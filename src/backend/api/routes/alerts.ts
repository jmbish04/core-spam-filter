import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { Bindings } from "../index";

import { emailsLog } from "../../db/schemas/emails_log";

const alertsRouter = new OpenAPIHono<{ Bindings: Bindings }>();

const EmailLogSchema = z.object({
  id: z.string(),
  message_id: z.string().nullable(),
  sender: z.string().nullable(),
  recipient: z.string().nullable(),
  cc: z.string().nullable(),
  bcc: z.string().nullable(),
  subject: z.string().nullable(),
  body_snippet: z.string().nullable(),
  is_spam: z.boolean().nullable(),
  is_high_alert: z.boolean().nullable(),
  spam_score: z.number().nullable(),
  rationale: z.string().nullable(),
  triggered_rules: z.string().nullable(),
  analyzed_at: z.string().nullable(),
});

const getAlertsRoute = createRoute({
  method: "get",
  path: "/",
  summary: "Fetches recent high-alert emails",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(EmailLogSchema),
        },
      },
      description: "Recent high-alert emails list",
    },
  },
});

alertsRouter.openapi(getAlertsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const alerts = await db
    .select()
    .from(emailsLog)
    .where(eq(emailsLog.is_high_alert, true))
    .orderBy(desc(emailsLog.analyzed_at))
    .limit(50);
  return c.json(alerts as z.infer<typeof EmailLogSchema>[]);
});

export { alertsRouter };
