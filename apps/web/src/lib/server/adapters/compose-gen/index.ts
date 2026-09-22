import { load, dump } from "js-yaml";
import type { AppSpec } from "$lib/server/domain/app-spec";

export interface ComposeGenOptions {
  baseDomain?: string;
  /**
   * App id — used to name images built from git-sourced build contexts.
   */
  appId?: string;
  /**
   * Deployment version — combined with `appId` into an image tag
   * (`benisploy/<appId>:v<version>`) so `docker compose build` tags the
   * built image deterministically.
   */
  version?: number;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function portString(container: number, protocol: string): string {
  if (protocol === "udp") return `${container}/udp`;
  return `${container}`;
}

function volumeString(source: string, target: string, mode: string): string {
  if (!mode || mode === "rw") return `${source}:${target}`;
  return `${source}:${target}:${mode}`;
}

function durationString(seconds: number): string {
  return `${seconds}s`;
}

function deepMerge(
  dst: Record<string, unknown>,
  src: Record<string, unknown>,
): void {
  for (const key of Object.keys(src)) {
    const srcVal = src[key];
    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal)
    ) {
      if (
        dst[key] !== null &&
        typeof dst[key] === "object" &&
        !Array.isArray(dst[key])
      ) {
        deepMerge(
          dst[key] as Record<string, unknown>,
          srcVal as Record<string, unknown>,
        );
        continue;
      }
    }
    dst[key] = srcVal;
  }
}

export function generateComposeYaml(
  appSpec: AppSpec,
  options?: ComposeGenOptions,
): string {
  const svc: Record<string, unknown> = {
    container_name: sanitize(appSpec.name),
  };

  if (appSpec.image) {
    svc.image = appSpec.image;
  } else if (appSpec.buildContext) {
    if (isHttpUrl(appSpec.buildContext)) {
      // The node clones the repo into the app's build-context directory
      // (build action), so the compose file points at the local context.
      // With appId+version, emit image tag so `docker compose build`
      // produces benisploy/<appId>:v<version> deterministically.
      svc.build = { context: "./build-context" };
      if (options?.appId && options.version) {
        svc.image = `benisploy/${sanitize(options.appId)}:v${options.version}`;
      }
    } else {
      svc.build = appSpec.buildContext;
    }
  }

  if (appSpec.envVars && Object.keys(appSpec.envVars).length > 0) {
    svc.environment = { ...appSpec.envVars };
  }

  if (appSpec.ports && appSpec.ports.length > 0) {
    svc.ports = appSpec.ports.map((p) => portString(p.container, p.protocol));
  }

  if (appSpec.volumeMounts && appSpec.volumeMounts.length > 0) {
    svc.volumes = appSpec.volumeMounts.map((v) =>
      volumeString(v.source, v.target, v.mode),
    );
  }

  if (appSpec.resourceLimits) {
    svc.deploy = {
      resources: {
        limits: {
          cpus: appSpec.resourceLimits.cpus,
          memory: `${appSpec.resourceLimits.memoryMB}M`,
        },
      },
    };
  }

  if (appSpec.healthCheck) {
    svc.healthcheck = {
      test: appSpec.healthCheck.test,
      interval: durationString(appSpec.healthCheck.interval),
      timeout: durationString(appSpec.healthCheck.timeout),
      retries: appSpec.healthCheck.retries,
      start_period: durationString(appSpec.healthCheck.startPeriod),
    };
  }

  if (options?.baseDomain) {
    const routerName = sanitize(appSpec.name);
    const hostname = `${routerName}.${options.baseDomain}`;
    const labels: string[] = [
      "traefik.enable=true",
      `traefik.http.routers.${routerName}.rule=Host(\`${hostname}\`)`,
      `traefik.http.routers.${routerName}.entrypoints=websecure`,
      `traefik.http.routers.${routerName}.tls.certresolver=letsencrypt`,
    ];

    const containerPort =
      appSpec.ports.length > 0 ? appSpec.ports[0].container : 80;
    labels.push(
      `traefik.http.services.${routerName}.loadbalancer.server.port=${containerPort}`,
    );

    svc.labels = labels;
  }

  const compose: Record<string, unknown> = {
    services: {
      [sanitize(appSpec.name)]: svc,
    },
  };

  // Declare named volumes (non-path sources) under top-level volumes
  if (appSpec.volumeMounts && appSpec.volumeMounts.length > 0) {
    const namedVolumes = appSpec.volumeMounts
      .filter((v) => !v.source.startsWith("/") && !v.source.startsWith("."))
      .map((v) => v.source);

    if (namedVolumes.length > 0) {
      const volumes: Record<string, unknown> = {};
      for (const name of namedVolumes) {
        volumes[name] = null;
      }
      compose.volumes = volumes;
    }
  }

  let yamlStr = dump(compose, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quoteStyle: "single",
  });

  // Apply compose overrides via deep merge
  if (appSpec.composeOverrides) {
    const baseObj = load(yamlStr) as Record<string, unknown>;
    const overrideObj = load(appSpec.composeOverrides) as Record<
      string,
      unknown
    >;
    deepMerge(baseObj, overrideObj);
    yamlStr = dump(baseObj, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
      quoteStyle: "single",
    });
  }

  return yamlStr;
}
