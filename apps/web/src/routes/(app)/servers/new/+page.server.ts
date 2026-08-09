import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";

export const load: ServerLoad = async ({ url, locals }) => {
  const serverId = url.searchParams.get("server");
  if (!serverId || !locals.orgId) {
    return { resumeServer: null };
  }

  const server = await app.repo.servers.get(locals.orgId, serverId);
  if (!server) {
    return { resumeServer: null };
  }

  return {
    resumeServer: {
      id: server.id,
      name: server.name,
      address: server.address,
      sshPort: server.sshPort,
      sshUser: server.sshUser,
      status: server.status,
    },
  };
};
