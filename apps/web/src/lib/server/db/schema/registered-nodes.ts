import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { servers } from "./servers";

export const registeredNodes = pgTable(
  "registered_nodes",
  {
    id: text().primaryKey(),
    serverId: text("server_id")
      .notNull()
      .unique()
      .references(() => servers.id, { onDelete: "cascade" }),
    sshPublicKey: text("ssh_public_key").notNull(),
    monitorBearerToken: text("monitor_bearer_token").notNull(),
    status: text().notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("registered_nodes_server_idx").on(table.serverId),
    index("registered_nodes_status_idx").on(table.status),
  ],
);
