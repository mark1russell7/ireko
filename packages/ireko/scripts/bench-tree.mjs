#!/usr/bin/env node
// The time of the strategy `tree` from the module of Vex against the code of ireko, in one process, with an A/A arm.
//
//   node scripts/bench-tree.mjs [--rounds 31] [--out file.json] [--check]
//   node --cpu-prof scripts/bench-tree.mjs --group "arrange, 12 children" --arm branch --passes 200000
//
// Two parts. Each part has three arms, and each round runs them in a turned order. Each sample repeats a pass until it
// lasts at least MIN_SAMPLE_MS. A round gives one ratio for each arm over the first arm (arm / base: more than 1 is slower).
//
//   layout  a full layout. base: the engine of `ireko/shapes` with the code of ireko for `tree`. aa: a second such
//           engine. branch: the entry `ireko/shapes`, with the module of Vex for `tree`.
//   arrange one call of the strategy on a row of children. base: `tree.arrange`. aa: the same function. branch:
//           `vexTree.arrange`.
//
// With --check, each arm runs one pass of each group, and the script prints no time.
// With --group, one arm (--arm, base by default) runs --passes passes of one group, for a CPU profile. It prints no time.

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createEngine } from "../src/core/engine.ts";
import { vexLinkedShape } from "../src/core/engine/shape-vex.ts";
import { defaultsOf } from "../src/core/options.ts";
import { tree } from "../src/core/strategies/tree.ts";
import { vexTree } from "../src/core/strategies/tree-vex.ts";
import { layout as shapesLayout } from "../src/shapes/index.ts";
import { exampleTrees, fullTree, randomTrees } from "../src/test/shape-trees.ts";

const { values } = parseArgs({
  options: {
    rounds: { type: "string", default: "31" },
    out: { type: "string" },
    check: { type: "boolean", default: false },
    group: { type: "string" },
    arm: { type: "string", default: "base" },
    passes: { type: "string", default: "1000" },
  },
});
const ROUNDS = Number(values.rounds);
const MIN_SAMPLE_MS = 5;
const WARM_ROUNDS = 5;

const median = (xs) => {
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const base = createEngine({ linkedShape: vexLinkedShape });
const second = createEngine({ linkedShape: vexLinkedShape });
const LAYOUT_ARMS = [
  ["base", (t) => base.layout(t.input, t.options).nodes.length],
  ["aa", (t) => second.layout(t.input, t.options).nodes.length],
  ["branch", (t) => shapesLayout(t.input, t.options).nodes.length],
];
const ARRANGE_ARMS = [
  ["base", (a) => tree.arrange(a).offsets.length],
  ["aa", (a) => tree.arrange(a).offsets.length],
  ["branch", (a) => vexTree.arrange(a).offsets.length],
];

const fullGroups = [2, 3, 4].flatMap((depth) =>
  ["linked", "nested"].map((mode) => ({ name: `tree, ${String((10 ** (depth + 1) - 1) / 9)} nodes, ${mode}`, items: [{ input: { root: fullTree(depth, 10, "tree", mode) } }] })),
);
const treeExamples = exampleTrees().filter((t) => JSON.stringify(t.input).includes('"tree"'));
const layoutGroups = [...fullGroups, { name: "examples with tree", items: treeExamples }, { name: "random trees", items: randomTrees(200) }];

const options = defaultsOf(tree.options);
const leaf = (i) => {
  const width = 40 + ((i * 37) % 80);
  const height = 20 + ((i * 17) % 40);
  return { id: `c${String(i)}`, box: { width, height }, extent: { x: 0, y: 0, width, height }, mode: "linked" };
};
const arrangeGroups = [12, 200, 1000].map((n) => ({
  name: `arrange, ${String(n)} children`,
  items: [{ id: "p", mode: "linked", self: { width: 100, height: 40 }, children: Array.from({ length: n }, (_, i) => leaf(i)), options, gap: 10, depth: 0 }],
}));

function pass(arm, items) {
  let n = 0;
  for (const item of items) n += arm[1](item);
  return n;
}

function sample(arm, items, reps) {
  const t0 = performance.now();
  let sink = 0;
  for (let i = 0; i < reps; i++) sink += pass(arm, items);
  const ms = (performance.now() - t0) / reps;
  if (sink < 0) throw new Error("no");
  return ms;
}

function measure(part, arms, groups) {
  const rows = [];
  for (const g of groups) {
    if (values.check) {
      const counts = arms.map((arm) => pass(arm, g.items));
      if (new Set(counts).size !== 1) throw new Error(`${g.name}: the arms give different counts ${counts.join(", ")}`);
      console.info(`${part}: ${g.name}: ${String(g.items.length)} items, count ${String(counts[0])}`);
      continue;
    }
    let reps = 1;
    while (sample(arms[0], g.items, reps) * reps < MIN_SAMPLE_MS) reps *= 2;
    for (let r = 0; r < WARM_ROUNDS; r++) for (const arm of arms) sample(arm, g.items, reps);
    const times = Object.fromEntries(arms.map(([n]) => [n, []]));
    for (let r = 0; r < ROUNDS; r++) {
      for (let k = 0; k < arms.length; k++) {
        const arm = arms[(r + k) % arms.length];
        times[arm[0]].push(sample(arm, g.items, reps));
      }
    }
    const ratio = (name) => median(times[name].map((x, i) => x / times.base[i]));
    rows.push({ part, name: g.name, reps, baseMs: median(times.base), aaMs: median(times.aa), branchMs: median(times.branch), aa: ratio("aa"), branch: ratio("branch"), times });
  }
  return rows;
}

if (values.group !== undefined) {
  const parts = [
    [LAYOUT_ARMS, layoutGroups],
    [ARRANGE_ARMS, arrangeGroups],
  ];
  const found = parts.flatMap(([arms, groups]) => groups.filter((g) => g.name === values.group).map((g) => [arms, g]));
  if (found.length !== 1) throw new Error(`no group "${values.group}"`);
  const [arms, g] = found[0];
  const arm = arms.find(([n]) => n === values.arm);
  if (arm === undefined) throw new Error(`no arm "${values.arm}"`);
  const passes = Number(values.passes);
  let sink = 0;
  for (let i = 0; i < passes; i++) sink += pass(arm, g.items);
  console.info(`${g.name}: arm ${values.arm}, ${String(passes)} passes, count ${String(sink)}`);
} else {
  const rows = [...measure("layout", LAYOUT_ARMS, layoutGroups), ...measure("arrange", ARRANGE_ARMS, arrangeGroups)];
  for (const r of rows) console.info(`${r.name.padEnd(28)} base ${r.baseMs.toFixed(3)} ms  branch ${r.branchMs.toFixed(3)} ms  branch/base ${r.branch.toFixed(3)}  A/A ${r.aa.toFixed(3)}`);
  if (values.out) writeFileSync(values.out, JSON.stringify({ node: process.version, rounds: ROUNDS, rows }));
}
