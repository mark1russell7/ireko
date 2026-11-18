import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { farField } from "./relax-far.ts";

/** The square of the smallest distance of these tests. It is less than each distance, so it has no effect. */
const FLOOR = 1e-6;
const REPULSION = 1000;

type Force = readonly [number, number];

/** The repulsion on the point `i` from each other point, one pair at a time. It also gives the sum of the sizes of the forces. */
function exact(points: readonly Force[], i: number, masses?: readonly number[]): { force: Force; size: number } {
  const [x, y] = points[i] ?? [0, 0];
  let fx = 0, fy = 0, size = 0;
  points.forEach(([px, py], j) => {
    if (j === i) return;
    const dx = x - px, dy = y - py;
    const d2 = Math.max(FLOOR, dx * dx + dy * dy);
    const f = ((masses?.[j] ?? 1) * REPULSION) / d2;
    fx += (dx / Math.sqrt(d2)) * f;
    fy += (dy / Math.sqrt(d2)) * f;
    size += f;
  });
  return { force: [fx, fy], size };
}

/** The repulsion on the point `i` from the tree of the points. */
function tree(points: readonly Force[], i: number, theta: number): Force {
  const xs = Float64Array.from(points, (p) => p[0]), ys = Float64Array.from(points, (p) => p[1]);
  const far = farField(xs, ys, theta, FLOOR, REPULSION);
  far.build();
  const out = new Float64Array(2);
  const [x, y] = points[i] ?? [0, 0];
  far.sum(i, x, y, out);
  return [out[0] ?? Number.NaN, out[1] ?? Number.NaN];
}

/** 1 to 60 points at different places with whole coordinates. */
const cloud = fc
  .uniqueArray(fc.tuple(fc.integer({ min: -400, max: 400 }), fc.integer({ min: -400, max: 400 })), { minLength: 1, maxLength: 60, selector: ([x, y]) => `${String(x)},${String(y)}` })
  .chain((points) => fc.tuple(fc.constant(points), fc.nat(points.length - 1)));

/**
 * The largest difference between the force of one box of a far cell and the force of the mean, as a part of the force.
 * A far cell of the width s is farther than s / theta. Each box of it is at most s / √2 from its middle, and so is the mean.
 */
const part = (theta: number): number => (2 * Math.SQRT2 * theta * (1 + theta / Math.SQRT2) ** 2) / (1 - theta / Math.SQRT2) ** 3;

/** The largest ratio of the force from the mean of a far cell to the force of one of its boxes. The mean is in the cell. */
const ratio = (theta: number): number => ((1 + theta / Math.SQRT2) / (1 - theta / Math.SQRT2)) ** 2;

