import { describe, expect, it } from "vitest";
import type { Issue, PlacedNode } from "../model.ts";
import { audit } from "./audit.ts";
import { normalize } from "./normalize.ts";
import { measure } from "./measure.ts";
import { createEngine } from "../engine.ts";
import type { Context } from "./types.ts";
import { straight } from "../routers.ts";

const engine = createEngine();
const ctx: Context = {
  strategies: engine.strategies,
  limits: engine.limits,
  options: { spacing: 24, nodeSize: { width: 120, height: 48 }, header: 0, router: straight, treeEdges: "linked", origin: { x: 0, y: 0 }, measure: undefined, audit: true, strict: false, trace: undefined },
};

const box = (id: string, x: number, y: number, w: number, h: number, extra: Partial<PlacedNode> = {}): PlacedNode => ({
  id, label: id, x, y, width: w, height: h, depth: 0, mode: "linked", layout: "grid", scale: 1, clip: false, childCount: 0, ...extra,
});

/** This function starts the audit on placed boxes that a test makes by hand. */
function run(root: { id: string; children?: { id: string }[]; mode?: "nested" | "linked"; fit?: "clip" }, nodes: PlacedNode[], container: number[]): Issue[] {
  const issues: Issue[] = [];
  const norm = normalize({ root }, ctx, issues);
  const m = measure(norm, ctx, issues);
  const found: Issue[] = [];
  audit(norm, m, { nodes, container }, ctx, found);
  return found;
}

describe("audit (on boxes made by hand)", () => {
  it("finds a child outside its container", () => {
    const issues = run({ id: "p", mode: "nested", children: [{ id: "a" }] }, [box("p", 0, 0, 100, 100, { mode: "nested", childCount: 1 }), box("a", 90, 90, 50, 50, { parent: "p", container: "p", depth: 1 })], [-1, 0]);
    expect(issues.map((i) => i.code)).toEqual(["ESCAPE"]);
  });

  it("accepts a child outside a clipped container, and counts only its visible part", () => {
    const issues = run(
      { id: "p", mode: "nested", fit: "clip", children: [{ id: "a" }, { id: "b" }] },
      [
        box("p", 0, 0, 100, 100, { mode: "nested", clip: true, childCount: 2 }),
        box("a", 150, 0, 50, 50, { parent: "p", container: "p", depth: 1 }),
        box("b", 160, 10, 50, 50, { parent: "p", container: "p", depth: 1 }),
      ],
      [-1, 0, 0],
    );
    // a and b overlap, but both are outside the visible area of p.
    expect(issues).toEqual([]);
  });

  it("finds an overlap between the visible parts of two clipped boxes", () => {
    const issues = run(
      { id: "p", mode: "nested", fit: "clip", children: [{ id: "a" }, { id: "b" }] },
      [
        box("p", 0, 0, 100, 100, { mode: "nested", clip: true, childCount: 2 }),
        box("a", 80, 0, 50, 50, { parent: "p", container: "p", depth: 1 }),
        box("b", 90, 10, 50, 50, { parent: "p", container: "p", depth: 1 }),
      ],
      [-1, 0, 0],
    );
    expect(issues.map((i) => i.code)).toEqual(["OVERLAP"]);
  });

  it("accepts a container over its own children and grandchildren", () => {
    const issues = run(
      { id: "p", mode: "nested", children: [{ id: "a" }] },
      [box("p", 0, 0, 100, 100, { mode: "nested", childCount: 1 }), box("a", 10, 10, 50, 50, { parent: "p", container: "p", depth: 1 })],
      [-1, 0],
    );
    expect(issues).toEqual([]);
  });
});
