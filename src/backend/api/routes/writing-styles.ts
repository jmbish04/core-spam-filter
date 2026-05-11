import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { styleConditions } from "../../db/schemas/style_conditions";
import { writingStyles } from "../../db/schemas/writing_styles";

const writingStylesRouter = new OpenAPIHono<{ Bindings: Env }>();

// ── Schemas ────────────────────────────────────────────────────────────────────

const ConditionFieldEnum = z.enum([
  "from_address",
  "from_domain",
  "to_address",
  "subject",
  "body",
  "cc",
]);

const ConditionOperatorEnum = z.enum([
  "contains",
  "equals",
  "starts_with",
  "ends_with",
  "not_contains",
  "matches_regex",
]);

const StyleConditionSchema = z.object({
  id: z.string(),
  style_id: z.string(),
  condition_field: ConditionFieldEnum,
  condition_operator: ConditionOperatorEnum,
  condition_value: z.string(),
  created_at: z.string(),
});

const WritingStyleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  style_prompt: z.string(),
  priority: z.number(),
  is_enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  conditions: z.array(StyleConditionSchema).optional(),
});

// ── GET /api/writing-styles ───────────────────────────────────────────────────

const listStylesRoute = createRoute({
  method: "get",
  path: "/",
  summary: "List all writing styles with their conditions",
  responses: {
    200: {
      content: { "application/json": { schema: z.array(WritingStyleSchema) } },
      description: "Writing styles list",
    },
  },
});

writingStylesRouter.openapi(listStylesRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const styles = await db.select().from(writingStyles).orderBy(desc(writingStyles.priority));
  const conditions = await db.select().from(styleConditions);

  const result = styles.map((s) => ({
    ...s,
    conditions: conditions.filter((cond) => cond.style_id === s.id),
  }));

  return c.json(result as z.infer<typeof WritingStyleSchema>[]);
});

// ── POST /api/writing-styles ──────────────────────────────────────────────────

const CreateStyleBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  style_prompt: z.string().min(1),
  priority: z.number().int().default(0),
  is_enabled: z.boolean().default(true),
});

const createStyleRoute = createRoute({
  method: "post",
  path: "/",
  summary: "Create a new writing style",
  request: {
    body: { content: { "application/json": { schema: CreateStyleBody } } },
  },
  responses: {
    201: {
      content: { "application/json": { schema: WritingStyleSchema } },
      description: "Writing style created",
    },
  },
});

writingStylesRouter.openapi(createStyleRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const payload = c.req.valid("json");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(writingStyles).values({
    id,
    name: payload.name,
    description: payload.description ?? null,
    style_prompt: payload.style_prompt,
    priority: payload.priority ?? 0,
    is_enabled: payload.is_enabled ?? true,
    created_at: now,
    updated_at: now,
  });

  return c.json(
    {
      id,
      name: payload.name,
      description: payload.description ?? null,
      style_prompt: payload.style_prompt,
      priority: payload.priority ?? 0,
      is_enabled: payload.is_enabled ?? true,
      created_at: now,
      updated_at: now,
      conditions: [],
    },
    201,
  );
});

// ── PUT /api/writing-styles/:id ───────────────────────────────────────────────

const UpdateStyleBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  style_prompt: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  is_enabled: z.boolean().optional(),
});

const updateStyleRoute = createRoute({
  method: "put",
  path: "/{id}",
  summary: "Update a writing style",
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: UpdateStyleBody } } },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Writing style updated",
    },
    404: { description: "Not found" },
  },
});

writingStylesRouter.openapi(updateStyleRoute, async (c) => {
  const { id } = c.req.valid("param");
  const payload = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  const existing = await db.select().from(writingStyles).where(eq(writingStyles.id, id)).limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Not found" }, 404) as any;
  }

  await db
    .update(writingStyles)
    .set({ ...payload, updated_at: now })
    .where(eq(writingStyles.id, id));

  return c.json({ success: true });
});

// ── DELETE /api/writing-styles/:id ───────────────────────────────────────────

const deleteStyleRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "Delete a writing style and its conditions",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Writing style deleted",
    },
  },
});

writingStylesRouter.openapi(deleteStyleRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = drizzle(c.env.DB);

  await db.delete(styleConditions).where(eq(styleConditions.style_id, id));
  await db.delete(writingStyles).where(eq(writingStyles.id, id));

  return c.json({ success: true });
});

// ── GET /api/writing-styles/:id/conditions ────────────────────────────────────

const listConditionsRoute = createRoute({
  method: "get",
  path: "/{id}/conditions",
  summary: "List conditions for a writing style",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(StyleConditionSchema) } },
      description: "Conditions list",
    },
  },
});

writingStylesRouter.openapi(listConditionsRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = drizzle(c.env.DB);
  const conditions = await db
    .select()
    .from(styleConditions)
    .where(eq(styleConditions.style_id, id));
  return c.json(conditions as z.infer<typeof StyleConditionSchema>[]);
});

// ── POST /api/writing-styles/:id/conditions ───────────────────────────────────

const CreateConditionBody = z.object({
  condition_field: ConditionFieldEnum,
  condition_operator: ConditionOperatorEnum,
  condition_value: z.string().min(1),
});

const createConditionRoute = createRoute({
  method: "post",
  path: "/{id}/conditions",
  summary: "Add a condition to a writing style",
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: CreateConditionBody } } },
  },
  responses: {
    201: {
      content: { "application/json": { schema: StyleConditionSchema } },
      description: "Condition created",
    },
  },
});

writingStylesRouter.openapi(createConditionRoute, async (c) => {
  const { id: style_id } = c.req.valid("param");
  const payload = c.req.valid("json");
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();
  const condId = crypto.randomUUID();

  await db.insert(styleConditions).values({
    id: condId,
    style_id,
    condition_field: payload.condition_field,
    condition_operator: payload.condition_operator,
    condition_value: payload.condition_value,
    created_at: now,
  });

  return c.json(
    {
      id: condId,
      style_id,
      condition_field: payload.condition_field,
      condition_operator: payload.condition_operator,
      condition_value: payload.condition_value,
      created_at: now,
    },
    201,
  );
});

// ── DELETE /api/writing-styles/:id/conditions/:conditionId ───────────────────

const deleteConditionRoute = createRoute({
  method: "delete",
  path: "/{id}/conditions/{conditionId}",
  summary: "Remove a condition from a writing style",
  request: { params: z.object({ id: z.string(), conditionId: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Condition deleted",
    },
  },
});

writingStylesRouter.openapi(deleteConditionRoute, async (c) => {
  const { conditionId } = c.req.valid("param");
  const db = drizzle(c.env.DB);
  await db.delete(styleConditions).where(eq(styleConditions.id, conditionId));
  return c.json({ success: true });
});

export { writingStylesRouter };
