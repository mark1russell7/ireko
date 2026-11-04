#!/usr/bin/env node
// The summary of the time run of the strategy layers. It prints the median and the worst sample of each ratio.
import { readFileSync } from "node:fs";

const rows = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")));
const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};
for (const k of [...new Set(rows.map((r) => r.k))]) {
  const of = rows.filter((r) => r.k === k);
  console.info(`k = ${String(k)}, ${String(of.length)} processes`);
  for (const key of ["newOverOld", "aaOverNew", "newOverReal", "realMs", "newMs", "oldMs"]) {
    const xs = of.map((r) => r[key]);
    console.info(`  ${key}: median ${median(xs).toFixed(3)}, least ${Math.min(...xs).toFixed(3)}, most ${Math.max(...xs).toFixed(3)}`);
  }
}
