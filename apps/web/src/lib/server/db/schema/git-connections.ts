import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

export const gitConnections = pgTable(
  "git_connections",
  {
    id: text().primaryKey(),
    orgId: text()
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    name: text().notNull(),
    baseUrl: text("base_url").notNull(),
    authKind: text("auth_kind").notNull(),
    credentialsEnc: text("credentials_enc").notNull(),
    webhookSecretEnc: text("webhook_secret_enc").notNull(),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("git_connections_org_idx").on(table.orgId),
    index("git_connections_provider_idx").on(table.provider),
    index("git_connections_auth_kind_idx").on(table.authKind),
  ],
);
