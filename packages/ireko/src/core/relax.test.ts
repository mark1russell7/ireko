import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { at as item } from "./at.ts";
import type { Point } from "./geometry.ts";
import { relaxEachPair } from "../test/relax-reference.ts";
import { MAX_SPRING_STRENGTH, MAX_THETA, RELAX_DEFAULTS, relaxForces, type RelaxEdge, type RelaxNode } from "./relax.ts";

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

/** This function tells if two results have the same boxes at the same places, bit for bit. */
const same = (a: Map<string, Point>, b: Map<string, Point>): boolean => a.size === b.size && [...a].every(([id, p]) => Object.is(p.x, b.get(id)?.x) && Object.is(p.y, b.get(id)?.y));

/**
 * 1 to 70 boxes in a small area, so many boxes overlap. Some boxes are fixed, and fixed boxes can overlap.
 * A size can be 0. The options are small and large values of each option that changes the steps.
 */
const crowd = fc
  .record({
    side: fc.constantFrom(60, 400, 2500),
    boxes: fc.array(
      fc.record({ x: fc.double({ min: 0, max: 1, noNaN: true }), y: fc.double({ min: 0, max: 1, noNaN: true }), width: fc.constantFrom(0, 1, 30, 90, 240, 700), height: fc.constantFrom(0, 2, 20, 60, 180), fixed: fc.constantFrom(false, false, false, false, true) }),
      { minLength: 1, maxLength: 70 },
    ),
    springs: fc.array(fc.record({ from: fc.nat(), to: fc.nat(), strength: fc.constantFrom(0, 0.02, 0.08, 0.5) }), { maxLength: 40 }),
    options: fc.record({
      iterations: fc.constantFrom(0, 1, 7, 40),
      margin: fc.constantFrom(0, 12, 56),
      inset: fc.constantFrom(0, 4),
      separationPasses: fc.constantFrom(0, 1, 2, 9, 300),
      width: fc.constantFrom(0, 300, 1200, 9000),
    }),
  })
  .map(({ side, boxes, springs, options }) => {
    const nodes: RelaxNode[] = boxes.map((b, i) => box(`n${String(i).padStart(2, "0")}`, b.x * side, b.y * side, b.width, b.height, b.fixed));
    const edges: RelaxEdge[] = springs.map((s) => ({ from: `n${String(s.from % boxes.length).padStart(2, "0")}`, to: `n${String(s.to % boxes.length).padStart(2, "0")}`, strength: s.strength }));
    const { width, ...rest } = options;
    return { nodes, edges, options: { ...RELAX_DEFAULTS, ...rest, bound: { width, height: 600 } } };
  });

