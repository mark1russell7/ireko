#!/usr/bin/env node
// The summary of the runs of bench-radial.mjs: for each row, the median and the range of the process medians.
import { readFileSync, appendFileSync } from "node:fs";

const files = process.argv.slice(2);
const runs = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const lines = [`${String(runs.length)} processes`, "", "| Row | old us | new us | new / old | range | A/A | range |", "| --- | --- | --- | --- | --- | --- | --- |"];
for (const name of runs[0].rows.map((r) => r.name)) {
  const rows = runs.map((run) => run.rows.find((r) => r.name === name));
  const of = (k) => rows.map((r) => r[k]);
  const span = (k) => `${Math.min(...of(k)).toFixed(3)}-${Math.max(...of(k)).toFixed(3)}`;
  lines.push(`| ${name} | ${median(of("oldUs")).toFixed(2)} | ${median(of("newUs")).toFixed(2)} | ${median(of("ratio")).toFixed(3)} | ${span("ratio")} | ${median(of("aa")).toFixed(3)} | ${span("aa")} |`);
}
console.info(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
