import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { gitConnections } from "./git-connections";

export const pushEvents = pgTable(
  "push_events",
  {
    id: text().primaryKey(),
    appId: text("app_id").references(() => apps.id, { onDelete: "cascade" }),
    connectionId: text("connection_id").references(() => gitConnections.id, {
      onDelete: "set null",
    }),
    provider: text().notNull(),
    repoSlug: text("repo_slug").notNull(),
    branch: text().notNull(),
    ref: text().notNull(),
    sha: text().notNull(),
    message: text().notNull().default(""),
    deliveryId: text("delivery_id"),
    status: text().notNull().default("queued"),
    deployJobId: text("deploy_job_id"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("push_events_app_received_idx").on(table.appId, table.receivedAt),
    index("push_events_connection_idx").on(table.connectionId),
    index("push_events_delivery_idx").on(table.deliveryId),
  ],
);
