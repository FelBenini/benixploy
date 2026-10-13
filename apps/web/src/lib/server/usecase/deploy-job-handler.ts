import type { Repository } from "../ports/repository";
import type { NodeCommandClient } from "../ports/node-command-client";
import type { CloneAuth } from "../ports/git-provider-client";
import type { DeployJob, DeployJobHandler } from "../ports/job-queue";
import type { ActiveColor } from "../domain/git-source";
import type { AppSpec } from "../domain/app-spec";
import type { Deployment } from "../domain/deployment";
import { generateComposeYaml } from "../adapters/compose-gen";
import { generateDynamicConfig } from "../adapters/traefik/dynamic-config-writer";
import { waitForHealthy } from "./deploy-helpers";
import { WARM_RETENTION_MS } from "./rollback-app";

const VERIFY_TIMEOUT_MS = 90_000;

export interface PushDeployDeps {
  resolveCloneAuth?: (
    orgId: string,
    connectionId: string | null,
    repoSlug: string,
  ) => Promise<CloneAuth | undefined>;
  /**
   * Health-check verification timeout for the new color.
   * ponytail: defaults to 90s; override in tests to avoid long waits.
   */
  verifyTimeoutMs?: number;
}

/**
 * Push deploy orchestrator (#64): a git push to a tracked branch runs
 * build → deploy the inactive color → health verify → Traefik flip → drain
 * the old color warm. A failed push leaves the live color untouched.
 */
export function createDeployJobHandler(
  repo: Repository,
  nodeClient: NodeCommandClient,
  deps: PushDeployDeps = {},
): DeployJobHandler {
  return async function deployJob(job: DeployJob): Promise<void> {
    const { orgId, appId, pushEventId, sha, repoSlug, cloneUrl, connectionId } =
      job;

    const app = await repo.apps.get(orgId, appId);
    const source = await repo.gitSources.findByApp(appId);
    const latest = await repo.deployments.getLatest(orgId, appId);
    if (!app || !source || !latest || app.kind !== "stateless") {
      console.error(
        `push deploy: app ${appId} is not push-deployable ` +
          `(found=${!!app}, source=${!!source}, prior=${!!latest})`,
      );
      await repo.pushEvents.updateStatus(pushEventId, "failed");
      return;
    }

    // Snapshot before any repo update: the in-memory repo aliases rows.
    const previousColor = app.activeColor;
    const targetColor: ActiveColor =
      previousColor === "blue" ? "green" : "blue";
    const version = latest.version + 1;

    // Live env vars override the deployment snapshot.
    const {
      image: _image,
      buildContext: _context,
      ...baseSpec
    } = latest.appSpec;
    const composeSpec: AppSpec = {
      ...baseSpec,
      kind: "stateless",
      buildContext: source.cloneUrl,
      envVars: {
        ...latest.appSpec.envVars,
        ...(await repo.envVars.listByApp(orgId, appId)),
      },
    };
    const composeYaml = generateComposeYaml(composeSpec, { appId, version });

    await repo.pushEvents.updateStatus(pushEventId, "deploying");
    await repo.apps.updateStatus(orgId, appId, "deploying");
    await repo.nodeEvents.insertEvent(
      app.serverId,
      "deploy_started",
      { sha, color: targetColor, version },
      appId,
    );

    let colorUp = false;

    const fail = async (
      eventType: "build_failed" | "deploy_failed",
      err: unknown,
    ): Promise<void> => {
      if (colorUp) {
        try {
          await nodeClient.stopColor(app.serverId, appId, targetColor);
        } catch (cleanupErr) {
          console.error(
            `push deploy: cleanup of ${targetColor} failed for app ${appId}:`,
            cleanupErr,
          );
        }
      }

      const message = err instanceof Error ? err.message : "deploy failed";
      await repo.pushEvents.updateStatus(pushEventId, "failed");
      await repo.apps.updateStatus(orgId, appId, "degraded");
      await repo.nodeEvents.insertEvent(
        app.serverId,
        eventType,
        { sha, color: targetColor, reason: message },
        appId,
      );
      console.error(`push deploy failed for app ${appId} (${sha}):`, err);
    };

    try {
      const cloneAuth = deps.resolveCloneAuth
        ? await deps.resolveCloneAuth(orgId, connectionId, repoSlug)
        : undefined;

      try {
        await nodeClient.build(
          app.serverId,
          appId,
          composeYaml,
          cloneUrl,
          sha,
          cloneAuth,
        );
      } catch (err) {
        await fail("build_failed", err);
        return;
      }

      for await (const _entry of nodeClient.deployColor(
        app.serverId,
        appId,
        targetColor,
        composeYaml,
      )) {
        // Log entries yielded here
      }
      colorUp = true;

      const healthy = await waitForHealthy(
        nodeClient,
        app.serverId,
        appId,
        targetColor,
        deps.verifyTimeoutMs ?? VERIFY_TIMEOUT_MS,
      );
      if (!healthy) {
        throw new Error(`healthcheck_timeout for ${targetColor}`);
      }

      // Flip traffic: atomic dynamic-config write, Traefik reloads in ms.
      // The old color stays stopped-but-warm for instant rollback (#52).
      const config = generateDynamicConfig(
        app,
        {
          ...source,
          activeColor: targetColor,
          warmColor: previousColor ?? null,
        },
        composeSpec.ports.length > 0
          ? { port: composeSpec.ports[0].container }
          : undefined,
      );
      await nodeClient.writeTraefikDynamic(app.serverId, appId, config);

      if (previousColor) {
        try {
          await nodeClient.stopColor(app.serverId, appId, previousColor);
        } catch (err) {
          // Traffic already flipped; a failed drain must not fail the deploy.
          // The warm-color reaper stops it at window expiry.
          console.error(
            `push deploy: drain of ${previousColor} failed for app ${appId}:`,
            err,
          );
        }
      }

      const timestamp = new Date().toISOString();
      const warmExpiresAt = previousColor
        ? new Date(Date.now() + WARM_RETENTION_MS).toISOString()
        : null;

      await repo.apps.updateActiveColor(orgId, appId, targetColor);
      await repo.gitSources.setActiveColor(appId, targetColor);
      if (previousColor && warmExpiresAt) {
        await repo.gitSources.setWarmColor(appId, previousColor, warmExpiresAt);
      }
      await repo.gitSources.markDeployed(appId, sha, timestamp);

      const deployment: Deployment = {
        id: crypto.randomUUID(),
        appId,
        serverId: app.serverId,
        status: "healthy",
        appSpec: composeSpec,
        composeYaml,
        color: targetColor,
        version,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await repo.deployments.create(orgId, deployment);

      await repo.pushEvents.updateStatus(pushEventId, "success");
      await repo.apps.updateStatus(orgId, appId, "healthy");
      await repo.auditLogs.record({
        orgId,
        actorId: null,
        action: "deploy",
        resource: "app",
        resourceId: appId,
        details: {
          strategy: previousColor ? "blue_green_flip" : "first_deploy",
          sha,
          color: targetColor,
          warm: previousColor,
          version,
        },
        reasoning: `Push deploy ${sha.slice(0, 7)} to ${targetColor}`,
      });
      await repo.nodeEvents.insertEvent(
        app.serverId,
        "deploy_done",
        {
          sha,
          color: targetColor,
          warm: previousColor,
          expires: warmExpiresAt,
        },
        appId,
      );
    } catch (err) {
      await fail("deploy_failed", err);
    }
  };
}
