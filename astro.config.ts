// @ts-check
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
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [
      // Cast through the Vite plugin type to work around the current
      // Vite/@tailwindcss-vite HotUpdateOptions mismatch without dropping
      // type information entirely.
      tailwindcss() as unknown as import("vite").Plugin
    ],
  },
});
