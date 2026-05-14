import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { emailsLog } from "../../db/schemas/emails_log";

const statsRouter = new OpenAPIHono<{ Bindings: Env }>();

const StatsSchema = z.object({
  total: z.number(),
  spam_count: z.number(),
  alert_count: z.number(),
});

const getStatsRoute = createRoute({
  method: "get",
  path: "/",
  summary: "Fetches inbox analytics for the dashboard",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StatsSchema,
        },
      },
      description: "Analytics summary",
    },
  },
});

statsRouter.openapi(getStatsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  // Optional: Add logic to filter by analyzed_at > ?

  const result = await db
    .select({
      total: sql<number>`COUNT(*)`,
      spam_count: sql<number>`SUM(CASE WHEN is_spam = 1 THEN 1 ELSE 0 END)`,
      alert_count: sql<number>`SUM(CASE WHEN is_high_alert = 1 THEN 1 ELSE 0 END)`,
    })
    .from(emailsLog);

  const stats = result[0];
  return c.json({
    total: stats.total || 0,
    spam_count: stats.spam_count || 0,
    alert_count: stats.alert_count || 0,
  });
});

export { statsRouter };
