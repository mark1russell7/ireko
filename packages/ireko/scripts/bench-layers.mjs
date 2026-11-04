#!/usr/bin/env node
// The time of the module of the strategy layers on setNth against the module of main, in one process. A throwaway branch:
// this script does not go to main.
//
//   node scripts/bench-layers.mjs [--k 1000] [--rounds 7] [--out file.json]
//
// A round runs each arm on the same seeded graph, in a turned order. The arm `aa` is a copy of the file of the arm `new`.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { k: { type: "string", default: "1000" }, rounds: { type: "string", default: "7" }, seed: { type: "string", default: "20261104" }, out: { type: "string" } } });
const K = Number(values.k);
const ROUNDS = Number(values.rounds);

const { layers } = await import("../src/core/strategies/layers.ts");
const oldModule = await import("./layers-arms/layers-old.generated.js");
const newModule = await import("./layers-arms/layers-new.generated.js");
const aaModule = await import("./layers-arms/layers-aa.generated.js");

let seed = Number(values.seed);
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// A graph with 1.5 edges for each child: most go forward to a near child, and one in ten goes back, so the search turns cycles around.
const edges = Array.from({ length: Math.floor(1.5 * K) }, () => {
  const from = int(0, K - 1);
  const to = rnd() < 0.1 ? int(0, K - 1) : Math.min(K - 1, from + int(1, 20));
  return { from, to };
});
const extents = Array.from({ length: K }, (_, i) => ({ x: 0, y: 0, width: 40 + ((i * 37) % 120), height: 24 + ((i * 53) % 90) }));
const froms = edges.map((e) => e.from);
const tos = edges.map((e) => e.to);
const records = extents.map((e, i) => ({ i, ex: e.x, ey: e.y, ew: e.width, eh: e.height, froms: i === 0 ? froms : [], tos: i === 0 ? tos : [] }));
const self = { width: 0, height: 0 };
const options = { side: "bottom", distance: 0, align: "center" };
const vars = { ...options, mode: "nested", gap: 10, selfW: self.width, selfH: self.height };
const children = extents.map((extent, i) => ({ id: `c${String(i)}`, extent }));

const moduleArm = (fn) => () => fn(records, vars).length;
const ARMS = {
  real: () => layers.arrange({ mode: "nested", self, children, options, gap: 10, edges }).offsets.length,
  new: moduleArm(newModule.layersOf),
  aa: moduleArm(aaModule.layersOf),
  old: moduleArm(oldModule.layersOf),
};
const NAMES = Object.keys(ARMS);

const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

for (const name of NAMES) ARMS[name]();
const times = Object.fromEntries(NAMES.map((n) => [n, []]));
for (let r = 0; r < ROUNDS; r++) {
  for (let k = 0; k < NAMES.length; k++) {
    const name = NAMES[(r + k) % NAMES.length];
    const t0 = performance.now();
    const sink = ARMS[name]();
    times[name].push(performance.now() - t0);
    if (sink !== K) throw new Error(`${name} gave ${String(sink)}`);
  }
}
const row = { node: process.version, k: K, edges: edges.length, rounds: ROUNDS };
for (const name of NAMES) row[`${name}Ms`] = median(times[name]);
const ratio = (a, b) => median(times[a].map((x, i) => x / times[b][i]));
row.newOverOld = ratio("new", "old");
row.aaOverNew = ratio("aa", "new");
row.newOverReal = ratio("new", "real");
console.info(JSON.stringify(row));
if (values.out) writeFileSync(values.out, JSON.stringify(row));
