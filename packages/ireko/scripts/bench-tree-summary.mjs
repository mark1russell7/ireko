#!/usr/bin/env node
// The summary of the runs of bench-tree.mjs: for each group, the median and the range of the process medians.
// A ratio is branch / base, so a ratio above 1 is slower.
import { appendFileSync, readFileSync } from "node:fs";

const files = process.argv.slice(2);
const runs = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const lines = [
  `${String(runs.length)} processes, ${runs[0].node}. A ratio is branch / base: above 1 is slower.`,
  "",
  "| Group | base ms | branch ms | branch / base | range | A/A | range |",
  "|---|---:|---:|---:|---|---:|---|",
];
for (const name of runs[0].rows.map((r) => r.name)) {
  const rows = runs.map((run) => run.rows.find((r) => r.name === name));
  const of = (k) => rows.map((r) => r[k]);
  const span = (k) => `${Math.min(...of(k)).toFixed(3)}-${Math.max(...of(k)).toFixed(3)}`;
  lines.push(`| ${name} | ${median(of("baseMs")).toFixed(3)} | ${median(of("branchMs")).toFixed(3)} | ${median(of("branch")).toFixed(3)} | ${span("branch")} | ${median(of("aa")).toFixed(3)} | ${span("aa")} |`);
}
console.info(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
