import { eq, and } from "drizzle-orm";
import type { GitSourceRepository } from "../../ports/repository";
import type {
  GitSource,
  ActiveColor,
  UpsertGitSourceInput,
} from "../../domain/git-source";
import type { GitProvider } from "../../domain/git-connection";
import type { DrizzleDB } from "./drizzle-repository";
import { gitSources } from "../../db/schema";

function toDomain(row: typeof gitSources.$inferSelect): GitSource {
  return {
    id: row.id,
    appId: row.appId,
    connectionId: row.connectionId,
    provider: row.provider as GitProvider,
    repoSlug: row.repoSlug,
    cloneUrl: row.cloneUrl,
    branch: row.branch,
    shaDeployed: row.shaDeployed,
    activeColor: row.activeColor as ActiveColor | null,
    warmColor: row.warmColor as ActiveColor | null,
    warmExpiresAt: row.warmExpiresAt ? row.warmExpiresAt.toISOString() : null,
    lastPushAt: row.lastPushAt ? row.lastPushAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleGitSourceRepository implements GitSourceRepository {
  constructor(private db: DrizzleDB) {}

  async findByApp(appId: string): Promise<GitSource | null> {
    const [row] = await this.db
      .select()
      .from(gitSources)
      .where(eq(gitSources.appId, appId))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByCloneMatch(
    connectionId: string,
    repoSlug: string,
    branch: string,
  ): Promise<GitSource | null> {
    const [row] = await this.db
      .select()
      .from(gitSources)
      .where(
        and(
          eq(gitSources.connectionId, connectionId),
          eq(gitSources.repoSlug, repoSlug),
          eq(gitSources.branch, branch),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async upsert(input: UpsertGitSourceInput): Promise<GitSource> {
    const existing = await this.db
      .select()
      .from(gitSources)
      .where(eq(gitSources.appId, input.appId))
      .limit(1);

    const values = {
      connectionId: input.connectionId,
      provider: input.provider,
      repoSlug: input.repoSlug,
      cloneUrl: input.cloneUrl,
      branch: input.branch,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      const [row] = await this.db
        .update(gitSources)
        .set(values)
        .where(eq(gitSources.appId, input.appId))
        .returning();
      return toDomain(row);
    }

    const [row] = await this.db
      .insert(gitSources)
      .values({
        ...values,
        id: crypto.randomUUID(),
        appId: input.appId,
        createdAt: new Date(),
      })
      .returning();
    return toDomain(row);
  }

  async setActiveColor(appId: string, color: string): Promise<void> {
    await this.db
      .update(gitSources)
      .set({ activeColor: color, updatedAt: new Date() })
      .where(eq(gitSources.appId, appId));
  }

  async setWarmColor(
    appId: string,
    color: string,
    expiresAt: string,
  ): Promise<void> {
    await this.db
      .update(gitSources)
      .set({
        warmColor: color,
        warmExpiresAt: new Date(expiresAt),
        updatedAt: new Date(),
      })
      .where(eq(gitSources.appId, appId));
  }

  async clearWarmColor(appId: string): Promise<void> {
    await this.db
      .update(gitSources)
      .set({ warmColor: null, warmExpiresAt: null, updatedAt: new Date() })
      .where(eq(gitSources.appId, appId));
  }
}
