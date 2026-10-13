// This script reads the JSON report of Stryker and writes the mutation score of each file as a Markdown table.
// The nightly workflow adds the table to the summary of its run. Usage: node scripts/mutation-score.mjs [report]
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(process.argv[2] ?? "reports/mutation/mutation.json", "utf8"));
const rows = [];
const total = { detected: 0, undetected: 0 };
for (const [file, data] of Object.entries(report.files)) {
  let detected = 0;
  let undetected = 0;
  for (const m of data.mutants) {
    if (m.status === "Killed" || m.status === "Timeout") detected++;
    else if (m.status === "Survived" || m.status === "NoCoverage") undetected++;
  }
  total.detected += detected;
  total.undetected += undetected;
  const all = detected + undetected;
  rows.push(`| ${file} | ${all === 0 ? "-" : ((100 * detected) / all).toFixed(1)} % | ${String(detected)} | ${String(undetected)} |`);
}
const all = total.detected + total.undetected;
const score = all === 0 ? 0 : (100 * total.detected) / all;
console.log(`## The mutation score of the core: ${score.toFixed(1)} %\n`);
console.log("| File | Score | Detected | Not detected |");
console.log("| --- | --- | --- | --- |");
for (const row of rows.toSorted()) console.log(row);
