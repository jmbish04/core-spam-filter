import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { drizzle } from "drizzle-orm/d1";



import { appscriptLogs } from "../../db/schemas/appscript_logs";

const logsRouter = new OpenAPIHono<{ Bindings: Env }>();

const LogSchema = z.object({
  function_name: z.string().optional(),
  error_summary: z.string().optional(),
  full_error: z.string().optional(),
  timestamp: z.string().optional(),
});

const postLogRoute = createRoute({
  method: "post",
  path: "/",
  summary: "Receive console messages from App Script",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: LogSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Log received",
    },
    401: {
      description: "Unauthorized",
    },
    500: {
      description: "Internal Server Error",
    },
  },
});

logsRouter.openapi(postLogRoute, async (c) => {
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

  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== secret) {
    return c.json({ error: "Unauthorized" }, 401) as any;
  }

  const payload = c.req.valid("json");
  const db = drizzle(c.env.DB);

  try {
    await db.insert(appscriptLogs).values({
      id: crypto.randomUUID(),
      function_name: payload.function_name || null,
      error_summary: payload.error_summary || null,
      full_error: payload.full_error || null,
      timestamp: payload.timestamp || new Date().toISOString(),
    });
    return c.json({ success: true }, 201);
  } catch (err) {
    console.error("Failed to insert log", err);
    return c.json({ error: "Internal Server Error" }, 500) as any;
  }
});

export { logsRouter };