describe("farField", () => {
  it("gives no force for no other box", () => {
    expect(tree([[5, 7]], 0, 1)).toEqual([0, 0]);
    const none = farField(new Float64Array(0), new Float64Array(0), 1, FLOOR, REPULSION);
    none.build();
    const out = Float64Array.of(9, 9);
    none.sum(0, 1, 2, out);
    expect([...out]).toEqual([0, 0]);
  });

  it("repels as one box at the mean of a far group, with the sum of its repulsions", () => {
    // The two boxes at the right are in one cell of the width 50, and its middle is 99 from the box at the left.
    // Thus they are one box of 2 times the repulsion at their mean (100, 60).
    const points: Force[] = [[0, 0], [100, 40], [100, 80]];
    const [fx, fy] = tree(points, 0, 1);
    const one = exact([[0, 0], [100, 60]], 0, [1, 2]).force;
    expect(fx).toBeCloseTo(one[0], 12);
    expect(fy).toBeCloseTo(one[1], 12);
    // It is not the sum of the two boxes.
    expect(Math.abs(fx - exact(points, 0).force[0])).toBeGreaterThan(1e-4);
    // With a smaller theta, the cell is not far, and each of its boxes repels.
    const each = exact(points, 0).force;
    expect(tree(points, 0, 0.5)[0]).toBeCloseTo(each[0], 12);
    expect(tree(points, 0, 0.5)[1]).toBeCloseTo(each[1], 12);
    // A box of the group is near the other box of the group, so that box repels it from its own center.
    const near = exact(points, 1).force;
    expect(tree(points, 1, 1)[0]).toBeCloseTo(near[0], 12);
    expect(tree(points, 1, 1)[1]).toBeCloseTo(near[1], 12);
  });

  it("gives the force of a near box from its center to a box at the corner of its cells, with a theta of 1", () => {
    // The first two boxes are in the same cells down to a small cell, and the first box is at a corner of each cell.
    // No such cell is far from it. If one were, the first box would repel itself.
    const points: Force[] = [[0, 0], [1, 0], [1000, 1000]];
    const [fx, fy] = tree(points, 0, 1);
    const want = exact(points, 0).force;
    expect(fx).toBeCloseTo(want[0], 9);
    expect(fy).toBeCloseTo(want[1], 9);
  });

  it("gives the sum of each pair for a very small theta", () => {
    fc.assert(fc.property(cloud, ([points, i]) => {
      const [fx, fy] = tree(points, i, 1e-9);
      const want = exact(points, i);
      expect(Math.abs(fx - want.force[0])).toBeLessThanOrEqual(1e-9 * want.size);
      expect(Math.abs(fy - want.force[1])).toBeLessThanOrEqual(1e-9 * want.size);
    }), { numRuns: 300 });
  });

  it("stays near the sum of each pair, by a limit that decreases with theta", () => {
    fc.assert(fc.property(cloud, fc.constantFrom(0.02, 0.05, 0.1), ([points, i], theta) => {
      const [fx, fy] = tree(points, i, theta);
      const want = exact(points, i);
      expect(Math.hypot(fx - want.force[0], fy - want.force[1])).toBeLessThanOrEqual(part(theta) * want.size + 1e-9);
    }), { numRuns: 300 });
  });

  it("keeps the force of each far group below a limit, for each theta to 1", () => {
    fc.assert(fc.property(cloud, fc.constantFrom(0.3, 0.7, 1), ([points, i], theta) => {
      const [fx, fy] = tree(points, i, theta);
      expect(Number.isFinite(fx) && Number.isFinite(fy)).toBe(true);
      expect(Math.hypot(fx, fy)).toBeLessThanOrEqual(exact(points, i).size * ratio(theta) + 1e-9);
    }), { numRuns: 300 });
  });

  it("keeps the boxes at one place in one cell, and each of them repels the others", () => {
    // 5 boxes at the same place, and one box apart. The tree stops at its deepest level.
    const points: Force[] = [[10, 10], [10, 10], [10, 10], [10, 10], [10, 10], [500, 300]];
    for (const i of [0, 4, 5]) {
      const [fx, fy] = tree(points, i, 1e-9);
      const want = exact(points, i);
      expect(fx).toBeCloseTo(want.force[0], 6);
      expect(fy).toBeCloseTo(want.force[1], 6);
    }
  });

  it("makes more cells than its first room for boxes that are very near", () => {
    // Each pair of near boxes needs a line of cells down to the size of its distance.
    const points: Force[] = [[0, 0], [1e-4, 1e-4], [1000, 1000], [1000 - 1e-4, 1000 - 1e-4], [0, 1000], [1e-4, 1000 - 1e-4], [1000, 0]];
    for (let i = 0; i < points.length; i++) {
      const [fx, fy] = tree(points, i, 1e-9);
      const want = exact(points, i);
      expect(Math.abs(fx - want.force[0])).toBeLessThanOrEqual(1e-9 * want.size);
      expect(Math.abs(fy - want.force[1])).toBeLessThanOrEqual(1e-9 * want.size);
    }
  });

  it("reads a near box at its place of the time of the sum, and a far group at its mean of the time of the tree", () => {
    const xs = Float64Array.of(0, 100, 100, 3), ys = Float64Array.of(0, -1, 1, 4);
    const far = farField(xs, ys, 1, FLOOR, REPULSION);
    far.build();
    const before = new Float64Array(2), after = new Float64Array(2);
    far.sum(0, 0, 0, before);
    // The far group moves: the sum does not change. The near box moves: the sum changes.
    xs[1] = 200;
    xs[2] = 200;
    far.sum(0, 0, 0, after);
    expect([...after]).toEqual([...before]);
    xs[3] = 30;
    far.sum(0, 0, 0, after);
    expect(after[0]).not.toBe(before[0]);
    // A new tree reads the new places.
    far.build();
    far.sum(0, 0, 0, after);
    const want = exact([[0, 0], [200, 0], [30, 4]], 0, [1, 2, 1]).force;
    expect(after[0]).toBeCloseTo(want[0], 12);
    expect(after[1]).toBeCloseTo(want[1], 12);
  });

  it("gives the same sums for the same centers", () => {
    fc.assert(fc.property(cloud, fc.constantFrom(0.5, 1), ([points, i], theta) => {
      expect(tree(points, i, theta)).toEqual(tree(points, i, theta));
    }), { numRuns: 50 });
  });
});
