import { describe, expect, it } from "vitest";
import { NOT_MEASURED, sizeText } from "./size.ts";
import { PAGES_WITH_A_SIZE, parseSizes, sizeStamps, STUDIES } from "./size-stamps.ts";

describe("sizeText", () => {
  it("gives the size in kB", () => {
    expect(sizeText("ireko: layout", { sizes: { "ireko: layout": 17337 } })).toBe("17.3 kB");
  });

  it("says so when the build measured nothing", () => {
    expect(sizeText("ireko: layout", undefined)).toBe(NOT_MEASURED);
  });

  it("stops the build on a name that the file does not have", () => {
    expect(() => sizeText("gone", { sizes: {} })).toThrow('no size "gone"');
  });
});

describe("parseSizes", () => {
  it("reads the output of size-limit", () => {
    expect(parseSizes('[{"name":"a","passed":true,"size":100},{"name":"b","passed":false,"size":200}]')).toEqual({ sizes: { a: 100, b: 200 } });
  });

  it("stops the build on output with no size", () => {
    expect(() => parseSizes("[]")).toThrow("no size");
    expect(() => parseSizes('[{"name":"a","size":0}]')).toThrow("no size for a");
  });
});

describe("sizeStamps", () => {
  const run = { id: "7", url: "https://example.com/7", date: "2026-11-05T00:00:00Z", engines: { ireko: "0.1.5" } };

  it("names the run of the build for each page with a size, and each fixed study", () => {
    const { schema, pages } = sizeStamps(run);
    expect(schema).toBe("data-stamp/1");
    expect(pages.filter((page) => page.study !== true).map((page) => page.page)).toEqual(PAGES_WITH_A_SIZE);
    expect(pages.filter((page) => page.study !== true).every((page) => page.runs[0] === run)).toBe(true);
    expect(pages.filter((page) => page.study === true)).toEqual(STUDIES);
  });
});
