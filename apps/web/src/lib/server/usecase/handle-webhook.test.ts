import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { createHandleWebhook } from "./handle-webhook";
import { InMemoryRepository } from "./test-utils";
import { getGitProvider } from "../adapters/git";
import type { DeployJob, EnqueueResult, JobQueue } from "../ports/job-queue";

const SECRET = "test-secret";
const ORG = "org-1";
const CONN_ID = "conn-1";
const REPO_SLUG = "octocat/hello";
const BRANCH = "main";

async function seedConnection(repo: InMemoryRepository): Promise<void> {
  await repo.gitConnections.upsertGitConnection(ORG, {
    id: CONN_ID,
    authKind: "github_app",
    provider: "github",
    name: "GH",
    baseUrl: "https://github.com",
    credentials: {
      appId: "1",
      clientId: "cid",
      privateKeyPem: "-----BEGIN PRIVATE KEY-----",
    },
    webhookSecret: SECRET,
  });
}

async function seedSource(repo: InMemoryRepository): Promise<void> {
  await repo.gitSources.upsert({
    appId: "app-1",
    connectionId: CONN_ID,
    provider: "github",
    repoSlug: REPO_SLUG,
    cloneUrl: `https://github.com/${REPO_SLUG}.git`,
    branch: BRANCH,
  });
}

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
}

function headersFor(body: string, event = "push"): Headers {
  return new Headers({
    "x-github-event": event,
    "x-github-delivery": "deliv-1",
    "x-hub-signature-256": sign(body),
  });
}

function pushPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ref: `refs/heads/${BRANCH}`,
    after: "abc123",
    repository: {
      full_name: REPO_SLUG,
      clone_url: `https://github.com/${REPO_SLUG}.git`,
    },
    head_commit: { message: "fix: thing" },
    ...overrides,
  });
}

function fakeQueue(
  result: EnqueueResult = { queued: true },
): JobQueue & { calls: DeployJob[] } {
  const calls: DeployJob[] = [];
  return {
    calls,
    async enqueue(job) {
      calls.push(job);
      return result;
    },
    start() {},
    async stop() {},
  };
}

describe("handleWebhook", () => {
  it("returns 404 for an unknown connection", async () => {
    const repo = new InMemoryRepository();
    const handle = createHandleWebhook(repo, fakeQueue(), getGitProvider);

    const body = pushPayload();
    const result = await handle("nope", headersFor(body), body);

    expect(result.status).toBe(404);
  });

  it("returns 401 on a bad signature and records nothing", async () => {
    const repo = new InMemoryRepository();
    await seedConnection(repo);
    const handle = createHandleWebhook(repo, fakeQueue(), getGitProvider);

    const body = pushPayload();
    const headers = new Headers({
      "x-github-event": "push",
      "x-hub-signature-256": "sha256=deadbeef",
    });
    const result = await handle(CONN_ID, headers, body);

    expect(result.status).toBe(401);
    expect(repo.pushEvents.data.size).toBe(0);
  });

  it("answers a ping with 200 and records nothing", async () => {
    const repo = new InMemoryRepository();
    await seedConnection(repo);
    const handle = createHandleWebhook(repo, fakeQueue(), getGitProvider);

    const body = JSON.stringify({ zen: "Keep it logically awesome." });
    const result = await handle(CONN_ID, headersFor(body, "ping"), body);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "pong" });
    expect(repo.pushEvents.data.size).toBe(0);
  });

  it("returns 204 for a non-push event", async () => {
    const repo = new InMemoryRepository();
    await seedConnection(repo);
    const handle = createHandleWebhook(repo, fakeQueue(), getGitProvider);

    const body = JSON.stringify({ action: "opened" });
    const result = await handle(
      CONN_ID,
      headersFor(body, "pull_request"),
      body,
    );

    expect(result.status).toBe(204);
    expect(repo.pushEvents.data.size).toBe(0);
  });

  it("records an untracked branch and does not enqueue", async () => {
    const repo = new InMemoryRepository();
    await seedConnection(repo);
    const queue = fakeQueue();
    const handle = createHandleWebhook(repo, queue, getGitProvider);

    const body = pushPayload();
    const result = await handle(CONN_ID, headersFor(body), body);

    expect(result.status).toBe(204);
    expect(queue.calls).toHaveLength(0);
    const [event] = Array.from(repo.pushEvents.data.values());
    expect(event.status).toBe("skipped_untracked");
    expect(event.appId).toBeNull();
    expect(event.sha).toBe("abc123");
  });

  it("enqueues a tracked push, records it as queued, and returns 202", async () => {
    const repo = new InMemoryRepository();
    await seedConnection(repo);
    await seedSource(repo);
    const queue = fakeQueue({ queued: true });
    const handle = createHandleWebhook(repo, queue, getGitProvider);

    const body = pushPayload();
    const result = await handle(CONN_ID, headersFor(body), body);

    expect(result.status).toBe(202);
    expect(queue.calls).toHaveLength(1);
    expect(queue.calls[0]).toMatchObject({
      appId: "app-1",
      connectionId: CONN_ID,
      sha: "abc123",
      repoSlug: REPO_SLUG,
      branch: BRANCH,
      cloneUrl: `https://github.com/${REPO_SLUG}.git`,
    });
    const [event] = await repo.pushEvents.findByAppId("app-1");
    expect(event.status).toBe("queued");
    expect(queue.calls[0].pushEventId).toBe(event.id);
  });

  it("records an in-flight duplicate as skipped_dupe", async () => {
    const repo = new InMemoryRepository();
    await seedConnection(repo);
    await seedSource(repo);
    const queue = fakeQueue({ queued: false, reason: "in-flight" });
    const handle = createHandleWebhook(repo, queue, getGitProvider);

    const body = pushPayload();
    const result = await handle(CONN_ID, headersFor(body), body);

    expect(result.status).toBe(204);
    const [event] = await repo.pushEvents.findByAppId("app-1");
    expect(event.status).toBe("skipped_dupe");
  });

  it("returns 503 when a tracked push arrives with no queue configured", async () => {
    const repo = new InMemoryRepository();
    await seedConnection(repo);
    await seedSource(repo);
    const handle = createHandleWebhook(repo, null, getGitProvider);

    const body = pushPayload();
    const result = await handle(CONN_ID, headersFor(body), body);

    expect(result.status).toBe(503);
    expect(repo.pushEvents.data.size).toBe(0);
  });
});
