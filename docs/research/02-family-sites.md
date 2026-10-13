<!-- ste-disable -->
> **Raw research report (2026-10-12).** Topic: the sites of Vex, client, AsyncBrowserContext, render, lag and crawler. A research agent of the 2026-10-12 review wrote it. It is kept as evidence, with local paths shortened. The synthesis and the decisions are in [../REVIEW.md](../REVIEW.md). This file is not STE text.

# How the six example sites are built, and what Jqy should copy

Nothing was edited. All paths below are absolute.

## 0. Key findings

- **Two stacks share one design system.** The family look comes from `lag`. Every site has a byte-identical copy of the "ink on graph paper" token file (`src/styles/tokens.css`, with small additions in client and AsyncBrowserContext).
  - **Stack A: Astro 7 + Starlight 0.42 + React 19 islands.** Used by Vex, render and crawler. Content is static HTML. Pagefind search, Expressive Code and the sitemap come built in.
  - **Stack B: a custom Vite + React 19 (+ MDX 3) single-page app.** Used by lag, AsyncBrowserContext (ABC) and client. A Vite plugin prerenders each route in Chromium after the build. It writes one HTML file per route, an OG image per page, `sitemap.xml`, `404.html`, and `llms.txt` (client only).
  - The lineage is lag → ABC → client. client's files say "from the AsyncBrowserContext site".
- **Vex chose Astro on purpose.** `Vex/docs/REVIEW.md` §10.4, decision D6, says Astro + Starlight gives static, searchable pages, Expressive Code and a sidebar for free. The custom shell would have needed search, highlighting and prerendering built by hand.
- **Jqy is already part of this family.** `Vex/docs/research/03-lineage.md` says "Vex was taken out of Jqy" (`brand.ts` is byte-identical, `vectors.ts` differs only in imports).
  - Vex's site has a live Jqy page: `~/git/Vex/packages/site/src/content/docs/gallery/audit.mdx` with `AuditLab.tsx`. It shows "The output of the Jqy engine (commit 8848753) with the spacing 16". It is a natural cross-link.
- **No custom domain or CNAME anywhere.** Every site is a project site at `https://mark1russell7.github.io/<repo>/`.
  - The base path comes from `SITE_BASE: /${{ github.event.repository.name }}`.
  - ABC uses a capitalized base (`/AsyncBrowserContext/`) and it works. For Jqy the base would be `/Jqy/`, and every link and hard-coded base must use that exact case.
- **Closest model for Jqy: render.** It is an Astro site whose live hero is an SVG graph laid out by levels, with animated edges. Its viewer page embeds a full React app (`client:only="react"`), which is how a ReactFlow renderer would go in.
  - Vex adds doctests, axe checks and size budgets.
  - crawler adds the strongest SEO: route-middleware JSON-LD, `seoTitle`, a 404 with `noindex`, a link checker, and `llms.txt` built from data.

---

## 1. Stack for each site

| Repo | Site folder | Framework | Build | Output | Base handling | Deploy trigger | Search | Code highlight |
|---|---|---|---|---|---|---|---|---|
| Vex | `~/git/Vex/packages/site` (`@vex/site`) | Astro 7.3 + Starlight 0.42 + `@astrojs/react`; also `motion` ^14 and `fast-check` | `node scripts/gen-spec.mjs && astro build` (the workflow runs `report` first) | `packages/site/dist` | `base = process.env.SITE_BASE ?? "/vex"`, `trailingSlash: "ignore"` | push to main | Pagefind (Starlight) | Expressive Code + own `Code.tsx` for Vex chains |
| render | `~/git/render/packages/site` (`@render/site`) | Astro + Starlight + React | `node scripts/gen-docs.mjs && astro build` (`report` first) | `packages/site/dist` | `SITE_BASE ?? "/render"` | `workflow_run` after CI succeeds on main | Pagefind | Expressive Code |
| crawler | `~/git/crawler/packages/site` (`@crawler/site`) | Astro + Starlight + React; `routeMiddleware`, `lastUpdated` | `astro build` | `packages/site/dist` | `SITE_BASE ?? "/crawler"` | push to main | Pagefind | Expressive Code, `wrap: true` |
| lag | `~/git/lag/packages/site` (`@lag/site`) | Vite 7 + React 19 + React Router 7 + MDX 3; Observable Plot, Mermaid, `@xyflow/react` | `vite build` (Chromium prerender in the plugin) | `packages/site/dist` | `normalizeBase(process.env.SITE_BASE)`, `SITE_BASE=lag` (no slashes, because Git Bash mangles `/lag`) | push to main (and a macOS Safari job) | none | none |
| ABC | `~/git/AsyncBrowserContext/site` | Vite 8 + React 19 + React Router 8 + MDX 3 + Shiki; Plot, Mermaid; Babel in the browser | `vite build` | `site/dist` | `SITE_BASE: ${{ github.event.repository.name }}` | push to main | build-time index (`build/search-index.ts`, `src/search/Search.tsx`) | Shiki (`@shikijs/rehype`) |
| client | `~/git/client/packages/site` (`@procedures/site`) | Vite 6 + React 19, custom path router (`src/lib/router.ts`), no MDX (`marked` + `highlight.js`) | `node scripts/gen-data.mjs && vite build` | `packages/site/dist` | `normalizeBase(SITE_BASE ?? "/client/")` | `workflow_run` after CI; e2e runs before deploy | Ctrl+K command palette, fuzzy search over a generated index | highlight.js |

**Fonts, the same everywhere.** Self-hosted `@fontsource-variable/atkinson-hyperlegible-next` and `@fontsource-variable/atkinson-hyperlegible-mono`. No Google Fonts.
- In Astro they load through Starlight `customCss`.
- In Vite sites, a `fontPreloadPlugin` (`build/font-preload-plugin.ts`) injects `<link rel="preload" as="font">`.
- crawler preloads the woff2 from `routeData.ts`.

### render's Astro config (the best template for Jqy)

`~/git/render/packages/site/astro.config.mjs`:
```js
// The site of render: the guide, the live viewer and the review. GitHub Pages serves it at /render/.
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const base = process.env.SITE_BASE ?? "/render";
const site = "https://mark1russell7.github.io";

// The share card of each page (Open Graph and Twitter). scripts/brand-images.mjs renders it.
const card = `${site}${base}/og.png`;
const cardAlt =
  "render: an interface that renders its own expressions. A graph of nodes on graph paper, with the order of one epoch.";

export default defineConfig({
  site,
  base,
  trailingSlash: "ignore",
  integrations: [
    starlight({
      title: "render",
      description: "A reactive expression engine whose interface renders its own expressions.",
      logo: { src: "./src/assets/mark.svg", replacesTitle: false },
      favicon: "/favicon.svg",
      head: [
        { tag: "meta", attrs: { property: "og:image", content: card } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { property: "og:image:alt", content: cardAlt } },
        { tag: "meta", attrs: { name: "twitter:image", content: card } },
        { tag: "meta", attrs: { name: "twitter:image:alt", content: cardAlt } },
        { tag: "meta", attrs: { name: "theme-color", content: "#f5f6f9", media: "(prefers-color-scheme: light)" } },
        { tag: "meta", attrs: { name: "theme-color", content: "#0e1220", media: "(prefers-color-scheme: dark)" } },
        { tag: "meta", attrs: { name: "author", content: "Mark Russell" } },
        {
          tag: "meta",
          attrs: {
            name: "keywords",
            content:
              "reactive programming, TypeScript, expression engine, dataflow, dependency graph, incremental computation, live programming, visual editor, formula language, signals, spreadsheet engine",
          },
        },
        // The owner proves the ownership of the site to Google Search Console with this tag.
        { tag: "meta", attrs: { name: "google-site-verification", content: "du_C4Y04G9XX4VZEjxZEcBq3e28zER6jS1H_NYgIaEY" } },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: `${base}/apple-touch-icon.png` } },
        { tag: "link", attrs: { rel: "manifest", href: `${base}/site.webmanifest` } },
      ],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/mark1russell7/render" }],
      editLink: { baseUrl: "https://github.com/mark1russell7/render/edit/main/packages/site/" },
      customCss: [
        "@fontsource-variable/atkinson-hyperlegible-next",
        "@fontsource-variable/atkinson-hyperlegible-mono",
        "./src/styles/tokens.css",
        "./src/styles/theme.css",
        "./src/styles/home.css",
      ],
      components: { Hero: "./src/components/Hero.astro" },
      sidebar: [
        { label: "Learn", items: ["learn/tour", "learn/nodes", "learn/expressions", "learn/classes", "learn/splay", "learn/lod"] },
        { label: "Viewer", items: ["viewer"] },
        { label: "Reference", items: ["reference/api", "reference/extension"] },
        { label: "Design", items: ["design/architecture", "design/review", "design/decisions"] },
        { label: "About", items: ["about"] },
      ],
    }),
    react(),
  ],
});
```

How the other two Astro configs differ:
- **Vex** (`~/git/Vex/packages/site/astro.config.mjs`) adds an Expressive Code plugin. It sets `tabIndex: 0` on each `<pre>`, so a keyboard can scroll a code block.
- **crawler** adds:
  - `expressiveCode: { defaultProps: { wrap: true } }`
  - `routeMiddleware: "./src/routeData.ts"`
  - `lastUpdated: true` (needs `fetch-depth: 0`)
  - a second social link (`{ icon: "npm", ... }`) and `twitter:card summary_large_image`
  - a `content.config.ts` that extends `docsSchema` with `seoTitle: z.string().optional()`

### The custom Vite build (stack B)

