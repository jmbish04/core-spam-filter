import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const healthChecks = sqliteTable("health_checks", {
  id: text("id").primaryKey(),
  module: text("module").notNull(),
  status: text("status").notNull(),
  latency_ms: integer("latency_ms").notNull(),
  timestamp: text("timestamp").notNull(),
});
