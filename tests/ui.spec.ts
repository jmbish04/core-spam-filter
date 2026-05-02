import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("http://localhost:4321");
  await expect(page).toHaveTitle(/Astro shadcn\/ui template|Core Spam Filter/);
});
