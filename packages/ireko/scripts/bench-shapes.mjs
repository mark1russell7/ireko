#!/usr/bin/env node
// The benchmark of the shapes module of Vex against the shapes code of ireko (SHAPEWIRE).
//
//   node scripts/bench-shapes.mjs [--runs 31] [--large] [--out file.json]
//
// It needs Node.js 23.6 or later: Node.js removes the types of the TypeScript source of ireko.
// The trees are the trees of src/test/shape-trees.ts: the examples, the full trees of the strategy tree and random trees.
// For each group of trees it measures, as the median of the runs:
//   1. the shapes pass alone: each call of the linked shape of one layout, with the code of ireko and with the module
//      (the module time includes the change of the bands into lists of Vex and back);
//   2. the module call alone, with the records made before the run;
//   3. a full layout with the switch off and on;
//   4. the null arm: a full layout with the wrapper of shape-vex.ts around the code of ireko, not the module. Its time
//      over the layout with the switch off is the fixed cost of the wrapper (the change of the bands into lists of Vex
//      and back). Then full = 1 + fixed + module, and each term is measured.
// For the full layout and the null arm it also gives the time of the garbage collector per pass in each arm, from the
// "gc" entries of perf_hooks.
// It writes a Markdown table to stdout and to $GITHUB_STEP_SUMMARY, and the raw numbers to --out.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PerformanceObserver } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { layout } from "../src/core/engine.ts";
import { handLinkedShape, MAX_BANDS, setLinkedShape } from "../src/core/engine/shape.ts";
import { vexLinkedShape } from "../src/core/engine/shape-vex.ts";
import { nodeShape } from "../src/core/engine/shape.generated.js";
import { at } from "../src/core/at.ts";
import { exampleTrees, fullTrees, randomTrees } from "../src/test/shape-trees.ts";

const { values } = parseArgs({ options: { runs: { type: "string", default: "31" }, large: { type: "boolean", default: false }, out: { type: "string" } } });
const RUNS = Number(values.runs);
// Each sample lasts at least this time: the loop repeats a pass this number of times.
const MIN_SAMPLE_MS = 5;

const median = (xs) => {
  const s = [...xs].toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// The null arm: the code of vexLinkedShape (shape-vex.ts), with the code of ireko in place of the module. The output of
// the code of ireko goes into the form of the module output, so the wrapper reads it back as it reads the module.
const listOfBands = (bands) => ({ kind: "vex.list", items: bands.map((value, k) => ({ key: String(k), result: { ok: true, value } })) });
const valuesOfList = (list) =>
  list.items.map((item) => {
    if (!item.result.ok) throw new RangeError("ireko: the shape of a node is not finite.");
    return item.result.value;
  });
function nullLinkedShape(own, parts) {
  if (parts.length === 0) return handLinkedShape(own, parts);
  const records = parts.map((p) => ({ ox: p.x, oy: p.y, rows: listOfBands(p.shape.rows), cols: listOfBands(p.shape.columns) }));
  if (records.length !== parts.length) throw new RangeError("ireko: a record is missing.");
  const shape = handLinkedShape(own, parts);
  const out = [listOfBands([listOfBands(shape.rows), listOfBands(shape.columns)])];
  const value = at(out, 0);
  if (!("kind" in value)) throw new RangeError("ireko: the shape of a node is not finite.");
  const axes = valuesOfList(value);
  return { rows: valuesOfList(at(axes, 0)), columns: valuesOfList(at(axes, 1)) };
}

// The entries of the garbage collector. compare() keeps the time span of each sample, and gcPerPass() counts the
// entries that start in the spans of one arm.
const gcEntries = [];
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) gcEntries.push([e.startTime, e.duration]);
}).observe({ entryTypes: ["gc"] });
const flushGc = () => new Promise((done) => setTimeout(done, 20));
function gcPerPass(spans, reps) {
  let ms = 0;
  for (const [t, d] of gcEntries) if (spans.some(([s0, s1]) => t >= s0 && t < s1)) ms += d;
  return ms / (spans.length * reps);
}

/** The time of one pass in ms: the median of RUNS samples. The two functions alternate, so a slow moment hits both. */
function compare(a, b) {
  const reps = Math.max(1, Math.ceil(MIN_SAMPLE_MS / Math.max(0.001, once(a))));
  // A warm-up for the JIT.
  for (let i = 0; i < 3; i++) {
    sample(a, reps);
    sample(b, reps);
  }
  const ta = [];
  const tb = [];
  const sa = [];
  const sb = [];
  const timed = (f, times, spans) => {
    const t0 = performance.now();
    times.push(sample(f, reps));
    spans.push([t0, performance.now()]);
  };
  for (let r = 0; r < RUNS; r++) {
    if (r % 2 === 0) {
      timed(a, ta, sa);
      timed(b, tb, sb);
    } else {
      timed(b, tb, sb);
      timed(a, ta, sa);
    }
  }
  return { a: median(ta), b: median(tb), reps, spansA: sa, spansB: sb };
}
function once(f) {
  const t = performance.now();
  f();
  return performance.now() - t;
}
function sample(f, reps) {
  const t = performance.now();
  for (let i = 0; i < reps; i++) f();
  return (performance.now() - t) / reps;
}

const listOf = (bands) => ({ kind: "vex.list", items: bands.map((value, k) => ({ key: String(k), result: { ok: true, value } })) });

