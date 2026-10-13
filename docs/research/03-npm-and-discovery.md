<!-- ste-disable -->
> **Raw research report (2026-10-12).** Topic: the package name, publishing to npm in 2026, search and discovery, and the site framework. A research agent of the 2026-10-12 review wrote it. It is kept as evidence, with local paths shortened. The synthesis and the decisions are in [../REVIEW.md](../REVIEW.md). This file is not STE text.
>
> **Note added by the review.** After this report, the owner asked for more relevant names. The review checked more candidates live (2026-10-12). These are free on npm, including their hyphen variants and their `@scope`: `ireko` (入れ子, Japanese for nested boxes), `laygram`, `nestlay`, `boxlay`, `boxgraph`, `layscript`, `laylang`, `layout-grammar`, `jubako`, `ringbox`, `nestedgraph`. These are taken: `hako`, `bento`, `bento-layout`, `matryoshka`, `babushka`, `espalier`, `layup`, `outlay`, `holarchy`, `treelay`, `laybox`, `flowbox`, `kasten`. The decision is `ireko` (REVIEW D1).

# Research report: publishing Jqy to npm and building an SEO-ready GitHub Pages site (checked 2026-10-12)

I edited no files. I checked every npm name against the live registry (`registry.npmjs.org/<name>`), checked scope ownership with `registry.npmjs.org/-/org/<scope>/package` (404 means free), and searched GitHub with `gh search repos`.

**Two findings change your plan:**
1. **`polite-crawler` is not on npm.** `https://registry.npmjs.org/polite-crawler` returns 404, so the "first version by hand" step in `crawler/.github/workflows/release.yml` has not happened yet.
2. **npm trusted publishing changed in 2026.** Your crawler release workflow will not publish as written without three settings changes (section 2.6).

---

## 1. Package name

**npm blocks names that differ from an existing package only by punctuation** (it ignores `.`, `-` and `_`). Because of this, some names that return 404 still cannot be published:
- `layoutflow` is blocked by `layout-flow`.
- `nestflow` is blocked by `nest-flow`.
- `nestbox` is blocked by `nest-box`.
- `box-tree` is blocked by `boxtree`.

npm may also reject a name it judges "too similar" to a popular package, and it only checks at publish time. Your first manual publish therefore also confirms the name.

### Names you asked about

| Name | npm | Collisions | Verdict |
|---|---|---|---|
| jqy | **Taken** (2018 test package "测试", v0.0.7, 0 downloads a week) | Reads like jq or jQuery; tiny GitHub repos | No. It has no meaning, is hard to say and carries no keyword. |
| jqy-layout | Free | Same weakness as `jqy` | No |
| @jqy/core | **Not available.** Another account owns the `@jqy` scope (it has no packages). | – | No |
| layout-kit | **Taken** (2016) | LinkedIn LayoutKit (iOS, 3.1k★) | No |
| nestlayout / nest-layout | Free | NestLayout on GitHub (16★). On npm, "nest" means NestJS (`nest-box`, `nestgraph`, `nestkit`, `nest-flow`). | Weak: people will expect a NestJS module. |
| nested-layout | Free | `nested-layouts` (2014) exists. The search phrase "nested layouts" belongs to the Next.js App Router. | No: you cannot win that search. |
| boxflow / box-flow | Free; scope `@boxflow` free | PyPI `boxflow` (a visual dataflow library, the same field); a "Boxflow" messaging product; GitHub repos with 26★ and 19★ | Possible, but crowded. |
| layoutflow | **Blocked** by `layout-flow` | GitHub layoutFlow 56★ | No |
| compose-layout / composable-layout | Free | Jetpack Compose fills the search results | No |
| layout-algebra | Free | "Layout algebra" is an NVIDIA CuTe/CUDA term | No |
| tessera / tessellate / lattice-layout / orrery | **All taken.** `orrery` is an empty 0.0.0 package from 2023 that you could claim through an npm dispute. | Tesseract OCR fills the results for "tessera" | No |
| @mark1russell7/layout | Free (your scope) | – | Usable as a fallback, but a personal scope is weak for brand and search. |
| @mark1russell7/jqy | Free | – | Same as above |

### New candidates (free on npm, including punctuation variants)