The pipeline lives in `~/git/lag/packages/site/build/static-site-plugin.ts`. ABC's and client's `spa-fallback-plugin.ts` are near-copies. After `vite build`, it does this:
1. Copies `index.html` to `404.html`. GitHub Pages serves it for unknown paths, and the client router shows the page. lag adds `noindex`.
2. Launches Chromium (Playwright) with `reducedMotion: "reduce"`, `colorScheme: "light"` and `timezoneId: "UTC"`. It serves `dist/` through `context.route` with no network.
   - It waits until no element matches `[data-loading]` (`src/lib/readiness.ts`), then until the DOM is quiet for 200 ms, then `document.fonts.ready`.
   - It captures `#root`. It rewrites literal token colors in `style` and SVG attributes to `var(--token)`, so the static HTML still follows dark mode.
3. Writes `<route>.html` and `<route>/index.html` for each route, with that route's head tags and the captured body (`data-prerendered="<route>"`).
4. Renders a 1200×630 OG PNG for each route to `og/<path>.png` from an HTML template with the fonts inlined as base64.
5. Writes `sitemap.xml`. lag also writes `robots.txt`; client also writes `llms.txt`.
6. `SITE_PRERENDER=0` builds without Chromium. In client, `SITE_PRERENDER=1` makes Chromium required.

**No-flash handoff** (`client/packages/site/src/lib/prerender-handoff.ts`, from ABC). The app renders into a hidden sibling with `identifierPrefix: "app-"`. When it is ready, it swaps in for the prerendered root and keeps the scroll position.

**No-flash theme script** in `index.html`. lag uses the key `lag-site:theme`, ABC `abc-site:theme`, client `theme`:
```html
<script>
    // Apply the stored theme before the first paint, so the page does not flash.
    (function () {
        try {
            var theme = window.localStorage.getItem("lag-site:theme");
            if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
        } catch (error) {
            // The storage is not available. The page uses the system theme.
        }
    })();
</script>
```

---

## 2. GitHub Pages deployment

Common to all six:
- The Pages source is "GitHub Actions" (`actions/upload-pages-artifact` + `actions/deploy-pages`).
- `concurrency: pages`.
- The pnpm version comes from `packageManager` (pnpm@12.10.1 in Vex, render, crawler and client; lag pins pnpm 10).
- Actions are pinned to a SHA in Vex, crawler and ABC, and to a tag in render, client and lag.

### render `pages.yml` (Astro, gated on CI, pings IndexNow)
```yaml
# Builds packages/site and publishes it to GitHub Pages at https://mark1russell7.github.io/render/.
# The Pages source of the repository is "GitHub Actions" (Settings > Pages).
# It starts after CI passes on main, thus the site never shows a commit that failed its checks.
name: Pages

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# One deployment at a time. A newer push cancels a deployment that waits.
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
          # The commit that CI checked
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
      # The pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # The test report: the review page shows the status of the regression test of each defect
      - run: pnpm --filter @render/site run report
      - run: pnpm --filter @render/site run build
        env:
          SITE_BASE: /${{ github.event.repository.name }}
          ASTRO_TELEMETRY_DISABLED: "1"
      - uses: actions/upload-pages-artifact@v5
        with:
          path: packages/site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5

  # The search engines of IndexNow learn about each page. A failure here does not fail the deployment.
  indexnow:
    needs: deploy
    runs-on: ubuntu-latest
    timeout-minutes: 5
    continue-on-error: true
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
          sparse-checkout: packages/site/scripts
      - uses: actions/setup-node@v7
        with:
          node-version: 26
      - run: node packages/site/scripts/indexnow.mjs
```

### crawler `pages.yml` (Astro, least privilege, full history for "last updated")
```yaml
# Builds packages/site and publishes it to GitHub Pages at https://mark1russell7.github.io/crawler/.
# The Pages source of the repository is "GitHub Actions" (Settings > Pages).
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

# One deployment at a time. A newer push cancels a deployment that waits.
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  # The build installs and runs the code of the repository, so it gets only "contents: read".
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          # The whole history, so that the "last updated" date of each page comes from its last commit
          fetch-depth: 0
      # The pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @crawler/site run build
        env:
          SITE_BASE: /${{ github.event.repository.name }}
          ASTRO_TELEMETRY_DISABLED: "1"
      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: packages/site/dist

  # The deployment runs no code of the repository. Only this job can write to Pages.
  deploy:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
```

### client `pages.yml` (custom prerender; e2e before deploy; IndexNow)
```yaml
# Builds packages/site and publishes it to GitHub Pages at https://mark1russell7.github.io/client/.
# The Pages source of the repository is "GitHub Actions" (Settings > Pages).
#
# The workflow starts when CI passes on main, so a commit that fails CI never reaches the
# site (deep dive SITE-10). It builds the commit that CI tested, runs the browser smoke test
# against the built site, then deploys. Only the deploy job can write to Pages: the build job
# runs install scripts, so it gets read access only.
name: Pages

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

# One deployment at a time. A deployment that started finishes: a newer run waits for it.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    if: >-
      github.event_name == 'workflow_dispatch' ||
      (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push')
    runs-on: ubuntu-latest
    timeout-minutes: 25
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          # The commit that CI tested. A manual run builds the selected branch.
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
          # The whole history: the status board of the site links each commit hash of the status
          # documents to its repository, and git tells which hashes are commits of this one
          fetch-depth: 0
          persist-credentials: false
      # The pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # The build of the site renders each page in Chromium (an HTML file for each page, and its
      # Open Graph image), and the smoke test uses it too
      - name: Install Chromium for Playwright
        run: pnpm --filter @procedures/site exec playwright install --with-deps chromium
      # The data of the site comes from the dist/ of every package. The site depends on each
      # package that registers procedures, so `pnpm build` builds the site last.
      # SITE_PRERENDER=1: the deploy has the prerendered pages, or the build fails.
      - run: pnpm build
        env:
          SITE_BASE: /${{ github.event.repository.name }}/
          SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/
          SITE_PRERENDER: "1"
      - name: Browser smoke test of the built site
        run: pnpm --filter @procedures/site test:e2e
        env:
          SITE_BASE: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v5
        with:
          path: packages/site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5

  # Tell the IndexNow search engines (Bing and others) about the pages of the new deploy. A
  # failure here does not fail the deploy.
  indexnow:
    needs: deploy
    runs-on: ubuntu-latest
    timeout-minutes: 5
    continue-on-error: true
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
          sparse-checkout: packages/site/scripts
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: node packages/site/scripts/indexnow.mjs "https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/"
```

The other three, compared with these:
- **Vex `pages.yml`** is like crawler's, but it sets top-level `pages: write` / `id-token: write`, has no `fetch-depth`, and runs `pnpm --filter @vex/site run report` (the living-spec test report) before the build.
- **ABC `pages.yml`:**
  - `fetch-depth: 0`, because the sitemap gets `<lastmod>` from `git log`.
  - Installs Chromium.
  - Sets `SITE_BASE: ${{ github.event.repository.name }}` and `SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/`.
  - The deploy job has `if: ${{ github.event.repository.has_pages }}`.
- **lag `pages.yml`:**
  - Has a `safari` job on `macos-latest` (safaridriver, App Nap off, iOS simulator) before the build.
  - Downloads the newest mutation report and the Safari reports, runs `pnpm results`, and fails the build if `public/data/results/index.json` is empty.
  - Then builds with `SITE_BASE`/`SITE_URL`.

**IndexNow script** (`render/packages/site/scripts/indexnow.mjs`). A key file `public/<KEY>.txt` must exist; render and client each have their own key.
```js
const KEY = "d081d74399af0acaa87d7d6a8a8d090c";
const site = "https://mark1russell7.github.io/render/";

const index = await (await fetch(new URL("sitemap-index.xml", site))).text();
const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((m) => m[1]);
const urls = [];
for (const map of maps) {
  const xml = await (await fetch(map)).text();
  urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((m) => m[1]));
}
const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "mark1russell7.github.io", key: KEY, keyLocation: new URL(`${KEY}.txt`, site).href, urlList: urls }),
});
console.info(`IndexNow: ${String(urls.length)} pages, status ${String(response.status)}`);
if (!response.ok && response.status !== 202) process.exitCode = 1;
```

---

## 3. Information architecture, API reference, live code

### Sidebars and navigation

**Vex** (Starlight sidebar):
- Learn: tour, concepts, spreadsheet, sheets, axes, errors
- Lab
- Spec: spec, spec/regressions
- "Why none?": autogenerated `errors/*` (args, calc, cycle, depth, na, name, num, ref, value; one page per error code)
- Reference: api, domains, ir
- Gallery: layout, **audit (Jqy)**, grid, life, laws, spreadsheets, simulations
- Ideas: comonad, lineage, about
- Also a full-window app at `/app/` (`src/pages/app/index.astro`, outside the Starlight layout, with its own `<head>`).

**render:**
- Learn: tour, nodes, expressions, classes, splay, lod
- Viewer: a splash page that embeds the whole React viewer app
- Reference: api, extension
- Design: architecture; review and decisions, both generated from `docs/REVIEW.md` and `docs/DECISIONS.md` by `scripts/gen-docs.mjs`
- About

**crawler:**
- Start: quick-start, mcp, how-it-works, politeness, compare
- Tools: robots-txt-tester, page-reader, opening-hours
- Field notes: a data study of the robots.txt files of 1,000 domains, and a restaurant survey
- Reference: api, cli
- For site owners: bot, block-ai-training-crawlers
- Plus a custom `404.mdx`

**lag:** the header nav comes from one array (`src/app/sections.tsx`): Home, Docs, Thesis, Research, Results, Playground. That array drives the nav, the routes and the home cards. Docs has concepts/, monitors/ (21), operations/, testing/ and contributing/.

