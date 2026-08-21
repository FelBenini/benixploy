import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";

export const load: ServerLoad = async ({ locals }) => {
  if (!locals.orgId) {
    return { connections: [] };
  }
  const connections = await app.repo.gitConnections.listGitConnections(
    locals.orgId,
  );
  return {
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      name: c.name,
      baseUrl: c.baseUrl,
      authKind: c.authKind,
      externalId: c.externalId ?? null,
      createdAt: c.createdAt,
    })),
  };
};
