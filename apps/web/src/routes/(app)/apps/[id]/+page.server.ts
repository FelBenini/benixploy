import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { app } from "$lib/server/app";

function buildCommitUrl(
  baseUrl: string,
  provider: string,
  repoSlug: string,
  sha: string,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (provider === "gitlab") {
    return `${base}/${repoSlug}/-/commit/${sha}`;
  }
  return `${base}/${repoSlug}/commit/${sha}`;
}

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.orgId) {
    throw error(401, "Unauthorized");
  }

  const [existing, gitSource, deployment] = await Promise.all([
    app.repo.apps.get(locals.orgId, params.id),
    app.repo.gitSources.findByApp(params.id),
    app.repo.deployments.getLatest(locals.orgId, params.id),
  ]);

  if (!existing) {
    throw error(404, "App not found");
  }

  const server = await app.repo.servers.get(locals.orgId, existing.serverId);

  let traffic: {
    color: string | null;
    lastFlipAt: string | null;
    healthy: boolean;
  } | null = null;

  if (gitSource && existing.kind === "stateless") {
    const events = await app.repo.nodeEvents.getRecentEvents(
      existing.serverId,
      100,
    );
    const reload = events.find(
      (e) =>
        e.appId === existing.id && e.eventType.startsWith("traefik_reload"),
    );
    traffic = {
      color: gitSource.activeColor,
      lastFlipAt: reload?.receivedAt ?? null,
      healthy: !reload || reload.eventType === "traefik_reload_ok",
    };
  }

  let commitUrl: string | null = null;
  if (gitSource?.connectionId && gitSource.shaDeployed) {
    const connection = await app.repo.gitConnections.findGitConnectionById(
      gitSource.connectionId,
    );
    if (connection) {
      commitUrl = buildCommitUrl(
        connection.baseUrl,
        gitSource.provider,
        gitSource.repoSlug,
        gitSource.shaDeployed,
      );
    }
  }

  return {
    app: {
      id: existing.id,
      name: existing.name,
      kind: existing.kind,
      status: existing.status,
      activeColor: existing.activeColor ?? null,
      serverName: server?.name ?? null,
      createdAt: existing.createdAt,
    },
    gitSource: gitSource
      ? {
          provider: gitSource.provider,
          repoSlug: gitSource.repoSlug,
          cloneUrl: gitSource.cloneUrl,
          branch: gitSource.branch,
          shaDeployed: gitSource.shaDeployed,
          commitUrl,
          activeColor: gitSource.activeColor,
          warmColor: gitSource.warmColor,
          warmExpiresAt: gitSource.warmExpiresAt,
          lastPushAt: gitSource.lastPushAt,
        }
      : null,
    traffic,
    currentDeployment: deployment
      ? {
          id: deployment.id,
          version: deployment.version,
          status: deployment.status,
          createdAt: deployment.createdAt,
        }
      : null,
  };
};
