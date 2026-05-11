import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { alertsRouter } from "./routes/alerts";
import { emailsRouter } from "./routes/emails";
import { gmailRouter } from "./routes/gmail";
import { healthRouter } from "./routes/health";
import { logsRouter } from "./routes/logs";
import { openapiRouter } from "./routes/openapi";
import { rulesRouter } from "./routes/rules";
import { statsRouter } from "./routes/stats";
import { writingStylesRouter } from "./routes/writing-styles";

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Mount routers
app.route("/api/emails", emailsRouter);
app.route("/api/rules", rulesRouter);
app.route("/api/writing-styles", writingStylesRouter);
app.route("/api/gmail", gmailRouter);
app.route("/api/emails/alerts", alertsRouter);
app.route("/api/stats", statsRouter);
app.route("/api/health", healthRouter);
app.route("/api/logs", logsRouter);
app.route("/", openapiRouter);

export { app };
