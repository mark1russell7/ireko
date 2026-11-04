#!/usr/bin/env node
// The summary of the time run of the router avoid. It prints the median and the worst sample of each ratio.
import { readFileSync } from "node:fs";

const rows = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")));
const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};
for (const key of ["newOverReal", "aaOverNew", "oldOverReal", "realMs", "newMs", "oldMs"]) {
  const xs = rows.map((r) => r[key]);
  console.info(`${key}: median ${median(xs).toFixed(3)}, least ${Math.min(...xs).toFixed(3)}, most ${Math.max(...xs).toFixed(3)}, ${String(xs.length)} processes`);
}
