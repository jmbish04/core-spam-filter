import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const emailsLog = sqliteTable("emails_log", {
  id: text("id").primaryKey(),
  message_id: text("message_id"),
  inbox_account: text("inbox_account").notNull(),
  sender: text("sender"),
  recipient: text("recipient"),
  cc: text("cc"),
  bcc: text("bcc"),
  subject: text("subject"),
  body_snippet: text("body_snippet"),
  is_spam: integer("is_spam", { mode: "boolean" }),
  is_high_alert: integer("is_high_alert", { mode: "boolean" }),
  spam_score: integer("spam_score"),
  rationale: text("rationale"),
  triggered_rules: text("triggered_rules"), // json
  analyzed_at: text("analyzed_at"),
});
