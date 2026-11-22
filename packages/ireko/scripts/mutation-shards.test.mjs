import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { byPath, coreFiles, mergeReports, shardsOf } from "./mutation-shards.mjs";

const file = (path, weight) => ({ path, weight });
const report = (files) => ({ schemaVersion: "2", thresholds: { high: 95, low: 90 }, files });

describe("the shards of the mutation tests", () => {
  it("puts each file in one shard, the heaviest first to the lightest shard", () => {
    const shards = shardsOf([file("a.ts", 5), file("b.ts", 4), file("c.ts", 3), file("d.ts", 3), file("e.ts", 1)], 2);
    expect(shards).toEqual([
      { weight: 8, files: ["a.ts", "d.ts"] },
      { weight: 8, files: ["b.ts", "c.ts", "e.ts"] },
    ]);
  });

  it("gives the same shards for the same files in another order", () => {
    const files = [file("a.ts", 2), file("b.ts", 2), file("c.ts", 2)];
    expect(shardsOf(files.toReversed(), 2)).toEqual(shardsOf(files, 2));
  });

  it("gives an empty shard when there are fewer files than shards, and refuses a bad count", () => {
    expect(shardsOf([file("a.ts", 1)], 2)).toEqual([
      { weight: 1, files: ["a.ts"] },
      { weight: 0, files: [] },
    ]);
    expect(() => shardsOf([], 0)).toThrow("the count of shards must be a whole number of 1 or more, not 0");
  });

  it("splits the files of the core, each shard at most an equal share plus its heaviest file", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const paths = coreFiles(root);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((path) => path.endsWith(".test.ts") || path.endsWith(".bench.ts"))).toBe(false);
    const shards = shardsOf(
      paths.map((path, i) => file(path, 100 + (i % 7) * 10)),
      6,
    );
    expect(shards.flatMap((shard) => shard.files).toSorted(byPath)).toEqual(paths);
    const total = shards.reduce((sum, shard) => sum + shard.weight, 0);
    // the bound of each greedy split: the equal share plus the heaviest file (160)
    for (const shard of shards) expect(shard.weight).toBeLessThanOrEqual(total / 6 + 160);
  });
});

describe("the merge of the reports of the shards", () => {
  it("joins the files of each report", () => {
    const merged = mergeReports([report({ "a.ts": { mutants: [1] } }), report({ "b.ts": { mutants: [2] } })], 2);
    expect(merged).toEqual(report({ "a.ts": { mutants: [1] }, "b.ts": { mutants: [2] } }));
  });

  it("refuses a missing report and a file in two reports", () => {
    expect(() => mergeReports([report({})], 2)).toThrow("2 shards, but 1 reports: a shard gave no report");
    expect(() => mergeReports([report({ "a.ts": {} }), report({ "a.ts": {} })], 2)).toThrow("the file a.ts is in two reports");
  });
});
