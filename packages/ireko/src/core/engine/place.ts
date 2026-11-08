/**
 * The place phase: the second of the two passes. It visits each node after its parent (the pre-order), and it composes
 * the placements into absolute positions and scales.
 */
import { at } from "../at.ts";
import type { Issue, PlacedNode } from "../model.ts";
import { finite } from "./finite.ts";
import type { Measurement } from "./measure.ts";
import { placeOf, type PlaceColumn, type PlaceRecord } from "./place.generated.js";
import type { Context, Normalized } from "./types.ts";

/** The output of the place phase. Each array has one item for each node, in pre-order. */
export interface Placed {
  readonly nodes: readonly PlacedNode[];
  /** The index of the nested container that holds each node, or -1. */
  readonly container: readonly number[];
}

/** This function gives the absolute box of each node. It adds its findings to `issues`. */
export function place(norm: Normalized, m: Measurement, ctx: Context, issues: Issue[]): Placed {
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
  // A value of the sheet that is not finite gives the finding NON_FINITE and a finite value.
  const num = (column: PlaceColumn, i: number, field: string, fallback: number): number => finite(at(column, i), fallback, { node: at(norm.nodes, i).id, field, phase: "place" }, issues);
  const container = sheet.container.map((_, i) => num(sheet.container, i, "container", -1));

  const out: PlacedNode[] = norm.nodes.map((node, i) => {
    const p = node.parent;
    const c = at(container, i);
    const spec = node.spec;
    return {
      id: node.id,
      label: typeof spec.label === "string" ? spec.label : node.id,
      x: num(sheet.x, i, "x", 0),
      y: num(sheet.y, i, "y", 0),
      width: num(sheet.width, i, "width", 0),
      height: num(sheet.height, i, "height", 0),
      ...(p < 0 ? {} : { parent: at(norm.nodes, p).id }),
      ...(c < 0 ? {} : { container: at(norm.nodes, c).id }),
      depth: node.depth,
      mode: node.mode,
      layout: at(m.layout, i),
      scale: num(sheet.as, i, "scale", 1),
      clip: node.mode === "nested" && node.fit === "clip" && node.children.length > 0,
      childCount: node.children.length,
      ...(spec.data === undefined ? {} : { data: spec.data }),
    };
  });
  return { nodes: out, container };
}
