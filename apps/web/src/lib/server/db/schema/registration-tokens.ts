import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { servers } from "./servers";

export const registrationTokens = pgTable(
  "registration_tokens",
  {
    id: text().primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    serverId: text("server_id").references(() => servers.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("registration_tokens_hash_idx").on(table.tokenHash),
    index("registration_tokens_expires_idx").on(table.expiresAt),
  ],
);
