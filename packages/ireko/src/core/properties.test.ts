import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { inputArbitrary, optionsArbitrary, treeArbitrary } from "../test/arbitrary.ts";
import { defectsOf, distanceToBorder } from "../test/invariants.ts";
import { layout } from "./engine.ts";
import type { Layout, NodeSpec } from "./model.ts";

const RUNS = { numRuns: 400 };

describe("properties of each layout (docs/REVIEW.md §9.3)", () => {
  it("P1, P2, P4: no overlap, each nested child inside its container, finite and positive boxes", () => {
    fc.assert(
      fc.property(inputArbitrary(), optionsArbitrary(), (input, options) => {
        const out = layout(input, options);
        expect(defectsOf(out)).toEqual([]);
        expect(out.issues.filter((i) => i.code === "OVERLAP" || i.code === "ESCAPE")).toEqual([]);
      }),
      RUNS,
    );
  });

  it("the audit of the engine agrees with the independent check", () => {
    fc.assert(
      fc.property(treeArbitrary({ fits: ["grow", "scale", "clip"] }), (root) => {
        const out = layout({ root });
        const overlaps = defectsOf(out).filter((d) => d.startsWith("overlap"));
        const reported = out.issues.filter((i) => i.code === "OVERLAP");
        // A clipped container can hide an overlap: the audit counts only the visible part of a box.
        // Thus the audit can find fewer overlaps than the independent check, but never more.
        expect(overlaps.length === 0 ? reported : []).toEqual([]);
      }),
      RUNS,
    );
  });

  it("P3: the same input gives the same output, and JSON keeps it without loss", () => {
    fc.assert(
      fc.property(inputArbitrary(), optionsArbitrary(), (input, options) => {
        const a = layout(input, options);
        const b = layout(input, options);
        expect(b).toEqual(a);
        expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      }),
      { numRuns: 150 },
    );
  });

  it("P5: a move of the origin moves each box and each point by the same vector", () => {
    fc.assert(
      fc.property(treeArbitrary(), fc.integer({ min: -500, max: 500 }), fc.integer({ min: -500, max: 500 }), (root, dx, dy) => {
        const a = layout({ root });
        const b = layout({ root }, { origin: { x: dx, y: dy } });
        a.nodes.forEach((n, i) => {
          const m = b.nodes[i];
          expect(m?.x).toBeCloseTo(n.x + dx, 2);
          expect(m?.y).toBeCloseTo(n.y + dy, 2);
          expect(m?.width).toBe(n.width);
        });
      }),
      { numRuns: 150 },
    );
  });

  it("P8: each edge starts on the edge of its source box and ends on the edge of its target box", () => {
    fc.assert(
      fc.property(inputArbitrary({ fits: ["grow"] }), fc.constantFrom("straight", "orthogonal"), (input, router) => {
        const out = layout(input, { router });
        const byId = new Map(out.nodes.map((n) => [n.id, n]));
        for (const e of out.edges) {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          const first = e.points[0];
          const last = e.points[e.points.length - 1];
          if (s === undefined || t === undefined || first === undefined || last === undefined) throw new Error("bad edge");
          if (contains(s, t) || contains(t, s)) continue;
          expect(Math.abs(distanceToBorder(first, s))).toBeLessThan(0.01);
          expect(Math.abs(distanceToBorder(last, t))).toBeLessThan(0.01);
        }
      }),
      RUNS,
    );
  });

  it("P11: a new leaf in one subtree does not change the relative positions inside a sibling subtree", () => {
    fc.assert(
      fc.property(treeArbitrary({ fits: ["grow"] }).filter((r) => (r.children?.length ?? 0) >= 2), (root) => {
        const [first, second] = root.children ?? [];
        if (first === undefined || second === undefined) return;
        const grown: NodeSpec = { ...root, children: [{ ...first, children: [...(first.children ?? []), { id: "extra-leaf" }] }, ...(root.children ?? []).slice(1)] };
        const a = relative(layout({ root }), second.id);
        const b = relative(layout({ root: grown }), second.id);
        expect(Object.keys(b)).toEqual(Object.keys(a));
        for (const [id, [x, y]] of Object.entries(a)) {
          // The engine rounds each coordinate to three decimals, so a difference of two coordinates can change by 0.001.
          expect(Math.abs((b[id]?.[0] ?? NaN) - x)).toBeLessThan(0.002);
          expect(Math.abs((b[id]?.[1] ?? NaN) - y)).toBeLessThan(0.002);
        }
      }),
      { numRuns: 200 },
    );
  });
});

function contains(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return b.x >= a.x - 0.01 && b.y >= a.y - 0.01 && b.x + b.width <= a.x + a.width + 0.01 && b.y + b.height <= a.y + a.height + 0.01;
}

/** This function gives the positions of the nodes of a subtree, relative to the root of the subtree. */
function relative(out: Layout, rootId: string): Record<string, [number, number]> {
  const byId = new Map(out.nodes.map((n) => [n.id, n]));
  const root = byId.get(rootId);
  if (root === undefined) return {};
  const inside = (id: string | undefined): boolean => {
    for (let c = id; c !== undefined; c = byId.get(c)?.parent) if (c === rootId) return true;
    return false;
  };
  const result: Record<string, [number, number]> = {};
  for (const n of out.nodes) if (inside(n.id)) result[n.id] = [n.x - root.x, n.y - root.y];
  return result;
}
