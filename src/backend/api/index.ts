import { OpenAPIHono } from "@hono/zod-openapi";
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

const app = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: "Validation error",
          issues: result.error.issues,
        },
        422
      );
    }
  },
});

// Global error handler
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json(
    {
      success: false,
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

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

// Generate dynamic OpenAPI spec
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Core Spam Filter API",
    version: "1.0.0",
    description: "API documentation for Core Spam Filter - Cloudflare Workers AI powered spam detection and filtering",
  },
  servers: [
    {
      url: "https://core-spam-filter.hacolby.workers.dev",
      description: "API Server",
    },
  ],
});

// Register security scheme
app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
});

export { app };
