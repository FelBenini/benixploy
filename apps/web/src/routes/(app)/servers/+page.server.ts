import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";

export const load: ServerLoad = async ({ locals }) => {
  if (!locals.orgId) {
    return { servers: [] };
  }
  const isUserFromOrg = await app.repo.orgs.isUserFromOrg(locals.user?.id ?? "", locals.orgId);
  if (!isUserFromOrg) {
    return { servers: [] };
  }
  const servers = await app.repo.servers.list(locals.orgId);
  return {
    servers: servers.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      sshPort: s.sshPort,
      sshUser: s.sshUser,
      status: s.status,
      cpuCores: s.cpuCores,
      memoryBytes: s.memoryBytes,
      diskBytes: s.diskBytes,
      lastHeartbeatAt: s.lastHeartbeatAt,
      createdAt: s.createdAt,
    })),
  };
};
