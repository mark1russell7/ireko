/**
 * The benchmarks of the engine (docs/REVIEW.md §9, L9): trees of 111, 1111 and 11111 nodes with each strategy, and
 * the routers on a tree with extra edges. Start them with `pnpm --filter ireko bench`. They measure and do not fail.
 */
import { test } from "vitest";
import { layout } from "./engine.ts";
import type { EdgeSpec, NodeSpec } from "./model.ts";

/** This function makes a full tree: each node with children has `k` children, down to the depth `depth`. */
function full(depth: number, k: number, strategy: string, mode: "linked" | "nested"): NodeSpec {
  let next = 0;
  const make = (d: number): NodeSpec => {
    const id = `n${String(next++)}`;
    return d === 0 ? { id } : { id, layout: strategy, mode, children: Array.from({ length: k }, () => make(d - 1)) };
  };
  return make(depth);
}

/** This function makes extra edges between leaves that are far apart, with a fixed pattern. */
function edgesOf(root: NodeSpec, count: number): EdgeSpec[] {
  const leaves: string[] = [];
  const walk = (n: NodeSpec): void => {
    if (n.children === undefined || n.children.length === 0) leaves.push(n.id);
    else n.children.forEach(walk);
  };
  walk(root);
  return Array.from({ length: count }, (_, i) => ({ source: leaves[(i * 7) % leaves.length] ?? "n0", target: leaves[(i * 13 + 5) % leaves.length] ?? "n0" })).filter((e) => e.source !== e.target);
}

const SIZES = [
  { name: "111 nodes", depth: 2 },
  { name: "1111 nodes", depth: 3 },
  { name: "11111 nodes", depth: 4 },
];

for (const strategy of ["grid", "radial", "tree", "layers"]) {
  test(`the strategy ${strategy}`, async ({ bench }) => {
    const cases = SIZES.flatMap((s) =>
      (["linked", "nested"] as const).map((mode) => {
        const root = full(s.depth, 10, strategy, mode);
        return bench(`${strategy}, ${s.name}, ${mode}`, () => {
          layout({ root });
        });
      }),
    );
    await bench.compare(...cases);
  });
}

test("the routers, 1111 nodes and 100 extra edges", async ({ bench }) => {
  const root = full(3, 10, "grid", "nested");
  const edges = edgesOf(root, 100);
  await bench.compare(
    ...["straight", "orthogonal", "avoid"].map((router) =>
      bench(router, () => {
        layout({ root, edges }, { router });
      }),
    ),
  );
});
