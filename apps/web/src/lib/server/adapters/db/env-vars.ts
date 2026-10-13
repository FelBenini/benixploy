import { eq, and } from "drizzle-orm";
import type { EnvVarRepository } from "../../ports/repository";
import type { DrizzleDB } from "./drizzle-repository";
import type { FieldTransform } from "./servers";
import { envVars } from "../../db/schema";

export class DrizzleEnvVarRepository implements EnvVarRepository {
  constructor(
    private db: DrizzleDB,
    private decryptValue?: FieldTransform,
  ) {}

  async listByApp(
    orgId: string,
    appId: string,
  ): Promise<Record<string, string>> {
    const rows = await this.db
      .select()
      .from(envVars)
      .where(and(eq(envVars.orgId, orgId), eq(envVars.appId, appId)));

    const vars: Record<string, string> = {};
    for (const row of rows) {
      vars[row.key] = this.decryptValue
        ? this.decryptValue(row.encryptedValue)
        : row.encryptedValue;
    }
    return vars;
  }
}
