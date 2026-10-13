import { describe, expect, expectTypeOf, it } from "vitest";
import { builder, grid, node, radial, type BuildOptions } from "./build.ts";
import { layout } from "./engine.ts";
import type { GridOptions } from "./strategies/grid.ts";

describe("builder", () => {
  it("makes linked nodes and nested containers, with leaves from strings", () => {
    expect(grid("r", "a", node("b", { label: "B" }))).toEqual({ id: "r", layout: "grid", mode: "linked", children: [{ id: "a" }, { id: "b", label: "B" }] });
    expect(radial.nested("r", "a")).toEqual({ id: "r", layout: "radial", mode: "nested", children: [{ id: "a" }] });
  });

  it("splits the options of the strategy from the options of the node", () => {
    // A JavaScript caller can give undefined for an option. The builder skips it.
    const options = { columns: 2, gap: 4, label: "Root", size: { width: 300 }, fit: "scale", data: 1, side: undefined } as unknown as BuildOptions<GridOptions>;
    const spec = grid.nested("r", options, "a", "b");
    expect(spec).toEqual({ id: "r", label: "Root", size: { width: 300 }, fit: "scale", data: 1, layout: { type: "grid", columns: 2, gap: 4 }, mode: "nested", children: [{ id: "a" }, { id: "b" }] });
  });

  it("makes a builder for a registered strategy", () => {
    const fan = builder<{ spread: number }>("fan");
    expect(fan("r", { spread: 3 }, "x")).toEqual({ id: "r", layout: { type: "fan", spread: 3 }, mode: "linked", children: [{ id: "x" }] });
    expectTypeOf(fan).toBeCallableWith("r", { spread: 3 }, "x");
  });

  it("gives specs that the engine lays out", () => {
    const out = layout({ root: grid("root", { columns: 3 }, radial.nested("api", "auth", "users"), grid("web", "home")) });
    expect(out.issues).toEqual([]);
    expect(out.nodes).toHaveLength(6);
  });

  it("types the options of each strategy", () => {
    // @ts-expect-error The grid strategy has no option "sweep".
    grid("r", { sweep: 90 }, "a");
    // @ts-expect-error The option "columns" is a number.
    grid("r", { columns: "two" }, "a");
    expectTypeOf(radial).toBeCallableWith("r", { sweep: 90, clockwise: false }, "a");
  });
});
