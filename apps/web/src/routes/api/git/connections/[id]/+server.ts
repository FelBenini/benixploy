import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  await app.repo.gitConnections.removeGitConnection(locals.orgId, params.id);
  return json({ data: { id: params.id } });
};
