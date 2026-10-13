/**
 * The strategy `layers` puts the children in layers, in the direction of the edges between them: a flowchart.
 * It is a small layered layout. It turns the edges of each cycle around. It gives each child the layer of its longest
 * path from a source, and it orders each layer by the mean place of its neighbors. Each layer is as deep as its deepest
 * extent, and the extents in a layer keep the gap, so no two subtrees overlap.
 */
import { at } from "../at.ts";
import { defineStrategy, type ChildEdge, type MeasuredChild, type Strategy } from "../strategy.ts";
import { DIRECTION, type Side } from "./side.ts";

/** The options of the strategy `layers`. */
export interface LayersOptions {
  /** The side where the edges go: the first layer is on the other side. */
  readonly side: Side;
  /** The distance between two layers. The value 0 means 2 times the gap. */
  readonly distance: number;
  /** The place of a layer across the direction of the edges: at the start, at the middle or at the end. */
  readonly align: "center" | "start" | "end";
}

/** The number of passes of the barycenter ordering. */
const SWEEPS = 8;

/** The strategy `layers`. */
export const layers: Strategy<LayersOptions> = defineStrategy<LayersOptions>({
  type: "layers",
  description: "The layers strategy puts the children in layers in the direction of the edges between them, like a flowchart.",
  options: {
    side: { type: "enum", values: ["bottom", "top", "left", "right"], default: "bottom", description: "The side where the edges go: the first layer is on the other side." },
    distance: { type: "number", default: 0, min: 0, description: "The distance between two layers. The value 0 means 2 times the gap." },
    align: { type: "enum", values: ["center", "start", "end"], default: "center", description: "The place of a layer across the direction of the edges: at the start, at the middle or at the end." },
  },
  arrange({ mode, self, children, options, gap, edges = [] }) {
    const k = children.length;
    const order = orderOf(k, layersOf(k, edges), edges);
    // The axis of the flow: y for the sides bottom and top, x for the sides left and right.
    const down = options.side === "bottom" || options.side === "top";
    const forward = options.side === "bottom" || options.side === "right";
    const distance = options.distance > 0 ? options.distance : 2 * gap;
    const along = (c: MeasuredChild): { from: number; size: number } => (down ? { from: c.extent.y, size: c.extent.height } : { from: c.extent.x, size: c.extent.width });
    const across = (c: MeasuredChild): { from: number; size: number } => (down ? { from: c.extent.x, size: c.extent.width } : { from: c.extent.y, size: c.extent.height });

    // The depth of each layer, and the length of each layer across the flow.
    const depths = order.map((layer) => Math.max(...layer.map((c) => along(at(children, c)).size)));
    const lengths = order.map((layer) => layer.reduce((sum, c, i) => sum + across(at(children, c)).size + (i > 0 ? gap : 0), 0));
    const widest = Math.max(...lengths);
    const total = depths.reduce((sum, d, i) => sum + d + (i > 0 ? distance : 0), 0);

    const offsets = children.map(() => ({ x: 0, y: 0 }));
    let flow = 0;
    order.forEach((layer, l) => {
      const depth = at(depths, l);
      const free = widest - at(lengths, l);
      let cross = options.align === "start" ? 0 : options.align === "end" ? free : free / 2;
      // The first layer is at the start of the flow. On the sides top and left, the flow goes to smaller values.
      const start = forward ? flow : total - flow - depth;
      for (const c of layer) {
        const child = at(children, c);
        const a = along(child);
        const b = across(child);
        // The extent is centered in the depth of its layer.
        const main = start + (depth - a.size) / 2 - a.from;
        const side = cross - b.from;
        offsets[c] = down ? { x: side, y: main } : { x: main, y: side };
        cross += b.size + gap;
      }
      flow += depth + distance;
    });

    const edgeFlow = DIRECTION[options.side];
    if (mode === "nested") return { offsets, flow: edgeFlow };
    // In the linked mode, the layers go on the side of the node, centered on it.
    const shift = linkedShift(options.side, self, widest, total, distance);
    return { offsets: offsets.map((o) => ({ x: o.x + shift.x, y: o.y + shift.y })), direction: edgeFlow, flow: edgeFlow };
  },
});

