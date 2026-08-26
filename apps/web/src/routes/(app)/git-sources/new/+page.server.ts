import type { ServerLoad } from "@sveltejs/kit";
import { app } from "$lib/server/app";
import { getInstallUrl } from "$lib/server/adapters/git/github";

export const load: ServerLoad = async ({ locals, url }) => {
  if (!locals.orgId) return { install: null };
  const id = url.searchParams.get("id");
  if (!id) return { install: null };

  const conn = await app.repo.gitConnections.findGitConnection(
    locals.orgId,
    id,
  );
  if (!conn || conn.provider !== "github" || conn.authKind !== "github_app") {
    return { install: null };
  }
  if (conn.externalId) {
    return {
      install: { id: conn.id, alreadyInstalled: true, installUrl: null },
    };
  }

  const installUrl = await getInstallUrl(conn).catch(() => null);
  return { install: { id: conn.id, alreadyInstalled: false, installUrl } };
};
