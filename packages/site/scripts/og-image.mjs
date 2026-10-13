// This script draws the share card (1200 by 630) of each page of a built site. Start it after `astro build`:
//   node scripts/og-image.mjs [dist]
// Each card goes to <dist>/og/<path>.png. The head of each page points there (cardOf in src/routeData.ts).
// Each card shows a real layout of ireko, drawn with toSVG. Node.js 24 reads the TypeScript of the workspace package.
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { layout } from "ireko";
import { examples } from "ireko/examples";
import { toSVG } from "ireko/svg";

const WIDTH = 1200;
const HEIGHT = 630;
const dist = process.argv[2] ?? fileURLToPath(new URL("../dist", import.meta.url));
const modules = fileURLToPath(new URL("../node_modules/", import.meta.url));

const leaves = (...ids) => ids.map((id) => ({ id }));
// The first text of the playground, as data. The card of the playground shows the same layout.
const PLAYGROUND = {
  root: {
    id: "app",
    label: "My app",
    mode: "nested",
    layout: { type: "grid", columns: 2 },
    children: [
      { id: "web", layout: "radial", mode: "nested", children: leaves("home", "cart", "search", "account") },
      { id: "api", children: leaves("auth", "orders", "payments") },
      { id: "data", mode: "nested", children: leaves("postgres", "redis", "kafka") },
      { id: "jobs", layout: "radial", children: leaves("email", "reports") },
    ],
  },
  edges: [
    { source: "web", target: "api", label: "calls" },
    { source: "api", target: "data" },
  ],
};

/** The label above the title of a card, for each first part of the path. */
const KICKERS = {
  learn: "Learn",
  design: "How it works",
  guides: "Guide",
  reference: "Reference",
  gallery: "Gallery",
  compare: "Compare",
  about: "About",
  playground: "Playground",
};

/** The example that each page shows. A page without an entry gets an example from a hash of its path. */
const ART = {
  index: "mixed",
  "learn/tour": "mind-map",
  "learn/quick-start": "org-chart",
  "learn/modes": "nested-rings",
  "learn/strategies": "sides",
  "learn/text-language": "architecture",
  "learn/edges": "routers",
  "learn/renderers": "fit-clip",
  "learn/custom-strategy": "fan",
  "design/two-passes": "jqy-demo",
  "design/pipeline": "sizes",
  "design/architecture": "fractal",
  "guides/react-flow": "architecture",
  "guides/server-svg": "fit-scale",
  compare: "mixed",
  "reference/api": "org-chart",
  "reference/options": "sides",
  "reference/issues": "jqy-demo",
  about: "nested-rings",
  gallery: "fractal",
};

const THEME = { fontFamily: "'Atkinson Hyperlegible Next Variable', sans-serif" };

const font = (file) => readFileSync(join(modules, file)).toString("base64");
const sans = font("@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2");
const mono = font("@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2");

