import { describe, expect, it } from "vitest";
import { defectsOf } from "../../test/invariants.ts";
import { layout } from "../engine.ts";
import type { Layout, NodeSpec } from "../model.ts";
import { defaultsOf } from "../options.ts";
import type { MeasuredChild } from "../strategy.ts";
import { grid, type GridOptions } from "./grid.ts";
import { radial, type RadialOptions } from "./radial.ts";

const leaf = (id: string, width = 100, height = 50): MeasuredChild => ({ id, box: { width, height }, extent: { x: 0, y: 0, width, height }, mode: "linked" });
const gridOf = (options: Partial<GridOptions>, mode: "nested" | "linked", children: MeasuredChild[]) =>
  grid.arrange({ id: "p", mode, self: { width: 100, height: 50 }, children, options: { ...defaultsOf(grid.options), ...options }, gap: 10, depth: 0 });
const radialOf = (options: Partial<RadialOptions>, mode: "nested" | "linked", children: MeasuredChild[]) =>
  radial.arrange({ id: "p", mode, self: { width: 100, height: 50 }, children, options: { ...defaultsOf(radial.options), ...options }, gap: 10, depth: 0 });
const center = (out: Layout, id: string) => {
  const n = out.nodes.find((x) => x.id === id);
  if (n === undefined) throw new Error(id);
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
};

describe("grid", () => {
  it("puts four children in two rows of two, with the gap between them", () => {
    const out = gridOf({}, "nested", [leaf("a"), leaf("b"), leaf("c"), leaf("d")]);
    expect(out.offsets).toEqual([{ x: 0, y: 0 }, { x: 110, y: 0 }, { x: 0, y: 60 }, { x: 110, y: 60 }]);
    expect(out.content).toEqual({ x: 0, y: 0, width: 210, height: 110 });
  });

  it("makes a column as wide as its widest child, and centers the other children in it", () => {
    const out = gridOf({ columns: 1 }, "nested", [leaf("a", 300), leaf("b", 100)]);
    expect(out.offsets).toEqual([{ x: 0, y: 0 }, { x: 100, y: 60 }]);
  });

  it("gives each cell the size of the largest cell with the option uniform", () => {
    const out = gridOf({ uniform: true }, "nested", [leaf("a", 300, 10), leaf("b", 100, 90)]);
    expect(out.content).toEqual({ x: 0, y: 0, width: 610, height: 90 });
  });

  it("uses the extent of a child, not its box", () => {
    const wide: MeasuredChild = { id: "w", box: { width: 100, height: 50 }, extent: { x: -150, y: 0, width: 400, height: 200 }, mode: "linked" };
    const out = gridOf({}, "nested", [wide, leaf("b")]);
    // The box of w is 150 px to the right of its extent.
    expect(out.offsets[0]).toEqual({ x: 150, y: 0 });
    expect(out.offsets[1]).toEqual({ x: 410, y: 75 });
  });

  it("aligns the children with justify and align", () => {
    const out = gridOf({ columns: 1, justify: "end", align: "end" }, "nested", [leaf("a", 300, 50), leaf("b", 100, 50)]);
    expect(out.offsets[1]).toEqual({ x: 200, y: 60 });
    const start = gridOf({ columns: 2, justify: "start", align: "start" }, "nested", [leaf("a", 100, 90), leaf("b", 100, 50)]);
    expect(start.offsets[1]).toEqual({ x: 110, y: 0 });
  });

  it("puts linked children below the node, centered, at 1.5 times the gap", () => {
    const out = gridOf({}, "linked", [leaf("a"), leaf("b")]);
    expect(out.offsets).toEqual([{ x: -55, y: 65 }, { x: 55, y: 65 }]);
  });

  it("puts linked children on each side", () => {
    expect(gridOf({ side: "top", distance: 20 }, "linked", [leaf("a")]).offsets).toEqual([{ x: 0, y: -70 }]);
    expect(gridOf({ side: "right", distance: 20 }, "linked", [leaf("a")]).offsets).toEqual([{ x: 120, y: 0 }]);
    expect(gridOf({ side: "left", distance: 20 }, "linked", [leaf("a")]).offsets).toEqual([{ x: -120, y: 0 }]);
  });

  it("makes a tall grid on the left and right sides, and a wide grid on the top and bottom sides", () => {
    expect(new Set(gridOf({ side: "right" }, "linked", [leaf("a"), leaf("b")]).offsets.map((p) => p.x)).size).toBe(1);
    expect(new Set(gridOf({ side: "bottom" }, "linked", [leaf("a"), leaf("b")]).offsets.map((p) => p.y)).size).toBe(1);
  });

  it("law: a grid with one column is a column", () => {
    const out = layout({ root: { id: "p", layout: { type: "grid", columns: 1 }, mode: "nested", children: [{ id: "a" }, { id: "b" }, { id: "c" }] } });
    const xs = out.nodes.filter((n) => n.parent === "p").map((n) => n.x);
    expect(new Set(xs).size).toBe(1);
  });

  it("law: a nested grid with one child centers it", () => {
    const out = layout({ root: { id: "p", mode: "nested", size: { width: 600, height: 400 }, children: [{ id: "a" }] } });
    expect(center(out, "a")).toEqual(center(out, "p"));
  });
});

