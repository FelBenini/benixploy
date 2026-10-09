import type { Repository } from "../ports/repository";
import type { JobQueue } from "../ports/job-queue";
import type { GitProviderClient } from "../ports/git-provider-client";
import type { GitProvider } from "../domain/git-connection";
import { ProviderNotImplementedError } from "../ports/git-provider-client";

export interface WebhookResult {
  status: number;
  body?: unknown;
}

export function createHandleWebhook(
  repo: Repository,
  jobQueue: JobQueue | null,
  getProvider: (provider: GitProvider) => GitProviderClient,
) {
  return async function handleWebhook(
    connectionId: string,
    headers: Headers,
    rawBody: string,
  ): Promise<WebhookResult> {
    const connection =
      await repo.gitConnections.findGitConnectionById(connectionId);
    if (!connection) {
      return { status: 404, body: { error: "Unknown connection" } };
    }

    let client: GitProviderClient;
    try {
      client = getProvider(connection.provider);
    } catch (err) {
      if (err instanceof ProviderNotImplementedError) {
        return { status: 501, body: { error: err.message } };
      }
      throw err;
    }

    if (!client.verifyWebhookSignature(connection, headers, rawBody)) {
      return { status: 401, body: { error: "Invalid signature" } };
    }

    // GitHub ping only. Move per-provider ping detection behind the
    // GitProviderClient port when the gitlab/gitea/bitbucket adapters land.
    if (headers.get("x-github-event") === "ping") {
      return { status: 200, body: { status: "pong" } };
    }

    const push = client.parsePushEvent(connection, headers, rawBody);
    if (!push) {
      return { status: 204 };
    }

    const base = {
      connectionId: connection.id,
      provider: connection.provider,
      repoSlug: push.repoSlug,
      branch: push.branch,
      ref: `refs/heads/${push.branch}`,
      sha: push.sha,
      message: push.message,
      deliveryId: push.deliveryId || null,
      deployJobId: null,
    };

    const source = await repo.gitSources.findByCloneMatch(
      connection.id,
      push.repoSlug,
      push.branch,
    );
    if (!source) {
      await repo.pushEvents.create({
        ...base,
        appId: null,
        status: "skipped_untracked",
      });
      return { status: 204 };
    }

    if (!jobQueue) {
      return { status: 503, body: { error: "Deploy queue unavailable" } };
    }

    const event = await repo.pushEvents.create({
      ...base,
      appId: source.appId,
      status: "queued",
    });

    const result = await jobQueue.enqueue({
      appId: source.appId,
      pushEventId: event.id,
      sha: push.sha,
      repoSlug: push.repoSlug,
      branch: push.branch,
      cloneUrl: source.cloneUrl,
      connectionId: connection.id,
    });

    if (!result.queued) {
      await repo.pushEvents.updateStatus(event.id, "skipped_dupe");
      return { status: 204 };
    }

    return { status: 202, body: { pushEventId: event.id } };
  };
}