const MARK = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="5" fill="none" stroke="#151c2e" stroke-width="2.5"/><rect x="8" y="8" width="16" height="16" rx="3" fill="none" stroke="#2346c4" stroke-width="2.5"/><rect x="13" y="13" width="6" height="6" rx="1.5" fill="#c2301f"/></svg>`;
const CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#0ca30c"/><path d="M4.6 8.2 7 10.5l4.4-4.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STYLE = `
@font-face { font-family: "Atkinson Hyperlegible Next Variable"; font-weight: 200 800; src: url(data:font/woff2;base64,${sans}) format("woff2"); }
@font-face { font-family: "Atkinson Hyperlegible Mono Variable"; font-weight: 200 800; src: url(data:font/woff2;base64,${mono}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
body {
  font-family: "Atkinson Hyperlegible Next Variable", sans-serif; color: #151c2e;
  background-color: #f5f6f9;
  background-image:
    linear-gradient(#dfe3eb 1px, transparent 1px), linear-gradient(90deg, #dfe3eb 1px, transparent 1px),
    linear-gradient(#e9ecf2 1px, transparent 1px), linear-gradient(90deg, #e9ecf2 1px, transparent 1px);
  background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;
  background-position: -1px -1px;
}
.card { position: absolute; inset: 0; padding: 56px 64px; display: grid; }
.brand { display: flex; align-items: center; gap: 14px; font-weight: 700; font-size: 32px; letter-spacing: -0.01em; }
.brand svg { width: 40px; height: 40px; }
.kicker { font-family: "Atkinson Hyperlegible Mono Variable", monospace; font-size: 19px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #2346c4; display: flex; align-items: center; gap: 12px; }
.kicker::before { content: ""; width: 28px; height: 3px; background: #2346c4; }
h1 { font-weight: 750; letter-spacing: -0.02em; line-height: 1.06; text-wrap: balance; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.desc { color: #454f67; font-size: 25px; line-height: 1.38; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; text-wrap: pretty; }
.url { font-family: "Atkinson Hyperlegible Mono Variable", monospace; font-size: 19px; color: #5f6880; }
.chip { white-space: nowrap; font-family: "Atkinson Hyperlegible Mono Variable", monospace; font-size: 17px; color: #151c2e; background: #ffffff; border: 1px solid #aeb6c7; border-radius: 6px; padding: 6px 12px; }
.chip b { color: #2346c4; font-weight: 600; }
.foot { display: flex; align-items: center; gap: 18px; }
.art { position: relative; display: grid; grid-template-rows: 1fr auto; gap: 10px; min-height: 0; }
.frame { position: relative; min-height: 0; padding: 18px; }
.frame svg.layout { width: 100%; height: 100%; display: block; }
/* The art is smaller than the layout. Strokes keep their width, so thin lines stay visible. */
.frame svg.layout rect, .frame svg.layout polyline { vector-effect: non-scaling-stroke; stroke-width: 1.4px; }
.tick { position: absolute; width: 18px; height: 18px; border-color: #7a8399; border-style: solid; border-width: 0; }
.tick.tl { top: 0; left: 0; border-top-width: 2px; border-left-width: 2px; }
.tick.tr { top: 0; right: 0; border-top-width: 2px; border-right-width: 2px; }
.tick.bl { bottom: 0; left: 0; border-bottom-width: 2px; border-left-width: 2px; }
.tick.br { bottom: 0; right: 0; border-bottom-width: 2px; border-right-width: 2px; }
.caption { justify-self: end; display: flex; align-items: center; gap: 10px; font-family: "Atkinson Hyperlegible Mono Variable", monospace; font-size: 17px; color: #5f6880; }
.caption svg { width: 18px; height: 18px; }
.caption .good { color: #006300; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }

/* The art on the right: a layout that is approximately square. */
.side { grid-template-columns: minmax(0, 1fr) 450px; column-gap: 44px; }
.side .text { display: grid; grid-template-rows: auto 1fr auto; min-height: 0; }
.side .body { align-self: center; display: grid; gap: 18px; }
.side .desc { -webkit-line-clamp: 3; }
.side h1 { -webkit-line-clamp: 3; }

/* The art below the text: a wide layout. */
.band { grid-template-rows: auto auto 1fr; row-gap: 22px; }
.band .top { display: flex; align-items: center; justify-content: space-between; }
.band .body { display: grid; gap: 12px; max-width: 1000px; }
.band h1 { -webkit-line-clamp: 2; }
.band .desc { -webkit-line-clamp: 2; font-size: 23px; }

/* The home page: the name of the library is the title. */
.home .brand { font-size: 88px; gap: 26px; letter-spacing: -0.03em; }
.home .brand svg { width: 92px; height: 92px; }
.home .body { gap: 22px; }
.home .lead { font-size: 34px; font-weight: 650; line-height: 1.2; letter-spacing: -0.01em; text-wrap: balance; }
.home .pills { display: flex; flex-wrap: wrap; gap: 10px; }
.home .pill { font-family: "Atkinson Hyperlegible Mono Variable", monospace; font-size: 17px; padding: 5px 11px; border-radius: 999px; border: 1px solid #aeb6c7; background: #ffffff; color: #454f67; }
`;

const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** This function decodes the character references of an attribute or a title of the built HTML. */
const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** This function gives the content of the first meta tag with the attribute `key` equal to `value`. */
const metaOf = (html, key, value) => {
  for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
    if (!tag.includes(`${key}="${value}"`)) continue;
    const content = /\bcontent="([^"]*)"/.exec(tag);
    if (content !== null) return decode(content[1]);
  }
  return undefined;
};

/** This function gives the path of each HTML page of the build, relative to the build folder. */
function pagesOf(folder) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "og" && entry.name !== "_astro" && entry.name !== "pagefind") walk(full);
      } else if (entry.name === "index.html") out.push(full);
    }
  };
  walk(folder);
  return out.toSorted((a, b) => a.localeCompare(b));
}

/** This function gives a number from 0 to n - 1 for a text. The same text gives the same number. */
const hashOf = (text, n) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h % n;
};

/** This function gives the layout of the card of the page at `path`, and the name of its example. */
function artOf(path) {
  if (path === "playground") return layout(PLAYGROUND, { spacing: 20, nodeSize: { width: 92, height: 38 } });
  const gallery = /^gallery\/([^/]+)$/.exec(path);
  const name = gallery?.[1] ?? ART[path] ?? examples[hashOf(path, examples.length)].name;
  const example = examples.find((e) => e.name === name) ?? examples[0];
  return layout(example.input, example.options);
}

function svgOf(out) {
  return toSVG(out, { background: false, padding: 6, theme: THEME })
    .replace(/^<svg /, '<svg class="layout" preserveAspectRatio="xMidYMid meet" ')
    .replace(/ width="[^"]*" height="[^"]*"/, "");
}

function captionOf(out) {
  const overlaps = out.issues.filter((issue) => issue.code === "OVERLAP").length;
  const boxes = `${String(out.nodes.length)} boxes · ${String(out.edges.length)} edges`;
  const check = overlaps === 0 ? `<span class="good">${CHECK}0 overlaps</span>` : `<span>${String(overlaps)} overlaps</span>`;
  return `<figcaption class="caption"><span>${boxes}</span>${check}</figcaption>`;
}

const figure = (out) =>
  `<figure class="art"><div class="frame"><i class="tick tl"></i><i class="tick tr"></i><i class="tick bl"></i><i class="tick br"></i>${svgOf(out)}</div>${captionOf(out)}</figure>`;

const titleSize = (title, band) => {
  const n = title.length;
  if (band) return n <= 34 ? 58 : n <= 56 ? 50 : 44;
  return n <= 22 ? 64 : n <= 40 ? 56 : n <= 64 ? 48 : 42;
};

const FOOT = `<span class="url">mark1russell7.github.io/ireko</span><span class="chip"><b>npm</b> install ireko</span>`;
const BRAND = `<div class="brand">${MARK}<span>ireko</span></div>`;

function cardHtml(path, title, description) {
  const out = artOf(path);
  const ratio = out.bounds.width / Math.max(1, out.bounds.height);
  if (path === "index") {
    return `<main class="card side home"><section class="text"><span></span><div class="body">${BRAND}<p class="lead">Composable graph and tree layout for TypeScript</p><div class="pills"><span class="pill">nested</span><span class="pill">linked</span><span class="pill">grid</span><span class="pill">radial</span><span class="pill">SVG · Canvas · DOM · React Flow</span></div></div><footer class="foot">${FOOT}</footer></section>${figure(out)}</main>`;
  }
  const kicker = KICKERS[path.split("/")[0]] ?? "ireko";
  const band = ratio > 1.7;
  const h1 = `<h1 style="font-size:${String(titleSize(title, band))}px">${esc(title)}</h1>`;
  const desc = description === "" ? "" : `<p class="desc">${esc(description)}</p>`;
  if (band) {
    return `<main class="card band"><header class="top">${BRAND}<div class="foot">${FOOT}</div></header><div class="body"><p class="kicker">${esc(kicker)}</p>${h1}${desc}</div>${figure(out)}</main>`;
  }
  return `<main class="card side"><section class="text">${BRAND}<div class="body"><p class="kicker">${esc(kicker)}</p>${h1}${desc}</div><footer class="foot">${FOOT}</footer></section>${figure(out)}</main>`;
}

const started = performance.now();
const pages = pagesOf(dist);
if (pages.length === 0) throw new Error(`og-image: no pages in ${dist}. Build the site first.`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${STYLE}</style></head><body></body></html>`);
let count = 0;
for (const file of pages) {
  const path = relative(dist, dirname(file)).split(sep).join("/") || "index";
  const html = readFileSync(file, "utf8");
  if (/<meta name="robots" content="noindex"/.test(html)) continue;
  const raw = metaOf(html, "property", "og:title") ?? decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "ireko");
  const title = raw.replace(/\s*\|\s*ireko$/, "");
  const description = metaOf(html, "name", "description") ?? "";
  await page.evaluate((body) => {
    document.body.innerHTML = body;
  }, cardHtml(path, title, description));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const target = join(dist, "og", `${path}.png`);
  mkdirSync(dirname(target), { recursive: true });
  await page.screenshot({ path: target, type: "png" });
  count += 1;
}
await browser.close();
console.info(`og-image: ${String(count)} cards in ${join(dist, "og")} (${((performance.now() - started) / 1000).toFixed(1)} s)`);
