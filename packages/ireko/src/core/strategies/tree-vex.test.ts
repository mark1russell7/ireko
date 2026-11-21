import { describe, expect, it } from "vitest";
import { exampleTrees, fullTree, fullTrees, randomTrees } from "../../test/shape-trees.ts";
import { layout as shapesLayout } from "../../shapes/index.ts";
import { createEngine, layout } from "../engine.ts";
import type { LayoutInput } from "../model.ts";
import { defaultsOf } from "../options.ts";
import { defineStrategy, type Arrangement, type MeasuredChild } from "../strategy.ts";
import { tree, type TreeOptions } from "./tree.ts";
import { vexTree } from "./tree-vex.ts";

const TREES = [...exampleTrees(), ...fullTrees(false), ...randomTrees(200)];
const SIDES = ["bottom", "top", "left", "right"] as const;
const ALIGNS = ["center", "start", "end"] as const;

/** The first difference of two arrangements, with `Object.is` on each number, or undefined. */
function difference(hand: Arrangement, vex: Arrangement): string | undefined {
  if (hand.direction !== vex.direction) return `direction ${String(hand.direction)} against ${String(vex.direction)}`;
  if (hand.offsets.length !== vex.offsets.length) return `${String(hand.offsets.length)} offsets against ${String(vex.offsets.length)}`;
  for (let i = 0; i < hand.offsets.length; i++) {
    const a = hand.offsets[i];
    const b = vex.offsets[i];
    if (a === undefined || b === undefined) return `no offset ${String(i)}`;
    if (!Object.is(a.x, b.x) || !Object.is(a.y, b.y)) return `offset ${String(i)}: ${String(a.x)}, ${String(a.y)} against ${String(b.x)}, ${String(b.y)}`;
  }
  return undefined;
}

/** This function lays out each input with a strategy `tree` that compares the module with the code of ireko at each node. */
function compareAll(inputs: readonly { readonly name: string; readonly input: LayoutInput }[]): { readonly calls: number; readonly differences: readonly string[] } {
  let calls = 0;
  const differences: string[] = [];
  for (const { name, input } of inputs) {
    const compare = defineStrategy<TreeOptions>({
      ...tree,
      arrange(arg) {
        const hand = tree.arrange(arg);
        const d = difference(hand, vexTree.arrange(arg));
        calls++;
        if (d !== undefined) differences.push(`${name}, node ${arg.id}: ${d}`);
        return hand;
      },
    });
    createEngine({ strategies: [compare] }).layout(input);
  }
  return { calls, differences };
}

const leaf = (id: string, width: number, height: number): MeasuredChild => ({ id, box: { width, height }, extent: { x: 0, y: 0, width, height }, mode: "linked" });

describe("the tree module of Vex against the strategy tree of ireko", () => {
  it("gives the same bits at each node of each tree", () => {
    const { calls, differences } = compareAll(TREES);
    expect(differences).toStrictEqual([]);
    expect(calls).toBeGreaterThan(100);
  });

  it("gives the same bits on each side, with each align, in both modes", () => {
    const inputs = SIDES.flatMap((side) =>
      ALIGNS.flatMap((align) =>
        (["linked", "nested"] as const).map((mode) => {
          const root = fullTree(3, 4, "tree", mode);
          const withOptions = (n: typeof root): typeof root => ({ ...n, ...(n.layout === undefined ? {} : { layout: { type: "tree", side, align } }), ...(n.children === undefined ? {} : { children: n.children.map(withOptions) }) });
          return { name: `${side} ${align} ${mode}`, input: { root: withOptions(root) } };
        }),
      ),
    );
    const { calls, differences } = compareAll(inputs);
    expect(differences).toStrictEqual([]);
    expect(calls).toBeGreaterThan(100);
  });

  it("gives the layout of the entry `ireko` from the entry `ireko/shapes`", () => {
    for (const t of TREES) expect(shapesLayout(t.input, t.options)).toStrictEqual(layout(t.input, t.options));
  });

  it("gives offsets that are not finite where a size overflows, so the engine uses the grid", () => {
    const options = defaultsOf(tree.options);
    const children = [leaf("a", 1e308, 10), leaf("b", 1e308, 10), leaf("c", 1e308, 10)];
    const out = vexTree.arrange({ id: "p", mode: "linked", self: { width: 10, height: 10 }, children, options, gap: 10, depth: 0 });
    expect(out.offsets.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))).toBe(true);
    const hand = tree.arrange({ id: "p", mode: "linked", self: { width: 10, height: 10 }, children, options, gap: 10, depth: 0 });
    expect(hand.offsets.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))).toBe(true);
  });

  it("has the type and the options of the strategy tree", () => {
    expect(vexTree.type).toBe(tree.type);
    expect(vexTree.options).toBe(tree.options);
    expect(vexTree.shapes).toBe(true);
  });
});
