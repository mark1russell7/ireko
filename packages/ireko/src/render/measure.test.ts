// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateWidth } from "../core/text.ts";
import { widthOfCanvas } from "./measure.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the width of a text from a canvas", () => {
  it("uses the canvas of OffscreenCanvas, and remembers each width", () => {
    const measureText = vi.fn<(text: string) => { width: number }>((text) => ({ width: text.length * 7 }));
    const ctx = { font: "", measureText };
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return ctx;
        }
      },
    );
    const widthOf = widthOfCanvas("Inter");
    expect(widthOf("abc", 13)).toBe(21);
    expect(widthOf("abc", 13)).toBe(21);
    expect(ctx.font).toBe("13px Inter");
    expect(measureText).toHaveBeenCalledTimes(1);
  });

  it("uses a canvas element of the document without OffscreenCanvas", () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    const ctx = { font: "", measureText: (text: string) => ({ width: text.length * 5 }) };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    expect(widthOfCanvas("serif")("abcd", 10)).toBe(20);
  });

  it("gives the estimate without a canvas", () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(widthOfCanvas("serif")("abcd", 10)).toBe(estimateWidth("abcd", 10));
    vi.stubGlobal("document", undefined);
    expect(widthOfCanvas("serif")("ab", 10)).toBe(estimateWidth("ab", 10));
  });
});
