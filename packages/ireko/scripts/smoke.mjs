#!/usr/bin/env node
// The smoke test of the tarball of ireko: the package as npm gives it to a user.
//
//   node scripts/smoke.mjs                    pack the package (build it first with `pnpm build`)
//   node scripts/smoke.mjs --tarball <file>   test a tarball that `pnpm pack` made
//   node scripts/smoke.mjs --keep             keep the temporary folder, and print its path
//
// The steps:
//   1. The packed manifest: each entry point is in the tarball, with the README, the LICENSE and the CHANGELOG.
//   2. publint (strict) and attw (the profile esm-only) examine the tarball.
//   3. An empty project installs the tarball from disk.
//   4. Plain Node.js imports each entry point that needs no DOM and no React, and lays out each example.
//   5. TypeScript examines two consumers: the core with no DOM types, and all entry points with the DOM types.
//      Each consumer compiles with the resolution nodenext and with the resolution bundler.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(packageDir, "..", "..");
const { values } = parseArgs({ options: { tarball: { type: "string" }, keep: { type: "boolean" } } });

let failures = 0;
const step = (text) => process.stdout.write(`\n== ${text}\n`);
const ok = (text) => process.stdout.write(`  ok    ${text}\n`);
const bad = (text) => {
  failures += 1;
  process.stdout.write(`  FAIL  ${text}\n`);
};
const check = (condition, text) => (condition ? ok(text) : bad(text));

