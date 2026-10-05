import { dump } from "js-yaml";
import type { App } from "$lib/server/domain/app";
import type { GitSource } from "$lib/server/domain/git-source";
import { sanitize } from "$lib/server/adapters/compose-gen";

/**
 * Traefik `file` provider dynamic configuration for a stateless app's
 * blue/green router. Pure and side-effect-free: the caller (the SSH adapter,
 * or the push-deploy orchestrator #64) is responsible for writing it.
 *
 * The router/upstream names derive from the sanitized app name so they match
 * the container names compose-gen emits (`<name>-blue` / `<name>-green`).
 */
const BASE_DOMAIN = "nip.io";
const DEFAULT_PORT = 8080;

export interface DynamicConfigOptions {
  /**
   * Container port the app listens on. Defaults to 8080.
   */
  port?: number;
}

export function generateDynamicConfig(
  app: App,
  gitSource: GitSource,
  options?: DynamicConfigOptions,
): string {
  if (app.kind !== "stateless") {
    throw new Error(
      `generateDynamicConfig is only valid for stateless apps (got "${app.kind}")`,
    );
  }

  const activeColor = gitSource.activeColor;
  if (!activeColor) {
    throw new Error("gitSource.activeColor is required to generate routing");
  }

  const name = sanitize(app.name);
  const port = options?.port ?? DEFAULT_PORT;

  const servers: Array<{ url: string; weight: number }> = [
    { url: `http://${name}-${activeColor}:${port}`, weight: 100 },
  ];
  if (gitSource.warmColor) {
    servers.push({
      url: `http://${name}-${gitSource.warmColor}:${port}`,
      weight: 0,
    });
  }

  const config = {
    http: {
      routers: {
        [name]: {
          rule: `Host(\`${name}.${BASE_DOMAIN}\`)`,
          service: `${name}-svc`,
          entryPoints: ["web"],
        },
      },
      services: {
        [`${name}-svc`]: {
          loadBalancer: {
            healthCheck: {
              path: "/health",
              interval: "5s",
              timeout: "2s",
            },
            servers,
          },
        },
      },
    },
  };

  return dump(config, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quoteStyle: "single",
  });
}
