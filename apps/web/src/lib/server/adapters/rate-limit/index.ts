import type { Redis } from "ioredis";
import type { RateLimiter } from "../../ports/rate-limiter";
import { RedisRateLimiter } from "./redis";
import { InMemoryRateLimiter } from "./in-memory";

export const LOGIN_IP_LIMIT = 20;
export const LOGIN_ACCOUNT_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Redis-backed sliding-window limiters, shared across replicas. Falls back to
 * per-process in-memory state in dev without Redis.
 */
export function createLoginRateLimiters(redis: Redis | null): {
  loginByIp: RateLimiter;
  loginByAccount: RateLimiter;
} {
  const create = (prefix: string, limit: number): RateLimiter =>
    redis == null
      ? new InMemoryRateLimiter(limit, LOGIN_WINDOW_MS)
      : new RedisRateLimiter(redis, `login:${prefix}`, limit, LOGIN_WINDOW_MS);

  return {
    loginByIp: create("ip", LOGIN_IP_LIMIT),
    loginByAccount: create("account", LOGIN_ACCOUNT_LIMIT),
  };
}
