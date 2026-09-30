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
  /**
   * Active color for stateless blue/g deployments. When provided with
   * baseDomain, Traefik weighted-service labels are emitted so the active
   * color receives 100% traffic and the inactive color receives 0%.
   * ponytail: compose-label stopgap; #63 replaces with file-provider atomic flip.
   */
  activeColor?: "blue" | "green";
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

function buildService(
  appSpec: AppSpec,
  options: ComposeGenOptions | undefined,
  serviceName: string,
  includeTraefikLabels: boolean,
): Record<string, unknown> {
  const svc: Record<string, unknown> = {
    container_name: serviceName,
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

  if (includeTraefikLabels && options?.baseDomain) {
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

  return svc;
}

function buildWeightLabels(
  baseName: string,
  baseDomain: string,
  activeColor: "blue" | "green" | undefined,
  containerPort: number,
): string[] {
  const routerName = sanitize(baseName);
  const hostname = `${routerName}.${baseDomain}`;
  const blueWeight = activeColor === "green" ? 0 : 100;
  const greenWeight = activeColor === "green" ? 100 : 0;

  return [
    "traefik.enable=true",
    `traefik.http.routers.${routerName}.rule=Host(\`${hostname}\`)`,
    `traefik.http.routers.${routerName}.entrypoints=websecure`,
    `traefik.http.routers.${routerName}.tls.certresolver=letsencrypt`,
    `traefik.http.routers.${routerName}.service=${routerName}-weighted`,
    `traefik.http.services.${routerName}-weighted.weighted.services.${routerName}-blue.weight=${blueWeight}`,
    `traefik.http.services.${routerName}-weighted.weighted.services.${routerName}-green.weight=${greenWeight}`,
    `traefik.http.services.${routerName}-blue.loadbalancer.server.port=${containerPort}`,
    `traefik.http.services.${routerName}-green.loadbalancer.server.port=${containerPort}`,
  ];
}

/**
 * Stateless output has two services (`<name>-blue` / `<name>-green`).
 * Compose overrides written against the base service name `services.<name>`
 * are remapped onto both color services so existing override semantics
 * still apply to the blue/green pair.
 */
function remapStatelessServiceName(
  overrideObj: Record<string, unknown>,
  baseName: string,
): void {
  const services = overrideObj.services;
  if (
    services === null ||
    typeof services !== "object" ||
    Array.isArray(services)
  ) {
    return;
  }
  const serviceMap = services as Record<string, unknown>;
  if (serviceMap[baseName] === undefined) return;
  const fragment = serviceMap[baseName];
  delete serviceMap[baseName];
  serviceMap[`${baseName}-blue`] = structuredClone(fragment);
  serviceMap[`${baseName}-green`] = structuredClone(fragment);
}

export function generateComposeYaml(
  appSpec: AppSpec,
  options?: ComposeGenOptions,
): string {
  const kind = appSpec.kind ?? "stateless";
  const baseName = sanitize(appSpec.name);

  const services: Record<string, unknown> = {};
  if (kind === "stateless") {
    const containerPort =
      appSpec.ports.length > 0 ? appSpec.ports[0].container : 80;
    const weightLabels = options?.baseDomain
      ? buildWeightLabels(
          baseName,
          options.baseDomain,
          options.activeColor,
          containerPort,
        )
      : undefined;
    services[`${baseName}-blue`] = buildService(
      appSpec,
      options,
      `${baseName}-blue`,
      false,
    );
    services[`${baseName}-green`] = buildService(
      appSpec,
      options,
      `${baseName}-green`,
      false,
    );
    if (weightLabels) {
      (services[`${baseName}-blue`] as Record<string, unknown>).labels =
        weightLabels;
      (services[`${baseName}-green`] as Record<string, unknown>).labels =
        weightLabels;
    }
  } else {
    services[baseName] = buildService(appSpec, options, baseName, true);
  }

  const compose: Record<string, unknown> = { services };

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
    const overrideObj = load(appSpec.composeOverrides) as Record<
      string,
      unknown
    >;
    if (kind === "stateless") {
      remapStatelessServiceName(overrideObj, baseName);
    }
    const baseObj = load(yamlStr) as Record<string, unknown>;
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
