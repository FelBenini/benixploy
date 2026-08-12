import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { app } from "$lib/server/app";

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.orgId) {
    throw error(401, "Unauthorized");
  }

  const server = await app.repo.servers.get(locals.orgId, params.id);
  if (!server) {
    throw error(404, "Server not found");
  }

  return {
    server: {
      id: server.id,
      name: server.name,
      address: server.address,
      sshPort: server.sshPort,
      sshUser: server.sshUser,
      status: server.status,
      cpuCores: server.cpuCores,
      memoryBytes: server.memoryBytes,
      diskBytes: server.diskBytes,
      lastHeartbeatAt: server.lastHeartbeatAt,
      createdAt: server.createdAt,
    },
  };
};
