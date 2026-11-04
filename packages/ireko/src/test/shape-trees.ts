/**
 * The trees of the comparison of the shapes code of ireko with the shapes module of Vex. The test of the bits and the
 * benchmark of the shapes (`scripts/bench-shapes.mjs`) use them. They are the trees of ireko. These are the examples of
 * the golden files, the full trees of `engine.bench.ts` and random trees of `arbitrary.ts` with a fixed seed.
 */
import * as fc from "fast-check";
import type { LayoutInput, LayoutOptions, NodeSpec } from "../core/model.ts";
import { examples } from "../examples/index.ts";
import { treeArbitrary } from "./arbitrary.ts";

/** One tree of the comparison: its name, its input and its options. */
export interface ShapeTree {
  readonly name: string;
  readonly input: LayoutInput;
  readonly options?: LayoutOptions;
}

/** This function makes a full tree, as `engine.bench.ts`: each node with children has `k` children, down to `depth`. */
export function fullTree(depth: number, k: number, strategy: string, mode: "linked" | "nested"): NodeSpec {
  let next = 0;
  const make = (d: number): NodeSpec => {
    const id = `n${String(next++)}`;
    return d === 0 ? { id } : { id, layout: strategy, mode, children: Array.from({ length: k }, () => make(d - 1)) };
  };
  return make(depth);
}

/** This function gives the examples of the golden files. */
export function exampleTrees(): ShapeTree[] {
  return examples.map((e) => ({ name: `example ${e.name}`, input: e.input, ...(e.options === undefined ? {} : { options: e.options }) }));
}

/** This function gives the full trees of the strategy `tree` in the linked mode: 111, 1111 and, with `large`, 11111 nodes. */
export function fullTrees(large: boolean): ShapeTree[] {
  const depths = large ? [2, 3, 4] : [2, 3];
  return depths.map((depth) => {
    const root = fullTree(depth, 10, "tree", "linked");
    return { name: `full tree ${String((10 ** (depth + 1) - 1) / 9)} nodes`, input: { root } };
  });
}

/** This function gives `count` random trees of `arbitrary.ts`, with a fixed seed. */
export function randomTrees(count: number, seed = 20_261_027): ShapeTree[] {
  const roots = fc.sample(treeArbitrary({ maxDepth: 5, maxChildren: 5 }), { numRuns: count, seed });
  return roots.map((root, i) => ({ name: `random tree ${String(i)}`, input: { root } }));
}
