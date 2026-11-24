import { cornersRouter, getStrategy, STRATEGIES } from "@mark1russell7/highways";
import { describe, expect, it } from "vitest";
import { createEngine, layout } from "./engine.ts";
import type { Point, Rect } from "./geometry.ts";
import type { Layout, LayoutInput } from "./model.ts";
import type { GraphRouter, GraphRouterInput } from "./router.ts";

/** Three boxes in one row. The straight edge from `a` to `c` goes through `b`. */
const ROW: LayoutInput = {
  root: { id: "root", mode: "nested", layout: { type: "grid", columns: 3 }, children: [{ id: "a" }, { id: "b" }, { id: "c" }] },
  edges: [{ id: "a-c", source: "a", target: "c" }],
};

const box = (out: Layout, id: string): Rect => {
  const n = out.nodes.find((x) => x.id === id);
  if (n === undefined) throw new Error(`no node ${id}`);
  return n;
};
const edge = (out: Layout, id: string) => {
  const e = out.edges.find((x) => x.id === id);
  if (e === undefined) throw new Error(`no edge ${id}`);
  return e;
};

/** This function tells if the segment from `p` to `q` goes into the inside of `r`. It samples the segment. */
function crosses(p: Point, q: Point, r: Rect): boolean {
  for (let k = 1; k < 100; k++) {
    const x = p.x + ((q.x - p.x) * k) / 100;
    const y = p.y + ((q.y - p.y) * k) / 100;
    if (x > r.x + 0.5 && x < r.x + r.width - 0.5 && y > r.y + 0.5 && y < r.y + r.height - 0.5) return true;
  }
  return false;
}
const routeCrosses = (points: readonly Point[], r: Rect): boolean => points.slice(1).some((q, i) => crosses(points[i] ?? q, q, r));

/** A fake graph router. It gives each edge the route of `points`, and the boxes of `through`. */
function fake(points: (id: string) => readonly Point[], through: readonly string[] = []): GraphRouter & { readonly seen: GraphRouterInput[] } {
  const seen: GraphRouterInput[] = [];
  return {
    name: "fake",
    seen,
    route(input) {
      seen.push(input);
      return { routes: input.edges.map((e) => ({ edge: e.id, points: points(e.id), ...(through.length > 0 ? { through } : {}) })) };
    },
  };
}

