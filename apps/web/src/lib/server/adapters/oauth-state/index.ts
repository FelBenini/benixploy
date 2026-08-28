import { Redis } from "ioredis";
import type { OAuthStateStore } from "../../ports/oauth-state-store";
import { RedisOAuthStateStore } from "./redis";
import { InMemoryOAuthStateStore } from "./in-memory";

function isConfigured(url: string | null | undefined): boolean {
  return typeof url === "string" && url.length > 0;
}

export function createOAuthStateStore(
  redisUrl: string | null | undefined,
  isDev: boolean,
): OAuthStateStore {
  if (!isConfigured(redisUrl)) {
    if (!isDev) {
      throw new Error(
        "REDIS_URL is required in production: OAuth state must be stored in Redis",
      );
    }
    return new InMemoryOAuthStateStore();
  }

  const client = new Redis(redisUrl as string, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
  });
  client.on("error", (err) => {
    console.error("oauth-state redis error:", err.message);
  });

  return new RedisOAuthStateStore(client);
}
