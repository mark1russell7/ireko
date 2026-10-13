import { defineConfig, devices } from "@playwright/test";

/**
 * The browser tests of the site. They use the built site at the base path of GitHub Pages.
 * Build first (`pnpm build`, then `pnpm og`). `SITE_DIST` selects another build folder.
 */
const port = 4322;
const ci = process.env["CI"] !== undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${String(port)}/ireko/`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/serve.ts",
    url: `http://127.0.0.1:${String(port)}/ireko/`,
    reuseExistingServer: !ci,
    timeout: 30_000,
    env: { PORT: String(port), SITE_BASE: "ireko", SITE_DIST: process.env["SITE_DIST"] ?? "dist" },
  },
});
