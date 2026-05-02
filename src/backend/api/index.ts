import type {
  D1Database,
  Ai,
  VectorizeIndex,
  DurableObjectNamespace,
} from "@cloudflare/workers-types";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { alertsRouter } from "./routes/alerts";
import { emailsRouter } from "./routes/emails";
import { healthRouter } from "./routes/health";
import { openapiRouter } from "./routes/openapi";
import { rulesRouter } from "./routes/rules";
import { statsRouter } from "./routes/stats";

export type Bindings = {
  DB: D1Database;
  AI: Ai;
  VECTOR_INDEX: VectorizeIndex;
  EmailAgent: DurableObjectNamespace;
  APPS_SCRIPT_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Mount routers
app.route("/api/emails", emailsRouter);
app.route("/api/rules", rulesRouter);
app.route("/api/emails/alerts", alertsRouter);
app.route("/api/stats", statsRouter);
app.route("/api/health", healthRouter);
app.route("/", openapiRouter);

export { app };
