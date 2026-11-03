import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { at as item } from "./at.ts";
import type { Point } from "./geometry.ts";
import { relaxForces, type RelaxEdge, type RelaxNode } from "./relax.ts";

const MARGIN = 12;
const box = (id: string, x: number, y: number, width: number, height: number, fixed = false): RelaxNode => ({ id, rect: { x, y, width, height }, ...(fixed ? { fixed } : {}) });
const gap = (m: Map<string, Point>) => (m.get("b") as Point).x - (m.get("a") as Point).x;
const sorted = (m: Map<string, Point>) => [...m].toSorted(([a], [b]) => (a < b ? -1 : 1));

/** The pairs of boxes that are nearer than the margin on both axes. */
function overlaps(nodes: readonly RelaxNode[], at: Map<string, Point>, margin = MARGIN): string[] {
  const out: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = item(nodes, i), b = item(nodes, j);
      const pa = at.get(a.id) as Point, pb = at.get(b.id) as Point;
      const ox = (a.rect.width + b.rect.width) / 2 + margin - Math.abs(pa.x + a.rect.width / 2 - (pb.x + b.rect.width / 2));
      const oy = (a.rect.height + b.rect.height) / 2 + margin - Math.abs(pa.y + a.rect.height / 2 - (pb.y + b.rect.height / 2));
      if (ox > 1e-9 && oy > 1e-9) out.push(`${a.id}/${b.id}`);
    }
  }
  return out;
}

/** 2 to 14 free boxes, 0 to 2 fixed boxes apart from each other, and some springs. */
const scene = fc
  .record({
    bound: fc.record({ width: fc.integer({ min: 900, max: 1600 }), height: fc.integer({ min: 500, max: 900 }) }),
    fixedY: fc.array(fc.integer({ min: 0, max: 300 }), { maxLength: 2 }),
    free: fc.array(fc.record({ x: fc.integer({ min: 0, max: 1500 }), y: fc.integer({ min: 0, max: 900 }), width: fc.integer({ min: 60, max: 260 }), height: fc.integer({ min: 40, max: 200 }) }), { minLength: 2, maxLength: 14 }),
    springs: fc.array(fc.record({ from: fc.nat(), to: fc.nat(), strength: fc.constantFrom(0.02, 0.08, 0.24) }), { maxLength: 14 }),
  })
  .map(({ bound, fixedY, free, springs }) => {
    const nodes: RelaxNode[] = [
      ...fixedY.map((y, i) => box(`f${i}`, i * 500, y, 160, 120, true)),
      ...free.map((r, i) => box(`n${i}`, Math.min(r.x, bound.width - 100), r.y, r.width, r.height)),
    ];
    const edges: RelaxEdge[] = springs.map((s) => ({ from: `n${s.from % free.length}`, to: `n${s.to % free.length}`, strength: s.strength }));
    return { nodes, edges, bound };
  });