| Name | npm / scope | GitHub and web collisions | Pros | Cons |
|---|---|---|---|---|
| **orbitgrid** | Free; `orbit-grid` free; `@orbitgrid` free | Only 0★ repos; no web results | Short, clear, no collisions; suggests the radial and grid strategies | Says nothing about nesting; sounds like only two strategies |
| **compound-layout** | Free; `compoundlayout` free; scope free | Android CompoundLayout (483★) | "Compound graph" is the graph-drawing term for nested graphs (Cytoscape compound nodes, cose-bilkent), so it matches expert searches | Longer; "compound" can read as chemistry |
| **graphlay** | Free; `graph-lay` free; `@graphlay` free | None found (the R package `graphlayouts` is similar) | Short; contains "graph" and "lay" | Slightly awkward to say |
| **gridnest** | Free; `grid-nest` free; `@gridnest` free | yellowkankan/gridnest (36★) | Says grid and nesting | Weak NestJS association |
| **layoutree** | Free | None | Says layout and tree | Undersells graphs; looks like `layout-tree` (2016) |
| **subflow-layout** | Free | No GitHub repos | Uses React Flow's own word for nested nodes ("sub flows"), so it hits the main audience's searches exactly | Ties a renderer-agnostic brand to React Flow; `subflow` (unrelated) exists |
| **nested-graph-layout** | Free | No GitHub repos | Exact keyword match | Generic, long, no brand |
| **matryoshka-layout** | Free | None | Memorable picture of nesting | Long and hard to spell |
| **holonic** | Free (but the `@holonic` scope is taken) | – | A holon is a whole that is also a part, which fits exactly | Obscure |
| **nestgrid** | Free; `nest-grid` free; scope free | Tiny repos | Short | NestJS association |
| gridwise / layoutly / nestwise | Free | gridwise-webgpu (11★) | – | Generic |
| Taken or blocked | – | – | – | `nestgraph`, `graphnest`, `nestkit`, `inlay`, `layit`, `layr`, `tessel`, `plait`, `trellis`, `embox`, `graphbox`, `laybox`, `boxtree`, `treeflow`, `nestify`, `nestle`, `stratum`, `quilt`, `holon`, `nidus`, `nido`, `enfold`; `tidygraph` collides with the R tidygraph package (573★) |

**Recommendation:**
- Choose a short, collision-free brand and always pair it with the same descriptive phrase. My order is **orbitgrid**, then **compound-layout**, then **graphlay**.
- Example tagline: "orbitgrid: a compositional layout engine for nested graphs and trees. Grid, radial and custom strategies. It renders to SVG, Canvas, DOM or React Flow."
- Use one lowercase string everywhere: the npm name, the GitHub repo (rename `Jqy`), the Pages path, the `<h1>` and the `<title>`.
- Pages paths are case-sensitive. Jqy has no Pages deployment yet (`/Jqy/` returns 404), so renaming now costs nothing.
- Reserve the npm scope too (free for public packages).

---

## 2. Publishing the TypeScript library (2025–2026 practice)

1. **Ship ESM only.** Node 20 reached end of life on 2026-04-30. Node 20.19+ and 22.12+ can `require()` ESM, and every bundler reads ESM. Avoid top-level await anywhere a CommonJS user could reach, because it breaks `require(esm)`. Check with `attw --profile esm-only` and `publint --strict`, as your crawler smoke test already does.

2. **Build with tsdown 0.23.1**, the same tool as crawler.
   - tsup's README now says it is not maintained and points to tsdown.
   - unbuild has had no release since 3.6.1 (August 2025).
   - Plain `tsc` (TypeScript 7.0.2) is a valid unbundled choice, but you lose tsdown's extras.
   - Useful tsdown options:
     - `exports: { devExports: true }` writes source exports at the top level and the build exports into `publishConfig`. This is your crawler pattern, and it is applied by pnpm pack, not npm.
     - `publint: true` and `attw: { profile: 'esm-only', level: 'error' }` (they need `publint` and `@arethetypeswrong/core` installed).
     - `unbundle` mode.
   - Turn on **`isolatedDeclarations`** in tsconfig. tsdown then writes `.d.ts` files with oxc (much faster), and the code also meets JSR's "no slow types" rule.

3. **Use `exports` with the types condition first**, plus `"./package.json"`. Set `"sideEffects": false`, or `["*.css"]` if you ship CSS (`@xyflow/react` does this). Use `"files": ["dist"]`. `repository.url` must match the GitHub repo exactly, or provenance fails.