**ABC:**
- Home
- Docs: getting-started, concepts/*, guides/*, api, design, contributing
- Explore: debugger, playground, timeline, transform, events, diagrams
- Testing: results, performance

**client:**
- Nav: Composer, Docs, Procedures (catalog, one page per procedure, 250+ in the sitemap), Architecture, Lab, "What Claude sees", Status
- Ctrl+K command palette, skip link, a footer with the commit hash

### Home page pattern (all six)
- **Left column:** an H1 (some sites add an eyebrow line), a one-sentence tagline, an install box with a Copy button, and CTA buttons (a primary "Take the tour" / "Start in two minutes" plus minimal secondary links).
- **Right column:** a live demo panel. Two columns at ≥64–72rem, stacked below that.
- A graph-paper background behind the hero, faded at the edges with a radial mask.
- Then cards (Starlight `CardGrid`, `LinkCard`, or Vex's SVG `Showcase.astro`), a "Use it in your code" sample, and links.

In Starlight, the hero is overridden through `components: { Hero: "./src/components/Hero.astro" }`. render's version:
```astro
---
import Default from "@astrojs/starlight/components/Hero.astro";
import CopyInstall from "./CopyInstall.tsx";
import LiveHero from "./LiveHero.tsx";

const home = Astro.locals.starlightRoute.id === "" || Astro.locals.starlightRoute.id === "index";
---

{
  home ? (
    <div class="rh-hero">
      <div class="rh-hero-copy">
        <Default />
        <CopyInstall client:idle />
      </div>
      <LiveHero client:load />
    </div>
  ) : (
    <Default />
  )
}
```
The home page is `src/content/docs/index.mdx` with `template: splash` and a `hero:` frontmatter block (title, tagline, actions with `icon: right-arrow` / `variant: minimal`).

### API reference: written by hand everywhere (no TypeDoc in use)
- **render** (`reference/api.mdx`): one `## \`@scope/pkg\`` section per package, each with an `| Export | Purpose |` table.
- **crawler** (`reference/api.mdx`): an options table `| Option | Type | Default | What it does |`, then `### method()` sections.
- **Vex** (`reference/api.mdx`): prose plus ` ```ts doctest ` blocks. `scripts/doctest.ts` extracts every doctest block from the MDX and the READMEs into `.doctest/*.test.ts`.
  - `expr; // => value` becomes `expect().toEqual`.
  - `// : Type` becomes `expectTypeOf`.
  - `// type error` becomes `@ts-expect-error`.
  - Then `tsc` and Vitest run them (`pnpm test:docs`, in CI).
- **Generated pages instead:** Vex's spec pages come from `spec/README.md` with `<Req id>` chips that show the test status from `src/data/test-report.json`. render's review page has `<Regression id>` chips. client generates docs pages from each package README (`scripts/docs-data.mjs`). lag has metric tables built from the code's catalog.

### How live code runs
- **Astro sites:** React islands import the real workspace packages (`"@mark1russell7/vex": "workspace:*"`), using `client:load` (hero), `client:visible` (widgets below the fold), `client:idle` (copy button) and `client:only="react"` (the render viewer, because it measures the DOM).
  - Vex Lab: a safe chain parser (`src/lib/chain-parser.ts`, no `eval`), a transparent `<textarea>` over a highlighted copy, a wavy underline on errors, and shareable state in `location.hash` as base64url JSON.
  - Vex law arena: runs fast-check in the browser.
- **lag:** Vite `resolve.alias` points the packages at workspace `src/`. The real monitors run in the page and in a Worker. Charts use Observable Plot through a `PlotFigure` wrapper that always offers a data table. There is a canvas session timeline (`src/playground/timeline/draw.ts`).
- **ABC:** the site builds with the library's own Vite plugin (`asyncContext({ include })`). The Playground lazy-loads `@babel/core` plus the library preset in the browser (`node:path` aliased to `pathe`), compiles user code, runs it with a step limit, and shares it through `#code=` base64url.
- **client:** programs run in a Web Worker with an 8 s limit. Share links use `?p=`. A link from someone else does not run until the reader presses Run.

---

## 4. Visual design language

**Concept** (the comment in every `tokens.css`): "Ink on graph paper. Hairlines, no shadows, no gradients. Blue ink for links, focus and the focus of an evaluation. Red pencil marks an error value." In lag: "Red pencil marks the time that the main thread loses."

### The token block

This is verbatim from Vex, render and crawler `src/styles/tokens.css`. lag's differs only in its header comment.
- client adds `--color-on-accent: #ffffff` (light) / `#0e1220` (dark).
- ABC adds `--header-min-height: 3.5rem` and `@media (max-width: 34rem) { :root { --header-height: 6.25rem; } }`.

```css
:root {
    color-scheme: light;

    --color-page: #f5f6f9;
    --color-surface: #ffffff;
    --color-surface-sunken: #eef1f6;
    --color-ink: #151c2e;
    --color-ink-secondary: #454f67;
    --color-ink-muted: #5f6880;
    --color-rule: #d6dbe5;
    --color-rule-strong: #aeb6c7;
    --color-control-border: #7a8399;
    --color-grid: #e7eaf1;
    --color-accent: #2346c4;
    --color-accent-strong: #172f8f;
    --color-accent-wash: #e7ecfd;
    --color-mark: #c2301f;
    --color-mark-wash: #fbe9e6;

    /* Status colors have a fixed meaning. Always show them with an icon and a label. */
    --status-good: #0ca30c;
    --status-good-ink: #006300;
    --status-warning: #fab219;
    --status-warning-ink: #7a5200;
    --status-critical: #d03b3b;
    --status-critical-ink: #a3262a;
    --status-neutral: #8a91a3;

    /* Chart series, in fixed order (validated for color vision deficiency on #ffffff). */
    --series-1: #2a78d6;
    --series-2: #eb6834;
    --series-3: #1baf7a;
    --series-4: #eda100;
    --series-5: #e87ba4;
    --series-6: #008300;
    --series-7: #4a3aa7;
    --series-8: #e34948;
    --chart-grid: #e6e9f0;
    --chart-axis: #9aa1b3;

    --font-sans: "Atkinson Hyperlegible Next Variable", "Atkinson Hyperlegible Next", system-ui, sans-serif;
    --font-mono: "Atkinson Hyperlegible Mono Variable", "Atkinson Hyperlegible Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;

    /* Type scale (17 px base). */
    --text-xs: 0.8125rem;
    --text-sm: 0.9375rem;
    --text-base: 1.0625rem;
    --text-lg: 1.25rem;
    --text-xl: 1.5rem;
    --text-2xl: 2rem;
    --text-3xl: 2.75rem;

    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-5: 1.5rem;
    --space-6: 2rem;
    --space-7: 2.5rem;
    --space-8: 3rem;
    --space-10: 4rem;

    --radius: 6px;
    --radius-small: 3px;
    --measure: 68ch;
    --page-width: 82rem;
    --header-height: 3.5rem;
    --gutter: clamp(1rem, 3vw, 2rem);
}

:root[data-theme="dark"] {
    color-scheme: dark;

    --color-page: #0e1220;
    --color-surface: #151a2b;
    --color-surface-sunken: #1c2236;
    --color-ink: #e6e9f3;
    --color-ink-secondary: #b3bad0;
    --color-ink-muted: #949cb3;
    --color-rule: #2b3350;
    --color-rule-strong: #46507a;
    --color-control-border: #6f7aa3;
    --color-grid: #1b2134;
    --color-accent: #93abff;
    --color-accent-strong: #bccbff;
    --color-accent-wash: #1f2a4f;
    --color-mark: #ff7b6b;
    --color-mark-wash: #3a1f22;

    --status-good-ink: #4cc94c;
    --status-warning-ink: #fab219;
    --status-critical-ink: #ff8a8a;
    --status-neutral: #8a91a3;

    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --series-4: #c98500;
    --series-5: #d55181;
    --series-6: #008300;
    --series-7: #9085e9;
    --series-8: #e66767;
    --chart-grid: #232a40;
    --chart-axis: #5d6683;
}

@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
        /* the same dark block repeated */
    }
}
```

### Starlight mapping

From `Vex/packages/site/src/styles/theme.css`; render and crawler are identical except for their prefixes `rd-` and `pc-`.
```css
/*
 * The family tokens (tokens.css) mapped to the variables of Starlight. Starlight and the tokens both use the
 * attribute data-theme on the html element, so the light and the dark theme follow the same switch.
 * In Starlight, "white" is the text with the most contrast and "black" is the page, in both themes.
 */
:root,
:root[data-theme="light"],
:root[data-theme="dark"] {
  --sl-font: var(--font-sans);
  --sl-font-mono: var(--font-mono);
  --sl-color-accent-low: var(--color-accent-wash);
  --sl-color-accent: var(--color-accent);
  --sl-color-accent-high: var(--color-accent-strong);
  --sl-color-white: var(--color-ink);
  --sl-color-gray-1: var(--color-ink);
  --sl-color-gray-2: var(--color-ink-secondary);
  --sl-color-gray-3: var(--color-ink-muted);
  --sl-color-gray-4: var(--color-rule-strong);
  --sl-color-gray-5: var(--color-rule);
  --sl-color-gray-6: var(--color-surface-sunken);
  --sl-color-gray-7: var(--color-surface);
  --sl-color-black: var(--color-page);
  --sl-color-bg-nav: color-mix(in srgb, var(--color-page) 92%, transparent);
  --sl-color-bg-sidebar: var(--color-page);
  --sl-color-hairline: var(--color-rule);
  --sl-color-hairline-light: var(--color-rule);
  --sl-color-hairline-shade: var(--color-rule-strong);
  --sl-color-red: var(--color-mark);
  --sl-color-red-low: var(--color-mark-wash);
  --sl-color-red-high: var(--color-mark);
}

header.header {
  backdrop-filter: blur(6px);
}

