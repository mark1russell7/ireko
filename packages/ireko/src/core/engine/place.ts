/**
 * The place phase: the second of the two passes. It visits each node after its parent (the pre-order), and it composes
 * the placements into absolute positions and scales.
 */
import { at } from "../at.ts";
import type { PlacedNode } from "../model.ts";
import type { Measurement } from "./measure.ts";
import { placeOf, type PlaceColumn, type PlaceRecord } from "./place.generated.js";
import type { Context, Normalized } from "./types.ts";

/** The output of the place phase. Each array has one item for each node, in pre-order. */
export interface Placed {
  readonly nodes: readonly PlacedNode[];
  /** The index of the nested container that holds each node, or -1. */
  readonly container: readonly number[];
}

/** This function gives the absolute box of each node. */
export function place(norm: Normalized, m: Measurement, ctx: Context): Placed {
  // The Vex sheet of the pass gives the absolute values: place.generated.js, from the pilot of Vex.
  const records: PlaceRecord[] = norm.nodes.map((node, i) => {
    const placement = at(m.placement, i);
    const box = at(m.box, i);
    return { p: node.parent, px: placement.x, py: placement.y, ps: placement.scale, bw: box.width, bh: box.height, nested: node.mode === "nested" };
  });
  const sheet = placeOf(
    records,
    { ox: ctx.options.origin.x, oy: ctx.options.origin.y },
    norm.nodes.map((node) => node.parent),
  );
  const container = numbers(sheet.container);

  const out: PlacedNode[] = norm.nodes.map((node, i) => {
    const p = node.parent;
    const c = at(container, i);
    const spec = node.spec;
    return {
      id: node.id,
      label: typeof spec.label === "string" ? spec.label : node.id,
      x: numberAt(sheet.x, i),
      y: numberAt(sheet.y, i),
      width: numberAt(sheet.width, i),
      height: numberAt(sheet.height, i),
      ...(p < 0 ? {} : { parent: at(norm.nodes, p).id }),
      ...(c < 0 ? {} : { container: at(norm.nodes, c).id }),
      depth: node.depth,
      mode: node.mode,
      layout: at(m.layout, i),
      scale: numberAt(sheet.as, i),
      clip: node.mode === "nested" && node.fit === "clip" && node.children.length > 0,
      childCount: node.children.length,
      ...(spec.data === undefined ? {} : { data: spec.data }),
    };
  });
  return { nodes: out, container };
}

/** This function gives the number of a column at the index `i`. An error of Vex is a value that is not finite, for example an overflow of a sum. */
function numberAt(column: PlaceColumn, i: number): number {
  const v = at(column, i);
  if (typeof v !== "number") throw new RangeError("ireko: the place of a node is not finite.");
  return v;
}

/** This function gives the numbers of a column. */
function numbers(column: PlaceColumn): number[] {
  return column.map((_, i) => numberAt(column, i));
}
