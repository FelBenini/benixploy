import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  jsonb,
  index,
  bigint,
} from "drizzle-orm/pg-core";
import { servers } from "./servers";

export const nodeEvents = pgTable(
  "node_events",
  {
    id: text().primaryKey(),
    serverId: text()
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    eventType: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("node_events_server_idx").on(table.serverId),
    index("node_events_type_idx").on(table.eventType),
    index("node_events_received_idx").on(table.receivedAt),
    index("node_events_server_type_idx").on(table.serverId, table.eventType),
  ],
);

export const nodeStats = pgTable(
  "node_stats",
  {
    id: text().primaryKey(),
    serverId: text()
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    cpuPercent: doublePrecision().notNull(),
    memoryTotal: bigint({ mode: "number" }).notNull(),
    memoryUsed: bigint({ mode: "number" }).notNull(),
    memoryAvailable: bigint({ mode: "number" }).notNull(),
    diskTotal: bigint({ mode: "number" }).notNull(),
    diskUsed: bigint({ mode: "number" }).notNull(),
    uptime: bigint({ mode: "number" }).notNull(),
    containerCount: bigint({ mode: "number" }).notNull(),
    containerStates: jsonb().notNull().default([]),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("node_stats_server_idx").on(table.serverId),
    index("node_stats_received_idx").on(table.receivedAt),
  ],
);
