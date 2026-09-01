import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import {
  OAUTH_STATE_TTL_SECONDS,
  type InstallStateClaims,
  type OAuthStateStore,
} from "../../ports/oauth-state-store";

function manifestKey(userId: string, orgId: string): string {
  return `github:oauth:manifest:${userId}:${orgId}`;
}

function installKey(nonce: string): string {
  return `github:oauth:install:${nonce}`;
}

export class RedisOAuthStateStore implements OAuthStateStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = OAUTH_STATE_TTL_SECONDS,
  ) {}

  async createManifestState(userId: string, orgId: string): Promise<string> {
    const nonce = randomBytes(32).toString("hex");
    await this.redis.setex(manifestKey(userId, orgId), this.ttlSeconds, nonce);
    return nonce;
  }

  async createInstallState(
    orgId: string,
    connectionId: string,
  ): Promise<string> {
    const nonce = randomBytes(32).toString("hex");
    const claims: InstallStateClaims = {
      purpose: "install",
      orgId,
      connectionId,
    };
    await this.redis.setex(
      installKey(nonce),
      this.ttlSeconds,
      JSON.stringify(claims),
    );
    return nonce;
  }

  async consumeManifestState(userId: string, orgId: string): Promise<boolean> {
    const nonce = await this.redis.getdel(manifestKey(userId, orgId));
    return nonce !== null;
  }

  async consumeInstallState(nonce: string): Promise<InstallStateClaims | null> {
    const raw = await this.redis.getdel(installKey(nonce));
    if (raw === null) return null;
    try {
      const claims = JSON.parse(raw) as InstallStateClaims;
      if (
        claims?.purpose !== "install" ||
        !claims.orgId ||
        !claims.connectionId
      ) {
        return null;
      }
      return claims;
    } catch {
      return null;
    }
  }
}
