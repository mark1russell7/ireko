import { describe, expect, it } from "vitest";
import { boxShape, joinShapes, mergeBands, moveShape } from "./shape.ts";

describe("shapes", () => {
  it("gives a box one band on each axis, and moves it", () => {
    expect(boxShape({ width: 10, height: 4 })).toEqual({ rows: [{ from: 0, to: 4, min: 0, max: 10 }], columns: [{ from: 0, to: 10, min: 0, max: 4 }] });
    expect(moveShape(boxShape({ width: 10, height: 4 }), 5, 7).rows).toEqual([{ from: 7, to: 11, min: 5, max: 15 }]);
  });

  it("merges overlapping bands, keeps gaps, and joins equal neighbors", () => {
    const bands = mergeBands([
      { from: 0, to: 10, min: 0, max: 5 },
      { from: 5, to: 15, min: 3, max: 9 },
      { from: 20, to: 30, min: 1, max: 2 },
      { from: 30, to: 40, min: 1, max: 2 },
    ]);
    expect(bands).toEqual([
      { from: 0, to: 5, min: 0, max: 5 },
      { from: 5, to: 10, min: 0, max: 9 },
      { from: 10, to: 15, min: 3, max: 9 },
      { from: 20, to: 40, min: 1, max: 2 },
    ]);
    expect(mergeBands([])).toEqual([]);
    expect(mergeBands([{ from: 3, to: 3, min: 0, max: 1 }])).toEqual([]);
  });

  it("joins neighbor bands until the limit, and a joined band covers each band", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ from: i * 2, to: i * 2 + 1, min: i, max: i + 1 }));
    const few = mergeBands(many, 16);
    expect(few.length).toBeLessThanOrEqual(16);
    for (const b of many) {
      const holder = few.find((f) => f.from <= b.from && f.to >= b.to);
      expect(holder).toBeDefined();
      expect(holder?.min).toBeLessThanOrEqual(b.min);
      expect(holder?.max).toBeGreaterThanOrEqual(b.max);
    }
  });

  it("joins the shapes of two boxes", () => {
    const joined = joinShapes([boxShape({ width: 10, height: 10 }), moveShape(boxShape({ width: 10, height: 10 }), 20, 5)]);
    expect(joined.rows).toEqual([
      { from: 0, to: 5, min: 0, max: 10 },
      { from: 5, to: 10, min: 0, max: 30 },
      { from: 10, to: 15, min: 20, max: 30 },
    ]);
  });
});
