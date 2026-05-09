import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Audit log recording which filter rule was applied to which Gmail message
 * and the AI rationale for the decision.
 */
export const messagesRulesMap = sqliteTable("messages_rules_map", {
  id: text("id").primaryKey(),
  message_id: text("message_id").notNull(),
  rule_id: text("rule_id").notNull(),
  ai_rationale: text("ai_rationale"),
  applied_at: text("applied_at").notNull(),
});
