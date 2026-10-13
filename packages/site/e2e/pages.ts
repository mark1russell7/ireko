/**
 * The pages of the built site, from its sitemap. The tests open each page, so a new page gets the same checks.
 */
import type { APIRequestContext } from "@playwright/test";

/** The origin and the base path of the published site. The sitemap gives absolute URLs with them. */
export const PUBLISHED = "https://mark1russell7.github.io/ireko/";

const locsOf = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? "");

/** This function gives the path of each page of the sitemap, relative to the base path: "" for the home page. */
export async function sitePages(request: APIRequestContext): Promise<string[]> {
  const index = await (await request.get("sitemap-index.xml")).text();
  const pages: string[] = [];
  for (const sitemap of locsOf(index)) {
    const xml = await (await request.get(sitemap.replace(PUBLISHED, ""))).text();
    pages.push(...locsOf(xml).map((loc) => loc.replace(PUBLISHED, "")));
  }
  return pages.toSorted((a, b) => a.localeCompare(b));
}

/** This function gives the name of the share card of a page: "index" for the home page. */
export const cardOf = (path: string): string => `og/${path.replace(/\/$/, "") || "index"}.png`;