.graph-paper {
  background-color: var(--color-surface);
  background-image:
    linear-gradient(var(--color-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
  background-size: 16px 16px;
  background-position: -1px -1px;
}

.vx-frame {            /* the "widget frame": the family card */
  margin-block: var(--space-5);
  border: 1px solid var(--color-rule);
  border-top: 3px solid var(--color-ink);
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--color-surface);
  overflow: hidden;
}
```

### Hero CSS

Vex `theme.css`; render's `.rh-hero::before` is the same idea with `mask-image: radial-gradient(ellipse 70% 75% at 65% 45%, #000 30%, transparent 78%)`.
```css
.vx-hero { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-6, 2rem); align-items: center; }
/* Graph paper behind the hero. It fades out at the edges. */
.vx-hero::before {
  content: ""; position: absolute; z-index: -1; inset: -3rem -1rem;
  background-image: linear-gradient(var(--color-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(ellipse 70% 65% at 50% 45%, #000 30%, transparent 75%);
  pointer-events: none;
}
.vx-hero div .hero { grid-template-columns: minmax(0, 1fr); }
.vx-hero div .hero h1 {
  background: linear-gradient(120deg, var(--color-ink) 30%, var(--color-accent));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
@media (min-width: 64rem) {
  .vx-hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .vx-hero .hero .stack, .vx-hero .hero .copy { text-align: start; align-items: flex-start; }
}
.vx-hero-live { margin: 0; box-shadow: 0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -12px rgb(0 0 0 / 0.18);
  border: 1px solid var(--color-rule-strong); border-radius: var(--radius, 6px); background: var(--color-surface); overflow: hidden; }
```
Hero H1 sizes:
- crawler: `font-size: clamp(2.5rem, 6vw, 4.25rem); line-height: 1.02; letter-spacing: -0.025em; max-width: 16ch`
- render: `clamp(2.75rem, 1.5rem + 5vw, 4.75rem)`
- lag/ABC: `clamp(2.1rem, 1.4rem + 3vw, var(--text-3xl)); font-weight: 800`

client's eyebrow is mono, accent-colored text with a 1.75rem × 2px accent bar before it (`.hero-eyebrow::before`). The H1 has a second line in the accent color (`.hero-accent { display:block; color: var(--color-accent) }`).

### Signature patterns repeated across sites
- **Graph paper:** a 16px grid inside widgets, 24px behind the hero, 32px on OG cards.
- **Cards and widget frames:** `border-top: 3px solid var(--color-ink)` (or the accent, in render's live panel), `border-radius: 0 0 6px 6px`, hairline sides.
- **Sticky header:** `color-mix(in srgb, var(--color-page) 92%, transparent)` with `backdrop-filter: blur(6px)`.
- **Buttons:** `[data-variant="primary"]` gets an accent fill. `aria-pressed="true"` gets the accent fill. Hover changes the border to the accent.
- **Chips:** `border-radius: 999px`, a mono font, `data-state="pass|fail|unknown"`. Fail uses the mark color; unknown has a dashed border.
- **Install box:** a mono pill or box with a Copy button. crawler's version (`CopyInstall.tsx`) also has an `execCommand` fallback, an `aria-live` message, and words wrapped in spans so a command never breaks inside a word.
- **Brand marks:** 32×32 SVGs on a 8px grid (`src/assets/mark.svg`). The favicon adapts to `prefers-color-scheme` with an inner `<style>`. The motif is one shape per site: lag a strip of frame ticks with one tall red tick; render nodes on a grid; Vex two boxes with an arrow and a red dot; crawler request bars with a red slash.
- **Syntax colors** (Vex): `light-dark(#7a2aa8, #d6a8ff)` for keywords, `light-dark(#17692f, #8fdc9f)` for strings, `light-dark(#9a4500, #ffbb7a)` for numbers.

### Dark and light mode
- **Starlight:** its own toggle, the `data-theme` attribute and the `starlight-theme` localStorage key. Tokens.css switches on the same attribute. Vex's `/app/` page reads `starlight-theme` to match.
- **Custom sites:** a three-state toggle, system → light → dark (`lag/packages/site/src/theme/ThemeToggle.tsx`, with sun, moon and half-circle SVG icons), `useSyncExternalStore` on the media query, and `theme/colors.ts`, which reads CSS variables so Plot, Mermaid and React Flow get real colors.
- `theme-color` meta: either a light/dark pair (render, lag, client) or a single color (Vex `#1f3fbf`, crawler `#2346c4`).

### Animations (all behind `prefers-reduced-motion` plus a global kill rule)

Every live hero pauses off screen (`IntersectionObserver`), and render also pauses on `visibilitychange`.
- **Vex LiveHero** (`Vex/packages/site/src/components/LiveHero.tsx`): an SVG `<pattern>` grid. Nine boxes drift and bounce on a `requestAnimationFrame` loop. Each frame, two compiled programs run per box: arrows go to the nearest box, and overlapping boxes get a red edge. Pointing at a box shows dashed lines with distances. A counter shows "N programs in X ms each frame", with a Play/Pause button. It starts paused with reduced motion.
- **render LiveHero** (`render/packages/site/src/components/LiveHero.tsx` plus `src/styles/home.css`): a real store of nine nodes, laid out by dependency level. It uses two layouts, "across" (columns) and "down" (rows), and switches with a `@container (max-width: 36rem)` query. Edges are cubic Béziers with arrow markers.
  - Each tick writes `qty`. Nodes light in the order of the epoch, 120 ms per step, with a numbered order badge.
  - `data-state` drives the CSS: idle, written, current, changed, same. "Same" has a dashed red border.
  - Edges in the "flow" state animate `stroke-dashoffset` (the keyframe `rh-flow`). A breathing green dot shows that it is live.
- **Vex Showcase** (`Showcase.astro`): static SVG card art. On hover the card lifts with `translateY(-3px)`, and SVG parts animate: a caret blinks, edges flow, cells pulse, bars shrink.
- **crawler:**
  - The study teaser is a 40-column grid with a clip-path "scan" animation (`pc-scan`).
  - `LiveCrawl.tsx` runs the real `HostScheduler` on a virtual clock, with lanes per host and a polite vs. impolite toggle.
  - `AgentReplay.tsx` steps through a real MCP session.
  - `Pipeline.tsx` is a clickable stage diagram that becomes a numbered list on narrow screens.
- **client:**
  - `Onion.tsx`: rings of middleware layers. Request dots and result particles move with rAF outside React.
  - `Journey.tsx`: a token moves across lanes, with a scrubber and 0.5×/1×/2× speeds.
  - `ProgramGraph.tsx`: an SVG tree with `$ref` dashed edges, using the WAI-ARIA tree keyboard pattern.
  - `LiveHero.tsx`: replays a real Web Worker trace, 170 ms per step.
- **lag:** a canvas timeline, a React Flow architecture map with a "show as list" fallback, and Plot charts that always have a data table.

**Accessibility conventions:**
- Every chart has a data table, every diagram has its source, and the map has a list.
- Skip link and a route announcer in the custom sites.
- Status always uses an icon plus a label, never color alone.
- `role="img"` or `aria-label` on SVGs; focusable nodes (`tabIndex={0}`) that show a caption on focus.
- `[role="region"][tabindex="0"]` for scroll areas.

---

## 5. SEO and social

### Full prerendered `<head>`

From `~/git/client/packages/site/dist/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <link rel="preload" as="font" type="font/woff2" crossorigin="" href="/client/assets/atkinson-hyperlegible-mono-latin-wght-normal-CoA7y8X5.woff2">
    <link rel="preload" as="font" type="font/woff2" crossorigin="" href="/client/assets/atkinson-hyperlegible-next-latin-wght-normal-BcXVPD7q.woff2">

    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Typed procedures as data for TypeScript: CLI, HTTP and MCP | client</title>
    <link rel="canonical" href="https://mark1russell7.github.io/client/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="client" />
    <meta property="og:title" content="Typed procedures as data for TypeScript: CLI, HTTP and MCP | client" />
    <meta property="og:description" content="One typed procedure registry for your code, a CLI, HTTP, WebSocket and Claude Code (MCP). Compose calls as JSON, with streaming and a visual composer." />
    <meta property="og:url" content="https://mark1russell7.github.io/client/" />
    <meta property="og:image" content="https://mark1russell7.github.io/client/og/index.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="client: Typed procedures as data. A program of procedure calls as a tree on graph paper." />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Typed procedures as data for TypeScript: CLI, HTTP and MCP | client" />
    <meta name="twitter:description" content="One typed procedure registry for your code, a CLI, HTTP, WebSocket and Claude Code (MCP). Compose calls as JSON, with streaming and a visual composer." />
    <meta name="twitter:image" content="https://mark1russell7.github.io/client/og/index.png" />
    <meta name="twitter:image:alt" content="client: Typed procedures as data. A program of procedure calls as a tree on graph paper." />
    <link rel="sitemap" type="application/xml" href="https://mark1russell7.github.io/client/sitemap.xml" />
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","@id":"https://mark1russell7.github.io/client/#website","url":"https://mark1russell7.github.io/client/","name":"client","description":"One typed procedure registry for your code, a CLI, HTTP, WebSocket and Claude Code (MCP). Compose calls as JSON, with streaming and a visual composer.","inLanguage":"en"},{"@type":"SoftwareSourceCode","@id":"https://mark1russell7.github.io/client/#software","name":"@procedures/client","alternateName":"client","description":"Typed procedures as data for TypeScript. One procedure registry for your code, a CLI, HTTP, WebSocket and the MCP tools of Claude Code, with streaming, middleware and a visual composer.","url":"https://mark1russell7.github.io/client/","codeRepository":"https://github.com/mark1russell7/client","programmingLanguage":"TypeScript","runtimePlatform":["Node.js","Web browsers"],"keywords":"typescript, rpc, procedures, json, mcp, model context protocol, claude code, cli, websocket, streaming, middleware, workflow","license":"https://opensource.org/licenses/MIT","version":"0.1.0","author":{"@type":"Person","name":"Mark Russell"}}]}</script>
    <style data-prerender>
:root[data-theme] [data-prerendered] .theme-toggle{visibility:hidden}
    </style>
    <meta name="description" content="One typed procedure registry for your code, a CLI, HTTP, WebSocket and Claude Code (MCP). Compose calls as JSON, with streaming and a visual composer." />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#f5f6f9" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0e1220" media="(prefers-color-scheme: dark)" />
    <meta name="author" content="Mark Russell" />
    <link rel="icon" href="/client/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/client/icons/icon-32.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/client/icons/apple-touch-icon.png" />
    <link rel="manifest" href="/client/site.webmanifest" />
    <script>
      // The theme of the reader: the selection in the header, else the system preference
      try {
        const theme = localStorage.getItem("theme");
        if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
      } catch {}
    </script>
    <script type="module" crossorigin src="/client/assets/index-D99bJKRG.js"></script>
    <link rel="stylesheet" crossorigin href="/client/assets/index-BVnddC9X.css">
  </head>
```
The body holds the full prerendered page (`data-prerendered`). Inner pages get `TechArticle` + `BreadcrumbList` JSON-LD (`lag/packages/site/build/head-tags.ts`, `structuredData()`).

### The Starlight head (crawler's built output)

Starlight emits by itself: `<title>`, canonical, `<link rel="sitemap" href="/crawler/sitemap-index.xml">`, shortcut icon, generator tags, and `og:title`, `og:type`, `og:url`, `og:locale`, `og:description`, `og:site_name`, `description`. The config's `head:` adds `og:image` (plus width, height and alt), `twitter:card`, `twitter:image`, `theme-color` and `keywords`. `routeData.ts` adds the font preload and JSON-LD.

### crawler's route middleware for SEO

The generic part of `~/git/crawler/packages/site/src/routeData.ts`, verbatim except where omissions are marked:
```ts
import type { StarlightRouteData } from "@astrojs/starlight/route-data";
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import pkg from "polite-crawler/package.json";
import font from "../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url";
// … (study imports omitted)
const SITE = "https://mark1russell7.github.io/crawler/";
const NAME = "polite-crawler";
const jsonLd = (data: unknown): HeadEntry => ({
  tag: "script",
  attrs: { type: "application/ld+json" },
  content: JSON.stringify(data).replace(/</g, "\\u003c"),
});
const homeData = (description: string): unknown => ({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: NAME, url: SITE },
    { "@type": "SoftwareSourceCode", name: NAME, description, codeRepository: "https://github.com/mark1russell7/crawler",
      programmingLanguage: "TypeScript", runtimePlatform: "Node.js", license: "https://opensource.org/licenses/MIT", url: SITE, author },
    { "@type": "SoftwareApplication", name: NAME, description, applicationCategory: "DeveloperApplication",
      operatingSystem: "Windows, macOS, Linux", softwareVersion: pkg.version, downloadUrl: "https://www.npmjs.com/package/polite-crawler",
      sameAs: ["https://github.com/mark1russell7/crawler", "https://www.npmjs.com/package/polite-crawler"],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, url: SITE, author },
  ],
});
const toolData = (url, title, description) => ({ "@context": "https://schema.org", "@type": "WebApplication", name: title, description, url,
  applicationCategory: "DeveloperApplication", operatingSystem: "Any", browserRequirements: "Requires JavaScript",
  isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, author });
const breadcrumbs = (url, title) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
  { "@type": "ListItem", position: 1, name: NAME, item: SITE }, { "@type": "ListItem", position: 2, name: title, item: url } ] });

export const onRequest = defineRouteMiddleware((context) => {
  const route = (context.locals as { starlightRoute: StarlightRouteData }).starlightRoute;
  const head = route.head as HeadEntry[];
  const data = route.entry.data as { title: string; description?: string; seoTitle?: string };
  const id = route.id;
  const home = id === "" || id === "index";
  const url = new URL(`${id}/`.replace(/^index\/$|^\/$/, ""), SITE).href;
  // … meta()/setMeta() helpers …
  // the title for search: a page can set seoTitle, and the H1 keeps its title
  const title = data.seoTitle ?? data.title;
  const full = title.includes(NAME) ? title : `${title} | ${NAME}`;
  const titleTag = head.find((entry) => entry.tag === "title");
  if (titleTag !== undefined) titleTag.content = full;
  setMeta("property", "og:title", title);
  // … (study-specific description and article:* meta omitted)
  // the 404 page is not a page to index, and its address is not its own
  if (id === "404") {
    for (let index = head.length - 1; index >= 0; index -= 1) {
      const entry = head[index]!;
      if ((entry.tag === "link" && entry.attrs?.["rel"] === "canonical") || (entry.tag === "meta" && entry.attrs?.["property"] === "og:url"))
        head.splice(index, 1);
    }
    head.push({ tag: "meta", attrs: { name: "robots", content: "noindex" } });
    return;
  }
  // the text font, before the style sheet asks for it
  head.push({ tag: "link", attrs: { rel: "preload", href: font, as: "font", type: "font/woff2", crossorigin: true } });
  if (home) head.push(jsonLd(homeData(description)));
  else head.push(jsonLd(breadcrumbs(url, title)));
  if (id.startsWith("tools/")) head.push(jsonLd(toolData(url, title, description)));
  // (study: Article + Dataset JSON-LD)
});
```
Vex puts `SoftwareSourceCode` JSON-LD directly in the `head:` frontmatter of `index.mdx` instead.

### Each SEO item, site by site
- **OG images:**
  - Astro sites: one static `public/og.png`, rendered by a Playwright screenshot of `scripts/og-card.html` (1200×630) through `scripts/og-image.mjs` or `brand-images.mjs`, and committed. render's script also renders `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `icon-maskable-512.png` from `mark.svg`. crawler also has `og-robots-study.png`, with data injected through `addInitScript`.
  - Custom sites: one PNG per route at build time. lag's card has a seeded per-page "lag bar chart" (FNV-1a + mulberry32). Each card has an eyebrow, a title fitted by a script, a description and the site address, all on graph paper.
  - lag also renders a 1280×640 GitHub social preview (`build/social-card.ts`, `pnpm social-preview`).
- **Sitemap:**
  - Astro: automatic `sitemap-index.xml` + `sitemap-0.xml`.
  - lag/client: `sitemap.xml` (client with the build date as `lastmod`).
  - ABC: `sitemap.xml` with each page's `lastmod` from `git log` (`build/lastmod.ts`).
- **robots.txt:** only lag writes one. Its own comment notes that a robots file below a subpath does not apply, and that crawlers find the sitemap through `<link rel="sitemap">` and Search Console.
- **Canonical:** on every page. Astro does it automatically from `site` + `base`.
- **404:**
  - Starlight default, or crawler's custom `404.mdx` (`template: splash`, a hero with actions, `pagefind: false`, `editUrl: false`, and `noindex` via routeData).
  - Custom sites: `404.html` is the app shell; lag adds `noindex`.
- **llms.txt:**
  - Static `public/llms.txt` in Vex and render (an H1, a `>` summary, a code sample, `## Packages`, `## Docs`, `## Optional`).
  - crawler generates it from data (`src/pages/llms.txt.ts`, an Astro endpoint).
  - client generates it from all routes (`src/build/llms.ts`).
- **Other:**
  - `google-site-verification` with the same token `du_C4Y04G9XX4VZEjxZEcBq3e28zER6jS1H_NYgIaEY` in Vex, render and ABC. It is a host-level verification, reusable for Jqy.
  - `site.webmanifest` in render and client.
  - IndexNow in render and client.
  - Vex publishes `ir.schema.json` in `public/`.
- **Crawlability:** Astro sites are fully static HTML. The custom sites are prerendered SPAs, and lag's CI greps the HTML for the H1, the canonical, the `TechArticle`, the OG PNG, the sitemap entry and the 404 `noindex`.

---

## 6. Tests for each site

- **Vex** (Playwright, `e2e/`, against `astro preview` at `/vex/`, in Chromium, Firefox and WebKit):
  - `smoke.spec.ts` and `app.spec.ts`.
  - `a11y.spec.ts`: axe WCAG 2.1 AA on every route in `dist/`, in both themes.
  - `budget.spec.ts`: at most 256 kB gzip per page and 160 kB of script.
  - Plus doctests (`pnpm test:docs`) and Vitest unit tests of `src/lib`.

  The a11y spec, verbatim:
  ```ts
  import { AxeBuilder } from "@axe-core/playwright";
  import { expect, test } from "@playwright/test";
  import { routes } from "./routes.ts";

  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${scheme} theme`, () => {
      test.use({ colorScheme: scheme });
      for (const route of routes()) {
        test(`the page /${route} has no WCAG 2.1 AA violation`, async ({ page }) => {
          await page.goto(`./${route}`);
          await page.waitForLoadState("networkidle");
          const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          const found = result.violations.map((v) => `${v.impact ?? ""} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
          expect(found).toEqual([]);
        });
      }
    });
  }
  ```
  `e2e/routes.ts` walks `dist/` for `index.html`, skipping `_astro` and `pagefind`, so every new page joins the checks automatically.
- **render** (Playwright: chromium, firefox, webkit and `phone-webkit` on an iPhone 15):
  - `smoke.spec.ts`: every route renders with no console or page errors and no horizontal overflow. Widget tests wait for hydration: `astro-island` loses its `ssr` attribute, then `__reactProps$` appears.
  - `seo.spec.ts`: for each route, the title, a description longer than 20 characters, a canonical URL, `og:image`, `twitter:image`, `og:image:alt` and `og:title`. Also the home page JSON-LD types, the manifest icons, `llms.txt` and `sitemap-index.xml`.
- **crawler:**
  - `scripts/check-site.mjs` (`pnpm check`) is a playwright-core link checker. It checks every internal `a`, `link`, `script` and `img` against the files in `dist`, finds no horizontal scroll at 320/375/768/1024 px, and no console errors. `--shots <dir>` saves screenshots for desktop and phone, light and dark.
  - Plus Vitest unit tests (`sim`, `study`, `tester`).
- **client** (Playwright, Chromium, run in both CI and Pages):
  - `seo.spec.ts`: head tags and JSON-LD types for each route, prerendered content, more than 250 sitemap entries, `llms.txt`, manifest icons, router behaviour (old hash links, no reload), and budgets of 256 kB per page, 180 kB of script and 128 kB of worker.
  - `smoke.spec.ts`: every Composer example, share-link round trip, undo and back, the TypeScript tab output run with Node, hostile links, keyboard trees, no overflow at 375 px, axe in both themes.
  - `docs.spec.ts`.
  - Plus Vitest (`src/build/build.test.ts` and others).
- **ABC:** Vitest with a node project and a browser project (Playwright Chromium): `smoke.browser.test.tsx`, components, playground, debugger, prerender handoff, and `build/*.test.ts` (head tags, OG image, lastmod, search index, static routes). CI builds with the prerender, which fails on page errors.
- **lag:** Vitest node + browser. `smoke.browser.test.tsx` renders every app and content route and fails on `console.error` or an unhandled rejection. Plus the CI grep checks of the prerendered output.
- **Absent everywhere:** Lighthouse CI and pixel-diff visual regression. lag's `__screenshots__` file is only Vitest's automatic screenshot on failure.

---

## 7. Shared conventions (copied files, no shared package)

- The same `tokens.css`. The same Starlight mapping in `theme.css` for the Astro sites.
- The same fonts, the graph-paper motif, cards with an ink top border, and a 32px SVG brand mark per site.
- The same home layout: hero, live demo, install box with Copy, cards.
- Custom sites copy whole build files: `static-site-plugin.ts` / `spa-fallback-plugin.ts`, `prerender.ts`, `head-tags.ts`, `og-image.ts`, `sitemap.ts`, `snapshot.ts`, `readiness.ts`, `prerender-handoff.ts`, `font-preload-plugin.ts`, `base.ts`, `site-url.ts`.
- `src/app/site.ts` holds the site facts: `SITE_NAME`, `SITE_TAGLINE`, `HOME_TITLE`, `REPOSITORY_URL`, `PUBLISHED_URL`, `LICENSE`, `AUTHOR = { name: "Mark Russell", url: "https://github.com/mark1russell7" }`, `KEYWORDS`.
- **Writing style:** all prose (READMEs, TSDoc, site text) follows ASD-STE100 Simplified Technical English, enforced by `ste-lint` (`pnpm lint:ste`, `ste.config.json`) in CI. The site text reads like "The page shows…", with short declarative sentences, and avoids "e.g." and em-dashes.
- **AI disclosure** in the lag and ABC footers: "An AI model (Claude, from Anthropic) wrote most of the text and the code of this site and of the library, under the direction of the author. The tests and the STE linter examine them."
- The Starlight `editLink` points to `.../edit/main/packages/site/`.
- **README hero GIFs** are recorded from the live hero:
  - `Vex/packages/site/scripts/hero-gif.mjs` and `render/packages/site/scripts/readme-media.mjs` use Playwright with `page.clock.install()` (a fake clock: each frame is fixed page time) and ffmpeg. They write `docs/media/hero-light.gif` and `hero-dark.gif`.
  - client has `scripts/readme-media.mjs` → `packages/site/media/live-program.gif`.
- **Root `pnpm check`** chains typecheck, lint (oxlint), test(:coverage), test:docs (Vex) and lint:ste. `check:packages` runs publint, attw and a tarball smoke test. The repos come from a template (`package`/`template` scripts in `packages/cli`).

---

## 8. Which sites are most elaborate, and why

1. **client.** The largest site.
   - The Composer (765 lines) with Blocks (779): blocks, JSON and TypeScript views of one program, a Worker runtime with a timeout, undo and redo, and share links.
   - The middleware Lab (731) with the animated `Onion.tsx`, `Journey.tsx` (a token through the layers, scrubber and speeds), and `ProgramGraph.tsx` (an ARIA tree graph).
   - A status board, a Ctrl+K palette, and 250+ prerendered pages, each with its own OG image.
   - IndexNow, and e2e as a gate before deploy.
2. **lag.** The richest data viz: a canvas session timeline (`draw.ts`, about 950+ lines), a CI results explorer (trends, matrices, coverage, mutation, budgets, ECDFs), real monitors live on the home page and in the playground, a React Flow architecture map, theme-aware Mermaid, seeded per-page OG charts, and Safari/iOS CI.
3. **Vex.** The most creative Astro site:
   - The rAF physics hero with live program evaluation per frame.
   - A Lab editor (overlay highlighting, safe parser, share URL), a law arena (fast-check in the browser), Life, an axes explorer, a stepper, and the Jqy AuditLab.
   - A full spreadsheet app at `/app/`, hover-animated SVG showcase cards, doctests, axe and size budgets.
4. **crawler.** The best SEO and content strategy: a 1,000-domain data study with Article + Dataset JSON-LD, downloadable JSON and CSV, its own OG card, and `llms.txt` generated from data. Interactive tools (robots tester, page reader, hours parser), LiveCrawl on a virtual clock, an agent replay, and a link checker.
5. **ABC.** A step-through context debugger, an in-browser Babel playground, Shiki, search, and git-dated sitemaps.
6. **render.** The animated graph hero (the most relevant visual to Jqy) and the full viewer app embedded in a page. It has fewer pages.

---

## 9. README conventions

The order is:
1. `# <repo>`
2. A badge row:
   - npm version: `https://img.shields.io/npm/v/<pkg>`. render and client add `?color=2346c4&label=npm`.
   - CI: `https://github.com/mark1russell7/<repo>/actions/workflows/ci.yml/badge.svg`.
   - Site: crawler uses the Pages workflow badge; render/client use `https://img.shields.io/badge/site-live-2346c4` (render: `site-live%20demos-2346c4`); Vex uses `https://img.shields.io/badge/docs-live-1f3fbf`.
   - License: `https://img.shields.io/badge/license-MIT-2346c4` or `-blue`.
   - ABC adds a mutation-score badge and `types-included`.
3. A **bold one-line claim**.
4. A `<p align="center"><a href=site><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/hero-dark.gif"><img src="docs/media/hero-light.gif" alt="…" width="640–860"></picture></a></p>`.
5. "**[The site](…)** has …"
6. Install (`npm i …`), a short TS example (Vex's is a `ts doctest` block), then "What is in it" bullets.
7. A Packages table (`| Package | Contents |`), Commands/Development, links to CONTRIBUTING, SECURITY and CHANGELOG (crawler), and `## License` MIT.

lag uses `<!-- metrics:start --> … <!-- metrics:end -->`, generated from code and checked in CI.

---

## 10. npm publishing and release workflows (all verbatim)

| Repo | Published packages | Release mechanism |
|---|---|---|
| crawler | `polite-crawler` (plus the MCP registry entry `io.github.mark1russell7/polite-crawler`) | tag `v*`; OIDC trusted publishing |
| Vex | `@mark1russell7/vex`, `@mark1russell7/vex-domains`, `@mark1russell7/vex-testkit` | Changesets, manual dispatch, OIDC |
| render | `@mark1russell7/render-{optional,dsl,node,biblo,splay,viewer,pack,seat}` | tag `v*`, `NPM_TOKEN` + provenance |
| client | `@procedures/client` and the other `@procedures/*` | Changesets (fixed group), OIDC |
| ABC | `async-browser-context` | tag `v*`, test-and-pack job, then a publish job (OIDC) |
| lag | `@mark1russell7/lag` | tag `v*`, one job (OIDC) |

### crawler `release.yml`
```yaml
# Publishes polite-crawler when the owner pushes a version tag (for example v0.2.0) on main.
#
#   preflight       The tag is on main and agrees with the version, and CHANGELOG.md has its section.
#   verify          The gates of ci.yml: each OS and Node.js version, and the smoke test.
#   build           Builds and packs the tarball, tests that tarball, and uploads it with the notes.
#   publish         Publishes that tarball to npm. Only this job and mcp-registry hold "id-token: write",
#                   and they run no code of the repository: no checkout, no install, no build.
#   mcp-registry    Publishes server.json to the MCP registry, after npm has the version.
#   github-release  Makes the GitHub release with the section of CHANGELOG.md and the tarball.
#
# npm trusted publishing uses the OIDC token of GitHub Actions, so the workflow needs no npm token,
# and the package gets a provenance statement. On npmjs.com the trusted publisher of polite-crawler
# names the repository mark1russell7/crawler, the workflow file release.yml and the environment npm.
# A tag for a version that is already on npm (the first version goes out by hand) skips the npm publish
# and does the other steps.
name: Release

on:
  push:
    tags: ["v*"]

permissions: {}

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  preflight:
    name: The tag, the version and the notes
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    outputs:
      version: ${{ steps.version.outputs.version }}
      dist-tag: ${{ steps.version.outputs.dist-tag }}
    steps:
      # fetch-depth 0 fetches the history of all branches, so origin/main is there.
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          fetch-depth: 0
      - name: The tag is on main
        run: |
          if ! git merge-base --is-ancestor "$GITHUB_SHA" origin/main; then
            echo "::error::The tag $GITHUB_REF_NAME points at $GITHUB_SHA, which is not on main."
            exit 1
          fi
      - name: The tag agrees with the version of the package
        id: version
        run: |
          version="$(node -p 'require("./packages/polite-crawler/package.json").version')"
          if [ "v$version" != "$GITHUB_REF_NAME" ]; then
            echo "::error::The tag is $GITHUB_REF_NAME, and package.json has the version $version."
            exit 1
          fi
          # A prerelease (0.2.0-beta.1) goes to the npm tag "next", and each other version to "latest".
          case "$version" in
            *-*) dist_tag=next ;;
            *) dist_tag=latest ;;
          esac
          echo "version=$version" >> "$GITHUB_OUTPUT"
          echo "dist-tag=$dist_tag" >> "$GITHUB_OUTPUT"
      - name: CHANGELOG.md has a section for the version
        env:
          VERSION: ${{ steps.version.outputs.version }}
        run: node scripts/changelog.mjs "$VERSION"

  verify:
    name: CI
    needs: preflight
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read

  build:
    name: Build and pack
    needs: [preflight, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    env:
      VERSION: ${{ needs.preflight.outputs.version }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      # No dependency cache: a release installs from the registry and the lockfile only.
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          package-manager-cache: false
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter polite-crawler build
      # pnpm writes the publishConfig entry points (build/) into the packed package.json.
      - run: pnpm --filter polite-crawler pack --pack-destination "$RUNNER_TEMP/release"
      - name: Test the tarball that goes to npm
        run: node scripts/smoke.mjs --tarball "$RUNNER_TEMP/release/polite-crawler-$VERSION.tgz"
      # The registry examines server.json before npm gets the version. This step needs no token.
      - name: Validate server.json
        env:
          MCP_PUBLISHER_VERSION: 1.8.1
          MCP_PUBLISHER_SHA256: a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc
        run: |
          curl -fsSL -o "$RUNNER_TEMP/mcp-publisher.tar.gz" "https://github.com/modelcontextprotocol/registry/releases/download/v${MCP_PUBLISHER_VERSION}/mcp-publisher_linux_amd64.tar.gz"
          echo "${MCP_PUBLISHER_SHA256}  $RUNNER_TEMP/mcp-publisher.tar.gz" | sha256sum --check
          tar -xzf "$RUNNER_TEMP/mcp-publisher.tar.gz" -C "$RUNNER_TEMP" mcp-publisher
          "$RUNNER_TEMP/mcp-publisher" validate
      - name: The release notes and server.json
        run: |
          node scripts/changelog.mjs "$VERSION" > "$RUNNER_TEMP/release/notes.md"
          cp server.json "$RUNNER_TEMP/release/server.json"
          ls -l "$RUNNER_TEMP/release"
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: release
          path: ${{ runner.temp }}/release/
          if-no-files-found: error
          retention-days: 30

  publish:
    name: Publish to npm
    needs: [preflight, build]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment:
      name: npm
      url: https://www.npmjs.com/package/polite-crawler
    permissions:
      id-token: write
    env:
      VERSION: ${{ needs.preflight.outputs.version }}
      DIST_TAG: ${{ needs.preflight.outputs.dist-tag }}
    steps:
      # The npm of Node.js 24 is 11.5.1 or later, which trusted publishing needs. No other npm is installed.
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: "24"
          package-manager-cache: false
      - name: npm is 11.5.1 or later
        run: |
          npm_version="$(npm --version)"
          if ! node -e 'const [a, b, c] = process.argv[1].split(".").map(Number); process.exit(a > 11 || (a === 11 && (b > 5 || (b === 5 && c >= 1))) ? 0 : 1)' "$npm_version"; then
            echo "::error::npm $npm_version cannot do trusted publishing. It must be 11.5.1 or later."
            exit 1
          fi
          echo "npm $npm_version"
      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
        with:
          name: release
          path: release
      # npm publishes the tarball as it is, with no package scripts.
      - name: Publish
        run: |
          if npm view "polite-crawler@$VERSION" version >/dev/null 2>&1; then
            echo "polite-crawler $VERSION is already on npm. Nothing to publish."
            exit 0
          fi
          npm publish "release/polite-crawler-$VERSION.tgz" --provenance --tag "$DIST_TAG"

  mcp-registry:
    name: Publish to the MCP registry
    needs: [preflight, publish]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      id-token: write
    env:
      VERSION: ${{ needs.preflight.outputs.version }}
      SERVER: io.github.mark1russell7%2Fpolite-crawler
      # To update: take the version and the sha256 of mcp-publisher_linux_amd64.tar.gz from
      # https://github.com/modelcontextprotocol/registry/releases
      MCP_PUBLISHER_VERSION: 1.8.1
      MCP_PUBLISHER_SHA256: a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc
    steps:
      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
        with:
          name: release
          path: release
      - name: The registry does not have the version
        id: registry
        run: |
          status="$(curl -s -o /dev/null -w '%{http_code}' "https://registry.modelcontextprotocol.io/v0.1/servers/$SERVER/versions/$VERSION")"
          echo "The registry answers $status for $VERSION."
          echo "listed=$([ "$status" = 200 ] && echo true || echo false)" >> "$GITHUB_OUTPUT"
      - name: Install mcp-publisher
        if: steps.registry.outputs.listed == 'false'
        run: |
          curl -fsSL -o mcp-publisher.tar.gz "https://github.com/modelcontextprotocol/registry/releases/download/v${MCP_PUBLISHER_VERSION}/mcp-publisher_linux_amd64.tar.gz"
          echo "${MCP_PUBLISHER_SHA256}  mcp-publisher.tar.gz" | sha256sum --check
          tar -xzf mcp-publisher.tar.gz mcp-publisher
      # The registry reads "mcpName" from the package on npm, so it waits until npm serves the version.
      - name: npm serves the version
        if: steps.registry.outputs.listed == 'false'
        run: |
          for attempt in 1 2 3 4 5 6 7 8 9 10; do
            if curl -fsS -o /dev/null "https://registry.npmjs.org/polite-crawler/$VERSION"; then exit 0; fi
            echo "npm does not serve polite-crawler $VERSION yet (attempt $attempt)."
            sleep 30
          done
          exit 1
      - name: Publish server.json
        if: steps.registry.outputs.listed == 'false'
        working-directory: release
        run: |
          ../mcp-publisher login github-oidc
          ../mcp-publisher publish

  github-release:
    name: GitHub release
    needs: [preflight, publish]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: write
    env:
      VERSION: ${{ needs.preflight.outputs.version }}
      DIST_TAG: ${{ needs.preflight.outputs.dist-tag }}
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
        with:
          name: release
          path: release
      - name: Make the release
        run: |
          if gh release view "$GITHUB_REF_NAME" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
            echo "The release $GITHUB_REF_NAME exists. Nothing to do."
            exit 0
          fi
          prerelease=()
          if [ "$DIST_TAG" = next ]; then prerelease=(--prerelease); fi
          gh release create "$GITHUB_REF_NAME" --repo "$GITHUB_REPOSITORY" --verify-tag \
            --title "polite-crawler $VERSION" --notes-file release/notes.md "${prerelease[@]}" \
            "release/polite-crawler-$VERSION.tgz"
```

### Vex `release.yml`
```yaml
name: Release

# Changesets: when changesets wait, this workflow opens a pull request with the new versions and change logs. When
# no changeset waits, it publishes each package version that is not on npm, with provenance.
# The pull request needs the setting "Allow GitHub Actions to create and approve pull requests". Without it, start
# `pnpm changeset version` locally, commit the result, and then start this workflow to publish.
#
# The owner starts it by hand. The job runs in the GitHub environment "npm", so the owner approves each run.
# npm trusts this workflow for each package (trusted publishing with OIDC, so there is no token):
#   npm trust github <package> --file release.yml --repo mark1russell7/vex --env npm --allow-publish
on:
  workflow_dispatch:

permissions: {}

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: npm
    permissions:
      # The version pull request: a branch and a pull request
      contents: write
      pull-requests: write
      # npm trusted publishing (OIDC) and provenance
      id-token: write
    steps:
      # The Changesets action pushes the version branch, so the checkout keeps its credentials.
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 26
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm check:packages
      - uses: changesets/action@ae32849d5ba541f9ae29e40e22a623bc13562f51 # v2.1.2
        # Version 2 of the action: the inputs have the suffix -script, and the token is the default github-token.
        # pnpm 12 publishes natively: it exchanges the OIDC token of the job with npm, and it signs the provenance.
        with:
          version-script: pnpm exec changeset version
          publish-script: pnpm exec changeset publish
          pr-title: Version the packages
          commit-message: Version the packages
        env:
          NPM_CONFIG_PROVENANCE: "true"
```

### render `release.yml`
```yaml
name: Release

# A tag v<version> publishes each package @mark1russell7/render-* whose version is not on npm yet, with provenance.
#   1. node scripts/set-version.mjs <version>, then commit
#   2. git tag v<version>, then git push origin v<version>
# The secret NPM_TOKEN is a granular npm token that can publish the packages @mark1russell7/render-*.
on:
  push:
    tags: ["v*"]
  workflow_dispatch:

permissions: {}

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      # The provenance of each package, and trusted publishing
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - name: The tag matches the version of each package
        if: github.ref_type == 'tag'
        run: node scripts/set-version.mjs --check "${GITHUB_REF_NAME#v}"
      - run: pnpm check
      - run: pnpm --filter @mark1russell7/render-viewer exec playwright install --with-deps chromium
      - run: pnpm --filter @mark1russell7/render-viewer exec playwright test --project=chromium
      - run: pnpm check:packages
      # pnpm skips each version that is already on npm, thus a second run publishes nothing again
      - name: Publish
        run: pnpm -r --filter "@mark1russell7/render-*" publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: "true"
```

### client `release.yml`
```yaml
name: Release

# Changesets: when changesets wait, this workflow opens a pull request with the new versions and
# change logs. When no changeset waits, it publishes each package version that is not on npm, with
# provenance. The public packages have one version together (.changeset/config.json, "fixed").
# The pull request needs the setting "Allow GitHub Actions to create and approve pull requests".
# Without it, start `pnpm changeset version` locally, commit the result, and then start this
# workflow to publish.
#
# The owner starts it by hand. The job runs in the GitHub environment "npm", so the owner approves
# each run. npm trusts this workflow for each package (trusted publishing with OIDC, no token):
#   node scripts/npm-bootstrap.mjs --trust --otp <code>
# packages/documentation/RELEASE.md tells the one-time bootstrap and the release steps.
on:
  workflow_dispatch:

permissions: {}

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: npm
    permissions:
      # The version pull request: a branch and a pull request
      contents: write
      pull-requests: write
      # npm trusted publishing (OIDC) and provenance
      id-token: write
    steps:
      # The Changesets action pushes the version branch, so the checkout keeps its credentials.
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      # The pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 26
          cache: pnpm
          registry-url: https://registry.npmjs.org
      # `lib new` runs cue-config, which needs the CUE binary (the scaffold test of mark)
      - name: Install CUE
        run: |
          curl -fsSL https://github.com/cue-lang/cue/releases/download/v0.15.1/cue_v0.15.1_linux_amd64.tar.gz | tar -xz -C "$RUNNER_TEMP" cue
          echo "$RUNNER_TEMP" >> "$GITHUB_PATH"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm lint:ste
      # The tarballs as npm gives them. No git dependencies: npm 12 does not install them.
      - run: node scripts/check-packages.mjs
      - uses: changesets/action@ae32849d5ba541f9ae29e40e22a623bc13562f51 # v2.1.2
        # Version 2 of the action: the inputs have the suffix -script, and the token is the default github-token.
        # pnpm 12 publishes natively: it exchanges the OIDC token of the job with npm, and it signs the provenance.
        with:
          version-script: pnpm exec changeset version
          publish-script: pnpm exec changeset publish
          pr-title: Version the packages
          commit-message: Version the packages
        env:
          NPM_CONFIG_PROVENANCE: "true"
```

### AsyncBrowserContext `release.yml`
```yaml
name: Release

# Publishes the package to npm when a version tag (for example v0.2.0) is pushed.
# npm trusted publishing uses the OIDC token of GitHub Actions, so the
# workflow needs no npm token, and the package gets a provenance statement.
# docs/release.md tells how to set up the trusted publisher one time.
#
# Two jobs: the test job installs the dependencies, starts all the tests and
# packs the package, without the OIDC token. The publish job gets the token,
# but it installs nothing: it publishes the tarball that the test job tested.
# The actions are pinned to commits.

on:
  push:
    tags: ["v*"]

permissions:
  contents: read

# One release for each tag. A second tag does not cancel or replace the first.
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  test:
    name: Test and pack the package
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 24
          cache: pnpm
      - name: The tag agrees with the version of package.json
        run: test "v$(node -p 'require("./package.json").version')" = "$GITHUB_REF_NAME"
      - run: pnpm install --frozen-lockfile
      - name: Install the browsers and their system dependencies
        run: pnpm exec playwright install --with-deps chromium firefox webkit
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm lint:ste
      # The checks of the packed package, as a user installs it
      - run: pnpm test:babel
      - run: pnpm smoke
      - run: pnpm test:bundlers
      # The steps above did the work of prepublishOnly
      - name: Pack the package
        run: mkdir -p package && npm pack --pack-destination package --ignore-scripts
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: package
          path: package/*.tgz
          if-no-files-found: error
          retention-days: 7

  publish:
    name: Publish to npm
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0
        with:
          name: package
          path: package
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 24
          registry-url: "https://registry.npmjs.org"
      # Trusted publishing needs npm 11.5.1 or later
      - run: npm install --global npm@11.20.0
      - name: Publish the tested tarball
        # The ./ prefix makes npm read a file path, not a GitHub repository (owner/name)
        run: npm publish ./package/*.tgz --provenance --access public
```

### lag `release.yml`
```yaml
name: Release

# Publishes @mark1russell7/lag (packages/lag) to npm when a version tag (for example v0.2.0) is pushed.
# npm trusted publishing uses the OIDC token of GitHub Actions: the workflow needs no npm token,
# and the package gets a provenance statement. The trusted publisher is set one time, after the
# first version is on npm: npm trust github @mark1russell7/lag --file release.yml
# --repo mark1russell7/lag --allow-publish

on:
  push:
    tags: ["v*"]

permissions:
  contents: read
  id-token: write

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  publish:
    name: Test and publish to npm
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          registry-url: "https://registry.npmjs.org"
      - name: The tag agrees with the version of the package
        run: test "v$(node -p 'require("./packages/lag/package.json").version')" = "$GITHUB_REF_NAME"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
      # pnpm pack runs prepack (a clean build of dist) and packs the files of "files" in package.json
      - name: Pack
        working-directory: packages/lag
        run: pnpm pack --pack-destination "$RUNNER_TEMP"
      # npm publishes the tarball. Trusted publishing (OIDC) needs npm 11.5.1 or later.
      - run: npm install --global npm@latest
      - name: Publish
        run: npm publish "$RUNNER_TEMP"/mark1russell7-lag-*.tgz --access public --provenance
```

---

## 11. CI workflow: render `ci.yml`

This is the cleanest template, with a dedicated `site` job and a `ci-ok` aggregate check.
```yaml
name: CI

on:
  push:
  pull_request:

permissions: {}

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    name: check (node ${{ matrix.node }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        node: [22, 24, 26]
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      # The pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # The source and the tests of each package (tsconfig.json and tsconfig.test.json)
      - run: pnpm typecheck
      # Oxlint with type-aware rules
      - run: pnpm lint
      - run: pnpm test
      # The coverage of the engine packages, with the floor of vitest.config.ts
      - run: pnpm test:coverage
      # The writing rules (ASD-STE100) of the README files, the docs, the site and the doc comments
      - run: pnpm lint:ste

  # The viewer in Chromium, Firefox and WebKit, and on two phones: the production build and the Playwright tests of each flow
  viewer:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @mark1russell7/render-viewer exec playwright install --with-deps chromium firefox webkit
      - run: pnpm test:e2e
      - name: Upload the Playwright report of a failure
        if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: viewer-test-results
          path: packages/viewer/test-results/
          if-no-files-found: ignore

  # The site: the test report, the static build and the smoke tests of each route and each widget
  site:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @render/site run report
      - run: pnpm --filter @render/site run build
        env:
          ASTRO_TELEMETRY_DISABLED: "1"
      - run: pnpm --filter @render/site exec playwright install --with-deps chromium firefox webkit
      - run: pnpm --filter @render/site run test:e2e
        env:
          ASTRO_TELEMETRY_DISABLED: "1"

  # The npm packages: the build, publint, attw, and an empty project that installs, runs and type-checks the tarballs
  packages:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check:packages

  # The only check that a pull request must pass
  ci-ok:
    name: CI OK
    if: always()
    needs: [check, viewer, site, packages]
    runs-on: ubuntu-latest
    timeout-minutes: 2
    permissions: {}
    steps:
      - name: All jobs passed
        run: test "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') || contains(needs.*.result, 'skipped') }}" = "false"
```

How the other CI files handle the site:
- **crawler `ci.yml`:**
  - A test matrix of Node 22.19.0/24/26 on Ubuntu, plus Windows and macOS on Node 24, with a weekly cron and `workflow_call`, so `release.yml` can reuse it.
  - A `checks` job: typecheck, oxlint `--type-aware`, `lint:ste`, the site build with `SITE_BASE: /crawler`, then `pnpm --filter @crawler/site run check`.
- **Vex `ci.yml`:** a site job that builds, then runs the Playwright e2e in chromium/firefox/webkit, plus `pnpm test:docs`.
- **lag `ci.yml`:** the site job builds with `SITE_BASE: lag` and `SITE_URL`, then greps the prerendered output.

---

## 12. Notes for building Jqy's site

- **Recommended starting stack:** copy render's site package (Astro + Starlight + React islands) with the family `tokens.css` and `theme.css`, the Hero override, `CopyInstall`, `brand-images.mjs`, `indexnow.mjs`, `llms.txt`, and the `e2e/seo.spec.ts` and `smoke.spec.ts` specs. Add Vex's `a11y.spec.ts` and `budget.spec.ts`, and crawler's `routeData.ts` (JSON-LD, `seoTitle`, 404 `noindex`, font preload).
- **Natural live hero:** a Jqy layout animating on graph paper. Possible forms:
  - a grid or radial strategy switching in place;
  - nested containers with the audit findings in red (`--color-mark`);
  - a DOM/Canvas/ReactFlow renderer toggle;
  - a step-through of parse → validate → plan → place → route → post, like render's epoch order badges.
- Use `client:only="react"` for anything that measures the DOM or uses ReactFlow (render's `ViewerEmbed` pattern).
- **Base path:** the repo is `Jqy`, so `SITE_BASE: /${{ github.event.repository.name }}` gives `/Jqy/`. Hard-coded defaults (`?? "/Jqy"`), the webmanifest and the IndexNow site URL must use the same case.
- **Cross-links:** Vex's `gallery/audit` page already shows Jqy output, and `docs/research/03-lineage.md` documents that Vex grew out of Jqy.
- **Jqy today:** a single Vite + React app (`reactflow` ^11, Vite 7, npm `package-lock.json`). It has no pnpm workspace, CI or Pages workflow. Adopting the family layout (pnpm workspace, `packages/site`) matches the other repos.