4. **Package split: start as one package with subpaths** (`<name>`, `<name>/react`, `<name>/xyflow`, and `<name>/svg` or `/canvas` if needed). Zustand and Jotai use this pattern.
   - `react`, `react-dom` and `@xyflow/react` go in `peerDependencies` and are all marked optional in `peerDependenciesMeta`. npm 7+ installs required peers automatically, so non-React users would otherwise get React.
   - The React Flow adapter (LayoutSnapshot to `Node[]`/`Edge[]`) can be pure data with `import type` only, so it has no runtime dependency.
   - Split into `<name>` plus `@<name>/react` only when the React side gets its own dependencies or release cycle. Then use Changesets 3.0.3 with a `fixed` group.
   - One package keeps your current tag-driven, single-package `release.yml` unchanged.

5. **Peer ranges.**
   - `@xyflow/react` is at 12.12.0 (peer `react >=17`). **13.0.0-next.0 came out 2026-10-11** (peer `react >=18`).
   - Declare `"@xyflow/react": "^12"` and add `|| ^13` after you test it. Use `react: ">=18"`.
   - Jqy still depends on the legacy `reactflow@11.11.4` (last release June 2024). Move to `@xyflow/react` 12.

6. **Trusted publishing (OIDC) and provenance: what changed in 2026.**
   - **Requirements:** npm CLI 11.5.1+ and Node 22.14+. Provenance is automatic from GitHub Actions for a public repo, so `--provenance` is optional. Self-hosted runners are not supported.
   - **First publish:** the package must exist before you can attach a trusted publisher, so the first publish is by hand.
   - **Expiry:** since 2026-10-02, a trusted-publisher configuration that has no successful publish within 48 hours expires. **Your `release.yml` skips the publish when the version is already on npm.** Tagging the hand-published version therefore never confirms the configuration. After the manual 0.1.0, push a *new* version (for example v0.1.1) through CI within 48 hours, or recreate the configuration just before that tag.
   - **Allowed actions:** configurations created after 2026-09-03 **allow only staged publishing by default**. Your workflow calls `npm publish`, so tick "npm publish" as an allowed action.
   - **Dist-tags:** changing dist-tags through OIDC needs npm 11.21.0+ or 12.2.0+.
   - **After the first CI publish:** set "Require 2FA and disallow tokens" on the package.
   - **Tokens:** granular tokens that bypass 2FA lost account and package management in early August 2026. They lose direct publishing in about January 2027 (a target date).
   - **npm 12** (generally available July 2026) turns off install scripts, git dependencies and URL dependencies by default. Never put a `github:` reference in runtime `dependencies`.
   - **Workflow changes:** the crawler `release.yml` structure is already best practice (preflight, CI, a pack-and-smoke job, and a publish job with no checkout, `id-token: write` and environment `npm`). Copy it, remove the MCP-registry job, and bump `actions/setup-node` to v7.1.0 (2026-10-08).

7. **Releases.** Keep your manual tag plus a CHANGELOG section check for a single package. Changesets 3.0.3 earns its cost only with several packages. release-please 17.11 is the alternative.

8. **Bundle size.**
   - Use `size-limit` 14.2.0 with `@size-limit/preset-small-lib` as a CI step that fails over budget. Run it directly: `andresz1/size-limit-action` has had no update since 2024.
   - Badge services that respond today: `https://deno.bundlejs.com/badge?q=<pkg>` (slow), `img.shields.io/bundlephobia/minzip/<pkg>`, pkg-size.dev, and the jsDelivr hits badge.
   - Badges build trust only; they do not help search ranking.

9. **JSR (optional, after the npm launch).**
   - Add a `jsr.json` with exports pointing at `src/*.ts`, and run `npx jsr publish` from Actions with `id-token: write`. You get provenance, and the code is ESM only.
   - Scope names are 2–32 characters. JSR also blocks names that differ only by a hyphen.
   - It gains you little for search; it mainly reaches Deno users and gives auto-generated docs.

---

## 3. Search and discovery, in order of impact

