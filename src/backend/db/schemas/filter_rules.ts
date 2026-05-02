import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const filterRules = sqliteTable("filter_rules", {
  id: text("id").primaryKey(),
  rule_type: text("rule_type", { enum: ["keyword", "domain", "email"] }).notNull(),
  classification: text("classification", { enum: ["spam", "safe"] }).notNull(),
  value: text("value").notNull(),
  created_at: text("created_at").notNull(),
});
