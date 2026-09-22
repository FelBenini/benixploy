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

    await repo.deployments.updateStatus(
      orgId,
      createdDeployment.id,
      "executing",
    );

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
        // commit is omitted here — the node checks out the default branch
        // HEAD. Push-specific SHAs are wired in by the push-deploy
        // orchestrator (issue #64).
        await nodeClient.build(
          serverId,
          createdApp.id,
          composeYaml,
          buildContext,
          undefined,
          cloneAuth,
        );
      }

      for await (const _entry of nodeClient.deploy(
        serverId,
        createdApp.id,
        composeYaml,
      )) {
        // Log entries yielded here; can be stored or forwarded
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
