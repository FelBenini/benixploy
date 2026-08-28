import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";
import { getInstallUrl } from "$lib/server/adapters/git/github";

export const load: ServerLoad = async ({ locals, url }) => {
  if (!locals.orgId) {
    return { connections: [] };
  }
  const orgId = locals.orgId;
  const connections = await app.repo.gitConnections.listGitConnections(orgId);
  const withInstallUrl = await Promise.all(
    connections.map(async (c) => {
      if (
        c.provider === "github" &&
        c.authKind === "github_app" &&
        !c.externalId
      ) {
        const full = await app.repo.gitConnections.findGitConnection(
          orgId,
          c.id,
        );
        if (full) {
          try {
            const state = await app.oauthStates.createInstallState(orgId, c.id);
            return { ...c, installUrl: await getInstallUrl(full, state) };
          } catch {
            return c;
          }
        }
      }
      return c;
    }),
  );
  return {
    connections: withInstallUrl.map((c) => ({
      id: c.id,
      provider: c.provider,
      name: c.name,
      baseUrl: c.baseUrl,
      authKind: c.authKind,
      externalId: c.externalId ?? null,
      installUrl: "installUrl" in c ? c.installUrl : null,
      createdAt: c.createdAt,
    })),
    installed: url.searchParams.get("installed") ?? null,
  };
};
