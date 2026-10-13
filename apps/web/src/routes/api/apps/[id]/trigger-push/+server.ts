import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { app } from "$lib/server/app";

/**
 * Manual push-deploy trigger for testing the orchestrator without a real
 * webhook. Creates a push event and enqueues the same DeployJob the webhook
 * receiver would.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.session || !locals.orgId) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetApp = await app.repo.apps.get(locals.orgId, params.id);
  if (!targetApp) {
    return json({ error: "App not found" }, { status: 404 });
  }

  const source = await app.repo.gitSources.findByApp(targetApp.id);
  if (!source) {
    return json({ error: "App has no git source" }, { status: 400 });
  }
  if (!source.connectionId) {
    return json(
      { error: "App has no git connection to resolve clone auth" },
      { status: 400 },
    );
  }
  if (!app.jobQueue) {
    return json({ error: "Deploy queue unavailable" }, { status: 503 });
  }

  let body: { sha?: string; branch?: string } = {};
  try {
    body = (await request.json()) as { sha?: string; branch?: string };
  } catch {
    // Empty body is fine — defaults are used.
  }

  const sha = body.sha?.trim() || `test-${Date.now()}`;
  const branch = body.branch?.trim() || source.branch;

  const event = await app.repo.pushEvents.create({
    appId: targetApp.id,
    connectionId: source.connectionId,
    provider: source.provider,
    repoSlug: source.repoSlug,
    branch,
    ref: `refs/heads/${branch}`,
    sha,
    message: "Manual test push",
    deliveryId: null,
    status: "queued",
    deployJobId: null,
  });

  const result = await app.jobQueue.enqueue({
    orgId: locals.orgId,
    appId: targetApp.id,
    pushEventId: event.id,
    sha,
    repoSlug: source.repoSlug,
    branch,
    cloneUrl: source.cloneUrl,
    connectionId: source.connectionId,
  });

  if (!result.queued) {
    await app.repo.pushEvents.updateStatus(event.id, "skipped_dupe");
    return json(
      { error: "A deploy is already in flight for this app" },
      { status: 409 },
    );
  }

  return json(
    { data: { pushEventId: event.id, sha, branch, status: "queued" } },
    { status: 202 },
  );
};