**Tier 1**
1. **Prerendered static HTML for every page.** Google: "server-side or pre-rendering is still a great idea… not all bots can run JavaScript." AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not run JavaScript (Vercel and MERJ study). Give each page a unique `<title>`, meta description and a canonical URL in the HTML itself. Use History API URLs, not `#` fragments.
2. **Get listed where React Flow users already look. This is the biggest backlink and traffic opportunity.**
   - React Flow's layouting page (https://reactflow.dev/learn/layouting/layouting) lists dagre, d3-hierarchy, d3-force and elkjs, plus "honourable mentions" (d3-flextree, entitree-flex, WebCola). Its own table says dagre has an open issue with sub-flow layout and ELK is the most complex option.
   - **Nested sub-flow layout for React Flow, without ELK's complexity, is the gap to own.** Ask through the xyflow repos; there is no formal submission process.
   - Open a PR to the "Layouting" section of **xyflow/awesome-node-based-uis** (3.7k★).
   - The one direct competitor is `@jalez/react-flow-automated-layout` (built on dagre, about 1k downloads a week).
3. **Search Console and Bing.**
   - Create a URL-prefix property for `https://mark1russell7.github.io/`, verified with an HTML file in the user-site repo. It covers every project site.
   - Add the project's `Sitemap:` line to **`mark1russell7.github.io/robots.txt`**. You already do this for crawler, vex and lag. A robots.txt inside a project path is ignored.
   - Import the property into Bing Webmaster Tools. Bing feeds ChatGPT search, Copilot and DuckDuckGo.
4. **npm metadata.**
   - The description is one sentence with the key phrases.
   - About 15–20 keywords: graph-layout, layout-engine, nested-graph, compound-graph, tree-layout, radial-layout, grid-layout, graph-drawing, react-flow, xyflow, subflows, diagram, svg, canvas, typescript, dagre-alternative, elkjs-alternative.
   - `homepage` points to the site.
   - README opening: one sentence, then a GIF or SVG, install, and a 10-line example.
   - The npm, GitHub, jsDelivr, unpkg and Socket pages rank for the name itself.
5. **GitHub repo settings.** Use the same tagline as the description, set the homepage URL, add up to 20 topics (topic counts: react-flow 986, graph-visualization 760, layout-engine 264, graph-drawing 108, graph-layout 72, dagre 61, elkjs 28), add a 1280×640 social preview image, and publish GitHub releases.

**Tier 2**

6. **Pages that match what people search for.**
   - "<name> vs dagre vs elkjs vs d3-hierarchy": an honest table plus the same graph laid out by each.
   - "Auto-layout nested sub-flows in React Flow."
   - "Radial tree layout in JavaScript."
   - **One URL for each example in the gallery** (not tabs on one page). Each page shows an SVG rendered at build time with your own `toSVG`, then upgrades to the interactive version. React Flow 12 can render on the server when nodes have explicit sizes, and your engine computes those sizes.
7. **Launch.**
   - Show HN ("Show HN: <name> – nested graph layout for React Flow, Canvas and SVG"), r/reactjs and r/javascript.
   - Cross-post on dev.to with `canonical_url` set to your page.
   - Submit to This Week in React and JavaScript Weekly, and post in React Flow Discord and GitHub Discussions.
