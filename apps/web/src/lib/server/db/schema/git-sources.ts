import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { apps } from "./apps";
import { gitConnections } from "./git-connections";

export const gitSources = pgTable(
  "git_sources",
  {
    id: text().primaryKey(),
    appId: text("app_id")
      .notNull()
      .unique()
      .references(() => apps.id, { onDelete: "cascade" }),
    connectionId: text("connection_id").references(() => gitConnections.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    repoSlug: text("repo_slug").notNull(),
    cloneUrl: text("clone_url").notNull(),
    branch: text("branch").notNull().default("main"),
    shaDeployed: text("sha_deployed"),
    activeColor: text("active_color"),
    warmColor: text("warm_color"),
    warmExpiresAt: timestamp("warm_expires_at", { withTimezone: true }),
    lastPushAt: timestamp("last_push_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("git_sources_app_idx").on(table.appId),
    index("git_sources_connection_idx").on(table.connectionId),
    index("git_sources_provider_idx").on(table.provider),
    index("git_sources_last_push_idx").on(table.lastPushAt),
  ],
);
