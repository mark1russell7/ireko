#!/usr/bin/env node
// The summary of several runs of bench-shapes.mjs (SHAPEWIRE).
//
//   node scripts/bench-summary.mjs [--out summary.json] run1.json run2.json ...
//
// Each file is the --out file of one run. For each group of trees and each measure, it gives the median of the run
// medians and a bootstrap 90 % interval of that median (2000 resamples, fixed seed). A gate is judged on this
// interval, not on one run.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({ options: { out: { type: "string" } }, allowPositionals: true });
const runs = positionals.map((p) => JSON.parse(readFileSync(p, "utf8")));
if (runs.length === 0) throw new Error("bench-summary: give one or more JSON files of bench-shapes.mjs.");

const MEASURES = [
  ["moduleCallRatio", "Module call"],
  ["passRatio", "Shapes pass"],
  ["layoutRatio", "Full layout"],
  ["nullRatio", "Null arm"],
  ["fixedShare", "Fixed share"],
  ["moduleShare", "Module share"],
  ["gcOffMs", "GC off, ms"],
  ["gcOnMs", "GC on, ms"],
  ["gcNullMs", "GC null, ms"],
];

const median = (xs) => {
  const s = [...xs].toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// A small fixed-seed generator (mulberry32), so the interval is the same for the same runs.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function interval(xs) {
  const next = random(17);
  const meds = [];
  for (let i = 0; i < 2000; i++) meds.push(median(xs.map(() => xs[Math.floor(next() * xs.length)])));
  meds.sort((a, b) => a - b);
  return [meds[Math.floor(0.05 * meds.length)], meds[Math.ceil(0.95 * meds.length) - 1]];
}

const groups = runs[0].rows.map((r) => r.group);
const out = [];
for (const g of groups) {
  const row = { group: g };
  for (const [key] of MEASURES) {
    const xs = runs.map((run) => run.rows.find((r) => r.group === g)?.[key]).filter((x) => typeof x === "number");
    if (xs.length > 0) row[key] = { median: median(xs), interval: interval(xs), runs: xs };
  }
  out.push(row);
}

const f = (x, d) => (x === undefined ? "" : x.toFixed(d));
const cell = (m, d) => (m === undefined ? "" : `${f(m.median, d)} (${f(m.interval[0], d)}–${f(m.interval[1], d)})`);
const lines = [
  `## SHAPEWIRE over ${String(runs.length)} runs: the median of the run medians (bootstrap 90 % interval)`,
  "",
  `| Trees | ${MEASURES.map(([, name]) => name).join(" | ")} |`,
  `|---|${MEASURES.map(() => "---:").join("|")}|`,
  ...out.map((r) => `| ${r.group} | ${MEASURES.map(([key]) => cell(r[key], key.startsWith("gc") ? 3 : 2)).join(" | ")} |`),
  "",
];
const text = lines.join("\n");
process.stdout.write(`${text}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
if (values.out !== undefined) writeFileSync(values.out, `${JSON.stringify({ runs: runs.length, node: runs[0].node, rows: out }, null, 2)}\n`);
