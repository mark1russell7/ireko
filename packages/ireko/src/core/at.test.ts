import { describe, expect, it } from "vitest";
import { at, atKey } from "./at.ts";

describe("at", () => {
  it("gives the item, or throws for a missing item", () => {
    expect(at([1, 2], 1)).toBe(2);
    expect(() => at([1], 4)).toThrow(RangeError);
    expect(atKey(new Map([["a", 1]]), "a")).toBe(1);
    expect(() => atKey(new Map<string, number>(), "b")).toThrow(RangeError);
  });
});
