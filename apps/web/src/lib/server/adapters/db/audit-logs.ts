import type {
  AuditLogRecord,
  AuditLogRepository,
} from "../../ports/repository";
import type { DrizzleDB } from "./drizzle-repository";
import { auditLog } from "../../db/schema";

export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private db: DrizzleDB) {}

  async record(input: AuditLogRecord): Promise<void> {
    await this.db.insert(auditLog).values({
      id: crypto.randomUUID(),
      orgId: input.orgId,
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      details: input.details ?? null,
      reasoning: input.reasoning ?? null,
    });
  }
}
