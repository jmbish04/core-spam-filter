import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getAgentByName } from "agents";
import type { SpamAgent } from "@/backend/ai/agents/SpamAgent"; // Adjust path to your agent

const emailsRouter = new OpenAPIHono<{ Bindings: Env }>();

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
  is_answerable: z.boolean(),
  no_reply_needed: z.boolean(),
  draft_reply: z.string(),
  action_reasoning: z.string(),
  applied_writing_style_id: z.string().nullable(),
  applied_writing_style_name: z.string().nullable(),
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
  
  // 1. Access the secret directly as a string from the env object
  const secret = await c.env.WORKER_API_KEY.get();

  if (!secret) {
    console.warn("WORKER_API_KEY is not configured in the worker secret store secret bindings.");
    return c.json({ error: "Server misconfiguration" }, 500) as any;
  }

  // 2. Validate the authorization header
  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ") ||
    authHeader.split(" ")[1] !== secret
  ) {
    return c.json({ error: "Unauthorized" }, 401) as any;
  }

  const payload = c.req.valid("json");

  // 3. Use the Agents SDK helper to get the typed RPC stub
  // "global" is the instance name to match your agent's initial state
  const agent = await getAgentByName(c.env.SpamAgent, "global");

  try {
    // 4. Direct RPC Call via the Agents SDK
    const data = await agent.analyzeEmail(payload);
    
    return c.json(data as z.infer<typeof AnalyzeEmailResponseSchema>);
  } catch (e: any) {
    console.error("Agent communication error", e);
    return c.json({ error: "Internal Server Error" }, 500) as any;
  }
});

export { emailsRouter };
