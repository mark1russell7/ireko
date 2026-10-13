import { describe, expect, it } from "vitest";
import { centerOf, clean, contains, EMPTY_RECT, farthestCorner, inflate, overlaps, rectAt, round3, translate, union, unionAll } from "./geometry.ts";
import { borderPoint, nestedPair } from "./router.ts";
import { orthogonal, straight } from "./routers.ts";

const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe("geometry", () => {
  it("makes, moves and grows rectangles", () => {
    expect(rectAt({ x: 1, y: 2 }, { width: 3, height: 4 })).toEqual(r(1, 2, 3, 4));
    expect(centerOf(r(0, 0, 10, 20))).toEqual({ x: 5, y: 10 });
    expect(translate(r(1, 1, 2, 2), 3, -1)).toEqual(r(4, 0, 2, 2));
    expect(inflate(r(10, 10, 10, 10), 2)).toEqual(r(8, 8, 14, 14));
  });

  it("gives the union of rectangles", () => {
    expect(union(r(0, 0, 10, 10), r(5, -5, 10, 10))).toEqual(r(0, -5, 15, 15));
    expect(unionAll([])).toBe(EMPTY_RECT);
    expect(unionAll([r(1, 1, 1, 1), r(3, 3, 1, 1)])).toEqual(r(1, 1, 3, 3));
  });

  it("tells overlap and containment, with a tolerance", () => {
    expect(overlaps(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(false);
    expect(overlaps(r(0, 0, 10, 10), r(9, 0, 10, 10))).toBe(true);
    expect(overlaps(r(0, 0, 10, 10), r(9, 0, 10, 10), 1)).toBe(false);
    expect(contains(r(0, 0, 10, 10), r(2, 2, 8, 8))).toBe(true);
    expect(contains(r(0, 0, 10, 10), r(2, 2, 9, 8))).toBe(false);
    expect(contains(r(0, 0, 10, 10), r(2, 2, 9, 8), 1)).toBe(true);
  });

  it("gives the farthest corner", () => {
    expect(farthestCorner({ x: 0, y: 0 }, r(-3, -4, 3, 4))).toBe(5);
  });

  it("rounds and cleans numbers", () => {
    expect(round3(1.23456)).toBe(1.235);
    expect(Object.is(round3(-0.0001), 0)).toBe(true);
    expect(Object.is(clean(-0), 0)).toBe(true);
    expect(clean(2.5)).toBe(2.5);
  });
});

describe("routers", () => {
  const a = r(0, 0, 100, 50);

  it("finds the point on the edge of a box", () => {
    expect(borderPoint(a, { x: 50, y: 500 })).toEqual({ x: 50, y: 50 });
    expect(borderPoint(a, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(borderPoint(a, { x: 50, y: 25 })).toEqual({ x: 50, y: 25 });
    expect(nestedPair(a, r(10, 10, 5, 5))).toBe(true);
  });

  it("straight: one segment between the edges, or between the centers of nested boxes", () => {
    expect(straight.route({ id: "e", kind: "tree", source: a, target: r(0, 200, 100, 50) })).toEqual([{ x: 50, y: 50 }, { x: 50, y: 200 }]);
    expect(straight.route({ id: "e", kind: "tree", source: a, target: r(10, 10, 20, 20) })).toEqual([{ x: 50, y: 25 }, { x: 20, y: 20 }]);
  });

  it("orthogonal: turns at the middle of a vertical gap", () => {
    expect(orthogonal.route({ id: "e", kind: "tree", source: a, target: r(100, 250, 100, 50) })).toEqual([
      { x: 50, y: 50 }, { x: 50, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 250 },
    ]);
    expect(orthogonal.route({ id: "e", kind: "tree", source: r(100, 250, 100, 50), target: a })).toEqual([
      { x: 150, y: 250 }, { x: 150, y: 150 }, { x: 50, y: 150 }, { x: 50, y: 50 },
    ]);
  });

  it("orthogonal: turns at the middle of a horizontal gap", () => {
    expect(orthogonal.route({ id: "e", kind: "tree", source: a, target: r(300, 60, 100, 50) })).toEqual([
      { x: 100, y: 25 }, { x: 200, y: 25 }, { x: 200, y: 85 }, { x: 300, y: 85 },
    ]);
    expect(orthogonal.route({ id: "e", kind: "tree", source: r(300, 60, 100, 50), target: a })).toEqual([
      { x: 300, y: 85 }, { x: 200, y: 85 }, { x: 200, y: 25 }, { x: 100, y: 25 },
    ]);
  });

  it("orthogonal: one segment for aligned boxes, and straight for boxes without a gap", () => {
    expect(orthogonal.route({ id: "e", kind: "tree", source: a, target: r(0, 200, 100, 50) })).toEqual([{ x: 50, y: 50 }, { x: 50, y: 200 }]);
    expect(orthogonal.route({ id: "e", kind: "tree", source: a, target: r(300, 0, 100, 50) })).toEqual([{ x: 100, y: 25 }, { x: 300, y: 25 }]);
    const overlapV = orthogonal.route({ id: "e", kind: "tree", source: a, target: r(60, 40, 100, 300) });
    expect(overlapV).toHaveLength(2);
    const overlapH = orthogonal.route({ id: "e", kind: "tree", source: a, target: r(90, 0, 300, 60) });
    expect(overlapH).toHaveLength(2);
    expect(orthogonal.route({ id: "e", kind: "tree", source: a, target: r(10, 10, 5, 5) })).toEqual([{ x: 50, y: 25 }, { x: 12.5, y: 12.5 }]);
  });
});
