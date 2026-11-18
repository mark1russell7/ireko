/**
 * One arm of the bench in its own process: `node src/arm.ts --arm <base | head | theta> --case <id>`. It makes the
 * scene of the case and times one use of `relaxForces`. Then it prints one JSON line with the time `ms`, the hash of
 * the result and the memory peak. The time does not include the scene or the hash.
 *
 * - The arm `base` is `ireko` 0.2.4 from npm (the package `ireko-base`).
 * - The arm `head` is the source of `packages/ireko` in this commit, with the default options.
 * - The arm `theta` is the same source with the option `theta` of `THETA`.
 *
 * With the variable `BENCH_HASHES`, the arm also adds a line `{ arm, case, hash }` to that file. The bench compares the
 * hashes of the arms `base` and `head`. The same command with `node --cpu-prof` gives the CPU profile of one arm.
 *
 * @packageDocumentation
 */

import fs from "node:fs";
import { peakRss } from "@mark1russell7/rigor-bench/fresh";
import { canonicalHash } from "@mark1russell7/rigor-generators";
import { ARMS, type ArmId, caseOf, type Scene, sceneOf, type SceneOptions, THETA } from "./scene.ts";

interface Place {
  readonly x: number;
  readonly y: number;
}
type Relax = (nodes: Scene["nodes"], edges: Scene["edges"], options: SceneOptions & { readonly theta?: number }) => ReadonlyMap<string, Place>;

const args = process.argv.slice(2);
const option = (key: string): string | undefined => {
  const index = args.indexOf(key);
  return index === -1 ? undefined : args[index + 1];
};
const isArm = (value: string | undefined): value is ArmId => ARMS.some((arm) => arm === value);
const which = option("--arm");
const id = option("--case");
if (!isArm(which) || id === undefined) {
  console.error("Usage: node src/arm.ts --arm <base | head | theta> --case <id>");
  process.exit(2);
}
const relax: Relax = which === "base" ? (await import("ireko-base/strategies/force")).relaxForces : (await import("ireko/strategies/force")).relaxForces;
const scene = sceneOf(caseOf(id));
const options = which === "theta" ? { ...scene.options, theta: THETA } : scene.options;
const start = performance.now();
const result = relax(scene.nodes, scene.edges, options);
const ms = performance.now() - start;
// The corner of each box, in the order of the boxes of the scene.
const hash = canonicalHash(scene.nodes.map((node) => [node.id, result.get(node.id)?.x ?? null, result.get(node.id)?.y ?? null]));
const file = process.env["BENCH_HASHES"];
if (file !== undefined && file !== "") fs.appendFileSync(file, `${JSON.stringify({ arm: which, case: id, hash })}\n`);
console.log(JSON.stringify({ ms, hash, peakRss: peakRss() }));
