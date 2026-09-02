import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";

export const load: ServerLoad = async ({ locals }) => {
  if (!locals.orgId) {
    return { apps: [] };
  }
  const isUserFromOrg = await app.repo.orgs.isUserFromOrg(
    locals.user?.id ?? "",
    locals.orgId,
  );
  if (!isUserFromOrg) {
    return { apps: [] };
  }

  const [appsWithSources, servers] = await Promise.all([
    app.repo.apps.listWithSources(locals.orgId),
    app.repo.servers.list(locals.orgId),
  ]);

  const serverNameById = new Map(servers.map((s) => [s.id, s.name]));

  return {
    apps: appsWithSources.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      status: a.status,
      activeColor: a.activeColor ?? null,
      serverId: a.serverId,
      serverName: serverNameById.get(a.serverId) ?? null,
      gitSource: a.gitSource
        ? {
            provider: a.gitSource.provider,
            repoSlug: a.gitSource.repoSlug,
            branch: a.gitSource.branch,
            shaDeployed: a.gitSource.shaDeployed,
            activeColor: a.gitSource.activeColor,
          }
        : null,
    })),
  };
};
