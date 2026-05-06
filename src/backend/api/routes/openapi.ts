/**
 * @fileoverview OpenAPI documentation routes
 */

import { swaggerUI } from "@hono/swagger-ui";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";



const openapiRouter = new Hono<{ Bindings: Env }>();

// OpenAPI specification
const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Core Spam Filter API",
    version: "1.0.0",
    description: "API documentation for Core Spam Filter - Cloudflare Workers AI powered spam detection and filtering",
  },
  servers: [
    {
      url: "/",
      description: "API Server",
    },
  ],
  paths: {},
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
  },
};

// GET /openapi.json
openapiRouter.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// GET /swagger
openapiRouter.get("/swagger", swaggerUI({ url: "/openapi.json" }));

// GET /scalar
openapiRouter.get(
  "/scalar",
  apiReference({
    pageTitle: "Core Spam Filter API Reference",
    theme: "default",
    spec: {
      url: "/openapi.json",
    },
  } as any),
);

// GET /docs - redirect to scalar
openapiRouter.get("/docs", (c) => {
  return c.redirect("/scalar");
});

// GET /context - API context and available endpoints
openapiRouter.get("/context", (c) => {
  return c.json({
    name: "Core Spam Filter API",
    version: "1.0.0",
    description: "Cloudflare Workers AI powered spam detection and filtering system",
    endpoints: {
      documentation: {
        "/openapi.json": "OpenAPI 3.1.0 specification",
        "/swagger": "Swagger UI documentation",
        "/scalar": "Scalar API reference",
        "/docs": "API documentation (redirects to /scalar)",
      },
      health: {
        "/health": "System health check",
      },
      api: {
        "/api/emails": "Email management endpoints",
        "/api/rules": "Filter rules management",
        "/api/emails/alerts": "Alert management",
        "/api/stats": "Statistics endpoints",
        "/api/logs": "Logging endpoints",
      },
    },
    openapi_version: "3.1.0",
    timestamp: new Date().toISOString(),
  });
});

export { openapiRouter };
