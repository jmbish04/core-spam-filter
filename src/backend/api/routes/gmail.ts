import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const gmailRouter = new OpenAPIHono<{ Bindings: Env }>();

// ── Schemas ────────────────────────────────────────────────────────────────────

const ConditionSchema = z.object({
  condition_field: z.enum(["from_address", "from_domain", "to_address", "subject", "body", "cc"]),
  condition_operator: z.enum([
    "contains",
    "equals",
    "starts_with",
    "ends_with",
    "not_contains",
    "matches_regex",
  ]),
  condition_value: z.string(),
});

const GmailSearchBody = z.object({
  conditions: z.array(ConditionSchema),
  max_results: z.number().int().min(1).max(20).default(10),
});

const GmailMessageSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  sender: z.string(),
  subject: z.string(),
  snippet: z.string(),
  date: z.string(),
});

const GmailSearchResponseSchema = z.object({
  messages: z.array(GmailMessageSchema),
  query: z.string(),
  total: z.number(),
});

// ── POST /api/gmail/search ────────────────────────────────────────────────────

const searchRoute = createRoute({
  method: "post",
  path: "/search",
  summary: "Search Gmail inbox for emails matching writing-style conditions (proxy to AppScript)",
  request: {
    body: { content: { "application/json": { schema: GmailSearchBody } } },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GmailSearchResponseSchema } },
      description: "Matching Gmail messages",
    },
    503: { description: "AppScript web-app not reachable or not configured" },
  },
});

gmailRouter.openapi(searchRoute, async (c) => {
  const payload = c.req.valid("json");

  // Access optional env vars that may not be in the generated Env interface yet
  const env = c.env as any;
  const appScriptUrl: string | undefined = env.APPSCRIPT_WEBAPP_URL;

  if (!appScriptUrl) {
    return c.json({ messages: [], query: "", total: 0 }, 200);
  }

  let appScriptSecret: string | undefined;
  if (env.APPSCRIPT_WEBHOOK_SECRET) {
    try {
      appScriptSecret = await env.APPSCRIPT_WEBHOOK_SECRET.get();
    } catch {
      appScriptSecret = env.APPSCRIPT_WEBHOOK_SECRET as string | undefined;
    }
  }

  try {
    const response = await fetch(appScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(appScriptSecret ? { Authorization: `Bearer ${appScriptSecret}` } : {}),
      },
      body: JSON.stringify({
        action: "search_gmail",
        conditions: payload.conditions,
        max_results: payload.max_results,
      }),
    });

    if (!response.ok) {
      console.error("AppScript responded with", response.status);
      return c.json({ messages: [], query: "AppScript error", total: 0 }, 200);
    }

    const data: any = await response.json();
    return c.json({
      messages: data.messages ?? [],
      query: data.query ?? "",
      total: data.total ?? 0,
    });
  } catch (e) {
    console.error("Gmail search proxy error", e);
    return c.json({ error: "Failed to reach AppScript" }, 503) as any;
  }
});

export { gmailRouter };
