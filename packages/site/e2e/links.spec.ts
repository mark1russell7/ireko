/**
 * The links of the built site. Each link and each asset of each page that goes to the site must lead to a file.
 * A link without the base path fails too: GitHub Pages serves the site at /ireko/, not at the root.
 */
import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.env["SITE_DIST"] ?? "dist");
// The base path, the same as e2e/serve.ts. Git Bash turns "/ireko" into a Windows path, so it can come without its slash.
const base = `/${(process.env["SITE_BASE"] ?? "ireko").replace(/^.*[\\/](?=[^\\/]+[\\/]?$)/, "").replace(/^\/+|\/+$/g, "")}`;

/** This function gives each HTML file of a folder and its subfolders. */
function pagesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pagesOf(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []));
}

/** This function tells if a path of the site leads to a file: a file, or a folder with an index.html. */
function resolves(path: string): boolean {
  const file = join(root, decodeURIComponent(path.slice(base.length)));
  return existsSync(file) && (statSync(file).isFile() || existsSync(join(file, "index.html")));
}

test("each internal link and asset leads to a file", () => {
  const bad = new Set<string>();
  let count = 0;
  for (const page of pagesOf(root)) {
    const html = readFileSync(page, "utf8");
    for (const m of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) {
      const url = m[1] ?? "";
      if (url.startsWith("//")) continue;
      count++;
      if (!(url === base || url.startsWith(`${base}/`)) || !resolves(url)) bad.add(`${url} (in ${page.slice(root.length + 1)})`);
    }
  }
  expect(count).toBeGreaterThan(500);
  expect([...bad]).toEqual([]);
});
