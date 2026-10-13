/**
 * The place phase: the second of the two passes. It visits each node after its parent (the pre-order), and it composes
 * the placements into absolute positions and scales.
 */
import { at } from "../at.ts";
import { clean } from "../geometry.ts";
import type { PlacedNode } from "../model.ts";
import type { Measurement } from "./measure.ts";
import type { Context, Normalized } from "./types.ts";

/** The output of the place phase. Each array has one item for each node, in pre-order. */
export interface Placed {
  readonly nodes: readonly PlacedNode[];
  /** The index of the nested container that holds each node, or -1. */
  readonly container: readonly number[];
}

/** This function gives the absolute box of each node. */
export function place(norm: Normalized, m: Measurement, ctx: Context): Placed {
  const n = norm.nodes.length;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const as = new Float64Array(n);
  const container: number[] = Array.from({ length: n }, () => -1);
  const out: PlacedNode[] = [];

  for (let i = 0; i < n; i++) {
    const node = at(norm.nodes, i);
    const p = node.parent;
    if (p < 0) {
      ax[i] = ctx.options.origin.x;
      ay[i] = ctx.options.origin.y;
      as[i] = 1;
    } else {
      // The pre-order puts each parent before its children, so the parent already has its absolute values.
      const placement = at(m.placement, i);
      const ps = at(as, p);
      ax[i] = at(ax, p) + ps * placement.x;
      ay[i] = at(ay, p) + ps * placement.y;
      as[i] = ps * placement.scale;
      container[i] = at(norm.nodes, p).mode === "nested" ? p : at(container, p);
    }
    const box = at(m.box, i);
    const scale = at(as, i);
    const c = at(container, i);
    const spec = node.spec;
    out.push({
      id: node.id,
      label: typeof spec.label === "string" ? spec.label : node.id,
      x: clean(at(ax, i)),
      y: clean(at(ay, i)),
      width: box.width * scale,
      height: box.height * scale,
      ...(p < 0 ? {} : { parent: at(norm.nodes, p).id }),
      ...(c < 0 ? {} : { container: at(norm.nodes, c).id }),
      depth: node.depth,
      mode: node.mode,
      layout: at(m.layout, i),
      scale,
      clip: node.mode === "nested" && node.fit === "clip" && node.children.length > 0,
      childCount: node.children.length,
      ...(spec.data === undefined ? {} : { data: spec.data }),
    });
  }
  return { nodes: out, container };
}
