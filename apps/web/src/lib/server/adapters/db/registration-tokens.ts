import { eq, lt, gt, and, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { registrationTokens } from "../../db/schema/registration-tokens";
import type {
  RegistrationToken,
  CreateRegistrationTokenInput,
} from "../../domain/registration-token";

function toDomain(
  row: typeof registrationTokens.$inferSelect,
): RegistrationToken {
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    serverId: row.serverId ?? null,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleRegistrationTokenRepository {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  async create(
    input: CreateRegistrationTokenInput & { id: string },
  ): Promise<RegistrationToken> {
    const [row] = await this.db
      .insert(registrationTokens)
      .values({
        id: input.id,
        tokenHash: input.tokenHash,
        expiresAt: new Date(input.expiresAt),
        createdAt: new Date(),
      })
      .returning();
    return toDomain(row);
  }

  async findByHash(tokenHash: string): Promise<RegistrationToken | null> {
    const [row] = await this.db
      .select()
      .from(registrationTokens)
      .where(
        and(
          eq(registrationTokens.tokenHash, tokenHash),
          isNull(registrationTokens.usedAt),
          gt(registrationTokens.expiresAt, new Date()),
        ),
      );

    if (!row) return null;
    return toDomain(row);
  }

  async markUsed(id: string, serverId: string): Promise<void> {
    await this.db
      .update(registrationTokens)
      .set({
        serverId,
        usedAt: new Date(),
      })
      .where(eq(registrationTokens.id, id));
  }

  async pruneExpired(): Promise<void> {
    await this.db
      .delete(registrationTokens)
      .where(lt(registrationTokens.expiresAt, new Date()));
  }
}
