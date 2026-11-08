import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ChildEdge } from "../strategy.ts";
import { countCrossings, orderLayers, PASSES, properGraph } from "./crossings.ts";

/** The number of random cases. A mutation run (IREKO_FAST=1) repeats the tests for each mutant, so it uses a tenth. */
const runs = (n: number): { numRuns: number } => ({ numRuns: process.env["IREKO_FAST"] === "1" ? Math.ceil(n / 10) : n });

const edge = (from: number, to: number): ChildEdge => ({ from, to });

describe("the crossing count", () => {
  it("counts two segments that change their order between two layers", () => {
    const graph = properGraph(4, [0, 0, 1, 1], [edge(0, 3), edge(1, 2)]);
    expect(countCrossings([[0, 1], [2, 3]], graph)).toBe(1);
    expect(countCrossings([[0, 1], [3, 2]], graph)).toBe(0);
  });

  it("does not count two segments with a common end", () => {
    const graph = properGraph(3, [0, 1, 1], [edge(0, 1), edge(0, 2)]);
    expect(countCrossings([[0], [2, 1]], graph)).toBe(0);
  });

  it("gives 9 for the complete graph of 3 and 3 nodes in any order", () => {
    const edges = [0, 1, 2].flatMap((a) => [3, 4, 5].map((b) => edge(a, b)));
    const graph = properGraph(6, [0, 0, 0, 1, 1, 1], edges);
    expect(countCrossings([[0, 1, 2], [3, 4, 5]], graph)).toBe(9);
    expect(countCrossings([[2, 0, 1], [4, 5, 3]], graph)).toBe(9);
    expect(orderLayers(6, [0, 0, 0, 1, 1, 1], edges).crossings.at(-1)).toBe(9);
  });
});

describe("the graph with virtual nodes", () => {
  it("gives a long edge a virtual node in each layer between its ends", () => {
    const graph = properGraph(3, [0, 1, 3], [edge(0, 2), edge(0, 1)]);
    expect(graph.layer).toEqual([0, 1, 3, 1, 2]);
    expect(graph.segments).toEqual([[0, 3], [3, 4], [4, 2], [0, 1]]);
  });

  it("turns an edge against the flow, and skips an edge in one layer or to itself", () => {
    const graph = properGraph(3, [0, 1, 1], [edge(1, 0), edge(1, 2), edge(2, 2), edge(0, 7)]);
    expect(graph.segments).toEqual([[0, 1]]);
  });
});

describe("the barycenter ordering", () => {
  it("removes the crossing of two segments", () => {
    const { order, crossings } = orderLayers(4, [0, 0, 1, 1], [edge(0, 3), edge(1, 2)]);
    expect(order).toEqual([[0, 1], [3, 2]]);
    expect(crossings).toEqual([1, ...Array.from({ length: PASSES }, () => 0)]);
  });

  it("counts a long edge in the layer that it goes through", () => {
    // The edge 0 -> 4 goes through layer 1. In the start order, its virtual node is last, and two segments cross it.
    const edges = [edge(0, 4), edge(1, 2), edge(1, 3), edge(2, 5), edge(3, 5), edge(4, 5)];
    const layer = [0, 0, 1, 1, 2, 3];
    const { crossings } = orderLayers(6, layer, edges);
    expect(crossings[0]).toBeGreaterThan(0);
    expect(crossings.at(-1)).toBe(0);
  });

  it("gives no layer for no child", () => {
    expect(orderLayers(0, [], [])).toEqual({ order: [], crossings: Array.from({ length: PASSES + 1 }, () => 0) });
  });
});

/** A graph in layers: the layer of each child, and edges between children in different layers. */
const layered = fc.integer({ min: 1, max: 24 }).chain((k) =>
  fc.record({
    k: fc.constant(k),
    layer: fc.array(fc.integer({ min: 0, max: 5 }), { minLength: k, maxLength: k }),
    pairs: fc.array(fc.tuple(fc.nat(k - 1), fc.nat(k - 1)), { maxLength: 3 * k }),
  }),
).map(({ k, layer, pairs }) => {
  // The layers have no gap: a layer with no child moves the next layers up.
  const used = [...new Set(layer)].sort((a, b) => a - b);
  const dense = layer.map((l) => used.indexOf(l));
  return { k, layer: dense, edges: pairs.map(([a, b]) => edge(a, b)) };
});

describe("properties of the barycenter ordering", () => {
  it("the crossing count never rises after a pass", () => {
    fc.assert(
      fc.property(layered, ({ k, layer, edges }) => {
        const { crossings } = orderLayers(k, layer, edges);
        expect(crossings).toHaveLength(PASSES + 1);
        for (let i = 1; i < crossings.length; i++) expect(crossings[i]).toBeLessThanOrEqual(crossings[i - 1] ?? 0);
      }),
      runs(300),
    );
  });

  it("the same input gives the same order", () => {
    fc.assert(
      fc.property(layered, ({ k, layer, edges }) => {
        expect(orderLayers(k, layer, edges)).toEqual(orderLayers(k, [...layer], [...edges]));
      }),
      runs(200),
    );
  });

  it("each child is one time in its own layer", () => {
    fc.assert(
      fc.property(layered, ({ k, layer, edges }) => {
        const { order } = orderLayers(k, layer, edges);
        expect(order.flat().sort((a, b) => a - b)).toEqual(Array.from({ length: k }, (_, i) => i));
        order.forEach((nodes, l) => nodes.forEach((v) => expect(layer[v]).toBe(l)));
      }),
      runs(200),
    );
  });

  it("each edge between two layers stays: one segment for each layer that it goes over", () => {
    fc.assert(
      fc.property(layered, ({ k, layer, edges }) => {
        const graph = properGraph(k, layer, edges);
        const span = edges.filter((e) => e.from !== e.to).reduce((sum, e) => sum + Math.abs((layer[e.from] ?? 0) - (layer[e.to] ?? 0)), 0);
        expect(graph.segments).toHaveLength(span);
        for (const [upper, lower] of graph.segments) expect(graph.layer[lower]).toBe((graph.layer[upper] ?? 0) + 1);
      }),
      runs(200),
    );
  });
});
