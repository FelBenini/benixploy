import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";

export const load: ServerLoad = async ({ locals }) => {
  if (!locals.orgId) return { apps: [] };

  const isUserFromOrg = await app.repo.orgs.isUserFromOrg(
    locals.user?.id ?? "",
    locals.orgId,
  );
  if (!isUserFromOrg) return { apps: [] };

  const [appsWithSources, servers] = await Promise.all([
    app.repo.apps.listWithSources(locals.orgId),
    app.repo.servers.list(locals.orgId),
  ]);
  const serverNameById = new Map(servers.map((s) => [s.id, s.name]));

  const deployable = appsWithSources.filter(
    (a) => a.kind === "stateless" && a.gitSource?.connectionId,
  );

  const apps = await Promise.all(
    deployable.map(async (a) => {
      const source = a.gitSource!;
      const [latestEvent] = await app.repo.pushEvents.findByAppId(a.id, 1);
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        serverName: serverNameById.get(a.serverId) ?? null,
        repoSlug: source.repoSlug,
        branch: source.branch,
        shaDeployed: source.shaDeployed,
        activeColor: source.activeColor,
        warmColor: source.warmColor,
        lastEvent: latestEvent
          ? {
              sha: latestEvent.sha,
              status: latestEvent.status,
              receivedAt: latestEvent.receivedAt,
            }
          : null,
      };
    }),
  );

  return { apps };
};
