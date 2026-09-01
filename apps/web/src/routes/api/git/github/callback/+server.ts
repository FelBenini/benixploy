import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";
import { verifyInstallation } from "$lib/server/adapters/git/github";

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.session || !locals.orgId) {
    throw redirect(302, "/login");
  }

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

  // Anti-forgery check: the state is a one-time nonce issued with the
  // install URL and bound to the organization and connection it was created
  // for. Consuming it makes replay impossible and refuses installations
  // started by anyone else.
  const claims = await app.oauthStates.consumeInstallState(state);
  if (!claims) {
    throw redirect(302, "/git-sources?installed=error&reason=invalid_state");
  }

  if (claims.orgId !== locals.orgId) {
    throw redirect(302, "/git-sources?installed=error&reason=forbidden");
  }

  const conn = await app.repo.gitConnections.findGitConnectionById(
    claims.connectionId,
  );
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
