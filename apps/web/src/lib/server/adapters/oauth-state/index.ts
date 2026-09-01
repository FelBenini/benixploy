import type { Redis } from "ioredis";
import type { OAuthStateStore } from "../../ports/oauth-state-store";
import { RedisOAuthStateStore } from "./redis";
import { InMemoryOAuthStateStore } from "./in-memory";

export function createOAuthStateStore(
  redis: Redis | null,
  isDev: boolean,
): OAuthStateStore {
  if (redis == null) {
    if (!isDev) {
      throw new Error(
        "REDIS_URL is required in production: OAuth state must be stored in Redis",
      );
    }
    return new InMemoryOAuthStateStore();
  }

  return new RedisOAuthStateStore(redis);
}
