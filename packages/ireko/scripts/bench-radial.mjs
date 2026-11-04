#!/usr/bin/env node
// The time of a new print of the radial module against the committed file, in one process, with an A/A arm. A throwaway
// branch: this script does not go to main.
//
//   node scripts/bench-radial.mjs [--rounds 31] [--out file.json]
//
// Three arms run in each round, in a turned order: the committed module, a copy of it (the A/A arm) and the new print.
// Each sample repeats a pass until it lasts at least MIN_SAMPLE_MS. A round gives one ratio for each arm over the first.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createEngine } from "../src/core/engine.ts";
import { radial } from "../src/core/strategies/radial.ts";
import { radialOf as oldOf } from "../src/core/strategies/radial.generated.js";
import { radialOf as aaOf } from "./radial-arms/radial-aa.generated.js";
import { radialOf as newOf } from "./radial-arms/radial-new.generated.js";

const { values } = parseArgs({ options: { rounds: { type: "string", default: "31" }, out: { type: "string" } } });
const ROUNDS = Number(values.rounds);
const MIN_SAMPLE_MS = 5;
const WARM_ROUNDS = 5;

const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The strategy `radial` with one module. */
function armed(radialOf) {
  return {
    ...radial,
    arrange({ mode, self, children, options, gap }) {
      const records = children.map((child, i) => ({ i, bw: child.box.width, bh: child.box.height, ex: child.extent.x, ey: child.extent.y, ew: child.extent.width, eh: child.extent.height }));
      return { offsets: radialOf(records, { ...options, mode, gap, selfW: self.width, selfH: self.height }) };
    },
  };
}

const MODULES = [["old", oldOf], ["aa", aaOf], ["new", newOf]];

/** The groups of whole layouts: full trees with 10 children at each node, as in the benchmarks of the engine. */
function full(depth, mode) {
  let next = 0;
  const make = (d) => {
    const id = `n${String(next++)}`;
    return d === 0 ? { id } : { id, layout: "radial", mode, children: Array.from({ length: 10 }, () => make(d - 1)) };
  };
  return make(depth);
}

const engines = Object.fromEntries(MODULES.map(([name, f]) => [name, createEngine({ strategies: [armed(f)] })]));
const layoutGroups = [["111", 2], ["1111", 3], ["11111", 4]].flatMap(([size, depth]) =>
  ["linked", "nested"].map((mode) => {
    const input = { root: full(depth, mode) };
    return { name: `layout ${size} nodes, ${mode}`, run: Object.fromEntries(MODULES.map(([name]) => [name, () => engines[name].layout(input).nodes])) };
  }),
);

/** The records of a ring. The mixed form has boxes of different sizes, with a fixed pattern. */
function ring(n, mixed) {
  return Array.from({ length: n }, (_, i) => {
    const w = mixed ? 40 + ((i * 37) % 120) : 80;
    const h = mixed ? 24 + ((i * 53) % 90) : 40;
    return { i, bw: w, bh: h, ex: 0, ey: 0, ew: w, eh: h };
  });
}

const OPTIONS = { startAngle: -90, clockwise: true, distance: 0, gap: 16, selfW: 120, selfH: 60 };
const SIZES = [3, 5, 8, 12, 20, 50, 100, 200, 500, 1000, 2000];
const ringGroups = SIZES.flatMap((n) =>
  ["linked", "nested"].flatMap((mode) =>
    [true, false].flatMap((mixed) => {
      const records = ring(n, mixed);
      const options = { ...OPTIONS, mode, sweep: 360 };
      return [{ name: `ring ${String(n)}, ${mode}, ${mixed ? "mixed" : "equal"}`, run: Object.fromEntries(MODULES.map(([name, f]) => [name, () => f(records, options)])) }];
    }),
  ),
);
const arcGroups = [12, 100].map((n) => {
  const records = ring(n, true);
  const options = { ...OPTIONS, mode: "linked", sweep: 180 };
  return { name: `arc ${String(n)}, linked, mixed`, run: Object.fromEntries(MODULES.map(([name, f]) => [name, () => f(records, options)])) };
});

function sample(run, reps) {
  const t0 = performance.now();
  let sink = 0;
  for (let i = 0; i < reps; i++) sink += run() === undefined ? 1 : 0;
  const ms = (performance.now() - t0) / reps;
  if (sink < 0) throw new Error("no");
  return ms;
}

const rows = [];
for (const g of [...layoutGroups, ...ringGroups, ...arcGroups]) {
  let reps = 1;
  while (sample(g.run.old, reps) * reps < MIN_SAMPLE_MS) reps *= 2;
  for (let r = 0; r < WARM_ROUNDS; r++) for (const [name] of MODULES) sample(g.run[name], reps);
  const times = Object.fromEntries(MODULES.map(([name]) => [name, []]));
  for (let r = 0; r < ROUNDS; r++) {
    for (let k = 0; k < MODULES.length; k++) {
      const [name] = MODULES[(r + k) % MODULES.length];
      times[name].push(sample(g.run[name], reps));
    }
  }
  const ratio = (name) => median(times[name].map((x, i) => x / times.old[i]));
  rows.push({ name: g.name, reps, oldUs: median(times.old) * 1000, newUs: median(times.new) * 1000, aa: ratio("aa"), ratio: ratio("new") });
}
for (const r of rows) console.info(`${r.name.padEnd(32)} old ${r.oldUs.toFixed(2)} us  new ${r.newUs.toFixed(2)} us  new/old ${r.ratio.toFixed(3)}  aa ${r.aa.toFixed(3)}`);
if (values.out) writeFileSync(values.out, JSON.stringify({ node: process.version, rounds: ROUNDS, rows }));
