/**
 * The search and share checks: the head of each page, the share cards, the sitemap and the files for language models.
 */
import { expect, test } from "@playwright/test";
import { cardOf, PUBLISHED, sitePages } from "./pages.ts";

test("each page has a title, a description, a canonical address and its own share card", async ({ page, request }) => {
  const pages = await sitePages(request);
  for (const path of pages) {
    await page.goto(path);
    const title = await page.title();
    expect(title.length, path).toBeGreaterThan(10);
    expect(title.length, `${path}: a title for search has 70 characters or fewer`).toBeLessThanOrEqual(70);
    expect(title, path).not.toMatch(/STUB/);
    await expect(page.locator("head > title"), path).toHaveCount(1);
    const description = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    expect(description.length, `${path}: description`).toBeGreaterThanOrEqual(50);
    expect(description.length, `${path}: description`).toBeLessThanOrEqual(200);
    await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute("href", `${PUBLISHED}${path}`);
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image, path).toBe(`${PUBLISHED}${cardOf(path)}`);
    const card = await request.get(cardOf(path));
    expect(card.status(), `${path}: ${cardOf(path)}`).toBe(200);
    expect(card.headers()["content-type"], path).toBe("image/png");
    await expect(page.locator('script[type="application/ld+json"]'), path).toHaveCount(1);
  }
});

test("the structured data of the home page names the software", async ({ page }) => {
  await page.goto("");
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}") as { "@graph"?: { "@type": string }[] };
  expect(data["@graph"]?.map((item) => item["@type"])).toEqual(expect.arrayContaining(["WebSite", "SoftwareSourceCode", "SoftwareApplication"]));
});

test("the 404 page is not for the index", async ({ page }) => {
  await page.goto("404.html");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test("the sitemap lists the pages, and not the 404 page", async ({ request }) => {
  const pages = await sitePages(request);
  expect(pages).toEqual(expect.arrayContaining(["", "playground/", "learn/tour/"]));
  expect(pages.some((p) => p.startsWith("404"))).toBe(false);
});

test("llms.txt lists the pages, and each link opens", async ({ request }) => {
  const response = await request.get("llms.txt");
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text.startsWith("# ireko\n\n> ")).toBe(true);
  const links = [...text.matchAll(/\]\((https:\/\/mark1russell7\.github\.io\/ireko\/[^)]*)\)/g)].map((m) => (m[1] ?? "").replace(PUBLISHED, ""));
  expect(links.length).toBeGreaterThan(10);
  for (const link of links) expect((await request.get(link)).status(), link).toBe(200);
  const full = await request.get("llms-full.txt");
  expect(full.status()).toBe(200);
  expect((await full.text()).length).toBeGreaterThan(text.length);
});
