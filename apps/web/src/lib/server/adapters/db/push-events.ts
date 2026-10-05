import { eq, and, desc, inArray } from "drizzle-orm";
import type { PushEventRepository } from "../../ports/repository";
import type {
  PushEvent,
  PushEventStatus,
  CreatePushEventInput,
} from "../../domain/push-event";
import type { GitProvider } from "../../domain/git-connection";
import type { DrizzleDB } from "./drizzle-repository";
import { pushEvents } from "../../db/schema";

const IN_PROGRESS: PushEventStatus[] = ["queued", "deploying"];

function toDomain(row: typeof pushEvents.$inferSelect): PushEvent {
  return {
    id: row.id,
    appId: row.appId,
    connectionId: row.connectionId,
    provider: row.provider as GitProvider,
    repoSlug: row.repoSlug,
    branch: row.branch,
    ref: row.ref,
    sha: row.sha,
    message: row.message,
    deliveryId: row.deliveryId,
    status: row.status as PushEventStatus,
    deployJobId: row.deployJobId,
    receivedAt: row.receivedAt.toISOString(),
  };
}

export class DrizzlePushEventRepository implements PushEventRepository {
  constructor(private db: DrizzleDB) {}

  async create(input: CreatePushEventInput): Promise<PushEvent> {
    const [row] = await this.db
      .insert(pushEvents)
      .values({
        id: crypto.randomUUID(),
        appId: input.appId,
        connectionId: input.connectionId,
        provider: input.provider,
        repoSlug: input.repoSlug,
        branch: input.branch,
        ref: input.ref,
        sha: input.sha,
        message: input.message,
        deliveryId: input.deliveryId,
        status: input.status,
        deployJobId: input.deployJobId,
        receivedAt: new Date(),
      })
      .returning();
    return toDomain(row);
  }

  async findByAppId(appId: string, limit = 10): Promise<PushEvent[]> {
    const rows = await this.db
      .select()
      .from(pushEvents)
      .where(eq(pushEvents.appId, appId))
      .orderBy(desc(pushEvents.receivedAt))
      .limit(limit);
    return rows.map(toDomain);
  }

  async findByDeliveryId(deliveryId: string): Promise<PushEvent | null> {
    const [row] = await this.db
      .select()
      .from(pushEvents)
      .where(eq(pushEvents.deliveryId, deliveryId))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findInProgressByAppId(appId: string): Promise<PushEvent | null> {
    const [row] = await this.db
      .select()
      .from(pushEvents)
      .where(
        and(
          eq(pushEvents.appId, appId),
          inArray(pushEvents.status, IN_PROGRESS),
        ),
      )
      .orderBy(desc(pushEvents.receivedAt))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async updateStatus(
    id: string,
    status: PushEventStatus,
    deployJobId?: string | null,
  ): Promise<void> {
    await this.db
      .update(pushEvents)
      .set(deployJobId === undefined ? { status } : { status, deployJobId })
      .where(eq(pushEvents.id, id));
  }
}
