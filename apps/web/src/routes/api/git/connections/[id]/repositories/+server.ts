import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";
import { getGitProvider } from "$lib/server/adapters/git";

/**
 * Lists the repositories reachable by a git connection. Used by the
 * "New Git App" form to pick a repo.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await app.repo.gitConnections.findGitConnection(
    locals.orgId,
    params.id,
  );
  if (!connection) {
    return json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const repos = await getGitProvider(connection.provider).listRepositories(
      connection,
    );
    return json({ data: repos });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list repositories";
    return json({ error: message }, { status: 502 });
  }
};
