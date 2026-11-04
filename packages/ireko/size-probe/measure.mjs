#!/usr/bin/env node
// This script measures the cases of the size probe: esbuild with --minify --format=esm, then gzip -9. It gives a table,
// and a JSON file for the path of --out. Start it in `packages/ireko`. In a workflow, the table also goes to the summary.
//
// The modules of this folder are the output of the Vex compiler (emitModule, default fusion) for two pilots of
// mark1russell7/vex at the commit VEX_COMMIT: `shape.generated.js` is NODE_SHAPE in the envelope form of lists, and
// `tree.generated.js` is TREE_PROGRAM in the plain form of lists.

import { spawnSync } from "node:child_process";
import { appendFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const VEX_COMMIT = "18282a16a9e2c93b7988e2f00852f3774b15e1dd";

const CASES = [
  { id: "a", item: "`layout` with no module", entry: "size-probe/layout.js", bundle: true },
  { id: "b", item: "`layout` with the shapes module wired in", entry: "size-probe/layout-shape.js", bundle: true },
  { id: "c", item: "`tree.ts` alone", entry: "src/core/strategies/tree.ts", bundle: false },
  { id: "d", item: "The tree module alone", entry: "size-probe/tree.generated.js", bundle: false },
  { id: "e", item: "`layout` with the strategy `tree` on the tree module (the code of `tree.ts` stays in the bundle)", entry: "size-probe/layout-tree.js", bundle: true },
];

const store = "../../node_modules/.pnpm";
const folder = readdirSync(store).filter((name) => name.startsWith("esbuild@")).toSorted()[0];
if (folder === undefined) throw new Error("size probe: esbuild is not in the store of pnpm.");
const esbuild = createRequire(import.meta.url)(join(process.cwd(), store, folder, "node_modules/esbuild"));

/** This function gives the size in bytes of one case, minified and with gzip. */
function measure({ entry, bundle }) {
  const built = esbuild.buildSync({ entryPoints: [entry], bundle, minify: true, format: "esm", write: false, logLevel: "error" });
  const code = built.outputFiles[0].contents;
  const gzip = spawnSync("gzip", ["-9c"], { input: code, maxBuffer: 2 ** 26 });
  if (gzip.status !== 0) throw new Error(`size probe: gzip failed: ${gzip.stderr}`);
  return { minified: code.length, gzip: gzip.stdout.length };
}

const cases = CASES.map((c) => ({ ...c, ...measure(c) }));
const bytes = Object.fromEntries(cases.map((c) => [c.id, c.gzip]));
const differences = { "b - a": bytes.b - bytes.a, "e - a": bytes.e - bytes.a };

const table = [
  `### Size probe (esbuild ${esbuild.version} --minify --format=esm, gzip -9)`,
  "",
  `The modules come from \`mark1russell7/vex\` at \`${VEX_COMMIT.slice(0, 7)}\`.`,
  "",
  "| Case | Item | Minified bytes | Bytes with gzip |",
  "|---|---|---:|---:|",
  ...cases.map((c) => `| ${c.id} | ${c.item} | ${c.minified} | ${c.gzip} |`),
  ...Object.entries(differences).map(([name, value]) => `| ${name} | The difference | | ${value} |`),
  "",
  "The size check of ireko (`.size-limit.json`) gives `layout` a limit of 17.4 kB. It uses a different bundler, so compare the differences, not the totals.",
  "",
].join("\n");

console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);

const out = process.argv.indexOf("--out");
if (out !== -1) {
  const record = { vexCommit: VEX_COMMIT, esbuild: esbuild.version, cases: cases.map(({ id, item, entry, bundle, minified, gzip }) => ({ id, item, entry, bundle, minified, gzip })), differences };
  writeFileSync(process.argv[out + 1], `${JSON.stringify(record, null, 2)}\n`);
}
