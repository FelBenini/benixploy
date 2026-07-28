import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { registeredNodes } from "../../db/schema/registered-nodes";
import type {
  RegisteredNode,
  CreateRegisteredNodeInput,
} from "../../domain/registered-node";

function toDomain(row: typeof registeredNodes.$inferSelect): RegisteredNode {
  return {
    id: row.id,
    serverId: row.serverId,
    sshPublicKey: row.sshPublicKey,
    monitorBearerToken: row.monitorBearerToken,
    status: row.status as RegisteredNode["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleRegisteredNodeRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async create(
    input: CreateRegisteredNodeInput & { id: string },
  ): Promise<RegisteredNode> {
    const [row] = await this.db
      .insert(registeredNodes)
      .values({
        id: input.id,
        serverId: input.serverId,
        sshPublicKey: input.sshPublicKey,
        monitorBearerToken: input.monitorBearerToken,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return toDomain(row);
  }

  async getByServer(serverId: string): Promise<RegisteredNode | null> {
    const [row] = await this.db
      .select()
      .from(registeredNodes)
      .where(eq(registeredNodes.serverId, serverId));

    if (!row) return null;
    return toDomain(row);
  }

  async updateStatus(serverId: string, status: string): Promise<void> {
    await this.db
      .update(registeredNodes)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(registeredNodes.serverId, serverId));
  }

  async delete(serverId: string): Promise<void> {
    await this.db
      .delete(registeredNodes)
      .where(eq(registeredNodes.serverId, serverId));
  }
}