8. **Answer questions.** On Stack Overflow and GitHub, answer questions such as "react flow group/subflow layout" and "dagre compound/cluster" with working code, and say that you are the author.
9. **AI and agent discovery.**
   - Add `llms.txt` and `llms-full.txt` (`starlight-llms-txt` 0.12, or reuse crawler's `src/pages/llms.txt.ts`). Google says AI Overviews do not need them; coding agents use them.
   - Submit the library to **Context7**, so AI coding assistants can fetch its docs.
   - Keep AI crawlers allowed; the user-site robots.txt already allows all.

**Tier 3**

10. **Structured data (JSON-LD).** Use `SoftwareSourceCode` (codeRepository, programmingLanguage, license, runtimePlatform), `WebSite` and `BreadcrumbList`, plus `TechArticle` for tutorials. Google's `SoftwareApplication` rich result needs `offers.price` and also `aggregateRating` or `review`. Do not invent ratings, so expect no rich result. Reuse crawler's `src/routeData.ts` JSON-LD middleware.
11. **Open Graph images per page** (`astro-og-canvas` 0.13.2, or your Playwright card script). They raise click-through on shares, not ranking.
12. **Core Web Vitals** (a tie-breaker signal):
    - Ship no JavaScript on docs pages.
    - Load demos with `client:visible`.
    - Reserve canvas dimensions to avoid layout shift.
    - Self-host fonts.
    - Use the prerendered SVG as the main content image.
13. **Internal links and smaller items.**
    - Docs, examples and API pages link to each other. Link from the portfolio root and the crawler site.
    - Add "Open in StackBlitz" links and an esm.sh or jsDelivr snippet. jsDelivr and unpkg mirror the package automatically.
    - Other awesome lists, once you have some stars: anvaka/graph-drawing-libraries, sorrycc/awesome-javascript, brillout/awesome-react-components, enaqx/awesome-react.

---

## 4. Static-site framework (versions as of 2026-10-12)

| Option | Prerender | MDX | Islands for heavy canvases | GitHub Pages base path | Client JS | Notes |
|---|---|---|---|---|---|---|
| **Astro 7.3.8 + Starlight 0.42.6 + @astrojs/react 7.0.1** | Static by default | `@astrojs/mdx` 8.0.3 / built into Starlight | **Yes**: `client:visible`, `client:idle`, `client:only="react"` | `site` + `base`; your crawler already does this | None on docs pages | Astro 7 has a Rust compiler and Vite 8 (Rolldown), with 15–61% faster builds. Starlight writes the sitemap, includes Pagefind search, and has starlight-typedoc 0.23.1. **Your crawler site already uses this exact stack.** |
| VitePress 1.6.4 (2.0 in alpha) | Yes | Markdown and Vue | Vue only; React needs workarounds | `base` | Small | Wrong framework for React demos. |
| vite-react-ssg 0.9.2 | Yes | Set up by hand | No; the whole page hydrates | Vite `base` | React on every page | Small project (240★); you build all docs features yourself. |
| React Router 8.4 framework mode (`prerender`, `ssr:false`) | Listed paths; dynamic routes must be enumerated; writes an SPA fallback | Set up by hand | No; the whole page hydrates | `basename` + `base` | React on every page | Good when the site is mostly an app. |
| TanStack Start 1.169 | `prerender` with `crawlLinks` | Set up by hand | No; the whole page hydrates | Router basepath | React on every page | Changes quickly; more configuration. |
| Next.js 16.4 `output:'export'` | Yes | `@next/mdx` | Server components cut JS, but no islands | `basePath`, `images.unoptimized` | Heavy runtime | More than this site needs. |
| Docusaurus 3.10.2 | Yes | MDX 3 | `BrowserOnly` | `baseUrl` | Every page hydrates a React app | Strong for docs; harder to make look portfolio-grade. |

**Recommendation: Astro 7 + Starlight + React islands**, the same stack as crawler. You can reuse `check-site.mjs`, the OG script, `routeData.ts` and `llms.txt.ts`.
- Make `/` a custom Astro splash page with a live demo island.
- Put `/docs/*` and the API reference in Starlight (starlight-typedoc).
- Make each `/examples/<slug>/` a static SVG plus a `client:visible` island.
- Make `/playground/` one `client:only="react"` island.
- Islands do not share React context; use `nanostores` 1.5.5 with `@nanostores/react` 2.0.1, or one large island per page.
- **TypeDoc 0.28.20 supports TypeScript only up to 6.0.** Give TypeDoc a `typescript@6` alias and build with TypeScript 7.
- Set `trailingSlash: "always"`, because GitHub Pages answers `/x` with a 301 to `/x/`.

---

## 5. GitHub Pages deployment

- **Workflow:** copy `crawler/.github/workflows/pages.yml`; it is already best practice.
  - Separate build and deploy jobs.
  - The build job has `contents: read`.
  - The deploy job has `pages: write` and `id-token: write`, uses environment `github-pages`, and runs no repo code.
  - Actions are pinned by SHA.
  - `SITE_BASE=/${{ github.event.repository.name }}`.
  - Current versions: checkout v7.0.1, setup-node v7.1.0, pnpm/action-setup v6.1.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1, configure-pages v6.0.0 (optional). `withastro/action` v6.1.3 is an alternative.
  - GitHub's starter workflow uses `cancel-in-progress: false` for Pages, so a deployment already running finishes. Crawler uses `true`; this is minor.
- **Settings:** set Settings → Pages → Source to "GitHub Actions". Custom workflows run no Jekyll, so you need no `.nojekyll`.
- **Limits:** the published site is at most 1 GB, the artifact tar must be under 10 GB with no symlinks, bandwidth has a soft limit of 100 GB a month, and a deployment times out after 10 minutes.
- **404:** Starlight writes `dist/404.html`, which Pages serves with a real 404 status for missing paths under `/<name>/`. Keep it `noindex`, as crawler does.
- **robots.txt and sitemap:** they belong in the **user-site repo** (`mark1russell7.github.io/robots.txt`), as for your other projects. Pages cannot set custom headers, and HTML is cached for about 10 minutes.
- **Custom domain, optional (for example `<name>.dev`):**
  - Pros: a brand URL, a domain property in Search Console, a robots.txt at the root, and freedom to leave Pages later.
  - Cons: yearly cost, and the site no longer builds authority for your portfolio domain.
  - With Actions deployments, set the domain in repo settings (a CNAME file is ignored), verify the domain in account settings to prevent takeover, and enforce HTTPS.
  - Pages redirects the github.io URL automatically, so switching later is cheap. **Start on `mark1russell7.github.io/<name>/`**, which matches your other projects.

---

## Key URLs
- npm punctuation rule: https://blog.npmjs.org/post/168978377570/new-package-moniker-rules
- Trusted publishing: https://docs.npmjs.com/trusted-publishers/ · Staged publishing: https://docs.npmjs.com/staged-publishing
- GitHub changelog: https://github.blog/changelog/2026-07-07-npm-install-time-security-and-gat-bypass2fa-deprecation · https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens · https://github.blog/changelog/2026-10-02-unvalidated-npm-trusted-publishing-configurations-now-expire
- tsdown: https://tsdown.dev/guide/migrate-from-tsup · https://tsdown.dev/options/package-exports · https://tsdown.dev/options/lint · https://tsdown.dev/options/dts
- ESM-only: https://blog.openreplay.com/end-dual-cjs-esm-builds-nodejs/
- JSR: https://jsr.io/docs/publishing-packages
- React Flow: https://reactflow.dev/learn/layouting/layouting · https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration · https://reactflow.dev/examples/layout/sub-flows
- Lists: https://github.com/xyflow/awesome-node-based-uis · https://github.com/anvaka/graph-drawing-libraries
- Google: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics · https://developers.google.com/search/docs/appearance/structured-data/software-app
- AI crawlers: https://vercel.com/blog/the-rise-of-the-ai-crawler · llms.txt: https://llmstxt.org
- Astro and Starlight: https://astro.build/blog/whats-new-june-2026/ · https://astro.build/blog/whats-new-july-2026 · https://starlight.astro.build/guides/customization/
- React Router v8: https://remix.run/blog/react-router-v8 · TanStack Start: https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode · https://tanstack.com/start/latest/docs/framework/solid/guide/static-prerendering
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages · https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## Not verified
- Some 2026 npm details (dates of stage-only tokens, the about-January-2027 publishing cutoff) come partly from secondary sources. The npm docs did confirm the 2026-05-20 and 2026-09-03 rules for allowed actions.
- Google's 2026 statement on llms.txt is reported only by third parties.
- npm's "too similar" check beyond punctuation runs only at publish, so the first manual publish is the real test of the name.

## Files I read
- Crawler release pattern: `~/git/crawler/package.json`, `~/git/crawler/packages/polite-crawler/package.json`, `~/git/crawler/packages/polite-crawler/tsdown.config.ts`, `~/git/crawler/.github/workflows/release.yml`, `~/git/crawler/.github/workflows/ci.yml`, `~/git/crawler/.github/workflows/pages.yml`, `~/git/crawler/scripts/smoke.mjs`, `~/git/crawler/scripts/publish-guard.mjs`, `~/git/crawler/README.md`.
- Crawler site (Astro 7 + Starlight; files to reuse): `~/git/crawler/packages/site/package.json`, `~/git/crawler/packages/site/astro.config.mjs`, `~/git/crawler/packages/site/src/routeData.ts`, `~/git/crawler/packages/site/scripts/check-site.mjs`, `~/git/crawler/packages/site/scripts/og-image.mjs`, `~/git/crawler/packages/site/src/pages/llms.txt.ts`.
- Jqy current state: `~/git/Jqy/package.json` (private Vite app on `reactflow@11`), `~/git/Jqy/README.md`.
- User site, whose robots.txt lists the project sitemaps: `~/git/mark1russell7.github.io/README.md`.
