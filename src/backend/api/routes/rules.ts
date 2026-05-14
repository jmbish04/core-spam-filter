import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { filterRules } from "../../db/schemas/filter_rules";

const rulesRouter = new OpenAPIHono<{ Bindings: Env }>();

const FilterRuleSchema = z.object({
  id: z.string(),
  rule_type: z.enum(["keyword", "domain", "email"]),
  classification: z.enum(["spam", "safe"]),
  value: z.string(),
  created_at: z.string(),
});

const getRulesRoute = createRoute({
  method: "get",
  path: "/",
  summary: "List all configuration rules",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(FilterRuleSchema),
        },
      },
      description: "Rules list",
    },
  },
});

rulesRouter.openapi(getRulesRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const rules = await db.select().from(filterRules);
  return c.json(rules);
});

const postRuleRoute = createRoute({
  method: "post",
  path: "/",
  summary: "Add a new rule",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            rule_type: z.enum(["keyword", "domain", "email"]),
            classification: z.enum(["spam", "safe"]),
            value: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: FilterRuleSchema,
        },
      },
      description: "Rule created",
    },
  },
});

rulesRouter.openapi(postRuleRoute, async (c) => {
  const payload = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const newId = crypto.randomUUID();
  const date = new Date().toISOString();

  await db.insert(filterRules).values({
    id: newId,
    rule_type: payload.rule_type,
    classification: payload.classification,
    value: payload.value,
    created_at: date,
  });

  return c.json(
    {
      id: newId,
      rule_type: payload.rule_type,
      classification: payload.classification,
      value: payload.value,
      created_at: date,
    },
    201,
  );
});

const deleteRuleRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "Delete a rule",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Rule deleted",
    },
  },
});

rulesRouter.openapi(deleteRuleRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = drizzle(c.env.DB);
  await db.delete(filterRules).where(eq(filterRules.id, id));
  return c.json({ success: true });
});

export { rulesRouter };
