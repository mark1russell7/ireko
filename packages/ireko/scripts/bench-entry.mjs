#!/usr/bin/env node
// The time of a full layout of `ireko/shapes` against `ireko`, in one process, with an A/A arm.
//
//   node scripts/bench-entry.mjs [--rounds 31] [--out file.json]
//
// Three arms run in each round, in a turned order: the engine of `ireko`, a second engine of `ireko` (the A/A arm) and
// the entry `ireko/shapes`. Each sample repeats a pass until it lasts at least MIN_SAMPLE_MS. A round gives one ratio
// for each arm over the first arm. All arms share one process, so the call site of the linked shape sees two functions.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createEngine } from "../src/core/engine.ts";
import { layout as shapesLayout } from "../src/shapes/index.ts";
import { exampleTrees, fullTrees, randomTrees } from "../src/test/shape-trees.ts";

const { values } = parseArgs({ options: { rounds: { type: "string", default: "31" }, out: { type: "string" } } });
const ROUNDS = Number(values.rounds);
const MIN_SAMPLE_MS = 5;
const WARM_ROUNDS = 5;

const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const base = createEngine();
const second = createEngine();
const ARMS = [
  ["ireko", (t) => base.layout(t.input, t.options)],
  ["aa", (t) => second.layout(t.input, t.options)],
  ["shapes", (t) => shapesLayout(t.input, t.options)],
];

const groups = [
  ...fullTrees(true).map((t) => ({ name: t.name, trees: [t] })),
  { name: "examples", trees: exampleTrees() },
  { name: "random trees", trees: randomTrees(200) },
];

function pass(arm, trees) {
  let n = 0;
  for (const t of trees) n += arm[1](t).nodes === undefined ? 1 : 0;
  return n;
}

function sample(arm, trees, reps) {
  const t0 = performance.now();
  let sink = 0;
  for (let i = 0; i < reps; i++) sink += pass(arm, trees);
  const ms = (performance.now() - t0) / reps;
  if (sink < 0) throw new Error("no");
  return ms;
}

const rows = [];
for (const g of groups) {
  let reps = 1;
  while (sample(ARMS[0], g.trees, reps) * reps < MIN_SAMPLE_MS) reps *= 2;
  for (let r = 0; r < WARM_ROUNDS; r++) for (const arm of ARMS) sample(arm, g.trees, reps);
  const times = Object.fromEntries(ARMS.map(([n]) => [n, []]));
  for (let r = 0; r < ROUNDS; r++) {
    for (let k = 0; k < ARMS.length; k++) {
      const arm = ARMS[(r + k) % ARMS.length];
      times[arm[0]].push(sample(arm, g.trees, reps));
    }
  }
  const ratio = (name) => median(times[name].map((x, i) => x / times.ireko[i]));
  rows.push({ name: g.name, reps, iMs: median(times.ireko), aaMs: median(times.aa), shapesMs: median(times.shapes), aa: ratio("aa"), shapes: ratio("shapes"), times });
}
for (const r of rows) console.info(`${r.name.padEnd(24)} ireko ${r.iMs.toFixed(3)} ms  entry ${r.shapesMs.toFixed(3)} ms  entry/ireko ${r.shapes.toFixed(3)}  A/A ${r.aa.toFixed(3)}`);
if (values.out) writeFileSync(values.out, JSON.stringify({ node: process.version, rounds: ROUNDS, rows }));
