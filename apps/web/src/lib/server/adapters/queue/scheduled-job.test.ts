import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { GenericContainer } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { Redis } from "ioredis";
import { ScheduledJob } from "./scheduled-job";

let container: StartedTestContainer;
let redis: Redis;

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

describe("ScheduledJob", () => {
  it("fires the handler on the scheduled interval", async () => {
    let calls = 0;
    const job = new ScheduledJob(
      "test-job",
      redis,
      async () => {
        calls++;
      },
      150,
    );

    await job.start();
    await waitFor(() => calls >= 1, 5_000);
    await job.stop();

    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it("keeps firing across ticks", async () => {
    let calls = 0;
    const job = new ScheduledJob(
      "test-job-repeat",
      redis,
      async () => {
        calls++;
      },
      75,
    );

    await job.start();
    await waitFor(() => calls >= 2, 5_000);
    await job.stop();

    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("keeps ticking after a handler failure", async () => {
    let calls = 0;
    const job = new ScheduledJob(
      "test-job-failure",
      redis,
      async () => {
        calls++;
        throw new Error("sweep exploded");
      },
      75,
    );

    await job.start();
    await waitFor(() => calls >= 2, 5_000);
    await job.stop();

    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
