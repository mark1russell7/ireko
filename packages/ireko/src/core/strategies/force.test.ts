import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defectsOf } from "../../test/invariants.ts";
import { at } from "../at.ts";
import { layout } from "../engine.ts";
import type { Rect } from "../geometry.ts";
import { defaultsOf } from "../options.ts";
import type { ChildEdge, MeasuredChild } from "../strategy.ts";
import { force, type ForceOptions } from "./force.ts";

const leaf = (id: string, width = 100, height = 50): MeasuredChild => ({ id, box: { width, height }, extent: { x: 0, y: 0, width, height }, mode: "linked" });
const arrange = (children: MeasuredChild[], edges: ChildEdge[] = [], mode: "nested" | "linked" = "nested", options: Partial<ForceOptions> = {}) =>
  force.arrange({ id: "p", mode, self: { width: 100, height: 50 }, children, options: { ...defaultsOf(force.options), ...options }, gap: 10, depth: 0, edges });

/** The extent of each child at its offset. */
const extents = (children: readonly MeasuredChild[], offsets: readonly { x: number; y: number }[]): Rect[] =>
  children.map((c, i) => ({ x: (offsets[i]?.x ?? 0) + c.extent.x, y: (offsets[i]?.y ?? 0) + c.extent.y, width: c.extent.width, height: c.extent.height }));
const apart = (a: Rect, b: Rect, margin: number) =>
  a.x + a.width + margin <= b.x + 1e-9 || b.x + b.width + margin <= a.x + 1e-9 || a.y + a.height + margin <= b.y + 1e-9 || b.y + b.height + margin <= a.y + 1e-9;

type Offsets = { offsets: readonly { x: number; y: number }[] };
/** The distance between the first and the fifth child. */
const distance = (out: Offsets) => Math.hypot((out.offsets[0]?.x ?? 0) - (out.offsets[4]?.x ?? 0), (out.offsets[0]?.y ?? 0) - (out.offsets[4]?.y ?? 0));
/** The offset of each child, by its identifier. */
const byId = (cs: readonly MeasuredChild[], out: Offsets) => new Map(cs.map((c, i) => [c.id, out.offsets[i]]));

const children = fc
  .array(fc.record({ width: fc.integer({ min: 10, max: 200 }), height: fc.integer({ min: 10, max: 120 }), x: fc.integer({ min: -40, max: 0 }), y: fc.integer({ min: -40, max: 0 }) }), { minLength: 1, maxLength: 12 })
  .map((list) => list.map((r, i): MeasuredChild => ({ id: `c${String(i).padStart(2, "0")}`, box: { width: r.width, height: r.height }, extent: { x: r.x, y: r.y, width: r.width - r.x, height: r.height - r.y }, mode: "linked" })));
const withEdges = children.chain((list) => fc.tuple(fc.constant(list), fc.array(fc.record({ from: fc.nat(list.length - 1), to: fc.nat(list.length - 1) }), { maxLength: list.length })));

describe("force", () => {
  it("gives no offsets for no children", () => {
    expect(arrange([])).toEqual({ offsets: [], content: { x: 0, y: 0, width: 0, height: 0 } });
    expect(arrange([], [], "linked")).toEqual({ offsets: [], direction: "down" });
  });

  it("puts the extents at (0, 0) and makes the content hold them", () => {
    const list = [leaf("a"), leaf("b", 80, 80), leaf("c", 40, 120)];
    const out = arrange(list);
    const boxes = extents(list, out.offsets);
    expect(Math.min(...boxes.map((r) => r.x))).toBeCloseTo(0, 9);
    expect(Math.min(...boxes.map((r) => r.y))).toBeCloseTo(0, 9);
    for (const r of boxes) {
      expect(r.x + r.width).toBeLessThanOrEqual((out.content?.width ?? 0) + 1e-9);
      expect(r.y + r.height).toBeLessThanOrEqual((out.content?.height ?? 0) + 1e-9);
    }
  });

  it("puts linked children below the node, by the distance", () => {
    const list = [leaf("a"), leaf("b"), leaf("c")];
    const out = arrange(list, [], "linked", { distance: 30 });
    expect(out.direction).toBe("down");
    expect(Math.min(...extents(list, out.offsets).map((r) => r.y))).toBeCloseTo(50 + 30, 9);
  });

  it("pulls two children with an edge nearer than without it", () => {
    const list = [leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e")];
    expect(distance(arrange(list, [{ from: 0, to: 4 }], "nested", { strength: 0.24 }))).toBeLessThan(distance(arrange(list)));
  });

  it("keeps the margin between each two extents", () => {
    fc.assert(fc.property(withEdges, fc.integer({ min: 0, max: 30 }), ([list, edges], margin) => {
      const boxes = extents(list, arrange(list, edges, "nested", { margin }).offsets);
      const used = margin > 0 ? margin : 10;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(apart(at(boxes, i), at(boxes, j), used)).toBe(true);
    }), { numRuns: 200 });
  });

  it("does not depend on the order of the children: the identifiers set the order", () => {
    fc.assert(fc.property(withEdges, fc.nat(), ([list, edges], turn) => {
      const k = turn % list.length;
      const order = [...list.keys()].map((i) => (i + k) % list.length).toReversed();
      const where = new Map(order.map((from, to) => [from, to]));
      const turned = order.map((i) => at(list, i));
      const turnedEdges = edges.map((e) => ({ from: where.get(e.from) ?? 0, to: where.get(e.to) ?? 0 }));
      expect(byId(turned, arrange(turned, turnedEdges))).toEqual(byId(list, arrange(list, edges)));
    }), { numRuns: 100 });
  });

  it("gives the same positions after a new name for each child that keeps the order of the identifiers", () => {
    fc.assert(fc.property(withEdges, ([list, edges]) => {
      const renamed = list.map((c) => ({ ...c, id: `node-${c.id}` }));
      expect(arrange(renamed, edges).offsets).toEqual(arrange(list, edges).offsets);
    }), { numRuns: 50 });
  });

  it("refuses a strength above 0.5 with a finding of the engine", () => {
    const out = layout({ root: { id: "r", layout: { type: "force", strength: 0.9 }, mode: "nested", children: ["a", "b"].map((id) => ({ id, size: { width: 80, height: 40 } })) } });
    expect(out.issues.map((i) => i.code)).toContain("INVALID_OPTION");
  });

  it("gives a layout with no defects through the engine", () => {
    const out = layout({
      root: { id: "r", layout: { type: "force", strength: 0.24 }, mode: "nested", children: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, size: { width: 80, height: 40 } })) },
      edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }, { source: "d", target: "e" }],
    });
    expect(out.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(defectsOf(out)).toEqual([]);
  });
});
