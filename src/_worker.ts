// src/_worker.ts
import type { ExecutionContext } from "@cloudflare/workers-types";

import { EmailAnalyzerAgent } from "./backend/ai/agents/workflow/EmailAnalyzerAgent";
import { app as honoApp } from "./backend/api/index";

// @ts-ignore - Astro generates this dynamically during the build step
import * as astroWorkerModule from "../dist/_worker.js";

// Export the Durable Object
export { EmailAnalyzerAgent };

const handler = {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle API routes with Hono
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname === "/openapi.json" ||
      url.pathname === "/swagger" ||
      url.pathname === "/scalar" ||
      url.pathname === "/docs"
    ) {
      return honoApp.fetch(request as any, env, ctx) as unknown as Response;
    }

    // Safely unwrap the Astro ES Module default export to avoid 500s or swallowed 404s
    // ESBuild may wrap the module differently depending on the Astro compilation output
    const astroWorker = astroWorkerModule.default || astroWorkerModule;
    const fetchHandler = astroWorker.fetch;
    
    if (typeof fetchHandler === "function") {
      return fetchHandler(request, env, ctx);
    }

    return new Response("Astro SSR Worker not found or failed to export fetch handler.", { status: 500 });
  },
};

export default handler;
