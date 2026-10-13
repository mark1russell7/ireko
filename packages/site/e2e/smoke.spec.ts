/**
 * The smoke tests: the home page, the playground and each page of the sitemap open with no error.
 */
import { expect, test, type Page } from "@playwright/test";
import { sitePages } from "./pages.ts";

/** This function collects the errors of the console and the uncaught errors of a page. */
function errorsOf(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** This function replaces the text of the editor of the playground. */
async function typeSource(page: Page, text: string): Promise<void> {
  await page.getByRole("textbox", { name: /The source of the layout/ }).fill(text);
}

test("the home page shows the hero and the live example", async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto("");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const live = page.getByRole("figure", { name: "A live example of ireko" });
  await expect(live).toBeVisible();
  await expect(live.locator(".ik-live-stage svg").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy the npm command/ })).toBeVisible();
  // The live example changes its layout in steps. The next step must give no error.
  await live.getByRole("button", { name: "The next step" }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test.describe("the playground", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("playground/");
    await expect(page.locator(".pg-status")).toContainText("boxes");
  });

  test("lays out the text that the reader types", async ({ page }) => {
    const errors = errorsOf(page);
    await typeSource(page, "root { a b c }");
    await expect(page.locator(".pg-status")).toContainText("4 boxes, 3 edges");
    await expect(page.locator(".pg-stage")).toContainText("root");
    expect(errors).toEqual([]);
  });

  test("shows each renderer", async ({ page }) => {
    const errors = errorsOf(page);
    const renderers = page.getByRole("group", { name: "Renderer" });
    const stage = page.locator(".pg-stage");
    await renderers.getByRole("button", { name: "DOM" }).click();
    await expect(stage.locator("[data-id]").first()).toBeVisible();
    await renderers.getByRole("button", { name: "Canvas" }).click();
    await expect(stage.locator("canvas")).toBeVisible();
    await renderers.getByRole("button", { name: "React Flow" }).click();
    await expect(stage.locator(".react-flow__node").first()).toBeVisible({ timeout: 15_000 });
    await renderers.getByRole("button", { name: "SVG" }).click();
    await expect(stage.locator("svg").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("shows a syntax error and keeps the last good layout", async ({ page }) => {
    await typeSource(page, "root { a b c }");
    await expect(page.locator(".pg-status")).toContainText("4 boxes");
    await typeSource(page, "root { a b c");
    await expect(page.locator(".pg-status")).toContainText(/Line 1, column \d+/);
    await expect(page.locator(".pg-status")).toHaveAttribute("data-state", "error");
    await expect(page.locator(".pg-stale")).toBeVisible();
    await expect(page.locator(".pg-stage")).toContainText("root");
  });

  test("gives a link that opens the same text", async ({ page }) => {
    const text = "# A shared layout\nshared radial nested { one two three }";
    await typeSource(page, text);
    await expect(page.locator(".pg-status")).toContainText("4 boxes");
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page).toHaveURL(/#z:/);
    const url = page.url();
    await page.goto("about:blank");
    await page.goto(url);
    await expect(page.getByRole("textbox", { name: /The source of the layout/ })).toHaveValue(text);
    await expect(page.locator(".pg-status")).toContainText("4 boxes");
  });
});

test("each page of the sitemap opens and has one main heading", async ({ page, request }) => {
  const pages = await sitePages(request);
  expect(pages.length).toBeGreaterThan(10);
  for (const path of pages) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1"), path).toHaveCount(1);
  }
});

test("a missing page gives the 404 page", async ({ page }) => {
  const response = await page.goto("no-such-page/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
