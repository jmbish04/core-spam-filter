import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const writingStyles = sqliteTable("writing_styles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  style_prompt: text("style_prompt").notNull(),
  priority: integer("priority").notNull().default(0),
  is_enabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
