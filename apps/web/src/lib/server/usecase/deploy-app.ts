import type { Repository } from "../ports/repository";
import type { NodeCommandClient } from "../ports/node-command-client";
import type { CloneAuth } from "../ports/git-provider-client";
import type { App } from "../domain/app";
import type { AppSpec } from "../domain/app-spec";
import type { Deployment } from "../domain/deployment";
import { generateComposeYaml, isHttpUrl } from "../adapters/compose-gen";

export interface DeployAppOutput {
  app: App;
  deployment: Deployment;
}

export interface DeployAppDeps {
  /**
   * Resolve clone credentials for a git-sourced app spec. Returns undefined
   * for public repos or when no matching provider connection exists.
   */
  resolveCloneAuth?: (
    orgId: string,
    appSpec: AppSpec,
  ) => Promise<CloneAuth | undefined>;
  /**
   * Health-check verification timeout for stateless blue/green deploys.
   * ponytail: defaults to 60s; override in tests to avoid long waits.
   */
  verifyTimeoutMs?: number;
}

const VERIFY_POLL_INTERVAL_MS = 2_000;
const VERIFY_TIMEOUT_MS = 60_000;

async function waitForHealthy(
  nodeClient: NodeCommandClient,
  serverId: string,
  appId: string,
  color: "blue" | "green",
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const states = await nodeClient.colorStatus(serverId, appId, color);
    const healthy = states.some(
      (s) => s.state === "running" && s.health === "healthy",
    );
    if (healthy) return true;
    await new Promise((r) => setTimeout(r, VERIFY_POLL_INTERVAL_MS));
  }
  return false;
}

export function createDeployApp(
  repo: Repository,
  nodeClient: NodeCommandClient,
  deps: DeployAppDeps = {},
) {
  return async function deployApp(
    orgId: string,
    appSpec: AppSpec,
    serverId: string,
  ): Promise<DeployAppOutput> {
    const now = new Date().toISOString();

    const app: App = {
      id: crypto.randomUUID(),
      name: appSpec.name,
      kind: appSpec.kind ?? "stateless",
      serverId,
      status: "deploying",
      activeColor: null,
      createdAt: now,
      updatedAt: now,
    };

    const createdApp = await repo.apps.create(orgId, app);

    const version = 1;
    const deployment: Deployment = {
      id: crypto.randomUUID(),
      appId: createdApp.id,
      serverId,
      status: "pending",
      appSpec,
      version,
      createdAt: now,
      updatedAt: now,
    };

    const createdDeployment = await repo.deployments.create(orgId, deployment);

    const composeYaml = generateComposeYaml(appSpec, {
      appId: createdApp.id,
      version,
    });

    try {
      const buildContext = appSpec.buildContext;
      if (buildContext && isHttpUrl(buildContext)) {
        const cloneAuth = deps.resolveCloneAuth
          ? await deps.resolveCloneAuth(orgId, appSpec)
          : undefined;
        await nodeClient.build(
          serverId,
          createdApp.id,
          composeYaml,
          buildContext,
          undefined,
          cloneAuth,
        );
      }

      if (appSpec.kind === "stateful" || appSpec.kind === "database") {
        await repo.deployments.updateStatus(
          orgId,
          createdDeployment.id,
          "executing",
        );

        for await (const _entry of nodeClient.deploy(
          serverId,
          createdApp.id,
          composeYaml,
        )) {
          // Log entries yielded here; can be stored or forwarded
        }
      } else {
        // stateless blue/green flow
        const activeColor = createdApp.activeColor;
        const inactiveColor: "blue" | "green" =
          activeColor === "blue" ? "green" : "blue";
        const oldColor = activeColor ?? null;

        await repo.deployments.updateStatus(
          orgId,
          createdDeployment.id,
          "executing",
        );
        await repo.deployments.updateStatus(
          orgId,
          createdDeployment.id,
          "verifying_new",
        );

        for await (const _entry of nodeClient.deployColor(
          serverId,
          createdApp.id,
          inactiveColor,
          composeYaml,
        )) {
          // Log entries yielded here
        }

        const healthy = await waitForHealthy(
          nodeClient,
          serverId,
          createdApp.id,
          inactiveColor,
          deps.verifyTimeoutMs ?? VERIFY_TIMEOUT_MS,
        );
        if (!healthy) {
          await nodeClient.stopColor(
            serverId,
            createdApp.id,
            inactiveColor,
          );
          await repo.deployments.updateStatus(
            orgId,
            createdDeployment.id,
            "failed",
          );
          await repo.apps.updateStatus(orgId, createdApp.id, "degraded");
          throw new Error(
            `Health check timeout for ${inactiveColor} deployment`,
          );
        }

        await repo.deployments.updateStatus(
          orgId,
          createdDeployment.id,
          "cutover",
        );
        await repo.apps.updateActiveColor(
          orgId,
          createdApp.id,
          inactiveColor,
        );

        const cutoverCompose = generateComposeYaml(appSpec, {
          appId: createdApp.id,
          version,
          activeColor: inactiveColor,
        });
        for await (const _entry of nodeClient.deploy(
          serverId,
          createdApp.id,
          cutoverCompose,
        )) {
          // Log entries yielded here
        }

        await repo.deployments.updateStatus(
          orgId,
          createdDeployment.id,
          "drain_old",
        );
        if (oldColor) {
          await nodeClient.stopColor(
            serverId,
            createdApp.id,
            oldColor,
          );
        }
      }
    } catch (err) {
      await repo.deployments.updateStatus(
        orgId,
        createdDeployment.id,
        "failed",
      );
      await repo.apps.updateStatus(orgId, createdApp.id, "degraded");
      throw err;
    }

    await repo.deployments.updateStatus(orgId, createdDeployment.id, "healthy");
    await repo.apps.updateStatus(orgId, createdApp.id, "healthy");

    const finalApp = (await repo.apps.get(orgId, createdApp.id))!;
    const finalDeployment = (await repo.deployments.getLatest(
      orgId,
      createdApp.id,
    ))!;

    return { app: finalApp, deployment: finalDeployment };
  };
}