describe("relaxForces: the same result as a test of each pair", () => {
  it("gives the positions of the relaxation with a test of each pair, bit for bit", () => {
    fc.assert(fc.property(crowd, ({ nodes, edges, options }) => {
      expect(same(relaxForces(nodes, edges, options), relaxEachPair(nodes, edges, options))).toBe(true);
    }), { numRuns: 400 });
  });

  it("gives them for a grid of boxes at the start of the strategy force, with the separation and the sweep", () => {
    // 150 boxes in 13 columns. The forces move them together, so each separation pass moves many pairs.
    const nodes = Array.from({ length: 150 }, (_, i) => box(`n${String(i).padStart(3, "0")}`, (i % 13) * 376, Math.floor(i / 13) * 270, 150 + ((i * 37) % 170), 40 + ((i * 53) % 174)));
    const edges: RelaxEdge[] = nodes.slice(10).map((n, i) => ({ from: n.id, to: `n${String((i * 7) % 10).padStart(3, "0")}`, strength: 0.08 }));
    const options = { ...RELAX_DEFAULTS, iterations: 60, springLength: 240, repulsion: 240 * 240, margin: 56, inset: 0, bound: { width: 13 * 376, height: 12 * 270 } };
    expect(same(relaxForces(nodes, edges, options), relaxEachPair(nodes, edges, options))).toBe(true);
  });

  it("gives them for positions and sizes that are very large, and for boxes with no size and no margin", () => {
    // A very large number gives a grid of one cell. A reach of 0 gives it also.
    const far = [box("a", 1e200, 0, 100, 100), box("b", 1e200, 10, 100, 100), box("c", -1e200, 0, 50, 50), box("d", 3, 4, 100, 100, true), box("e", 20, 30, 100, 100)];
    const wide = [box("a", 0, 0, 1e160, 10), box("b", 5, 5, 10, 10), box("c", 9, 2, 10, 1e160), box("d", 6, 6, 10, 10)];
    const points = [box("a", 5, 5, 0, 0), box("b", 5, 5, 0, 0), box("c", 5, 6, 0, 0), box("d", 5, 5, 0, 0, true)];
    for (const [nodes, margin] of [[far, 12], [wide, 12], [points, 0], [points, 3]] as const) {
      for (const iterations of [0, 3]) {
        const options = { ...RELAX_DEFAULTS, iterations, margin, bound: { width: 1000, height: 600 } };
        expect(same(relaxForces(nodes, [], options), relaxEachPair(nodes, [], options))).toBe(true);
      }
    }
  });

  it("gives an empty result for no boxes", () => {
    expect(relaxForces([], [], { bound: { width: 100, height: 100 } }).size).toBe(0);
    expect(relaxForces([], [], { bound: { width: 100, height: 100 }, theta: 1 }).size).toBe(0);
  });
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
    expect(sorted(relaxForces(nodes, [{ from: "a", to: "a", strength: 0.5 }], { bound }))).toEqual(sorted(relaxForces(nodes, [], { bound })));
    expect(() => relaxForces([...nodes, box("a", 5, 5, 10, 10)], [], { bound })).toThrow(RangeError);
    expect(() => relaxForces(nodes, [{ from: "a", to: "zz", strength: 0.5 }], { bound })).toThrow(/unknown node "zz"/);
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

describe("relaxForces: options and errors", () => {
  const nodes = [box("a", 10, 10, 200, 150), box("b", 40, 30, 120, 90), box("c", 400, 300, 100, 100)];
  const edges: RelaxEdge[] = [{ from: "a", to: "c", strength: 0.08 }];
  const bound = { width: 900, height: 700 };

  it("gives the same positions with the defaults written out", () => {
    expect(sorted(relaxForces(nodes, edges, { bound, ...RELAX_DEFAULTS }))).toEqual(sorted(relaxForces(nodes, edges, { bound })));
    expect(RELAX_DEFAULTS).toMatchObject({ minDistance: 20, centering: 0.005, maxStep: 30, separationPasses: 300, theta: 0 });
  });

  it("uses the options minDistance, centering and maxStep", () => {
    const base = sorted(relaxForces(nodes, edges, { bound }));
    for (const option of [{ minDistance: 200 }, { centering: 0.05 }, { maxStep: 2 }]) expect(sorted(relaxForces(nodes, edges, { bound, ...option }))).not.toEqual(base);
  });

  it("uses the option theta: a far group of boxes repels as one box", () => {
    // The two boxes at the left are a far group for the box `a`: their centers are 2000 left of it, and 1800 and 1200 above.
    // One force step with no other force moves `a` away from them, into the bound.
    const three = [box("a", 2000, 2000, 10, 10), box("b", 0, 200, 10, 10), box("c", 0, 800, 10, 10)];
    const only = { bound: { width: 4000, height: 4000 }, iterations: 1, centering: 0, repulsion: 1e7, maxStep: 1e6, separationPasses: 0 };
    const each = relaxForces(three, [], only), group = relaxForces(three, [], { ...only, theta: MAX_THETA });
    expect(same(relaxForces(three, [], { ...only, theta: 0 }), each)).toBe(true);
    // Each box repels from its center: 1e7 / 7.24e6 along (2000, 1800), and 1e7 / 5.44e6 along (2000, 1200).
    expect((each.get("a") as Point).x).toBeCloseTo(2000 + (2000 * 1e7) / 7.24e6 ** 1.5 + (2000 * 1e7) / 5.44e6 ** 1.5, 9);
    expect((each.get("a") as Point).y).toBeCloseTo(2000 + (1800 * 1e7) / 7.24e6 ** 1.5 + (1200 * 1e7) / 5.44e6 ** 1.5, 9);
    // The group repels as one box of 2 times the repulsion at the mean of the two centers: 2e7 / 6.25e6 along (2000, 1500).
    expect((group.get("a") as Point).x).toBeCloseTo(2002.56, 9);
    expect((group.get("a") as Point).y).toBeCloseTo(2001.92, 9);
    expect(MAX_THETA).toBe(1);
  });

  it("brings the two ends of a spring of strength 0.5 to the spring length in one step, and refuses a larger strength", () => {
    // With no repulsion and no centering, only the spring moves the boxes: each end goes (d - L) * k.
    const two = [box("a", 0, 0, 10, 10), box("b", 1000, 0, 10, 10)];
    const only = { bound: { width: 2000, height: 100 }, iterations: 1, repulsion: 0, centering: 0, springLength: 340 };
    const at = relaxForces(two, [{ from: "a", to: "b", strength: MAX_SPRING_STRENGTH }], only);
    expect((at.get("b") as Point).x - (at.get("a") as Point).x).toBeCloseTo(340, 9);
    expect(() => relaxForces(two, [{ from: "a", to: "b", strength: 0.6 }], only)).toThrow(/0.5 or less/);
  });

  it("throws a RangeError for a value that is not a finite number of 0 or more", () => {
    // Each entry names its case, for the reader.
    const bad: [string, () => unknown][] = [
      ["a width of NaN", () => relaxForces([box("a", 0, 0, Number.NaN, 10)], [], { bound })],
      ["a negative height", () => relaxForces([box("a", 0, 0, 10, -1)], [], { bound })],
      ["a position of Infinity", () => relaxForces([box("a", Infinity, 0, 10, 10)], [], { bound })],
      ["a negative strength", () => relaxForces(nodes, [{ from: "a", to: "b", strength: -0.1 }], { bound })],
      ["a strength of NaN", () => relaxForces(nodes, [{ from: "a", to: "b", strength: Number.NaN }], { bound })],
      ["iterations of 1.5", () => relaxForces(nodes, [], { bound, iterations: 1.5 })],
      ["negative iterations", () => relaxForces(nodes, [], { bound, iterations: -1 })],
      ["a negative margin", () => relaxForces(nodes, [], { bound, margin: -1 })],
      ["a margin of NaN", () => relaxForces(nodes, [], { bound, margin: Number.NaN })],
      ["a minDistance of 0", () => relaxForces(nodes, [], { bound, minDistance: 0 })],
      ["a bound of Infinity", () => relaxForces(nodes, [], { bound: { width: Infinity, height: 10 } })],
      ["a theta of more than 1", () => relaxForces(nodes, [], { bound, theta: 1.01 })],
      ["a negative theta", () => relaxForces(nodes, [], { bound, theta: -0.1 })],
      ["a theta of NaN", () => relaxForces(nodes, [], { bound, theta: Number.NaN })],
    ];
    for (const [, run] of bad) expect(run).toThrow(RangeError);
  });
});

/** The values of the option `theta` of the property tests: each pair, and a far group as one box. */
const thetas = fc.constantFrom(0, 0.5, 1);

describe("relaxForces: properties", () => {
  it("leaves no two boxes nearer than the margin", () => {
    fc.assert(fc.property(scene, thetas, ({ nodes, edges, bound }, theta) => {
      expect(overlaps(nodes, relaxForces(nodes, edges, { bound, theta }))).toEqual([]);
    }), { numRuns: 300 });
  });

  it("gives the same result for each order of the boxes and the springs, and each direction of a spring", () => {
    fc.assert(fc.property(scene, thetas, fc.infiniteStream(fc.boolean()), fc.nat(), ({ nodes, edges, bound }, theta, flips, turn) => {
      const turned = edges.map((e) => (flips.next().value ? { ...e, from: e.to, to: e.from } : e));
      const rotate = <T>(list: readonly T[]): T[] => [...list.slice(turn % Math.max(list.length, 1)), ...list.slice(0, turn % Math.max(list.length, 1))].toReversed();
      expect(sorted(relaxForces(rotate(nodes), rotate(turned), { bound, theta }))).toEqual(sorted(relaxForces(nodes, edges, { bound, theta })));
    }), { numRuns: 100 });
  });

  it("gives the same result for the same input", () => {
    fc.assert(fc.property(scene, thetas, ({ nodes, edges, bound }, theta) => {
      expect(sorted(relaxForces(nodes, edges, { bound, theta }))).toEqual(sorted(relaxForces(nodes, edges, { bound, theta })));
    }), { numRuns: 30 });
  });

  it("keeps each fixed box at its place, and gives a finite place to each box of a crowd, with each theta", () => {
    fc.assert(fc.property(crowd, thetas, ({ nodes, edges, options }, theta) => {
      const at = relaxForces(nodes, edges, { ...options, theta });
      expect([...at.values()].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
      // The relaxation keeps the center of a box. Thus the corner of a fixed box is the corner from its center.
      for (const n of nodes.filter((b) => b.fixed === true)) {
        expect(at.get(n.id)).toEqual({ x: n.rect.x + n.rect.width / 2 - n.rect.width / 2, y: n.rect.y + n.rect.height / 2 - n.rect.height / 2 });
      }
    }), { numRuns: 200 });
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
