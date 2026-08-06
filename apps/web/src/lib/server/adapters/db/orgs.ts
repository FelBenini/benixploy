import { and, eq, inArray } from "drizzle-orm";
import type { DbExecutor, OrgRepository } from "../../ports/repository";
import type { Org } from "../../domain/org";
import type { DrizzleDB } from "./drizzle-repository";
import { orgMemberships, orgs } from "../../db/schema";

function toDomain(row: typeof orgs.$inferSelect): Org {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleOrgRepository implements OrgRepository {
  constructor(private db: DrizzleDB) {}

  async create(db: DbExecutor, org: Org): Promise<Org> {
    const [row] = await (db
      .insert(orgs)
      .values({
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      })
      .returning() as Promise<(typeof orgs.$inferSelect)[]>);
    return toDomain(row);
  }

  async getById(id: string): Promise<Org | null> {
    const [row] = await this.db
      .select()
      .from(orgs)
      .where(eq(orgs.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async listByIds(ids: string[]): Promise<Org[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(orgs).where(inArray(orgs.id, ids));
    return rows.map(toDomain);
  }

  async isUserFromOrg(userId: string, orgId: string): Promise<boolean> {
    if (!userId || !orgId) return false;
    const [row] = await this.db
      .select()
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.orgId, orgId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }
}
