/**
 * The crossing reduction of the strategy `layers`. An edge over more than one layer gets a virtual node in each layer
 * between its ends. Thus each edge counts in each layer that it goes through. Each pass is a sweep of the barycenter
 * ordering: down, then up. The ordering counts the crossings after each pass and keeps the best order. Thus the count
 * does not rise.
 */
import { at } from "../at.ts";
import type { ChildEdge } from "../strategy.ts";

/** The number of passes of the barycenter ordering. A pass goes down and then up. */
export const PASSES = 8;

/** The layers of a graph with a virtual node in each layer between the ends of a long edge. */
export interface ProperGraph {
  /** The layer of each node. The first `k` nodes are the children, the others are virtual. */
  readonly layer: readonly number[];
  /** The segments of the edges: each one goes from a node to a node in the next layer. */
  readonly segments: readonly (readonly [upper: number, lower: number])[];
}

/** The order of the layers, and the crossing count before the first pass and after each pass. */
export interface Ordering {
  /** The children of each layer, in order, with no virtual node. */
  readonly order: number[][];
  /** The best order of each layer with its virtual nodes. Its crossing count is the last value of `crossings`. */
  readonly proper: number[][];
  /** The crossing count of the best order: the start, then the count after each pass. The count does not rise. */
  readonly crossings: readonly number[];
}

/** This function gives the graph with virtual nodes. An edge in one layer, or to itself, has no segment. */
export function properGraph(k: number, layer: readonly number[], edges: readonly ChildEdge[]): ProperGraph {
  const layers = [...layer];
  const segments: [number, number][] = [];
  for (const e of edges) {
    if (e.from === e.to || e.from < 0 || e.to < 0 || e.from >= k || e.to >= k) continue;
    // A turned edge goes against the flow: its upper end is its target.
    const forward = at(layer, e.from) < at(layer, e.to);
    const top = forward ? e.from : e.to;
    const bottom = forward ? e.to : e.from;
    const span = at(layer, bottom) - at(layer, top);
    if (span <= 0) continue;
    let last = top;
    for (let l = at(layer, top) + 1; l < at(layer, bottom); l++) {
      const virtual = layers.length;
      layers.push(l);
      segments.push([last, virtual]);
      last = virtual;
    }
    segments.push([last, bottom]);
  }
  return { layer: layers, segments };
}

/** This function gives the count of pairs of segments that cross. Two segments with a common end do not cross. */
export function countCrossings(order: readonly (readonly number[])[], graph: ProperGraph): number {
  const place = new Map<number, number>();
  for (const nodes of order) nodes.forEach((v, i) => place.set(v, i));
  // The segments of each gap between two layers, as pairs of places.
  const gaps: [number, number][][] = order.map(() => []);
  for (const [upper, lower] of graph.segments) at(gaps, at(graph.layer, upper)).push([place.get(upper) ?? 0, place.get(lower) ?? 0]);
  let count = 0;
  for (const gap of gaps) {
    // Two segments cross when their order at the top is the other way around at the bottom: an inversion.
    gap.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    count += inversions(gap.map((pair) => pair[1]));
  }
  return count;
}

/** This function counts the inversions of a list by a merge sort: each pair with the larger value first. Equal values do not count. */
function inversions(values: number[]): number {
  if (values.length < 2) return 0;
  const middle = values.length >> 1;
  const left = values.slice(0, middle);
  const right = values.slice(middle);
  let count = inversions(left) + inversions(right);
  let i = 0;
  let j = 0;
  let w = 0;
  while (i < left.length && j < right.length) {
    if (at(left, i) <= at(right, j)) values[w++] = at(left, i++);
    else {
      count += left.length - i;
      values[w++] = at(right, j++);
    }
  }
  while (i < left.length) values[w++] = at(left, i++);
  while (j < right.length) values[w++] = at(right, j++);
  return count;
}

/**
 * This function gives the children of each layer, in order. It starts from the order of the children. A pass sorts each
 * layer by the mean place of the neighbors of each node. On the way down, the neighbors are in the layer before it. On
 * the way up, they are in the layer after it.
 *
 * A node with no such neighbor keeps its place. Nodes with equal keys keep their current order.
 */
export function orderLayers(k: number, layer: readonly number[], edges: readonly ChildEdge[], passes: number = PASSES): Ordering {
  const graph = properGraph(k, layer, edges);
  const n = graph.layer.length;
  const count = n === 0 ? 0 : Math.max(...graph.layer) + 1;
  const order: number[][] = Array.from({ length: count }, () => []);
  for (let v = 0; v < n; v++) at(order, at(graph.layer, v)).push(v);
  const above: number[][] = Array.from({ length: n }, () => []);
  const below: number[][] = Array.from({ length: n }, () => []);
  for (const [upper, lower] of graph.segments) {
    at(below, upper).push(lower);
    at(above, lower).push(upper);
  }
  const place = new Float64Array(n);
  const remember = (): void => order.forEach((nodes) => nodes.forEach((v, i) => (place[v] = i)));
  remember();
  const sortLayer = (l: number, near: readonly (readonly number[])[]): void => {
    const keys = new Map<number, number>();
    for (const v of at(order, l)) {
      const ns = at(near, v);
      keys.set(v, ns.length === 0 ? at(place, v) : ns.reduce((sum, u) => sum + at(place, u), 0) / ns.length);
    }
    order[l] = at(order, l).toSorted((a, b) => (keys.get(a) ?? 0) - (keys.get(b) ?? 0) || at(place, a) - at(place, b));
    remember();
  };
  let best = order.map((nodes) => [...nodes]);
  let fewest = countCrossings(order, graph);
  const crossings = [fewest];
  for (let pass = 0; pass < passes; pass++) {
    if (fewest === 0) {
      crossings.push(0);
      continue;
    }
    for (let l = 1; l < count; l++) sortLayer(l, above);
    for (let l = count - 2; l >= 0; l--) sortLayer(l, below);
    const now = countCrossings(order, graph);
    if (now < fewest) {
      fewest = now;
      best = order.map((nodes) => [...nodes]);
    }
    crossings.push(fewest);
  }
  return { order: best.map((nodes) => nodes.filter((v) => v < k)), proper: best, crossings };
}
