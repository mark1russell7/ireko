#!/usr/bin/env node
// The time of the module of the router avoid against the router, in one process. A throwaway branch: this script does
// not go to main.
//
//   node scripts/bench-avoid.mjs [--edges 4000] [--rounds 5] [--out file.json]
//
// A round runs each arm over the same seeded edges, in a turned order. The arm `aa` is a copy of the file of the arm
// `new`, so that the ratio aa/new shows the noise of a run.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { edges: { type: "string", default: "4000" }, rounds: { type: "string", default: "5" }, seed: { type: "string", default: "1" }, out: { type: "string" } } });
const N = Number(values.edges);
const ROUNDS = Number(values.rounds);

const { avoid } = await import("../src/core/avoid.ts");
const oldModule = await import("./avoid-arms/avoid-old.generated.js");
const newModule = await import("./avoid-arms/avoid-new.generated.js");
const aaModule = await import("./avoid-arms/avoid-aa.generated.js");

let seed = Number(values.seed);
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (l) => l[int(0, l.length - 1)];
const coord = (s) => (s === 0 ? int(-30, 30) * 10 : s === 1 ? int(-300, 300) : s === 2 ? (rnd() - 0.5) * 600 : int(-12, 12) * 20);
const size = (s) => (s === 0 ? int(0, 10) * 10 : s === 1 ? int(0, 120) : s === 2 ? rnd() * 120 : int(1, 6) * 20);
const box = (s) => ({ x: coord(s), y: coord(s), width: size(s), height: size(s) });
const DIRS = [undefined, undefined, "down", "up", "left", "right"];

function edge(most) {
  const s = int(0, 3);
  const source = box(s);
  let target = box(s);
  if (rnd() < 0.1) target = { x: source.x + 5, y: source.y + 5, width: Math.max(0, source.width - 10), height: Math.max(0, source.height - 10) };
  if (rnd() < 0.05) target = { ...source };
  const direction = pick(DIRS);
  const obstacles = Array.from({ length: int(0, most) }, () => box(s));
  if (rnd() < 0.1) {
    const m = 30;
    const b = target;
    obstacles.push(
      { x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: m / 2 },
      { x: b.x - m, y: b.y + b.height + m / 2, width: b.width + 2 * m, height: m / 2 },
      { x: b.x - m, y: b.y - m, width: m / 2, height: b.height + 2 * m },
      { x: b.x + b.width + m / 2, y: b.y - m, width: m / 2, height: b.height + 2 * m },
    );
  }
  return { source, target, obstacles, ...(direction === undefined ? {} : { direction }) };
}

const edges = Array.from({ length: N }, (_, k) => edge(k % 20 === 0 ? 34 : 8));
const input = edges.map((e) => ({ id: "", kind: "tree", ...e }));
const records = edges.map((e) => [...e.obstacles, e.source, e.target]);
const vars = edges.map((e) => ({ dir: e.direction ?? "" }));

const moduleArm = (fn) => () => {
  let sink = 0;
  for (let i = 0; i < N; i++) sink += fn(records[i], vars[i]).length;
  return sink;
};
const ARMS = {
  real: () => {
    let sink = 0;
    for (const e of input) sink += avoid.route(e).length;
    return sink;
  },
  new: moduleArm(newModule.avoidOf),
  aa: moduleArm(aaModule.avoidOf),
  old: moduleArm(oldModule.avoidOf),
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
    if (sink < 0) throw new Error("no");
  }
}
const row = { node: process.version, edges: N, rounds: ROUNDS };
for (const name of NAMES) row[`${name}Ms`] = median(times[name]);
const ratio = (a, b) => median(times[a].map((x, i) => x / times[b][i]));
row.newOverReal = ratio("new", "real");
row.aaOverNew = ratio("aa", "new");
row.oldOverReal = ratio("old", "real");
console.info(JSON.stringify(row));
if (values.out) writeFileSync(values.out, JSON.stringify(row));
