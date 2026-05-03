import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appscriptLogs = sqliteTable("appscript_logs", {
  id: text("id").primaryKey(),
  inbox_account: text("inbox_account").notNull(),
  function_name: text("function_name"),
  error_summary: text("error_summary"),
  full_error: text("full_error"),
  timestamp: text("timestamp"),
});
