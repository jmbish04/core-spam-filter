import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { Bindings } from "../index";

const emailsRouter = new OpenAPIHono<{ Bindings: Bindings }>();

// Define schema for analyze payload
const AnalyzeEmailSchema = z.object({
  message_id: z.string().optional(),
  sender: z.string(),
  recipient: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  date: z.string().optional(),
});

const AnalyzeEmailResponseSchema = z.object({
  spam: z.boolean(),
  not_spam: z.boolean(),
  high_alert: z.boolean(),
  likelihood_score_spam: z.number(),
  likelihood_score_not_spam: z.number(),
  rationale_spam: z.string(),
  rationale_not_spam: z.string(),
  triggered_configurations: z.array(z.string()),
});

const analyzeRoute = createRoute({
  method: "post",
  path: "/analyze",
  summary: "Analyze an email for spam and high alert",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: AnalyzeEmailSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AnalyzeEmailResponseSchema,
        },
      },
      description: "Analysis completed",
    },
    401: {
      description: "Unauthorized",
    },
    500: {
      description: "Internal server error",
    },
  },
});

emailsRouter.openapi(analyzeRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  let secret = c.env.APPS_SCRIPT_SECRET;

  if (c.env.WORKER_API_KEY) {
    try {
      const apiKeyVal = await c.env.WORKER_API_KEY.get();
      if (apiKeyVal) secret = apiKeyVal;
    } catch (e) {
      console.warn("Could not get WORKER_API_KEY from secrets store", e);
    }
  }

  if (
    !secret ||
    !authHeader ||
    !authHeader.startsWith("Bearer ") ||
    authHeader.split(" ")[1] !== secret
  ) {
    return c.json({ error: "Unauthorized" }, 401) as any;
  }

  const payload = c.req.valid("json");

  // Trigger Durable Object Workflow Agent here
  const agentId = c.env.SpamAgent.idFromName("singleton"); // Or a distinct ID per request if parallel
  const agent = c.env.SpamAgent.get(agentId);

  try {
    const res = await agent.fetch("http://agent/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("Agent error", await res.text());
      return c.json({ error: "Agent failed" }, 500) as any;
    }

    const data = await res.json();
    return c.json(data as z.infer<typeof AnalyzeEmailResponseSchema>);
  } catch (e: any) {
    console.error("Agent communication error", e);
    return c.json({ error: "Internal Server Error" }, 500) as any;
  }
});

export { emailsRouter };