/** This function gives the move of the block of layers to the side of the node, in the linked mode. */
function linkedShift(side: Side, self: { readonly width: number; readonly height: number }, widest: number, total: number, distance: number): { x: number; y: number } {
  switch (side) {
    case "bottom":
      return { x: (self.width - widest) / 2, y: self.height + distance };
    case "top":
      return { x: (self.width - widest) / 2, y: -distance - total };
    case "right":
      return { x: self.width + distance, y: (self.height - widest) / 2 };
    case "left":
      return { x: -distance - total, y: (self.height - widest) / 2 };
  }
}

/**
 * This function gives the layer of each child. It turns around the edges that close a cycle: the back edges of a
 * depth-first search. Then it gives each child the length of its longest path from a child with no edge into it.
 */
function layersOf(k: number, edges: readonly ChildEdge[]): number[] {
  const next: number[][] = Array.from({ length: k }, () => []);
  for (const e of edges) if (e.from !== e.to && e.from >= 0 && e.to >= 0 && e.from < k && e.to < k) at(next, e.from).push(e.to);
  // A depth-first search without recursion. A back edge goes to a child on the stack of the search.
  const state = new Uint8Array(k);
  const forward: number[][] = Array.from({ length: k }, () => []);
  for (let root = 0; root < k; root++) {
    if (at(state, root) !== 0) continue;
    const stack: [number, number][] = [[root, 0]];
    state[root] = 1;
    while (stack.length > 0) {
      const top = at(stack, stack.length - 1);
      const [v, i] = top;
      const out = at(next, v);
      if (i >= out.length) {
        state[v] = 2;
        stack.pop();
        continue;
      }
      top[1] = i + 1;
      const w = at(out, i);
      if (at(state, w) === 1) at(forward, w).push(v);
      else at(forward, v).push(w);
      if (at(state, w) === 0) {
        state[w] = 1;
        stack.push([w, 0]);
      }
    }
  }
  // The longest path, in a topological order (Kahn).
  const indegree = new Int32Array(k);
  for (const out of forward) for (const w of out) indegree[w] = at(indegree, w) + 1;
  const queue: number[] = [];
  for (let v = 0; v < k; v++) if (at(indegree, v) === 0) queue.push(v);
  const layer: number[] = Array.from({ length: k }, () => 0);
  for (let head = 0; head < queue.length; head++) {
    const v = at(queue, head);
    for (const w of at(forward, v)) {
      layer[w] = Math.max(at(layer, w), at(layer, v) + 1);
      indegree[w] = at(indegree, w) - 1;
      if (at(indegree, w) === 0) queue.push(w);
    }
  }
  return layer;
}

/**
 * This function gives the children of each layer, in order. It starts from the order of the children, and then each
 * pass sorts a layer by the mean place of the neighbors of each child. A child with no neighbor keeps its place.
 */
function orderOf(k: number, layer: readonly number[], edges: readonly ChildEdge[]): number[][] {
  const count = Math.max(0, ...layer) + 1;
  const order: number[][] = Array.from({ length: count }, () => []);
  for (let v = 0; v < k; v++) at(order, at(layer, v)).push(v);
  const neighbors: number[][] = Array.from({ length: k }, () => []);
  for (const e of edges) {
    if (e.from === e.to || e.from < 0 || e.to < 0 || e.from >= k || e.to >= k) continue;
    at(neighbors, e.from).push(e.to);
    at(neighbors, e.to).push(e.from);
  }
  const place = new Float64Array(k);
  const remember = (): void => order.forEach((l) => l.forEach((v, i) => (place[v] = i)));
  remember();
  for (let pass = 0; pass < SWEEPS; pass++) {
    const down = pass % 2 === 0;
    for (let s = 0; s < count; s++) {
      const l = down ? s : count - 1 - s;
      // Only the neighbors in the layer before (down) or after (up) count.
      const near = down ? l - 1 : l + 1;
      const keyOf = (v: number): number => {
        const ns = at(neighbors, v).filter((u) => at(layer, u) === near);
        return ns.length === 0 ? at(place, v) : ns.reduce((sum, u) => sum + at(place, u), 0) / ns.length;
      };
      const keys = new Map(at(order, l).map((v) => [v, keyOf(v)]));
      order[l] = at(order, l).toSorted((a, b) => (keys.get(a) ?? 0) - (keys.get(b) ?? 0) || a - b);
      remember();
    }
  }
  return order;
}
