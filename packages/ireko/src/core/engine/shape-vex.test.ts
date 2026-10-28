import { afterEach, describe, expect, it } from "vitest";
import { exampleTrees, fullTrees, randomTrees } from "../../test/shape-trees.ts";
import { layout } from "../engine.ts";
import type { Band, Shape } from "../strategy.ts";
import { boxShape, handLinkedShape, setLinkedShape, type LinkedShape, type ShapePart } from "./shape.ts";
import { vexLinkedShape } from "./shape-vex.ts";

const TREES = [...exampleTrees(), ...fullTrees(false), ...randomTrees(200)];

/** The first difference of two lists of bands, with `Object.is` on each number, or undefined. */
function bandDifference(a: readonly Band[], b: readonly Band[], where: string): string | undefined {
  if (a.length !== b.length) return `${where}: ${String(a.length)} bands against ${String(b.length)}`;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined) return `${where}: no band ${String(i)}`;
    for (const key of ["from", "to", "min", "max"] as const) {
      if (!Object.is(x[key], y[key])) return `${where}: band ${String(i)} ${key} ${String(x[key])} against ${String(y[key])}`;
    }
  }
  return undefined;
}

function shapeDifference(hand: Shape, vex: Shape): string | undefined {
  return bandDifference(hand.rows, vex.rows, "rows") ?? bandDifference(hand.columns, vex.columns, "columns");
}

afterEach(() => {
  setLinkedShape(handLinkedShape);
});

describe("the shapes module of Vex against the shapes code of ireko", () => {
  it("gives the same bits for each linked node of each tree", () => {
    let nodes = 0;
    const differences: string[] = [];
    for (const tree of TREES) {
      const compare: LinkedShape = (own, parts) => {
        const hand = handLinkedShape(own, parts);
        const vex = vexLinkedShape(own, parts);
        nodes++;
        const d = shapeDifference(hand, vex);
        if (d !== undefined) differences.push(`${tree.name}: ${d}`);
        return hand;
      };
      setLinkedShape(compare);
      layout(tree.input, tree.options);
    }
    expect(differences).toStrictEqual([]);
    // The examples, the full trees and the random trees have many linked nodes with children.
    expect(nodes).toBeGreaterThan(1000);
  });

  it("gives the same layout with the switch on", () => {
    for (const tree of TREES) {
      setLinkedShape(handLinkedShape);
      const hand = layout(tree.input, tree.options);
      setLinkedShape(vexLinkedShape);
      expect(layout(tree.input, tree.options)).toStrictEqual(hand);
    }
  });

  it("gives the box to a node without children", () => {
    expect(vexLinkedShape({ width: 10, height: 4 }, [])).toStrictEqual(boxShape({ width: 10, height: 4 }));
  });

  it("gives the same bits where a moved band is not finite: the module and the code of ireko keep Infinity", () => {
    // A sum of two numbers near the largest number overflows. The layout of ireko throws before this point.
    const huge: ShapePart = { shape: boxShape({ width: 1e308, height: 1e308 }), x: 1e308, y: 1e308 };
    const own = { width: 10, height: 4 };
    const hand = handLinkedShape(own, [huge]);
    expect(hand.rows.some((b) => b.max === Infinity)).toBe(true);
    expect(shapeDifference(hand, vexLinkedShape(own, [huge]))).toBeUndefined();
    // A box that is not finite keeps its infinite end in both.
    const wide = { width: Infinity, height: 4 };
    const parts: ShapePart[] = [{ shape: boxShape(own), x: 0, y: 0 }];
    expect(shapeDifference(handLinkedShape(wide, parts), vexLinkedShape(wide, parts))).toBeUndefined();
    // A box with NaN is an error of the module.
    expect(() => vexLinkedShape({ width: Number.NaN, height: 4 }, parts)).toThrow(RangeError);
  });

  it("gives the code before, and the measure pass uses the code of the switch", () => {
    let calls = 0;
    const counted: LinkedShape = (own, parts) => {
      calls++;
      return handLinkedShape(own, parts);
    };
    expect(setLinkedShape(counted)).toBe(handLinkedShape);
    layout({ root: { id: "r", layout: "tree", children: [{ id: "a", children: [{ id: "b" }] }, { id: "c" }] } });
    expect(calls).toBeGreaterThan(0);
  });
});
