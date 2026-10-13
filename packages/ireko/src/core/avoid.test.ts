import { describe, expect, it } from "vitest";
import { crossingsOf } from "../test/invariants.ts";
import { avoid } from "./avoid.ts";
import { createEngine, layout } from "./engine.ts";
import { examples } from "../examples/index.ts";
import type { Point, Rect } from "./geometry.ts";
import { defineRouter } from "./router.ts";
import { orthogonal } from "./routers.ts";

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** This function tells if a route crosses the inside of a box. */
function crosses(points: readonly Point[], b: Rect): boolean {
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (p === undefined || q === undefined) continue;
    for (let t = 0; t <= 50; t++) {
      const x = p.x + ((q.x - p.x) * t) / 50;
      const y = p.y + ((q.y - p.y) * t) / 50;
      if (x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height) return true;
    }
  }
  return false;
}

/** This function tells if a point is on the border of a box. */
const onBorder = (p: Point | undefined, b: Rect): boolean => p !== undefined && (p.x === b.x || p.x === b.x + b.width || p.y === b.y || p.y === b.y + b.height);

/** This function tells if each segment of a route is horizontal or vertical. */
const orthogonalOnly = (points: readonly Point[]): boolean => points.every((p, i) => i === 0 || p.x === points[i - 1]?.x || p.y === points[i - 1]?.y);

describe("the router avoid", () => {
  const source = r(0, 0, 100, 50);
  const target = r(400, 0, 100, 50);
  const wall = r(200, -40, 60, 130);

  it("goes around a box between the two ends, with horizontal and vertical segments", () => {
    const direct = orthogonal.route({ id: "e", kind: "extra", source, target });
    expect(crosses(direct, wall)).toBe(true);
    const points = avoid.route({ id: "e", kind: "extra", source, target, obstacles: [wall] });
    expect(crosses(points, wall)).toBe(false);
    expect(orthogonalOnly(points)).toBe(true);
    // The route starts on the border of the source and ends on the border of the target.
    expect(onBorder(points[0], source)).toBe(true);
    expect(onBorder(points.at(-1), target)).toBe(true);
  });

  it("starts and ends on the sides of a direction", () => {
    const child = r(300, 200, 100, 50);
    const points = avoid.route({ id: "e", kind: "tree", source, target: child, direction: "down", obstacles: [r(130, 100, 60, 60)] });
    expect(points[0]).toEqual({ x: 50, y: 50 });
    expect(points.at(-1)).toEqual({ x: 350, y: 200 });
    expect(orthogonalOnly(points)).toBe(true);
  });

  it("is one straight segment between two aligned boxes, and joins the centers of nested boxes", () => {
    expect(avoid.route({ id: "e", kind: "extra", source, target, obstacles: [] })).toEqual([{ x: 100, y: 25 }, { x: 400, y: 25 }]);
    expect(avoid.route({ id: "e", kind: "extra", source: r(0, 0, 200, 200), target: r(50, 50, 20, 20) })).toEqual([{ x: 100, y: 100 }, { x: 60, y: 60 }]);
  });

  it("gives the orthogonal route when the boxes around the target leave no way to it", () => {
    const cage = [r(330, -60, 240, 40), r(330, 80, 240, 40), r(330, -60, 40, 180), r(530, -60, 40, 180)];
    const input = { id: "e", kind: "extra" as const, source, target, obstacles: cage };
    expect(avoid.route(input)).toEqual(orthogonal.route(input));
  });

  it("gives each obstacle only to a router that asks, without the ends and their containers", () => {
    const seen: string[][] = [];
    const spy = defineRouter({
      type: "spy",
      description: "A test router.",
      obstacles: true,
      route: (input) => {
        seen.push((input.obstacles ?? []).map((o) => `${String(o.x)},${String(o.y)}`));
        return [input.source, input.target];
      },
    });
    const engine = createEngine({ routers: [spy] });
    const out = engine.layout(
      { root: { id: "r", mode: "nested", children: [{ id: "g", mode: "nested", children: [{ id: "a" }, { id: "b" }] }, { id: "c" }] }, edges: [{ source: "a", target: "c" }] },
      { router: "spy", treeEdges: "none" },
    );
    const at = (id: string) => {
      const n = out.nodes.find((x) => x.id === id);
      return `${String(n?.x)},${String(n?.y)}`;
    };
    // The obstacles of a -> c: the box b, and the labels of g and r. Not a and c (the ends), and not the boxes of g and r
    // (they hold an end): the edge goes inside them.
    const label = (id: string) => {
      const n = out.nodes.find((x) => x.id === id);
      return `${String((n?.x ?? 0) + 4)},${String((n?.y ?? 0) + 2)}`;
    };
    expect(seen).toEqual([[at("b"), label("r"), label("g")]]);
    expect(layout({ root: { id: "r", children: [{ id: "a" }] } }, { router: "orthogonal" }).edges).toHaveLength(1);
  });

  it("draws the edges of the architecture example around the containers", () => {
    const example = examples.find((e) => e.name === "architecture");
    if (example === undefined) throw new Error("no example");
    expect(crossingsOf(layout(example.input, { ...example.options, router: "orthogonal" })).length).toBeGreaterThan(0);
    const out = layout(example.input, { ...example.options, router: "avoid" });
    expect(out.issues).toEqual([]);
    expect(crossingsOf(out)).toEqual([]);
  });
});
