import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";
import { verifyInstallation } from "$lib/server/adapters/git/github";

export const GET: RequestHandler = async ({ url }) => {
  const setupAction = url.searchParams.get("setup_action");
  const installationId = url.searchParams.get("installation_id");
  const state = url.searchParams.get("state");

  if (setupAction === "request_pending") {
    throw redirect(302, "/git-sources?installed=pending");
  }

  if (setupAction !== "install" && setupAction !== "update") {
    throw redirect(302, "/git-sources?installed=error&reason=unexpected");
  }

  if (!installationId || !/^\d+$/.test(installationId)) {
    throw redirect(302, "/git-sources?installed=error&reason=no_installation");
  }

  if (!state) {
    throw redirect(302, "/git-sources?installed=error&reason=no_state");
  }

  const conn = await app.repo.gitConnections.findGitConnectionById(state);
  if (!conn) {
    throw redirect(
      302,
      "/git-sources?installed=error&reason=unknown_connection",
    );
  }

  const verified = await verifyInstallation(conn, installationId);
  if (!verified) {
    throw redirect(302, "/git-sources?installed=error&reason=verify_failed");
  }

  await app.repo.gitConnections.setExternalId(
    conn.orgId,
    conn.id,
    installationId,
  );

  throw redirect(302, "/git-sources?installed=ok");
};
