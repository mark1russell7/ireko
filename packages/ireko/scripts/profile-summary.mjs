#!/usr/bin/env node
// The summary of a CPU profile of Node (a .cpuprofile file): the functions with the most self time, and the files.
//
//   node scripts/profile-summary.mjs <file.cpuprofile> [--top 15] [--title text]
//
// A function is its name, its file and its line. The self time of a sample is the time to the next sample.
import { appendFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { top: { type: "string", default: "15" }, title: { type: "string" } } });
const TOP = Number(values.top);
if (positionals.length !== 1) throw new Error("give one .cpuprofile file");
const profile = JSON.parse(readFileSync(positionals[0], "utf8"));

const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const selfUs = new Map();
const { samples, timeDeltas } = profile;
for (let i = 0; i < samples.length; i++) {
  const dt = i + 1 < timeDeltas.length ? timeDeltas[i + 1] : profile.endTime - profile.startTime - timeDeltas.reduce((a, b) => a + b, 0);
  selfUs.set(samples[i], (selfUs.get(samples[i]) ?? 0) + Math.max(0, dt));
}

const fileOf = (url) => (url === "" ? "" : url.slice(url.lastIndexOf("/") + 1));
const byFunction = new Map();
const byFile = new Map();
let totalUs = 0;
for (const [id, us] of selfUs) {
  const f = nodes.get(id).callFrame;
  const file = fileOf(f.url);
  const key = `${f.functionName === "" ? "(anonymous)" : f.functionName} ${file}${file === "" ? "" : `:${String(f.lineNumber + 1)}`}`;
  byFunction.set(key, (byFunction.get(key) ?? 0) + us);
  const fileKey = file === "" ? f.functionName || "(native)" : file;
  byFile.set(fileKey, (byFile.get(fileKey) ?? 0) + us);
  totalUs += us;
}

const table = (map, label) => {
  const rows = [...map].toSorted((a, b) => b[1] - a[1]).slice(0, TOP);
  return [`| ${label} | self ms | % |`, "|---|---:|---:|", ...rows.map(([k, us]) => `| \`${k}\` | ${(us / 1000).toFixed(1)} | ${((100 * us) / totalUs).toFixed(1)} |`)];
};
const lines = [
  `### ${values.title ?? positionals[0]}`,
  "",
  `${String(samples.length)} samples, ${(totalUs / 1000).toFixed(1)} ms.`,
  "",
  ...table(byFunction, "Function"),
  "",
  ...table(byFile, "File"),
  "",
];
console.info(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
