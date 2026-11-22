// This script splits the mutation tests of the core into shards, and merges the JSON reports of the shards.
// One runner cannot test all the mutants of the core in the time of one job (4,071 mutants on 11-22: about 7 h).
// So the nightly workflow runs one job for each shard, and a last job merges the reports and writes the score.
//
// Usage, in packages/ireko:
//   node scripts/mutation-shards.mjs list <index> <count>             the files of shard <index>, separated by commas
//   node scripts/mutation-shards.mjs merge <count> <out> <report>...  one report from the report of each shard
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The files that Stryker mutates: the TypeScript files of src/core, without the tests and the benchmarks. */
export const coreFiles = (root) =>
  readdirSync(join(root, "src/core"), { recursive: true })
    .map((name) => `src/core/${String(name).replaceAll("\\", "/")}`)
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.endsWith(".bench.ts"))
    .toSorted();

/**
 * This function puts each file in one of `count` shards, so that the shards have near the same weight. The
 * weight of a file is its size, which follows its count of mutants. The heaviest file goes first, to the
 * lightest shard (the rule of the longest job first: each shard is at most 4/3 of the best split). The order
 * is fixed: the same files give the same shards on each runner.
 */
export const shardsOf = (files, count) => {
  if (!Number.isInteger(count) || count < 1) throw new Error(`the count of shards must be a whole number of 1 or more, not ${count}`);
  const shards = Array.from({ length: count }, () => ({ weight: 0, files: [] }));
  const heaviest = files.toSorted((a, b) => b.weight - a.weight || (a.path < b.path ? -1 : 1));
  for (const file of heaviest) {
    const lightest = shards.reduce((best, shard) => (shard.weight < best.weight ? shard : best));
    lightest.files.push(file.path);
    lightest.weight += file.weight;
  }
  return shards.map((shard) => ({ weight: shard.weight, files: shard.files.toSorted() }));
};

/**
 * This function merges the reports of the shards into one report. Each file must be in one report only. It
 * throws when a report is missing, because a score without a shard is no read of the core.
 */
export const mergeReports = (reports, count) => {
  if (reports.length !== count) throw new Error(`${count} shards, but ${reports.length} reports: a shard gave no report`);
  const files = {};
  for (const report of reports)
    for (const [path, data] of Object.entries(report.files)) {
      if (files[path] !== undefined) throw new Error(`the file ${path} is in two reports`);
      files[path] = data;
    }
  return { ...reports[0], files };
};

const main = (args) => {
  const [command, ...rest] = args;
  if (command === "list") {
    const [index, count] = rest.map(Number);
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const files = coreFiles(root).map((path) => ({ path, weight: statSync(join(root, path)).size }));
    const shards = shardsOf(files, count);
    if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error(`the index must be 0 to ${count - 1}, not ${rest[0]}`);
    console.log(shards[index].files.join(","));
    return;
  }
  if (command === "merge") {
    const [count, out, ...inputs] = rest;
    const merged = mergeReports(inputs.map((path) => JSON.parse(readFileSync(path, "utf8"))), Number(count));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(merged)}\n`);
    console.log(`${inputs.length} reports, ${Object.keys(merged.files).length} files: ${out}`);
    return;
  }
  throw new Error(`the command must be list or merge, not ${command}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
