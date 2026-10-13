import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";

export const load: ServerLoad = async ({ locals }) => {
  if (!locals.orgId) return { connections: [], servers: [] };

  const isUserFromOrg = await app.repo.orgs.isUserFromOrg(
    locals.user?.id ?? "",
    locals.orgId,
  );
  if (!isUserFromOrg) return { connections: [], servers: [] };

  const [connections, servers] = await Promise.all([
    app.repo.gitConnections.listGitConnections(locals.orgId),
    app.repo.servers.list(locals.orgId),
  ]);

  return {
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      name: c.name,
      installed: c.externalId != null || c.authKind !== "github_app",
    })),
    servers: servers.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
    })),
  };
};