describe("the option graphRouter", () => {
  it("routes around a box that the straight router goes through, with the router corners of highways", () => {
    const plain = layout(ROW);
    expect(routeCrosses(edge(plain, "a-c").points, box(plain, "b"))).toBe(true);

    const corners = cornersRouter({ name: "corners", plug: getStrategy(STRATEGIES, "plugs", "spread"), plugOptions: { plugGap: 6 } });
    const out = layout(ROW, { graphRouter: corners });
    expect(out.issues).toEqual([]);
    expect(out.nodes).toEqual(plain.nodes);
    const points = edge(out, "a-c").points;
    expect(points.length).toBeGreaterThan(2);
    for (const id of ["a", "b", "c"]) expect(routeCrosses(points, box(out, id))).toBe(false);
  });

  it("gives the router each box but the nested root, and the edges between boxes that do not hold each other", () => {
    const router = fake(() => [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    layout(
      {
        root: { id: "root", mode: "nested", children: [{ id: "C", mode: "nested", children: [{ id: "a" }] }, { id: "d" }] },
        edges: [
          { id: "a-d", source: "a", target: "d" },
          { id: "C-a", source: "C", target: "a" },
        ],
      },
      { graphRouter: router, treeEdges: "all" },
    );
    const input = router.seen[0];
    expect(input?.nodes.map((n) => [n.id, n.parent])).toEqual([
      ["C", undefined],
      ["a", "C"],
      ["d", undefined],
    ]);
    expect(input?.edges.map((e) => e.id)).toEqual(["a-d"]);
    expect(input?.nodes[0]?.box).toEqual({ x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) });
  });

  it("keeps the route of an edge between a container and a box inside it", () => {
    const input: LayoutInput = { root: { id: "root", children: [{ id: "C", mode: "nested", children: [{ id: "a" }] }] } };
    const plain = layout(input, { treeEdges: "all" });
    const out = layout(input, { treeEdges: "all", graphRouter: fake(() => [{ x: 5, y: 5 }, { x: 6, y: 6 }]) });
    expect(edge(out, "C->a").points).toEqual(edge(plain, "C->a").points);
    expect(edge(out, "root->C").points).toEqual([{ x: 5, y: 5 }, { x: 6, y: 6 }]);
  });

  it("grows the bounds to hold each new route", () => {
    const plain = layout(ROW);
    const out = layout(ROW, {
      graphRouter: fake(() => [
        { x: -50, y: -40 },
        { x: 1000, y: 900 },
      ]),
    });
    expect(edge(out, "a-c").points).toEqual([
      { x: -50, y: -40 },
      { x: 1000, y: 900 },
    ]);
    expect(out.bounds).toEqual({ x: -50, y: -40, width: 1050, height: 940 });
    expect(out.bounds.width).toBeGreaterThan(plain.bounds.width);
  });

  it("reports a route that goes through a box, but not through its ends or the containers that hold them", () => {
    const input: LayoutInput = {
      root: { id: "root", children: [{ id: "C", mode: "nested", children: [{ id: "a" }] }, { id: "b" }, { id: "d" }] },
      edges: [{ id: "a-d", source: "a", target: "d" }],
    };
    const through = ["C", "a", "b", "d"];
    const out = layout(input, { treeEdges: "none", strict: true, graphRouter: fake(() => [{ x: 0, y: 0 }, { x: 9, y: 9 }], through) });
    expect(out.issues).toEqual([
      { code: "EDGE_THROUGH_BOX", severity: "warning", message: 'The edge "a-d" goes through the boxes "b".', edge: "a-d", detail: { boxes: ["b"], router: "fake" } },
    ]);
  });

  it("keeps the route of the router of the layout when the graph router fails", () => {
    const plain = layout(ROW);
    const throws: GraphRouter = {
      route() {
        throw new Error("no way");
      },
    };
    const out = layout(ROW, { graphRouter: throws });
    expect(out.edges).toEqual(plain.edges);
    expect(out.issues.map((i) => [i.code, i.message])).toEqual([["ROUTER_FAILED", 'The graph router "graph" threw: no way The edge keeps its first route.']]);
    const text: GraphRouter = {
      route() {
        // oxlint-disable-next-line no-throw-literal -- The test throws a value that is not an error on purpose.
        throw "no route";
      },
    };
    expect(layout(ROW, { graphRouter: text }).issues.map((i) => i.message)).toEqual(['The graph router "graph" threw: no route The edge keeps its first route.']);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test gives a bad result on purpose.
    const noList = { name: "bad", route: () => ({ routes: "none" }) } as unknown as GraphRouter;
    expect(layout(ROW, { graphRouter: noList }).issues.map((i) => i.code)).toEqual(["ROUTER_FAILED"]);
    expect(layout(ROW, { graphRouter: { name: "odd", route: () => "none" } as unknown as GraphRouter }).issues.map((i) => i.code)).toEqual(["ROUTER_FAILED"]);

    const short = layout(ROW, { graphRouter: fake(() => [{ x: 0, y: 0 }]) });
    expect(short.edges).toEqual(plain.edges);
    expect(short.issues).toMatchObject([{ code: "ROUTER_FAILED", edge: "a-c" }]);
    expect(layout(ROW, { graphRouter: fake(() => [{ x: 0, y: 0 }, { x: Number.NaN, y: 0 }]) }).issues).toMatchObject([{ code: "ROUTER_FAILED", edge: "a-c" }]);
    expect(layout(ROW, { graphRouter: { route: () => ({ routes: [] }) } }).issues).toMatchObject([{ code: "ROUTER_FAILED", edge: "a-c" }]);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test gives a bad list of points on purpose.
    expect(layout(ROW, { graphRouter: { route: () => ({ routes: [{ edge: "a-c", points: "none" as unknown as Point[] }] }) } }).issues).toMatchObject([{ code: "ROUTER_FAILED", edge: "a-c" }]);
  });

  it("reads a list of boxes that is not a list as no boxes", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test gives a bad list of boxes on purpose.
    const odd: GraphRouter = { route: () => ({ routes: [{ edge: "a-c", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], through: "b" as unknown as string[] }] }) };
    expect(layout(ROW, { graphRouter: odd }).issues).toEqual([]);
  });

  it("is a default of an engine", () => {
    const router = fake(() => [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    const engine = createEngine({ defaults: { graphRouter: router } });
    expect(edge(engine.layout(ROW), "a-c").points).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });
});
