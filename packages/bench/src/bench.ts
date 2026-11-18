/**
 * The bench of `relaxForces`: `node src/bench.ts --out <folder> [--rounds 7] [--cases <id,id>] [--timeout-ms 180000]`.
 *
 * It starts each arm of each pair, case and round in a fresh process with `freshRun` of `@mark1russell7/rigor-bench`.
 * The pairs are (base, head), (base, theta) and the A/A pair (base, base). The arm `base` is ireko 0.2.4 from npm.
 * The arms `head` and `theta` are the source of this commit: `head` with the default options, and `theta` with the
 * option `theta` of `THETA`.
 *
 * It writes the records of each pair to `records-<pair>.jsonl` and the skips to `skipped.json`. It writes the hashes of
 * the results to `hashes.jsonl` and the facts of the computer to `env.json`. The report goes to `report.json` and
 * `report.md`. The workflow `bench-relax.yml` starts it in CI. Do not start a full bench on a shared computer.
 *
 * The exit code is 1 when a case has no read, or when `head` and `base` give different results on a case.
 *
 * @packageDocumentation
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freshRun } from "@mark1russell7/rigor-bench/fresh";
import { hashLines, markdown, report } from "./report.ts";
import { type ArmId, CASES, THETA } from "./scene.ts";

const USAGE = "Usage: node src/bench.ts --out <folder> [--rounds 7] [--cases <id,id>] [--timeout-ms 180000]";
const args = process.argv.slice(2);
const option = (key: string, fallback?: string): string | undefined => {
  const index = args.indexOf(key);
  return index === -1 ? fallback : args[index + 1];
};
const out = option("--out");
const rounds = Number(option("--rounds", "7"));
const timeoutMs = Number(option("--timeout-ms", "180000"));
const listed = option("--cases", "");
const names = listed === undefined || listed === "" ? CASES.map((spec) => spec.id) : listed.split(",");
if (out === undefined || !Number.isSafeInteger(rounds) || rounds < 1 || !(timeoutMs > 0)) {
  console.error(USAGE);
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
const hashFile = path.resolve(out, "hashes.jsonl");
fs.writeFileSync(hashFile, "");
process.env["BENCH_HASHES"] = hashFile;

const arm = path.join(path.dirname(fileURLToPath(import.meta.url)), "arm.ts");
const command = (id: ArmId): string[] => [process.execPath, arm, "--arm", id];
const run = await freshRun({
  base: { id: "base", command: command("base") },
  candidates: [
    { id: "head", command: command("head") },
    { id: "theta", command: command("theta") },
  ],
  cases: names,
  rounds,
  timeoutMs,
  overLimit: "skip",
});

const jsonl = (rows: readonly unknown[]): string => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
for (const [pair, records] of Object.entries(run.pairs)) fs.writeFileSync(path.join(out, `records-${pair}.jsonl`), jsonl(records));
fs.writeFileSync(path.join(out, "skipped.json"), JSON.stringify(run.skipped, null, 2) + "\n");
fs.writeFileSync(path.join(out, "env.json"), JSON.stringify(run.env, null, 2) + "\n");
const hashes = hashLines(fs.readFileSync(hashFile, "utf8"));
const result = report(run.pairs, hashes);
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ env: run.env, skipped: run.skipped, thetaOption: THETA, ...result }, null, 2) + "\n");
const text = markdown(result, THETA) + (run.skipped.length > 0 ? `\nSkipped: ${run.skipped.map((skip) => `${skip.case} (${skip.arm}: ${skip.reason})`).join(", ")}\n` : "");
fs.writeFileSync(path.join(out, "report.md"), text);
console.log(text);

// The gate of the result: each case of the bench has one hash in each arm, and the hashes are the same.
// A case with no hash (a skip or a fault) is no read, and no read is not a pass.
const unsure = names.filter((id) => result.cases.find((row) => row.case === id)?.sameResult !== true);
if (unsure.length > 0) {
  console.error(`The result of head is not the same as the result of ireko 0.2.4, or has no read, on: ${unsure.join(", ")}`);
  process.exitCode = 1;
}
