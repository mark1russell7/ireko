/**
 * The head of each page, after Starlight makes it. This middleware sets the title for search, the share card, the
 * structured data and the base path of the links of the hero. It also keeps the 404 page out of the index.
 * Starlight starts it for each page (the `routeMiddleware` of the site config).
 */
import type { StarlightRouteData } from "@astrojs/starlight/route-data";
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import pkg from "ireko/package.json";
import font from "../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url";
import { AUTHOR, NAME, NPM, REPOSITORY, SITE } from "./lib/site.ts";

type HeadEntry = { tag: string; attrs?: Record<string, string | boolean | undefined>; content?: string };

const author = { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url };

const jsonLd = (data: unknown): HeadEntry => ({ tag: "script", attrs: { type: "application/ld+json" }, content: JSON.stringify(data).replace(/</g, "\\u003c") });

const homeData = (description: string): unknown => ({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE}#website`, name: NAME, url: SITE, description, inLanguage: "en" },
    {
      "@type": "SoftwareSourceCode",
      "@id": `${SITE}#software`,
      name: NAME,
      description,
      codeRepository: REPOSITORY,
      programmingLanguage: "TypeScript",
      runtimePlatform: ["Node.js", "Web browsers"],
      keywords: "graph layout, tree layout, compound graph, nested graph, React Flow, xyflow, diagram, SVG, canvas, TypeScript",
      license: "https://opensource.org/licenses/MIT",
      version: pkg.version,
      url: SITE,
      author,
    },
    {
      "@type": "SoftwareApplication",
      name: NAME,
      description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      softwareVersion: pkg.version,
      downloadUrl: NPM,
      sameAs: [REPOSITORY, NPM],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      url: SITE,
      author,
    },
  ],
});

const articleData = (url: string, title: string, description: string): unknown => ({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "TechArticle", headline: title, description, url, mainEntityOfPage: url, author, image: cardOf(url), about: { "@id": `${SITE}#software` } },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: NAME, item: SITE },
        { "@type": "ListItem", position: 2, name: title, item: url },
      ],
    },
  ],
});

/** This function gives the address of the share card of a page. scripts/og-image.mjs draws one card for each page. */
function cardOf(url: string): string {
  const path = url.slice(SITE.length).replace(/\/$/, "") || "index";
  return `${SITE}og/${path}.png`;
}

export const onRequest = defineRouteMiddleware((context) => {
  // The type of the locals comes from the generated types of Astro, which tsc does not read.
  const route = (context.locals as { starlightRoute: StarlightRouteData }).starlightRoute;
  const head = route.head as HeadEntry[];
  const page: unknown = route.entry;
  const data = (page as { data: unknown }).data as {
    title: string;
    description?: string;
    seoTitle?: string;
    hero?: { actions?: { link: string }[] };
  };
  const id = route.id;
  const home = id === "" || id === "index";
  const url = new URL(`${id}/`.replace(/^index\/$|^\/$/, ""), SITE).href;
  const meta = (key: "name" | "property", value: string): HeadEntry | undefined => head.find((entry) => entry.tag === "meta" && entry.attrs?.[key] === value);
  const setMeta = (key: "name" | "property", value: string, content: string): void => {
    const entry = meta(key, value);
    if (entry?.attrs !== undefined) entry.attrs["content"] = content;
    else head.push({ tag: "meta", attrs: { [key]: value, content } });
  };

  // The links of the hero start at the root of the site, so they get the base path here.
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  for (const action of data.hero?.actions ?? []) {
    if (action.link.startsWith("/") && !action.link.startsWith(`${base}/`)) action.link = `${base}${action.link}`;
  }

  // The title for search: a page can set seoTitle, and the heading keeps its title.
  const title = data.seoTitle ?? data.title;
  const full = title.includes(NAME) ? title : `${title} | ${NAME}`;
  const titleTag = head.find((entry) => entry.tag === "title");
  if (titleTag !== undefined) titleTag.content = full;
  setMeta("property", "og:title", title);
  setMeta("name", "twitter:title", title);
  const description = data.description ?? "";
  setMeta("name", "twitter:description", description);

  // The 404 page is not a page to index, and its address is not its own.
  if (id === "404") {
    for (let index = head.length - 1; index >= 0; index -= 1) {
      const entry = head[index];
      if ((entry?.tag === "link" && entry.attrs?.["rel"] === "canonical") || (entry?.tag === "meta" && entry.attrs?.["property"] === "og:url")) head.splice(index, 1);
    }
    head.push({ tag: "meta", attrs: { name: "robots", content: "noindex" } });
    return;
  }

  // Each page has its own share card.
  setMeta("property", "og:image", cardOf(url));
  setMeta("name", "twitter:image", cardOf(url));
  setMeta("property", "og:image:alt", `${title}: a layout of ireko on graph paper.`);

  // The text font, before the style sheet asks for it.
  head.push({ tag: "link", attrs: { rel: "preload", href: font, as: "font", type: "font/woff2", crossorigin: true } });
  head.push(jsonLd(home ? homeData(description) : articleData(url, title, description)));
});
