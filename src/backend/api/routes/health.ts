import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";



const healthRouter = new OpenAPIHono<{ Bindings: Env }>();

const HealthSchema = z.object({
  status: z.string(),
  modules: z.array(
    z.object({
      module: z.string(),
      status: z.string(),
      latency_ms: z.number(),
      timestamp: z.string(),
    }),
  ),
});

const getHealthRoute = createRoute({
  method: "get",
  path: "/",
  summary: "System health check",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: HealthSchema,
        },
      },
      description: "System is healthy",
    },
  },
});

healthRouter.openapi(getHealthRoute, async (c) => {
  const env = c.env;
  const modules = [];

  // Check D1
  const d1Start = Date.now();
  let d1Status = "Healthy";
  try {
    await env.DB.prepare("SELECT 1").run();
  } catch {
    d1Status = "Unhealthy";
  }
  modules.push({
    module: "D1 Database",
    status: d1Status,
    latency_ms: Date.now() - d1Start,
    timestamp: new Date().toISOString(),
  });

  // Check AI
  const aiStart = Date.now();
  let aiStatus = "Healthy";
  try {
    // A simple fast call
    await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: ["test"] });
  } catch {
    aiStatus = "Unhealthy";
  }
  modules.push({
    module: "Workers AI",
    status: aiStatus,
    latency_ms: Date.now() - aiStart,
    timestamp: new Date().toISOString(),
  });

  return c.json({
    status: "ok",
    modules,
  });
});

export { healthRouter };
