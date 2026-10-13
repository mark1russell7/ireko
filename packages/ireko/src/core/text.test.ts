import { describe, expect, it } from "vitest";
import { layout } from "./engine.ts";
import { estimateWidth, fitText } from "./text.ts";

describe("boxes that fit their labels", () => {
  it("estimates the width of a text from the widths of its characters", () => {
    expect(estimateWidth("", 13)).toBe(0);
    expect(estimateWidth("ill", 10)).toBeLessThan(estimateWidth("mmm", 10));
    expect(estimateWidth("ABC", 10)).toBeGreaterThan(estimateWidth("abc", 10));
    expect(estimateWidth("Operations", 13)).toBeGreaterThan(55);
    expect(estimateWidth("Operations", 13)).toBeLessThan(75);
    // A space, digits, brackets and a wide script.
    expect(estimateWidth(" 12(x)入", 10)).toBeCloseTo(2.8 + 11.2 + 7.2 + 5.2 + 10, 6);
    expect(estimateWidth("é", 10)).toBeCloseTo(6, 6);
  });

  it("gives each box the size of its label, with the padding and the smallest size", () => {
    const measure = fitText({ fontSize: 10, padding: { x: 5, y: 2 }, minWidth: 30, widthOf: (text) => text.length * 10 });
    expect(measure({ id: "a" })).toEqual({ width: 30, height: 17 });
    expect(measure({ id: "a", label: "long label" })).toEqual({ width: 110, height: 17 });
    expect(fitText({ minHeight: 50 })({ id: "x" }).height).toBe(50);
    expect(fitText()({ id: "abc" })).toEqual({ width: Math.ceil(estimateWidth("abc", 13) + 24), height: Math.ceil(13 * 1.3 + 16) });
  });

  it("makes the boxes of a layout as wide as their labels", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }, { id: "b", label: "A much longer label" }] } }, { measure: fitText() });
    const a = out.nodes.find((n) => n.id === "a");
    const b = out.nodes.find((n) => n.id === "b");
    expect(b?.width).toBeGreaterThan((a?.width ?? 0) * 3);
    expect(out.issues).toEqual([]);
  });
});
