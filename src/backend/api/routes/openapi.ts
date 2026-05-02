/**
 * @fileoverview OpenAPI documentation routes
 */

import { swaggerUI } from "@hono/swagger-ui";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";

import type { Bindings } from "../index";

const openapiRouter = new Hono<{ Bindings: Bindings }>();

// OpenAPI specification
const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Core Template API",
    version: "1.0.0",
    description: "API documentation for Cloudflare Workers AI powered application",
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
    pageTitle: "API Reference",
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

export { openapiRouter };
