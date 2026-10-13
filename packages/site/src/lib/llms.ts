/**
 * The text files for language models (https://llmstxt.org): `llms.txt` lists the pages, and `llms-full.txt` holds
 * the text of each page. Both come from the docs collection, so a new page needs no change here.
 */
import type { CollectionEntry } from "astro:content";
import { examples } from "ireko/examples";
import { NAME, NPM, REPOSITORY, SITE, TAGLINE } from "./site.ts";

type Page = CollectionEntry<"docs">;

/** The sections of `llms.txt`, in order, for each first part of the identifier of a page. */
const SECTIONS: readonly { readonly key: string; readonly title: string }[] = [
  { key: "learn", title: "Learn" },
  { key: "design", title: "How it works" },
  { key: "guides", title: "Guides" },
  { key: "reference", title: "Reference" },
  { key: "compare", title: "Optional" },
  { key: "about", title: "Optional" },
];

/** The order of the pages in a section. A page that is not in this list comes after the others. */
const ORDER = [
  "learn/tour",
  "learn/quick-start",
  "learn/modes",
  "learn/strategies",
  "learn/text-language",
  "learn/edges",
  "learn/renderers",
  "learn/custom-strategy",
  "design/two-passes",
  "design/pipeline",
  "design/architecture",
  "guides/react-flow",
  "guides/server-svg",
  "reference/api",
  "reference/options",
  "reference/issues",
  "compare",
  "about",
];

/** This function gives the absolute URL of a page. */
export const urlOf = (id: string): string => (id === "index" || id === "" ? SITE : `${SITE}${id}/`);

/** This function tells if a page goes into the files. The 404 page and the drafts do not. */
export const listed = (page: Page): boolean => page.id !== "404" && !page.data.draft && page.data.pagefind;

const rank = (id: string): number => {
  if (id === "index") return -1;
  const index = ORDER.indexOf(id);
  return index === -1 ? ORDER.length : index;
};

/** This function sorts the pages: the home page, the order of the sidebar, then the alphabetical order. */
export const sorted = (pages: readonly Page[]): Page[] => pages.toSorted((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

const line = (title: string, url: string, description: string | undefined): string => `- [${title}](${url})${description === undefined || description === "" ? "" : `: ${description}`}`;

/** This function gives the text of `llms.txt`. */
export function llmsTxt(pages: readonly Page[]): string {
  const out: string[] = [
    `# ${NAME}`,
    "",
    `> ${TAGLINE}`,
    "",
    `${NAME} is a TypeScript library. A tree of boxes goes in. Each container selects a strategy (grid or radial) and a mode (nested or linked).`,
    "The engine measures each subtree before it places it, so no two boxes overlap. The output is plain JSON: absolute boxes, routed edges and the findings of an audit.",
    `Renderers for SVG, Canvas, the DOM, React and React Flow are optional subpath exports. Install: \`npm install ${NAME}\`.`,
    "",
    `- [Home](${SITE}): ${TAGLINE}`,
    `- [Playground](${SITE}playground/): Type a layout in the text language and see it at once.`,
    `- [Source code](${REPOSITORY}): The repository on GitHub.`,
    `- [npm package](${NPM}): The package on npm.`,
  ];
  const home = new Set(["index", ""]);
  const groups = new Map<string, Page[]>();
  for (const page of sorted(pages.filter((p) => listed(p) && !home.has(p.id)))) {
    const key = page.id.split("/")[0] ?? "";
    const title = SECTIONS.find((s) => s.key === key)?.title ?? "Docs";
    groups.set(title, [...(groups.get(title) ?? []), page]);
  }
  const titles = [...new Set([...SECTIONS.map((s) => s.title), ...groups.keys()])].filter((t) => t !== "Optional");
  for (const title of titles) {
    const list = groups.get(title);
    if (list === undefined) continue;
    out.push("", `## ${title}`, "", ...list.map((p) => line(p.data.title, urlOf(p.id), p.data.description)));
  }
  out.push("", "## Optional", "", ...(groups.get("Optional") ?? []).map((p) => line(p.data.title, urlOf(p.id), p.data.description)));
  out.push(line("Gallery", `${SITE}gallery/`, "Each example of the library, with its layout and its text."));
  out.push(...examples.map((e) => line(`Gallery: ${e.title}`, `${SITE}gallery/${e.name}/`, e.description)));
  return `${out.join("\n")}\n`;
}

/** This function gives the Markdown of a page without the imports and the lines that are only a component. */
const plainOf = (body: string): string =>
  body
    .replace(/^import\s.*$/gm, "")
    .replace(/^\s*<[A-Z][\w.]*\b[^>]*\/>\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** This function gives the text of `llms-full.txt`: the title, the address and the text of each page. */
export function llmsFullTxt(pages: readonly Page[]): string {
  const out: string[] = [`# ${NAME}`, "", `> ${TAGLINE}`];
  for (const page of sorted(pages.filter(listed))) {
    out.push("", "---", "", `# ${page.data.title}`, "", `Source: ${urlOf(page.id)}`);
    if (page.data.description !== undefined) out.push("", `> ${page.data.description}`);
    const body = plainOf(page.body ?? "");
    if (body !== "") out.push("", body);
  }
  return `${out.join("\n")}\n`;
}
