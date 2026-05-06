# Cloudflare Workers + Astro SSR Standards

- **Asset Routing:** Always utilize the `assets: { directory: "./dist/" }` configuration in `wrangler.jsonc` to offload static file delivery to Cloudflare's edge CDN, bypassing the V8 isolate for static content.

- **Node Compatibility:** Always include `compatibility_flags = ["nodejs_compat"]` for standard backend modules.

- **Hono Delegation:** Hono must isolate its routes under `/api/*`. A catch-all fallback to the ASSETS binding must be used at the end of the routing chain to pass unhandled requests to the Astro SSR handler.

- **Compatibility Date:** Always set `compatibility_date` to today's date or the most recent date (e.g., "2026-05-03").

- **SPA Routing:** For Astro SSR applications, set `not_found_handling: "single-page-application"` in the assets configuration to ensure proper client-side routing.

- **Worker First:** Use `run_worker_first: true` to ensure the Worker processes requests before attempting to serve static assets, allowing proper API routing.

- **Strict Output:** Every file modified or generated must be output in its entirety. Placeholders are strictly forbidden.
