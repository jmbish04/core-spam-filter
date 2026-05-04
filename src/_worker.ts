import type { ExecutionContext } from "@cloudflare/workers-types";
import { routeAgentRequest } from "agents";

import { SpamAgent } from "./backend/ai/agents/SpamAgent";
import { app as honoApp } from "./backend/api/index";

// Export the Agent (Durable Object)
export { SpamAgent };

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

    // Handle Agent routes
    if (url.pathname.startsWith("/agents/")) {
      return routeAgentRequest(request, env);
    }

    // Let Astro handle everything else via the ASSETS binding
    return env.ASSETS.fetch(request);
  },
};

export default handler;
