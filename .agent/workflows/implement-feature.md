# Feature Implementation Workflow

1. **Initialization:**
   - Scan `wrangler.jsonc`, `astro.config.ts`, and `src/backend/api/index.ts`.
   - Identify routing conflicts between Hono and Astro SSR.

2. **Execution:**
   - Correct Cloudflare `assets` binding in `wrangler.jsonc` to leverage native asset routing.
   - Refactor the Hono router to delegate non-API requests to the Astro SSR handler.
   - Author `scripts/deploy-appscript.sh` for multi-tenant `.clasp.json` generation and push.
   - Audit and replace deprecated `@google/generative-ai` imports with `@google/genai`.
   - Enforce `GEMINI_API_KEY` across all AI instantiations.

3. **Verification:**
   - Ensure OpenAPI v3.1.0 endpoints (`/openapi.json`, `/swagger`, `/scalar`) are functional.
   - Confirm `/health`, `/context`, and `/docs` routes are active.
   - Validate UI components against Shadcn Default Dark Theme standards.

4. **Finalization:**
   - Output full, end-to-end files for all modifications. No truncated code blocks.
