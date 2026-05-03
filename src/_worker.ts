// src/_worker.ts
import type { ExecutionContext } from "@cloudflare/workers-types";
import { handler as astroHandler } from "@astrojs/cloudflare/handler";
import { EmailAnalyzerAgent } from "./backend/ai/agents/workflow/EmailAnalyzerAgent";
import { app as honoApp } from "./backend/api/index";

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

    // Pass all other requests to the Astro SSR engine
    return astroHandler(request, env, ctx);
  },
};

export default handler;
