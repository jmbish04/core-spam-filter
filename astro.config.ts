// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = process.env.SITE ?? "http://localhost:4321";
const base = process.env.BASE || "/";

// https://astro.build/config
export default defineConfig({
  site,
  srcDir: "./src/frontend",
  base,
  output: "server",
  adapter: cloudflare({
    imageService: "cloudflare",
    platformProxy: {
      enabled: true,
    },
    routes: {
      // Extend Cloudflare routes to include backend API routes
      extend: {
        include: ["/api/*"],
        exclude: [],
      },
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [
      // Cast through the Vite plugin type to work around the current
      // Vite/@tailwindcss-vite HotUpdateOptions mismatch without dropping
      // type information entirely.
      tailwindcss() as unknown as import("vite").Plugin
    ],
    // Explicitly externalize node built-in modules for SSR
    ssr: {
      external: [
        "node:fs/promises",
        "node:path",
        "node:url",
        "node:crypto",
        "node:buffer",
        "node:stream",
        "node:util",
      ],
    },
  },
});
