import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Conditions that must ALL be true (AND-logic) for the parent writing_style to apply.
 * If a style has no conditions it matches every email (acts as a default/fallback).
 */
export const styleConditions = sqliteTable("style_conditions", {
  id: text("id").primaryKey(),
  style_id: text("style_id").notNull(),
  condition_field: text("condition_field", {
    enum: ["from_address", "from_domain", "to_address", "subject", "body", "cc"],
  }).notNull(),
  condition_operator: text("condition_operator", {
    enum: ["contains", "equals", "starts_with", "ends_with", "not_contains", "matches_regex"],
  }).notNull(),
  condition_value: text("condition_value").notNull(),
  created_at: text("created_at").notNull(),
});