// One command line. On Windows npm, pnpm and the bin shims are .cmd files, which need a shell.
const quote = (arg) => (/^[\w./:=@\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`);
const run = (command, args, cwd) => {
  const result = spawnSync([command, ...args].map(quote).join(" "), { cwd, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};
const bin = (name) => join(root, "node_modules", ".bin", name);

/**
 * This function reads the files of a .tgz into a map from each path to its content. It knows the ustar paths and the
 * pax paths. A tar program is not necessary: Git Bash on Windows reads "C:" in a path as the name of a remote host.
 */
function readTarball(file) {
  const data = gunzipSync(readFileSync(file));
  const out = new Map();
  let paxPath;
  for (let at = 0; at + 512 <= data.length; ) {
    const header = data.subarray(at, at + 512);
    if (header.every((b) => b === 0)) break;
    const field = (from, to) => {
      const raw = header.subarray(from, to);
      const end = raw.indexOf(0);
      return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8");
    };
    const size = Number.parseInt(field(124, 136).trim() || "0", 8);
    const type = field(156, 157);
    const prefix = field(345, 500);
    const name = paxPath ?? (prefix === "" ? field(0, 100) : `${prefix}/${field(0, 100)}`);
    const body = data.subarray(at + 512, at + 512 + size);
    paxPath = undefined;
    if (type === "x") paxPath = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString("utf8"))?.[1];
    else if (type === "0" || type === "") out.set(name, body);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

const work = mkdtempSync(join(tmpdir(), "ireko-smoke-"));
try {
  // 1. The tarball and its manifest.
  step("The tarball");
  let tarball = values.tarball === undefined ? undefined : resolve(values.tarball);
  if (tarball === undefined) {
    if (!existsSync(join(packageDir, "dist", "index.js"))) throw new Error("dist/ is missing. Start `pnpm build` first.");
    const packed = run("pnpm", ["pack", "--pack-destination", work], packageDir);
    if (packed.status !== 0) throw new Error(`pnpm pack failed:\n${packed.output}`);
    const file = readdirSync(work).find((f) => f.endsWith(".tgz"));
    if (file === undefined) throw new Error("pnpm pack made no tarball.");
    tarball = join(work, file);
  }
  ok(tarball);
  const files = readTarball(tarball);
  const has = (path) => files.has(`package/${path.replace(/^\.\//, "")}`);
  const manifestFile = files.get("package/package.json");
  if (manifestFile === undefined) throw new Error("The tarball has no package.json.");
  const manifest = JSON.parse(manifestFile.toString("utf8"));
  check(manifest.private !== true, "the manifest is not private");
  for (const [key, target] of Object.entries(manifest.exports)) {
    const targets = typeof target === "string" ? [target] : Object.values(target);
    for (const file of targets) check(has(file), `${key} -> ${file}`);
  }
  for (const file of ["README.md", "LICENSE", "CHANGELOG.md"]) check(has(file), `the tarball has ${file}`);
  check(![...files.keys()].some((f) => f.startsWith("package/src/")), "the tarball has no source folder");
  ok(`${String(files.size)} files`);
  check(manifest.dependencies === undefined || Object.keys(manifest.dependencies).length === 0, "the package has no runtime dependencies");

  // 2. publint and attw.
  step("publint and attw");
  const publint = run(bin("publint"), ["run", tarball, "--strict"], root);
  check(publint.status === 0, "publint --strict");
  if (publint.status !== 0) process.stdout.write(publint.output);
  const attw = run(bin("attw"), [tarball, "--profile", "esm-only"], root);
  check(attw.status === 0, "attw --profile esm-only");
  if (attw.status !== 0) process.stdout.write(attw.output);

  // 3. An empty project that installs the tarball, as a user installs the package from npm.
  step("Install");
  const app = join(work, "app");
  mkdirSync(app);
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "ireko-smoke", private: true, type: "module" }));
  const install = run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", tarball], app);
  check(install.status === 0, "npm install <tarball>");
  if (install.status !== 0) throw new Error(install.output);

  // 4. Plain Node.js: the entry points with no DOM and no React.
  step("Node.js");
  writeFileSync(
    join(app, "smoke.mjs"),
    `import { createEngine, grid, layout, radial } from "ireko";
import { examples } from "ireko/examples";
import { createViewport, labelAt } from "ireko/render";
import { toSVG } from "ireko/svg";
import { parse, print } from "ireko/text";

const fail = (message) => { throw new Error(message); };
for (const example of examples) {
  const out = layout(example.input, example.options);
  if (out.issues.length > 0) fail(example.name + ": " + JSON.stringify(out.issues));
  if (!toSVG(out, { title: example.title }).startsWith("<svg")) fail(example.name + ": toSVG");
  const again = parse(print(example.input));
  if (!again.ok) fail(example.name + ": parse(print(input)) failed: " + again.error.message);
}
const root = grid.nested("system", radial.nested("web", "home", "cart"), grid("api", "auth", "orders"));
const out = createEngine().layout({ root, edges: [{ source: "cart", target: "orders", label: "checkout" }] });
if (out.nodes.length !== 7 || out.issues.length > 0) fail("the builder layout: " + out.nodes.length + " nodes, " + JSON.stringify(out.issues));
if (!toSVG(out).includes("checkout")) fail("toSVG has no edge label");
const view = createViewport();
view.fit(out.bounds, 800, 600);
if (!(view.get().k > 0)) fail("the viewport");
const middle = labelAt([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
if (middle.x !== 5) fail("labelAt");
console.log("node: " + examples.length + " examples and the builder lay out with no findings");
`,
  );
  const node = run("node", ["smoke.mjs"], app);
  check(node.status === 0, node.output.trim().split("\n").at(-1) ?? "node smoke.mjs");
  if (node.status !== 0) process.stdout.write(node.output);

  // 5. TypeScript: two consumers, two resolutions.
  step("TypeScript");
  writeFileSync(
    join(app, "core.ts"),
    `import { layout, type Layout, type NodeSpec } from "ireko";
import { examples, type Example } from "ireko/examples";
import { parse, print, type ParseResult } from "ireko/text";

const root: NodeSpec = { id: "r", children: [{ id: "a" }, { id: "b" }] };
const out: Layout = layout({ root });
const parsed: ParseResult = parse(print({ root }));
const first: Example | undefined = examples[0];
export const summary = [out.nodes.length, parsed.ok, first?.name];
`,
  );
  writeFileSync(
    join(app, "all.ts"),
    `import { layout } from "ireko";
import { drawFrame, mountCanvas, type Context2D } from "ireko/canvas";
import { mountDom } from "ireko/dom";
import { createViewport, darkTheme, frameOf, type Renderer } from "ireko/render";
import { mountSvg, toSVG } from "ireko/svg";

const out = layout({ root: { id: "r", children: [{ id: "a" }] } });
const host: HTMLElement = document.createElement("div");
const views: Renderer[] = [mountSvg(host), mountDom(host, { theme: darkTheme }), mountCanvas(host, { viewport: createViewport() })];
for (const view of views) view.update(out);
const draw = (ctx: Context2D): void => drawFrame(ctx, frameOf(out), { x: 0, y: 0, k: 1 }, darkTheme, { width: 10, height: 10, dpr: 1 });
export const result = [toSVG(out).length, draw];
`,
  );
  const configs = [
    { name: "core, no DOM, nodenext", lib: ["es2022"], module: "nodenext", resolution: "nodenext", files: ["core.ts"] },
    { name: "core, no DOM, bundler", lib: ["es2022"], module: "preserve", resolution: "bundler", files: ["core.ts"] },
    { name: "renderers, DOM, nodenext", lib: ["es2022", "dom"], module: "nodenext", resolution: "nodenext", files: ["all.ts"] },
    { name: "renderers, DOM, bundler", lib: ["es2022", "dom"], module: "preserve", resolution: "bundler", files: ["all.ts"] },
  ];
  for (const c of configs) {
    const file = `tsconfig.${c.name.replace(/\W+/g, "-")}.json`;
    writeFileSync(
      join(app, file),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, skipLibCheck: false, target: "es2022", lib: c.lib, module: c.module, moduleResolution: c.resolution, types: [] },
        files: c.files,
      }),
    );
    const tsc = run(bin("tsc"), ["-p", file], app);
    check(tsc.status === 0, `tsc: ${c.name}`);
    if (tsc.status !== 0) process.stdout.write(tsc.output);
  }
} catch (error) {
  bad(error instanceof Error ? error.message : String(error));
} finally {
  if (values.keep === true) process.stdout.write(`\nThe temporary folder: ${work}\n`);
  else rmSync(work, { recursive: true, force: true });
}

process.stdout.write(failures === 0 ? "\nThe smoke test passed.\n" : `\nThe smoke test failed: ${String(failures)} problems.\n`);
process.exit(failures === 0 ? 0 : 1);
