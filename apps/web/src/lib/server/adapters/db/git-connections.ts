import { eq, and } from "drizzle-orm";
import type { GitConnectionRepository } from "../../ports/repository";
import type {
  GitConnection,
  GitConnectionWithSecrets,
  GitProvider,
  GitAuthKind,
  UpsertGitConnectionInput,
} from "../../domain/git-connection";
import type { DrizzleDB } from "./drizzle-repository";
import type { FieldTransform } from "./servers";
import { gitConnections } from "../../db/schema";

function toDomain(row: typeof gitConnections.$inferSelect): GitConnection {
  return {
    id: row.id,
    provider: row.provider as GitProvider,
    name: row.name,
    baseUrl: row.baseUrl,
    authKind: row.authKind as GitAuthKind,
    externalId: row.externalId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleGitConnectionRepository implements GitConnectionRepository {
  constructor(
    private db: DrizzleDB,
    private encryptValue?: FieldTransform,
    private decryptValue?: FieldTransform,
  ) {}

  async findGitConnection(
    orgId: string,
    id: string,
  ): Promise<GitConnectionWithSecrets | null> {
    const [row] = await this.db
      .select()
      .from(gitConnections)
      .where(and(eq(gitConnections.id, id), eq(gitConnections.orgId, orgId)))
      .limit(1);
    if (!row) return null;

    const credentials = this.decryptValue
      ? JSON.parse(this.decryptValue(row.credentialsEnc))
      : JSON.parse(row.credentialsEnc);
    const webhookSecret = this.decryptValue
      ? this.decryptValue(row.webhookSecretEnc)
      : row.webhookSecretEnc;

    return { ...toDomain(row), credentials, webhookSecret };
  }

  async listGitConnections(orgId: string): Promise<GitConnection[]> {
    const rows = await this.db
      .select()
      .from(gitConnections)
      .where(eq(gitConnections.orgId, orgId));
    return rows.map(toDomain);
  }

  async upsertGitConnection(
    orgId: string,
    input: UpsertGitConnectionInput,
  ): Promise<GitConnection> {
    const credentialsJson = JSON.stringify(input.credentials);
    const credentialsEnc = this.encryptValue
      ? this.encryptValue(credentialsJson)
      : credentialsJson;
    const webhookSecretEnc = this.encryptValue
      ? this.encryptValue(input.webhookSecret)
      : input.webhookSecret;

    const values = {
      provider: input.provider,
      name: input.name,
      baseUrl: input.baseUrl,
      authKind: input.authKind,
      credentialsEnc,
      webhookSecretEnc,
      updatedAt: new Date(),
    };

    if (input.id) {
      const [row] = await this.db
        .update(gitConnections)
        .set(values)
        .where(
          and(eq(gitConnections.id, input.id), eq(gitConnections.orgId, orgId)),
        )
        .returning();
      if (row) return toDomain(row);
    }

    const [row] = await this.db
      .insert(gitConnections)
      .values({
        ...values,
        id: crypto.randomUUID(),
        orgId,
        createdAt: new Date(),
      })
      .returning();
    return toDomain(row);
  }

  async removeGitConnection(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(gitConnections)
      .where(and(eq(gitConnections.id, id), eq(gitConnections.orgId, orgId)));
  }

  async setExternalId(
    orgId: string,
    id: string,
    installationId: string,
  ): Promise<void> {
    await this.db
      .update(gitConnections)
      .set({ externalId: installationId, updatedAt: new Date() })
      .where(and(eq(gitConnections.id, id), eq(gitConnections.orgId, orgId)));
  }

  async clearExternalId(orgId: string, id: string): Promise<void> {
    await this.db
      .update(gitConnections)
      .set({ externalId: null, updatedAt: new Date() })
      .where(and(eq(gitConnections.id, id), eq(gitConnections.orgId, orgId)));
  }
}