describe("relaxForces: fixed inputs", () => {
  it("does not move one box at the center of the bound", () => {
    expect(sorted(relaxForces([box("a", 450, 450, 100, 100)], [], { bound: { width: 1000, height: 1000 } }))).toEqual([["a", { x: 450, y: 450 }]]);
  });

  it("moves two boxes at the same place apart, by the margin at least", () => {
    const nodes = [box("a", 10, 10, 200, 150), box("b", 10, 10, 200, 150)];
    expect(overlaps(nodes, relaxForces(nodes, [], { bound: { width: 600, height: 400 }, iterations: 20 }))).toEqual([]);
  });

  it("pulls two far boxes nearer with a spring than without it", () => {
    const nodes = [box("a", 0, 0, 100, 100), box("b", 1400, 0, 100, 100)];
    const bound = { width: 1500, height: 600 };
    expect(gap(relaxForces(nodes, [{ from: "a", to: "b", strength: 0.24 }], { bound }))).toBeLessThan(gap(relaxForces(nodes, [], { bound })));
  });

  it("keeps a fixed box at its place, and pushes a free box out of it", () => {
    const nodes = [box("wall", 300, 200, 200, 200, true), box("a", 350, 250, 100, 100)];
    const at = relaxForces(nodes, [], { bound: { width: 900, height: 600 } });
    expect(at.get("wall")).toEqual({ x: 300, y: 200 });
    expect(overlaps(nodes, at)).toEqual([]);
  });

  it("separates a box that goes up and back between the top and a fixed box (the sweep)", () => {
    // The push up meets the top of the bound on each pass, and the clamp moves the box back.
    const nodes = [box("f0", 0, 88, 160, 120, true), box("n12", 1, 40, 214, 103)];
    const at = relaxForces(nodes, [], { bound: { width: 940, height: 892 }, iterations: 0 });
    expect(overlaps(nodes, at)).toEqual([]);
    expect((at.get("n12") as Point).y).toBeGreaterThan(88 + 120);
  });

  it("separates a box that goes up and down between a box at the top and a fixed box (the sweep)", () => {
    // The space between the two boxes (143) is less than the box and its two margins (146).
    const nodes = [box("f1", 500, 242, 160, 120, true), box("n7", 553, 4, 187, 95), box("n12", 593, 110, 120, 122)];
    const at = relaxForces(nodes, [], { bound: { width: 1167, height: 622 }, iterations: 0 });
    expect(overlaps(nodes, at)).toEqual([]);
    expect(at.get("f1")).toEqual({ x: 500, y: 242 });
  });

  it("ignores a spring from a box to the same box, and throws for a duplicate or an unknown identifier", () => {
    const nodes = [box("a", 0, 0, 100, 100), box("b", 300, 0, 100, 100)];
    const bound = { width: 800, height: 400 };
    expect(sorted(relaxForces(nodes, [{ from: "a", to: "a", strength: 1 }], { bound }))).toEqual(sorted(relaxForces(nodes, [], { bound })));
    expect(() => relaxForces([...nodes, box("a", 5, 5, 10, 10)], [], { bound })).toThrow(RangeError);
    expect(() => relaxForces(nodes, [{ from: "a", to: "zz", strength: 1 }], { bound })).toThrow(/unknown node "zz"/);
  });

  it("keeps each box inside the width and below the top, by the inset", () => {
    const nodes = [box("a", -500, -500, 100, 100), box("b", 5000, 50, 100, 100)];
    const at = relaxForces(nodes, [], { bound: { width: 800, height: 400 }, iterations: 1, inset: 10 });
    for (const n of nodes) {
      const p = at.get(n.id) as Point;
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x + n.rect.width).toBeLessThanOrEqual(800 - 10);
      expect(p.y).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps the margin of the options", () => {
    const nodes = [box("a", 10, 10, 200, 150), box("b", 10, 10, 200, 150), box("c", 20, 15, 100, 100)];
    expect(overlaps(nodes, relaxForces(nodes, [], { bound: { width: 600, height: 400 }, margin: 40 }), 40)).toEqual([]);
  });
});

describe("relaxForces: properties", () => {
  it("leaves no two boxes nearer than the margin", () => {
    fc.assert(fc.property(scene, ({ nodes, edges, bound }) => {
      expect(overlaps(nodes, relaxForces(nodes, edges, { bound }))).toEqual([]);
    }), { numRuns: 300 });
  });

  it("gives the same result for each order of the boxes and the springs, and each direction of a spring", () => {
    fc.assert(fc.property(scene, fc.infiniteStream(fc.boolean()), fc.nat(), ({ nodes, edges, bound }, flips, turn) => {
      const turned = edges.map((e) => (flips.next().value ? { ...e, from: e.to, to: e.from } : e));
      const rotate = <T>(list: readonly T[]): T[] => [...list.slice(turn % Math.max(list.length, 1)), ...list.slice(0, turn % Math.max(list.length, 1))].toReversed();
      expect(sorted(relaxForces(rotate(nodes), rotate(turned), { bound }))).toEqual(sorted(relaxForces(nodes, edges, { bound })));
    }), { numRuns: 100 });
  });

  it("gives the same result for the same input", () => {
    fc.assert(fc.property(scene, ({ nodes, edges, bound }) => {
      expect(sorted(relaxForces(nodes, edges, { bound }))).toEqual(sorted(relaxForces(nodes, edges, { bound })));
    }), { numRuns: 30 });
  });

  it("keeps a fixed point: one more step, or a full relaxation, gives the same positions", () => {
    // One free box at the center, and fixed boxes in pairs that are symmetric about it. The forces on it are zero.
    const pairs = fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })).filter(([dx, dy]) => dx + dy > 0), { minLength: 1, maxLength: 3 });
    fc.assert(fc.property(fc.integer({ min: 40, max: 160 }), fc.integer({ min: 600, max: 900 }), fc.integer({ min: 400, max: 700 }), pairs, (size, halfW, halfH, offsets) => {
      const bound = { width: 2 * halfW, height: 2 * halfH };
      const step = size + 2 * MARGIN;
      const nodes = [box("free", halfW - size / 2, halfH - size / 2, size, size)];
      offsets.forEach(([dx, dy], k) => {
        nodes.push(box(`m${k}+`, halfW + dx * step - size / 2, halfH + dy * step - size / 2, size, size, true));
        nodes.push(box(`m${k}-`, halfW - dx * step - size / 2, halfH - dy * step - size / 2, size, size, true));
      });
      const start = new Map(nodes.map((n) => [n.id, { x: n.rect.x, y: n.rect.y }]));
      fc.pre(overlaps(nodes, start).length === 0);
      for (const iterations of [1, 150]) expect(sorted(relaxForces(nodes, [], { bound, iterations }))).toEqual(sorted(start));
    }), { numRuns: 100 });
  });
});
