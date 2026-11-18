import { describe, expect, it } from "vitest";
import { flag, int, num } from "./typed.ts";

describe("the reads of the lists of numbers", () => {
  it("gives the value at an index of each kind of list", () => {
    expect(num(Float64Array.of(1.5, -0, Number.NaN), 0)).toBe(1.5);
    expect(Object.is(num(Float64Array.of(1.5, -0, Number.NaN), 1), -0)).toBe(true);
    expect(num(Float64Array.of(1.5, -0, Number.NaN), 2)).toBeNaN();
    expect(int(Int32Array.of(7, -3), 1)).toBe(-3);
    expect(flag(Uint8Array.of(0, 1, 9), 0)).toBe(false);
    expect(flag(Uint8Array.of(0, 1, 9), 1)).toBe(true);
    expect(flag(Uint8Array.of(0, 1, 9), 2)).toBe(true);
  });

  it("throws a RangeError for an index with no value", () => {
    expect(() => num(new Float64Array(2), 2)).toThrow(/no number at the index 2/);
    expect(() => int(new Int32Array(2), -1)).toThrow(/no integer at the index -1/);
    expect(() => flag(new Uint8Array(0), 0)).toThrow(RangeError);
  });
});