const groups = [
  { name: "examples (golden files)", trees: exampleTrees() },
  ...fullTrees(values.large).map((t) => ({ name: t.name, trees: [t] })),
  { name: "200 random trees (arbitrary.ts, fixed seed)", trees: randomTrees(200) },
];

const rows = [];
for (const group of groups) {
  // The inputs of each linked shape of one layout of each tree.
  const calls = [];
  setLinkedShape((own, parts) => {
    calls.push([own, parts]);
    return handLinkedShape(own, parts);
  });
  for (const t of group.trees) layout(t.input, t.options);
  setLinkedShape(handLinkedShape);
  const nodes = group.trees.reduce((sum, t) => sum + countNodes(t.input.root), 0);
  const bands = calls.reduce((sum, [, parts]) => sum + parts.reduce((s, p) => s + p.shape.rows.length + p.shape.columns.length, 0), 0);
  const row = { group: group.name, nodes, linkedShapes: calls.length, inputBands: bands };
  if (calls.length > 0) {
    const pass = compare(
      () => {
        for (const [own, parts] of calls) handLinkedShape(own, parts);
      },
      () => {
        for (const [own, parts] of calls) vexLinkedShape(own, parts);
      },
    );
    const prepared = calls.map(([own, parts]) => [parts.map((p) => ({ ox: p.x, oy: p.y, rows: listOf(p.shape.rows), cols: listOf(p.shape.columns) })), { w: own.width, h: own.height, limit: MAX_BANDS }]);
    const moduleOnly = compare(
      () => {
        for (const [own, parts] of calls) handLinkedShape(own, parts);
      },
      () => {
        for (const [records, vars] of prepared) nodeShape(records, vars);
      },
    );
    Object.assign(row, { handPassMs: pass.a, vexPassMs: pass.b, passRatio: pass.b / pass.a, moduleCallMs: moduleOnly.b, moduleCallRatio: moduleOnly.b / moduleOnly.a });
  }
  const full = compare(
    () => {
      setLinkedShape(handLinkedShape);
      for (const t of group.trees) layout(t.input, t.options);
    },
    () => {
      setLinkedShape(vexLinkedShape);
      for (const t of group.trees) layout(t.input, t.options);
    },
  );
  const nul = compare(
    () => {
      setLinkedShape(handLinkedShape);
      for (const t of group.trees) layout(t.input, t.options);
    },
    () => {
      setLinkedShape(nullLinkedShape);
      for (const t of group.trees) layout(t.input, t.options);
    },
  );
  setLinkedShape(handLinkedShape);
  await flushGc();
  Object.assign(row, { gcOffMs: gcPerPass(full.spansA, full.reps), gcOnMs: gcPerPass(full.spansB, full.reps), gcNullMs: gcPerPass(nul.spansB, nul.reps) });
  gcEntries.length = 0;
  Object.assign(row, { layoutOffMs: full.a, layoutOnMs: full.b, layoutRatio: full.b / full.a, layoutNullMs: nul.b, nullRatio: nul.b / nul.a, fixedShare: nul.b / nul.a - 1, moduleShare: full.b / full.a - nul.b / nul.a });
  rows.push(row);
  process.stderr.write(`done: ${group.name}\n`);
}

function countNodes(n) {
  return 1 + (n.children ?? []).reduce((s, c) => s + countNodes(c), 0);
}

const here = dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(resolve(here, "..", "src", "core", "engine", "shape.generated.js"));
const size = { bytes: moduleSource.length, gzip: gzipSync(moduleSource, { level: 9 }).length };

const f = (x, d = 3) => (x === undefined ? "-" : x.toFixed(d));
const lines = [
  "## SHAPEWIRE: the shapes module of Vex against the shapes code of ireko",
  "",
  `Node.js ${process.version}, ${String(RUNS)} runs, median. Times are ms for one pass over the group.`,
  "",
  "| Trees | Nodes | Linked shapes | Shapes pass, ireko | Shapes pass, Vex | Ratio | Module call only | Ratio | Layout, switch off | Layout, switch on | Ratio | Null arm | Ratio | Fixed share | Module share | GC off | GC on | GC null |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...rows.map((r) => `| ${r.group} | ${String(r.nodes)} | ${String(r.linkedShapes)} | ${f(r.handPassMs)} | ${f(r.vexPassMs)} | ${f(r.passRatio, 2)} | ${f(r.moduleCallMs)} | ${f(r.moduleCallRatio, 2)} | ${f(r.layoutOffMs)} | ${f(r.layoutOnMs)} | ${f(r.layoutRatio, 2)} | ${f(r.layoutNullMs)} | ${f(r.nullRatio, 2)} | ${f(r.fixedShare, 2)} | ${f(r.moduleShare, 2)} | ${f(r.gcOffMs)} | ${f(r.gcOnMs)} | ${f(r.gcNullMs)} |`),
  "",
  `The module \`shape.generated.js\`: ${String(size.bytes)} bytes, ${String(size.gzip)} bytes gzip (not minified).`,
  "",
];
const text = lines.join("\n");
process.stdout.write(`${text}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
if (values.out !== undefined) writeFileSync(values.out, `${JSON.stringify({ node: process.version, runs: RUNS, size, rows }, null, 2)}\n`);
