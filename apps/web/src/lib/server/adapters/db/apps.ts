import { eq, and } from "drizzle-orm";
import type { AppRepository, AppWithSource } from "../../ports/repository";
import type { App } from "../../domain/app";
import type { ActiveColor } from "../../domain/git-source";
import type { GitProvider } from "../../domain/git-connection";
import type { DrizzleDB } from "./drizzle-repository";
import { apps, gitSources } from "../../db/schema";

function toDomain(row: typeof apps.$inferSelect): App {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as App["kind"],
    serverId: row.serverId,
    status: row.status as App["status"],
    activeColor: row.activeColor as ActiveColor | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleAppRepository implements AppRepository {
  constructor(private db: DrizzleDB) {}

  async create(orgId: string, data: App): Promise<App> {
    const [row] = await this.db
      .insert(apps)
      .values({
        id: data.id,
        orgId,
        serverId: data.serverId,
        name: data.name,
        kind: data.kind,
        status: data.status,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      })
      .returning();
    return toDomain(row);
  }

  async get(orgId: string, id: string): Promise<App | null> {
    const [row] = await this.db
      .select()
      .from(apps)
      .where(and(eq(apps.id, id), eq(apps.orgId, orgId)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async list(orgId: string): Promise<App[]> {
    const rows = await this.db.select().from(apps).where(eq(apps.orgId, orgId));
    return rows.map(toDomain);
  }

  async listWithSources(orgId: string): Promise<AppWithSource[]> {
    const rows = await this.db
      .select()
      .from(apps)
      .leftJoin(gitSources, eq(gitSources.appId, apps.id))
      .where(eq(apps.orgId, orgId));

    return rows.map(({ apps: appRow, git_sources: sourceRow }) => ({
      ...toDomain(appRow),
      gitSource: sourceRow
        ? {
            id: sourceRow.id,
            appId: sourceRow.appId,
            connectionId: sourceRow.connectionId,
            provider: sourceRow.provider as GitProvider,
            repoSlug: sourceRow.repoSlug,
            cloneUrl: sourceRow.cloneUrl,
            branch: sourceRow.branch,
            shaDeployed: sourceRow.shaDeployed,
            activeColor: sourceRow.activeColor as ActiveColor | null,
            warmColor: sourceRow.warmColor as ActiveColor | null,
            warmExpiresAt: sourceRow.warmExpiresAt
              ? sourceRow.warmExpiresAt.toISOString()
              : null,
            lastPushAt: sourceRow.lastPushAt
              ? sourceRow.lastPushAt.toISOString()
              : null,
            createdAt: sourceRow.createdAt.toISOString(),
            updatedAt: sourceRow.updatedAt.toISOString(),
          }
        : null,
    }));
  }

  async updateStatus(orgId: string, id: string, status: string): Promise<void> {
    await this.db
      .update(apps)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(apps.id, id), eq(apps.orgId, orgId)));
  }

  async delete(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(apps)
      .where(and(eq(apps.id, id), eq(apps.orgId, orgId)));
  }
}
