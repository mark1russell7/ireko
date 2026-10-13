// The site of ireko: the guide, the playground, the gallery and the reference.
// GitHub Pages serves it at /<repository>/. The Pages workflow sets SITE_BASE from the name of the repository.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { examples } from "../ireko/src/examples/index.ts";
import rehypeBase from "./scripts/rehype-base.mjs";

/**
 * This function gives the base path with one slash at the start and none at the end. Git Bash on Windows changes an
 * argument that starts with a slash into a Windows path, so the base can also come without its slash: SITE_BASE=ireko.
 */
const normalizeBase = (value) => `/${value.replace(/^.*[\\/](?=[^\\/]+[\\/]?$)/, "").replace(/^\/+|\/+$/g, "")}`;
const base = normalizeBase(process.env.SITE_BASE ?? "ireko");
const site = "https://mark1russell7.github.io";
// The share card of the pages without their own card. scripts/og-image.mjs draws each card with ireko itself.
const card = `${site}${base}/og/index.png`;
const docs = fileURLToPath(new URL("./src/content/docs/", import.meta.url));

/**
 * This function gives the date of the last commit of the page of a URL. With no git history (a shallow clone),
 * it gives no date, and the sitemap has no lastmod.
 */
const lastmodOf = (url) => {
  const path = new URL(url).pathname.slice(base.length).replace(/^\/+|\/+$/g, "") || "index";
  for (const file of [`${path}.mdx`, `${path}.md`, `${path}/index.mdx`, `${path}/index.md`]) {
    const full = join(docs, file);
    if (!existsSync(full)) continue;
    try {
      return execFileSync("git", ["log", "-1", "--format=%cI", "--", full], { encoding: "utf8" }).trim() || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export default defineConfig({
  site,
  base,
  trailingSlash: "ignore",
  // The content writes links from the root of the site ("/learn/tour/"), and this plugin adds the base path.
  markdown: { rehypePlugins: [rehypeBase(base)] },
  integrations: [
    sitemap({
      serialize: (item) => {
        const lastmod = lastmodOf(item.url);
        return lastmod === undefined ? item : { ...item, lastmod };
      },
    }),
    starlight({
      title: "ireko",
      description: "Composable graph and tree layout for TypeScript. Select a layout for each container, and get boxes and routed edges for SVG, Canvas, the DOM or React Flow.",
      head: [
        { tag: "meta", attrs: { property: "og:image", content: card } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { property: "og:image:alt", content: "ireko: nested boxes on graph paper. Each container selects its own layout." } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        { tag: "meta", attrs: { name: "twitter:image", content: card } },
        { tag: "meta", attrs: { name: "theme-color", content: "#f5f6f9", media: "(prefers-color-scheme: light)" } },
        { tag: "meta", attrs: { name: "theme-color", content: "#0e1220", media: "(prefers-color-scheme: dark)" } },
        { tag: "meta", attrs: { name: "author", content: "Mark Russell" } },
        {
          tag: "meta",
          attrs: {
            name: "keywords",
            content:
              "graph layout, tree layout, compound graph layout, nested graph, diagram layout, React Flow auto layout, React Flow subflows, xyflow, radial tree, grid layout, edge routing, orthogonal routing, layout engine, TypeScript, SVG, canvas, dagre alternative, elkjs alternative",
          },
        },
        // The owner proves the ownership of mark1russell7.github.io to Google Search Console with this tag.
        { tag: "meta", attrs: { name: "google-site-verification", content: "du_C4Y04G9XX4VZEjxZEcBq3e28zER6jS1H_NYgIaEY" } },
        { tag: "link", attrs: { rel: "manifest", href: `${base}/site.webmanifest` } },
      ],
      logo: { src: "./src/assets/mark.svg", replacesTitle: false },
      favicon: "/favicon.svg",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/mark1russell7/ireko" },
        { icon: "npm", label: "npm", href: "https://www.npmjs.com/package/ireko" },
      ],
      editLink: { baseUrl: "https://github.com/mark1russell7/ireko/edit/main/packages/site/" },
      customCss: [
        "@fontsource-variable/atkinson-hyperlegible-next",
        "@fontsource-variable/atkinson-hyperlegible-mono",
        "./src/styles/tokens.css",
        "./src/styles/theme.css",
        "./src/styles/widgets.css",
        "./src/styles/home.css",
        "./src/styles/docs.css",
        "./src/styles/figures.css",
      ],
      components: { Hero: "./src/components/Hero.astro" },
      expressiveCode: { defaultProps: { wrap: true } },
      routeMiddleware: "./src/routeData.ts",
      lastUpdated: true,
      sidebar: [
        { label: "Start", items: ["learn/tour", "learn/quick-start", { label: "Playground", link: "/playground/" }] },
        { label: "Learn", items: ["learn/modes", "learn/strategies", "learn/text-language", "learn/edges", "learn/renderers", "learn/custom-strategy"] },
        { label: "How it works", items: ["design/two-passes", "design/pipeline", "design/architecture"] },
        {
          label: "Gallery",
          collapsed: true,
          items: [{ label: "All examples", link: "/gallery/" }, ...examples.map((e) => ({ label: e.title, link: `/gallery/${e.name}/` }))],
        },
        { label: "Guides", items: ["guides/react-flow", "guides/server-svg"] },
        { label: "Compare", items: ["compare"] },
        { label: "Reference", items: ["reference/api", "reference/options", "reference/issues"] },
        { label: "About", items: ["about"] },
      ],
    }),
    react(),
  ],
  vite: {
    // The site uses the source of the workspace package, so a change of the library shows at once.
    resolve: { conditions: ["source"] },
  },
});
