import { randomBytes } from "node:crypto";
import {
  OAUTH_STATE_TTL_SECONDS,
  type InstallStateClaims,
  type OAuthStateStore,
} from "../../ports/oauth-state-store";

interface RecordEntry {
  value: string;
  expiresAt: number;
}

export class InMemoryOAuthStateStore implements OAuthStateStore {
  private entries = new Map<string, RecordEntry>();

  constructor(private readonly ttlSeconds = OAUTH_STATE_TTL_SECONDS) {}

  async createManifestState(userId: string, orgId: string): Promise<string> {
    const nonce = randomBytes(32).toString("hex");
    this.entries.set(this.manifestKey(userId, orgId), {
      value: nonce,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
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
    this.entries.set(this.installKey(nonce), {
      value: JSON.stringify(claims),
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
    return nonce;
  }

  async consumeManifestState(userId: string, orgId: string): Promise<boolean> {
    const key = this.manifestKey(userId, orgId);
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return false;
    }
    this.entries.delete(key);
    return true;
  }

  async consumeInstallState(nonce: string): Promise<InstallStateClaims | null> {
    const key = this.installKey(nonce);
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    this.entries.delete(key);
    try {
      const claims = JSON.parse(entry.value) as InstallStateClaims;
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

  get size(): number {
    return this.entries.size;
  }

  private manifestKey(userId: string, orgId: string): string {
    return `manifest:${userId}:${orgId}`;
  }

  private installKey(nonce: string): string {
    return `install:${nonce}`;
  }
}
