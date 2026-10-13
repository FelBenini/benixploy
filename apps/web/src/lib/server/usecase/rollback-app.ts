import type { Repository } from "../ports/repository";
import type { NodeCommandClient } from "../ports/node-command-client";
import type { App } from "../domain/app";
import { generateComposeYaml } from "../adapters/compose-gen";

/**
 * How long a drained color is kept warm (stopped containers + images) after
 * cutover, so a rollback can flip traffic without rebuilding.
 * shortcut: fixed 1h window; make it per-app if an app ever needs otherwise.
 */
export const WARM_RETENTION_MS = 60 * 60 * 1000;

export interface RollbackAppResult {
  app: App;
  strategy: "blue_green_flip" | "classical";
  targetVersion: number;
}

export function createRollbackApp(
  repo: Repository,
  nodeClient: NodeCommandClient,
) {
  return async function rollbackApp(
    orgId: string,
    appId: string,
    actorId?: string,
  ): Promise<RollbackAppResult> {
    const app = await repo.apps.get(orgId, appId);
    if (!app) throw new Error("App not found");

    // Snapshot before any repo update: the in-memory repo aliases stored
    // rows, so reading mutable fields after an update would see them changed.
    const previousColor = app.activeColor;

    const deployments = (await repo.deployments.listForApp(orgId, appId)).sort(
      (a, b) => b.version - a.version,
    );
    const current = deployments[0];
    const prior = deployments[1];
    if (!current || !prior) {
      throw new Error("No prior deployment to roll back to");
    }

    const source = await repo.gitSources.findByApp(appId);
    const warmColor =
      source?.warmColor &&
      source.warmExpiresAt &&
      new Date(source.warmExpiresAt).getTime() > Date.now()
        ? source.warmColor
        : null;

    const flip = app.kind === "stateless" && warmColor !== null;
    const strategy = flip ? "blue_green_flip" : "classical";

    await repo.apps.updateStatus(orgId, appId, "deploying");

    try {
      const composeYaml =
        flip && warmColor
          ? generateComposeYaml(prior.appSpec, {
              appId,
              version: prior.version,
              activeColor: warmColor,
            })
          : (prior.composeYaml ??
            generateComposeYaml(prior.appSpec, {
              appId,
              version: prior.version,
            }));

      for await (const _entry of nodeClient.deploy(
        app.serverId,
        appId,
        composeYaml,
      )) {
        // Log entries yielded here
      }

      if (flip && warmColor) {
        await repo.apps.updateActiveColor(orgId, appId, warmColor);
        if (source) await repo.gitSources.setActiveColor(appId, warmColor);
        if (previousColor) {
          await nodeClient.stopColor(app.serverId, appId, previousColor);
          // The rolled-forward color takes the warm slot so flipping back is
          // just as fast.
          await repo.gitSources.setWarmColor(
            appId,
            previousColor,
            new Date(Date.now() + WARM_RETENTION_MS).toISOString(),
          );
        }
      } else if (source) {
        await repo.gitSources.clearWarmColor(appId);
      }

      await repo.deployments.updateStatus(orgId, current.id, "rolled_back");
      await repo.apps.updateStatus(orgId, appId, "healthy");
      await repo.auditLogs.record({
        orgId,
        actorId: actorId ?? null,
        action: "rollback",
        resource: "app",
        resourceId: appId,
        details: {
          strategy,
          fromVersion: current.version,
          toVersion: prior.version,
        },
        reasoning:
          strategy === "blue_green_flip"
            ? "Rollback via blue/green flip"
            : "Classical rollback",
      });
    } catch (err) {
      await repo.apps.updateStatus(orgId, appId, "degraded");
      throw err;
    }

    const finalApp = (await repo.apps.get(orgId, appId))!;
    return { app: finalApp, strategy, targetVersion: prior.version };
  };
}
