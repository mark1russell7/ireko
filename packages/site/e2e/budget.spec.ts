/**
 * The budgets: the size of the scripts of the home page, and the time of a layout in the playground.
 * A change that makes a page much larger or slower fails here.
 */
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

/**
 * The largest size of the scripts of the home page, in kilobytes after gzip. The home page has React and ireko.
 * The size was 117 kB on 2026-10-13. The budget is 1.5 times that size.
 */
const HOME_SCRIPT_KB = 175;
/** The longest time of the layout of the first text of the playground, in milliseconds. */
const LAYOUT_MS = 50;

test("the home page loads a small amount of script", async ({ page }) => {
  const bodies: Promise<Buffer | undefined>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") bodies.push(response.body().catch(() => undefined));
  });
  await page.goto("", { waitUntil: "networkidle" });
  // GitHub Pages sends the scripts with gzip. The test measures the same size.
  const scripts = (await Promise.all(bodies)).filter((b) => b !== undefined);
  const raw = scripts.reduce((sum, b) => sum + b.length, 0) / 1024;
  const gzip = scripts.reduce((sum, b) => sum + gzipSync(b).length, 0) / 1024;
  console.info(`budget: the home page loads ${String(scripts.length)} scripts, ${raw.toFixed(0)} kB (${gzip.toFixed(0)} kB after gzip).`);
  expect(gzip).toBeLessThan(HOME_SCRIPT_KB);
});

test("the playground lays out its first text quickly", async ({ page }) => {
  await page.goto("playground/");
  const status = page.locator(".pg-status");
  await expect(status).toContainText("laid out in");
  const ms = Number(/laid out in ([\d.]+) ms/.exec((await status.textContent()) ?? "")?.[1] ?? Number.NaN);
  console.info(`budget: the playground laid out its first text in ${String(ms)} ms.`);
  expect(ms).toBeLessThan(LAYOUT_MS);
});
