import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("the entry", () => {
  it("gives the scenes and the report", () => {
    expect(Object.keys(entry).toSorted()).toEqual(["ARMS", "CASES", "MINIMUM_CASES", "PICTURE", "THETA", "caseOf", "hashLines", "markdown", "report", "sceneOf"]);
  });
});