describe("radial", () => {
  it("law: a nested ring with one child centers it", () => {
    const out = radialOf({}, "nested", [leaf("a")]);
    expect(out.offsets).toEqual([{ x: -50, y: -25 }]);
    const full = layout({ root: { id: "p", layout: "radial", mode: "nested", size: { width: 500, height: 500 }, children: [{ id: "a" }] } });
    expect(center(full, "a").x).toBeCloseTo(center(full, "p").x, 6);
    expect(center(full, "a").y).toBeCloseTo(center(full, "p").y, 6);
  });

  it("keeps the circles of two neighbors apart by the gap", () => {
    const children = [leaf("a"), leaf("b"), leaf("c"), leaf("d"), leaf("e")];
    const out = radialOf({}, "nested", children);
    const rho = Math.hypot(50, 25);
    const centers = out.offsets.map((p) => ({ x: p.x + 50, y: p.y + 25 }));
    const [a, b] = centers;
    if (a === undefined || b === undefined) throw new Error("two centers");
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(2 * rho + 10, 6);
  });

  it("starts at the top and goes clockwise by default", () => {
    const out = radialOf({}, "nested", [leaf("a"), leaf("b"), leaf("c"), leaf("d")]);
    const [top, right] = out.offsets.map((p) => ({ x: p.x + 50, y: p.y + 25 }));
    expect(top?.x).toBeCloseTo(0, 6);
    expect(top?.y).toBeLessThan(0);
    expect(right?.x).toBeGreaterThan(0);
    const ccw = radialOf({ clockwise: false }, "nested", [leaf("a"), leaf("b"), leaf("c"), leaf("d")]);
    expect((ccw.offsets[1]?.x ?? 0) + 50).toBeLessThan(0);
  });

  it("puts linked children around the node, outside its circle", () => {
    const out = radialOf({}, "linked", [leaf("a"), leaf("b")]);
    const self = { x: 50, y: 25 };
    for (const p of out.offsets) {
      const c = { x: p.x + 50, y: p.y + 25 };
      expect(Math.hypot(c.x - self.x, c.y - self.y)).toBeGreaterThanOrEqual(2 * Math.hypot(50, 25) + 10 - 1e-9);
    }
    expect(out.content).toBeUndefined();
  });

  it("puts one linked child on the middle of a part of a ring", () => {
    const out = radialOf({ startAngle: 0, sweep: 180, distance: 5 }, "linked", [leaf("a")]);
    const c = { x: (out.offsets[0]?.x ?? 0) + 50, y: (out.offsets[0]?.y ?? 0) + 25 };
    // The middle of the arc from 0 to 180 degrees is straight down.
    expect(c.x).toBeCloseTo(50, 6);
    expect(c.y).toBeGreaterThan(25);
  });

  it("puts the children of a part of a ring at the middles of equal parts of the arc", () => {
    const out = radialOf({ startAngle: 0, sweep: 90 }, "nested", [leaf("a"), leaf("b")]);
    const angles = out.offsets.map((p) => (Math.atan2(p.y + 25, p.x + 50) * 180) / Math.PI);
    expect(angles[0]).toBeCloseTo(22.5, 6);
    expect(angles[1]).toBeCloseTo(67.5, 6);
  });

  it("gives no defect for many children of different sizes", () => {
    const children: NodeSpec[] = Array.from({ length: 12 }, (_, i) => ({ id: `c${String(i)}`, size: { width: 20 + i * 15, height: 60 - i * 3 } }));
    expect(defectsOf(layout({ root: { id: "p", layout: "radial", children } }))).toEqual([]);
    expect(defectsOf(layout({ root: { id: "p", layout: "radial", mode: "nested", children } }))).toEqual([]);
  });
});

describe("radial, the search of the radius", () => {
  it("keeps two large circles apart across a small circle", () => {
    // Two large children with a small child between them: neighbors keep apart at the first radius, but the two
    // large circles touch across the small one. The search makes the ring larger.
    const out = radialOf({}, "nested", [leaf("big1", 400, 400), leaf("tiny", 4, 4), leaf("big2", 400, 400), leaf("tiny2", 4, 4)]);
    const c = out.offsets.map((p, i) => ({ x: p.x + (i % 2 === 0 ? 200 : 2), y: p.y + (i % 2 === 0 ? 200 : 2) }));
    const [b1, , b2] = c;
    if (b1 === undefined || b2 === undefined) throw new Error("centers");
    expect(Math.hypot(b1.x - b2.x, b1.y - b2.y)).toBeGreaterThanOrEqual(2 * Math.hypot(200, 200) + 10 - 1e-6);
  });

  it("uses equal angles for a ring with more than 256 children", () => {
    const children = Array.from({ length: 300 }, (_, i) => leaf(`c${String(i)}`, 10 + (i % 7), 10));
    const out = radialOf({}, "nested", children);
    const angles = out.offsets.slice(0, 3).map((p, i) => Math.atan2(p.y + 5, p.x + (10 + (i % 7)) / 2));
    const [a0, a1, a2] = angles;
    if (a0 === undefined || a1 === undefined || a2 === undefined) throw new Error("angles");
    expect(a1 - a0).toBeCloseTo(a2 - a1, 9);
    expect(defectsOf(layout({ root: { id: "p", layout: "radial", mode: "nested", children: children.map((c) => ({ id: c.id, size: c.box })) } }))).toEqual([]);
  });
});
