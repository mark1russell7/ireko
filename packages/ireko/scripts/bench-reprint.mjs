#!/usr/bin/env node
// The time of a new print of each module against the file of main, in one process, with an A/A arm. A throwaway branch:
// this script does not go to main.
//
//   node scripts/bench-reprint.mjs [--rounds 31] [--out file.json]
//
// Each generated file of this branch is a switch. It calls the arm that `globalThis.__reprint` names. One module changes
// arm at a time, and the other four stay on the file of main. The rows are whole layouts and replays of recorded calls.
// A round runs three arms in a turned order and gives one ratio for each arm over the first.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { rounds: { type: "string", default: "31" }, out: { type: "string" } } });
const ROUNDS = Number(values.rounds);
const MIN_SAMPLE_MS = 5;
const WARM_ROUNDS = 5;

const FILES = {
  measure: ["measureOf"],
  place: ["placeOf"],
  shape: ["nodeShape"],
  grid: ["gridOf"],
  radial: ["radialOf"],
};
const NAMES = Object.keys(FILES);
const ARMS = ["old", "aa", "new"];

const arms = {};
for (const name of NAMES) {
  arms[name] = {};
  for (const arm of ARMS) {
    const module = await import(`./reprint-arms/${name}-${arm}.generated.js`);
    arms[name][arm] = module[FILES[name][0]];
  }
}
const state = { fn: Object.fromEntries(NAMES.map((n) => [n, arms[n].old])), log: undefined };
globalThis.__reprint = state;

const { layout } = await import("../src/index.ts");
const shapes = await import("../src/shapes/index.ts");

const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** A full tree with 10 children at each node. */
function full(depth, form, mode) {
  let next = 0;
  const make = (d) => {
    const id = `n${String(next++)}`;
    return d === 0 ? { id, size: { width: 60 + (next % 40), height: 30 + (next % 20) } } : { id, layout: form, mode, children: Array.from({ length: 10 }, () => make(d - 1)) };
  };
  return { root: make(depth) };
}

/** One container with n children of mixed sizes. */
function flat(n, form, mode) {
  const children = Array.from({ length: n }, (_, i) => ({ id: `c${String(i)}`, size: { width: 40 + ((i * 37) % 120), height: 24 + ((i * 53) % 90) } }));
  return { root: { id: "p", layout: form, mode, children } };
}

/** This function makes a function of a row that first sets the arm of one module. */
function armed(name, arm, run) {
  const fn = arms[name][arm];
  return () => {
    state.fn[name] = fn;
    const value = run();
    state.fn[name] = arms[name].old;
    return value;
  };
}

const groups = [];
const layoutRow = (name, label, entry, input) => groups.push({ module: name, kind: "layout", name: `${name}: ${label}`, run: Object.fromEntries(ARMS.map((arm) => [arm, armed(name, arm, () => entry(input).nodes)])) });

for (const [size, depth] of [["1111", 3], ["11111", 4]]) {
  for (const mode of ["linked", "nested"]) {
    for (const form of ["grid", "radial"]) {
      const input = full(depth, form, mode);
      layoutRow("measure", `layout ${size} ${form} ${mode}`, layout, input);
      layoutRow("place", `layout ${size} ${form} ${mode}`, layout, input);
      layoutRow(form, `layout ${size} ${mode}`, layout, input);
    }
  }
  layoutRow("shape", `layout ${size} radial linked`, shapes.layout, full(depth, "radial", "linked"));
}

/** This function records each call of the five modules in one layout. */
function recorded(entry, input) {
  const log = Object.fromEntries(NAMES.map((n) => [n, []]));
  state.log = log;
  entry(input);
  state.log = undefined;
  return log;
}

for (const n of [12, 200, 1000]) {
  for (const form of ["grid", "radial"]) {
    for (const mode of ["linked", "nested"]) {
      const log = recorded(mode === "linked" ? shapes.layout : layout, flat(n, form, mode));
      for (const name of NAMES) {
        const calls = log[name];
        if (calls.length === 0) continue;
        const row = Object.fromEntries(
          ARMS.map((arm) => {
            const fn = arms[name][arm];
            return [
              arm,
              () => {
                let last;
                for (const args of calls) last = fn(...args);
                return last;
              },
            ];
          }),
        );
        groups.push({ module: name, kind: "replay", name: `${name}: replay ${String(n)} ${form} ${mode}`, run: row });
      }
    }
  }
}

function sample(run, reps) {
  const t0 = performance.now();
  let sink = 0;
  for (let i = 0; i < reps; i++) sink += run() === undefined ? 1 : 0;
  const ms = (performance.now() - t0) / reps;
  if (sink < 0) throw new Error("no");
  return ms;
}

const rows = [];
for (const g of groups) {
  let reps = 1;
  while (sample(g.run.old, reps) * reps < MIN_SAMPLE_MS) reps *= 2;
  for (let r = 0; r < WARM_ROUNDS; r++) for (const arm of ARMS) sample(g.run[arm], reps);
  const times = Object.fromEntries(ARMS.map((arm) => [arm, []]));
  for (let r = 0; r < ROUNDS; r++) {
    for (let k = 0; k < ARMS.length; k++) {
      const arm = ARMS[(r + k) % ARMS.length];
      times[arm].push(sample(g.run[arm], reps));
    }
  }
  const ratio = (arm) => median(times[arm].map((x, i) => x / times.old[i]));
  rows.push({ name: g.name, module: g.module, kind: g.kind, reps, oldUs: median(times.old) * 1000, newUs: median(times.new) * 1000, aa: ratio("aa"), ratio: ratio("new") });
}
for (const r of rows) console.info(`${r.name.padEnd(40)} old ${r.oldUs.toFixed(2)} us  new ${r.newUs.toFixed(2)} us  new/old ${r.ratio.toFixed(3)}  aa ${r.aa.toFixed(3)}`);
if (values.out) writeFileSync(values.out, JSON.stringify({ node: process.version, rounds: ROUNDS, rows }));
