/**
 * A static server for the browser tests. It serves a built site at its base path, the same as GitHub Pages:
 * a folder gives its `index.html`, and a missing file gives `404.html` with the status 404.
 * The environment sets the folder (`SITE_DIST`), the port (`PORT`) and the base path (`SITE_BASE`).
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.env["SITE_DIST"] ?? "dist");
const port = Number(process.env["PORT"] ?? "4322");
const base = `/${(process.env["SITE_BASE"] ?? "ireko").replace(/^.*[\\/](?=[^\\/]+[\\/]?$)/, "").replace(/^\/+|\/+$/g, "")}/`;

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".pf_meta": "application/octet-stream",
  ".pf_fragment": "application/octet-stream",
  ".pf_index": "application/octet-stream",
};

/** This function gives the file of a path below the base, or undefined. A path outside the folder gives undefined. */
function fileOf(path: string): string | undefined {
  const full = normalize(join(root, decodeURIComponent(path)));
  if (!full.startsWith(root)) return undefined;
  if (existsSync(full) && statSync(full).isFile()) return full;
  const index = join(full, "index.html");
  return existsSync(index) ? index : undefined;
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === base.slice(0, -1)) {
    response.writeHead(301, { Location: base });
    response.end();
    return;
  }
  const file = url.pathname.startsWith(base) ? fileOf(url.pathname.slice(base.length)) : undefined;
  // A folder without a slash at the end goes to the address with the slash, as on GitHub Pages.
  if (file?.endsWith("index.html") === true && !url.pathname.endsWith("/") && !url.pathname.endsWith(".html")) {
    response.writeHead(301, { Location: `${url.pathname}/${url.search}` });
    response.end();
    return;
  }
  const found = file ?? join(root, "404.html");
  response.writeHead(file === undefined ? 404 : 200, { "Content-Type": TYPES[extname(found)] ?? "application/octet-stream" });
  createReadStream(found).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.info(`serve: ${root} at http://127.0.0.1:${String(port)}${base}`);
});
