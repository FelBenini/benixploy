import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { GenericContainer } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { Redis } from "ioredis";
import { RedisJobQueue } from "./redis-job-queue";
import type { DeployJob } from "../../ports/job-queue";

let container: StartedTestContainer;
let redis: Redis;

function job(appId: string): DeployJob {
  return {
    orgId: "org-1",
    appId,
    pushEventId: `pe-${appId}`,
    sha: "abc123",
    repoSlug: "octocat/hello",
    branch: "main",
    cloneUrl: "https://github.com/octocat/hello.git",
    connectionId: "conn-1",
  };
}

async function waitFor(
  cond: () => boolean | Promise<boolean>,
  ms = 5_000,
): Promise<void> {
  const started = Date.now();
  while (!(await cond())) {
    if (Date.now() - started > ms) throw new Error("waitFor timeout");
    await new Promise((r) => setTimeout(r, 25));
  }
}

beforeAll(async () => {
  container = await new GenericContainer("redis:7-alpine")
    .withExposedPorts(6379)
    .start();
  redis = new Redis(container.getMappedPort(6379), container.getHost(), {
    maxRetriesPerRequest: 1,
  });
}, 120_000);

afterAll(async () => {
  redis?.disconnect();
  await container?.stop();
}, 30_000);

beforeEach(async () => {
  await redis.flushdb();
});

describe("RedisJobQueue", () => {
  it("drops a second enqueue while an app is in flight", async () => {
    const queue = new RedisJobQueue(redis);

    expect(await queue.enqueue(job("app-1"))).toEqual({ queued: true });
    expect(await queue.enqueue(job("app-1"))).toEqual({
      queued: false,
      reason: "in-flight",
    });
    expect(await queue.enqueue(job("app-2"))).toEqual({ queued: true });
    await queue.stop();
  });

  it("drains queued jobs in order and frees the app for re-enqueue", async () => {
    const queue = new RedisJobQueue(redis);
    const seen: string[] = [];
    queue.start(async (j) => {
      seen.push(j.appId);
    });

    await queue.enqueue(job("app-a"));
    await queue.enqueue(job("app-b"));

    await waitFor(() => seen.length === 2);
    expect(seen).toEqual(["app-a", "app-b"]);

    // The poll that turns queued:true is the release assertion.
    await waitFor(async () => (await queue.enqueue(job("app-a"))).queued);
    await queue.stop();
  });

  it("releases the app after a failed handler", async () => {
    const queue = new RedisJobQueue(redis);
    queue.start(async () => {
      throw new Error("deploy exploded");
    });

    await queue.enqueue(job("app-a"));
    await waitFor(async () => (await queue.enqueue(job("app-a"))).queued);
    await queue.stop();
  });
});
