import { eq, desc, and, lt, gt, asc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { nodeEvents, nodeStats } from "../../db/schema/node-events";
import type { NodeEvent, NodeStats } from "../../domain/node-event";

export interface NodeEventRepository {
  insertEvent(
    serverId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<NodeEvent>;
  insertStats(
    serverId: string,
    stats: Omit<NodeStats, "id" | "receivedAt">,
  ): Promise<NodeStats>;
  getRecentEvents(
    serverId: string,
    limit?: number,
    since?: string,
  ): Promise<NodeEvent[]>;
  getLatestStats(serverId: string): Promise<NodeStats | null>;
  pruneEvents(olderThan: string): Promise<void>;
}

function toEventDomain(row: typeof nodeEvents.$inferSelect): NodeEvent {
  return {
    id: row.id,
    serverId: row.serverId,
    appId: row.appId ?? undefined,
    eventType: row.eventType as NodeEvent["eventType"],
    payload: row.payload as Record<string, unknown>,
    receivedAt: row.receivedAt.toISOString(),
  };
}

function toStatsDomain(row: typeof nodeStats.$inferSelect): NodeStats {
  return {
    id: row.id,
    serverId: row.serverId,
    cpuPercent: row.cpuPercent,
    memoryTotal: row.memoryTotal,
    memoryUsed: row.memoryUsed,
    memoryAvailable: row.memoryAvailable,
    diskTotal: row.diskTotal,
    diskUsed: row.diskUsed,
    uptime: row.uptime,
    containerCount: row.containerCount,
    containerStates: row.containerStates as NodeStats["containerStates"],
    receivedAt: row.receivedAt.toISOString(),
  };
}

export class DrizzleNodeEventRepository implements NodeEventRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async insertEvent(
    serverId: string,
    eventType: string,
    payload: Record<string, unknown>,
    appId?: string,
  ): Promise<NodeEvent> {
    const [row] = await this.db
      .insert(nodeEvents)
      .values({
        id: crypto.randomUUID(),
        serverId,
        appId: appId ?? null,
        eventType,
        payload,
        receivedAt: new Date(),
      })
      .returning();
    return toEventDomain(row);
  }

  async insertStats(
    serverId: string,
    stats: Omit<NodeStats, "id" | "receivedAt">,
  ): Promise<NodeStats> {
    const [row] = await this.db
      .insert(nodeStats)
      .values({
        id: crypto.randomUUID(),
        serverId,
        cpuPercent: stats.cpuPercent,
        memoryTotal: stats.memoryTotal,
        memoryUsed: stats.memoryUsed,
        memoryAvailable: stats.memoryAvailable,
        diskTotal: stats.diskTotal,
        diskUsed: stats.diskUsed,
        uptime: stats.uptime,
        containerCount: stats.containerCount,
        containerStates: stats.containerStates,
        receivedAt: new Date(),
      })
      .returning();
    return toStatsDomain(row);
  }

  async getRecentEvents(
    serverId: string,
    limit = 100,
    since?: string,
  ): Promise<NodeEvent[]> {
    const conditions = [eq(nodeEvents.serverId, serverId)];
    if (since) {
      conditions.push(gt(nodeEvents.receivedAt, new Date(since)));
    }

    const rows = await this.db
      .select()
      .from(nodeEvents)
      .where(and(...conditions))
      .orderBy(desc(nodeEvents.receivedAt))
      .limit(limit);

    return rows.map(toEventDomain);
  }

  async getLatestStats(serverId: string): Promise<NodeStats | null> {
    const [row] = await this.db
      .select()
      .from(nodeStats)
      .where(eq(nodeStats.serverId, serverId))
      .orderBy(desc(nodeStats.receivedAt))
      .limit(1);

    if (!row) return null;

    return toStatsDomain(row);
  }

  async getRecentStats(
    serverId: string,
    limit = 500,
    since?: string,
  ): Promise<NodeStats[]> {
    const conditions = [eq(nodeStats.serverId, serverId)];
    if (since) {
      conditions.push(gt(nodeStats.receivedAt, new Date(since)));
    }

    const rows = await this.db
      .select()
      .from(nodeStats)
      .where(and(...conditions))
      .orderBy(asc(nodeStats.receivedAt))
      .limit(limit);

    return rows.map(toStatsDomain);
  }

  async pruneEvents(olderThan: string): Promise<void> {
    await this.db
      .delete(nodeEvents)
      .where(lt(nodeEvents.receivedAt, new Date(olderThan)));
  }
}
