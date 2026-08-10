import { eq, and } from "drizzle-orm";
import type { ServerRepository, ServerWithOrg } from "../../ports/repository";
import type { Server } from "../../domain/server";
import type { DrizzleDB } from "./drizzle-repository";
import { servers } from "../../db/schema";

export type FieldTransform = (value: string) => string;

function toDomain(
  row: typeof servers.$inferSelect,
  decryptPrivateKey?: FieldTransform,
): Server {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    sshPort: row.sshPort,
    sshUser: row.sshUser,
    sshPrivateKey: decryptPrivateKey
      ? decryptPrivateKey(row.sshPrivateKey)
      : row.sshPrivateKey,
    status: row.status as Server["status"],
    cpuCores: row.cpuCores,
    memoryBytes: row.memoryBytes,
    diskBytes: row.diskBytes,
    labels: row.labels as Record<string, string>,
    hostKeyFingerprint: row.hostKeyFingerprint,
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleServerRepository implements ServerRepository {
  constructor(
    private db: DrizzleDB,
    private encryptPrivateKey?: FieldTransform,
    private decryptPrivateKey?: FieldTransform,
  ) {}

  async create(orgId: string, input: Server): Promise<Server> {
    const [row] = await this.db
      .insert(servers)
      .values({
        id: input.id,
        orgId,
        name: input.name,
        address: input.address,
        sshPort: input.sshPort,
        sshUser: input.sshUser,
        sshPrivateKey: this.encryptPrivateKey
          ? this.encryptPrivateKey(input.sshPrivateKey)
          : input.sshPrivateKey,
        status: input.status,
        cpuCores: input.cpuCores,
        memoryBytes: input.memoryBytes,
        diskBytes: input.diskBytes,
        labels: input.labels,
        hostKeyFingerprint: input.hostKeyFingerprint ?? null,
        lastHeartbeatAt: input.lastHeartbeatAt
          ? new Date(input.lastHeartbeatAt)
          : null,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
      })
      .returning();
    return toDomain(row, this.decryptPrivateKey);
  }

  async get(orgId: string, id: string): Promise<Server | null> {
    const [row] = await this.db
      .select()
      .from(servers)
      .where(and(eq(servers.id, id), eq(servers.orgId, orgId)))
      .limit(1);
    return row ? toDomain(row, this.decryptPrivateKey) : null;
  }

  async getByIdAny(id: string): Promise<ServerWithOrg | null> {
    const [row] = await this.db
      .select()
      .from(servers)
      .where(eq(servers.id, id))
      .limit(1);
    if (!row) return null;
    return { ...toDomain(row, this.decryptPrivateKey), orgId: row.orgId };
  }

  async list(orgId: string): Promise<Server[]> {
    const rows = await this.db
      .select()
      .from(servers)
      .where(eq(servers.orgId, orgId));
    return rows.map((r) => toDomain(r, this.decryptPrivateKey));
  }

  async updateStatus(orgId: string, id: string, status: string): Promise<void> {
    await this.db
      .update(servers)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(servers.id, id), eq(servers.orgId, orgId)));
  }

  async updateHeartbeat(orgId: string, id: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(servers)
      .set({ status: "online", lastHeartbeatAt: now, updatedAt: now })
      .where(and(eq(servers.id, id), eq(servers.orgId, orgId)));
  }

  async provision(
    orgId: string,
    id: string,
    data: {
      sshPrivateKey: string;
      sshUser: string;
      cpuCores: number;
      memoryBytes: number;
      diskBytes: number;
      status: string;
      lastHeartbeatAt: string;
      hostKeyFingerprint?: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(servers)
      .set({
        sshPrivateKey: this.encryptPrivateKey
          ? this.encryptPrivateKey(data.sshPrivateKey)
          : data.sshPrivateKey,
        sshUser: data.sshUser,
        cpuCores: data.cpuCores,
        memoryBytes: data.memoryBytes,
        diskBytes: data.diskBytes,
        status: data.status,
        lastHeartbeatAt: new Date(data.lastHeartbeatAt),
        hostKeyFingerprint: data.hostKeyFingerprint ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(servers.id, id), eq(servers.orgId, orgId)));
  }

  async updateConnection(
    orgId: string,
    id: string,
    data: { name?: string; address?: string; sshPort?: number },
  ): Promise<Server> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.address !== undefined) updates.address = data.address;
    if (data.sshPort !== undefined) updates.sshPort = data.sshPort;

    const [row] = await this.db
      .update(servers)
      .set(updates)
      .where(and(eq(servers.id, id), eq(servers.orgId, orgId)))
      .returning();

    return toDomain(row, this.decryptPrivateKey);
  }
}
