import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { GenericContainer } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { Redis } from "ioredis";
import { RedisRateLimiter } from "./redis";

let container: StartedTestContainer;
let redis: Redis;

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

describe("RedisRateLimiter", () => {
  it("allows attempts up to the limit", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 3, 60_000);

    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(true);
  });

  it("denies the attempt that exceeds the limit", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 3, 60_000);

    await limiter.consume("k");
    await limiter.consume("k");
    await limiter.consume("k");

    const fourth = await limiter.consume("k");
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("counts same-millisecond hits separately", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 2, 60_000);

    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(false);
  });

  it("tracks distinct keys independently", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 1, 60_000);

    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(false);
    expect((await limiter.consume("b")).allowed).toBe(true);
  });

  it("allows attempts again once the window has rolled over", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 1, 50);

    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 60));

    expect((await limiter.consume("k")).allowed).toBe(true);
  });

  it("does not allow a burst of 2x limit across a window boundary", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 2, 200);

    expect((await limiter.consume("k")).allowed).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(false);
  });

  it("reset clears the counter for a key", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 1, 60_000);

    await limiter.consume("k");
    expect((await limiter.consume("k")).allowed).toBe(false);

    await limiter.reset("k");
    expect((await limiter.consume("k")).allowed).toBe(true);
  });

  it("reset does not affect other keys", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 1, 60_000);

    await limiter.consume("a");
    await limiter.consume("b");

    await limiter.reset("a");

    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("b")).allowed).toBe(false);
  });

  it("expires keys so stale windows are not kept", async () => {
    const limiter = new RedisRateLimiter(redis, "test", 5, 100);

    await limiter.consume("k");
    expect(await redis.exists("rl:test:k:hits")).toBe(1);

    await new Promise((r) => setTimeout(r, 1200));

    expect(await redis.exists("rl:test:k:hits")).toBe(0);
    expect(await redis.exists("rl:test:k:seq")).toBe(0);
  });
});
