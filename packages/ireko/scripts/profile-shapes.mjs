#!/usr/bin/env node
// The CPU profile of the shapes pass on the full tree of 1111 nodes (SHAPEWIRE). CI runs it: see shapes-bench.yml.
//
//   node scripts/profile-shapes.mjs --mode vex|module|hand [--seconds 4] [--iterations N] --out file.cpuprofile
//
// The modes:
//   vex     vexLinkedShape: the wrapper shape-vex.ts and the module shape.generated.js
//   module  nodeShape of the module alone, with the records that the wrapper makes (plain arrays), made before the run
//   hand    handLinkedShape: the code of ireko, as the reference
// One pass is each call of the linked shape of one layout of the tree (110 calls), with the inputs of that layout.
// The script warms up the pass, then profiles it for --seconds (or for --iterations passes) with a sampling interval of
// 100 µs. It starts the profiler of V8 through node:inspector after the warm-up, not with `node --cpu-prof`: thus the
// profile holds only the warm passes, not the import, the type stripping of the TypeScript source and the warm-up.
// It writes the profile in the format of `--cpu-prof` (a .cpuprofile file). scripts/profile-summary.mjs reads it.

import { writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { parseArgs } from "node:util";
import { layout } from "../src/core/engine.ts";
import { handLinkedShape, MAX_BANDS, setLinkedShape } from "../src/core/engine/shape.ts";
import { vexLinkedShape } from "../src/core/engine/shape-vex.ts";
import { nodeShape } from "../src/core/engine/shape.generated.js";
import { fullTree } from "../src/test/shape-trees.ts";

const { values } = parseArgs({
  options: { mode: { type: "string", default: "vex" }, seconds: { type: "string", default: "4" }, iterations: { type: "string" }, out: { type: "string" } },
});
if (values.out === undefined) throw new Error("profile-shapes: give --out file.cpuprofile");
const SECONDS = Number(values.seconds);
const ITERATIONS = values.iterations === undefined ? undefined : Number(values.iterations);

// The inputs of each linked shape of one layout of the full tree of 1111 nodes (depth 3, 10 children).
const calls = [];
setLinkedShape((own, parts) => {
  calls.push([own, parts]);
  return handLinkedShape(own, parts);
});
layout({ root: fullTree(3, 10, "tree", "linked") });
setLinkedShape(handLinkedShape);

const prepared = calls.map(([own, parts]) => [parts.map((p) => ({ ox: p.x, oy: p.y, rows: p.shape.rows, cols: p.shape.columns })), { w: own.width, h: own.height, limit: MAX_BANDS }]);

// Each pass adds to a sink, so the JIT cannot drop the calls.
let sink = 0;
const passes = {
  vex() {
    for (const [own, parts] of calls) sink += vexLinkedShape(own, parts).rows.length;
  },
  module() {
    for (const [records, vars] of prepared) sink += nodeShape(records, vars).length;
  },
  hand() {
    for (const [own, parts] of calls) sink += handLinkedShape(own, parts).rows.length;
  },
};
const pass = passes[values.mode];
if (pass === undefined) throw new Error(`profile-shapes: the mode "${values.mode}" is not vex, module or hand`);

// The warm-up: 1 s, or a fifth of the passes with --iterations (at least 5).
const warmUntil = performance.now() + 1000;
if (ITERATIONS === undefined) while (performance.now() < warmUntil) pass();
else for (let i = 0; i < Math.max(5, Math.ceil(ITERATIONS / 5)); i++) pass();

const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 100 });
await session.post("Profiler.start");
const t0 = performance.now();
let count = 0;
if (ITERATIONS === undefined) {
  const until = t0 + SECONDS * 1000;
  while (performance.now() < until) {
    pass();
    count++;
  }
} else {
  for (; count < ITERATIONS; count++) pass();
}
const ms = performance.now() - t0;
const { profile } = await session.post("Profiler.stop");
session.disconnect();
writeFileSync(values.out, JSON.stringify(profile));
process.stderr.write(
  `profile-shapes: ${values.mode}, ${String(calls.length)} linked shapes, ${String(count)} passes in ${ms.toFixed(0)} ms (${(ms / count).toFixed(3)} ms a pass, sink ${String(sink)}) -> ${values.out}\n`,
);
