/**
 * The strategy `tree` puts the children in one row, on one side of the node, like the linked grid. It packs the
 * subtrees by their shapes, not by their extents. Thus a small subtree fits under the edge of a large subtree, and a
 * wide tree becomes narrower (a tidy tree).
 *
 * The strategy packs the row two times: from the first child to the last, and from the last child to the first.
 * Each packing keeps each pair of subtrees apart by the gap. The two packings are solutions of the same linear
 * constraints, so their mean is a solution too. The mean puts the small subtrees in the middle of their space.
 */
import { at } from "../at.ts";
import { mergeBands } from "../engine/shape.ts";
import { defineStrategy, type Band, type MeasuredChild, type Strategy } from "../strategy.ts";
import { DIRECTION } from "./side.ts";

/** The options of the strategy `tree`. */
export interface TreeOptions {
  /** The side of the node where the children go. */
  readonly side: "bottom" | "top" | "left" | "right";
  /** The distance between the node and its children. The value 0 means 1.5 times the gap. */
  readonly distance: number;
  /** The place of the node along the row of its children: over the middle, the first child or the last child. */
  readonly align: "center" | "start" | "end";
}

/** The strategy `tree`. */
export const tree: Strategy<TreeOptions> = defineStrategy<TreeOptions>({
  type: "tree",
  description: "The tree strategy puts the children in one row and packs the subtrees by their shapes, so a small subtree fits under the edge of a large one.",
  shapes: true,
  options: {
    side: { type: "enum", values: ["bottom", "top", "left", "right"], default: "bottom", description: "The side of the node where the children go." },
    distance: { type: "number", default: 0, min: 0, description: "The distance between the node and its children. The value 0 means 1.5 times the gap." },
    align: { type: "enum", values: ["center", "start", "end"], default: "center", description: "The place of the node along the row of its children: over the middle, the first child or the last child." },
  },
  arrange({ mode, self, children, options, gap }) {
    // The row goes along x for the sides bottom and top, and along y for the sides left and right.
    const across = options.side === "bottom" || options.side === "top";
    // In the nested mode, the node is a container: the row starts at the origin, and the engine moves the content.
    const nested = mode === "nested";
    const distance = nested ? 0 : options.distance > 0 ? options.distance : 1.5 * gap;
    const depth = children.map((c) => depthOf(c, options.side, nested ? { width: 0, height: 0 } : self, distance));
    // The bands of each subtree on the axis of the row, moved to the depth of the child.
    const bands = children.map((c, i) => bandsOf(c, across).map((b) => ({ ...b, from: b.from + at(depth, i), to: b.to + at(depth, i) })));

    const forward = pack(bands, gap);
    const backward = mirror(pack(bands.toReversed().map(flip), gap)).toReversed();
    const shift = at(forward, 0) - at(backward, 0);
    let place = forward.map((f, i) => (f + at(backward, i) + shift) / 2);

    if (!nested) {
      // The node goes over the middle of its row, or over its first or last child.
      const size = (c: MeasuredChild): number => (across ? c.box.width : c.box.height);
      const own = across ? self.width : self.height;
      const lastIndex = children.length - 1;
      const first = at(place, 0);
      const lastStart = at(place, lastIndex);
      const last = lastStart + size(at(children, lastIndex));
      const middle = (first + size(at(children, 0)) / 2 + lastStart + size(at(children, lastIndex)) / 2) / 2;
      const move = options.align === "start" ? -first : options.align === "end" ? own - last : own / 2 - middle;
      place = place.map((p) => p + move);
    }

    const offsets = children.map((_, i) => (across ? { x: at(place, i), y: at(depth, i) } : { x: at(depth, i), y: at(place, i) }));
    return nested ? { offsets } : { offsets, direction: DIRECTION[options.side] };
  },
});

/**
 * This function gives the place of a child box on the axis from the node to its children. The extent of the child
 * stays clear of the node: a subtree that grows toward the node starts farther away.
 */
function depthOf(c: MeasuredChild, side: TreeOptions["side"], self: { readonly width: number; readonly height: number }, distance: number): number {
  const e = c.extent;
  switch (side) {
    case "bottom":
      return self.height + distance - Math.min(0, e.y);
    case "top":
      return -distance - Math.max(c.box.height, e.y + e.height);
    case "right":
      return self.width + distance - Math.min(0, e.x);
    case "left":
      return -distance - Math.max(c.box.width, e.x + e.width);
  }
}

/** This function gives the bands of a subtree for a row: its rows for a row along x, its columns for a row along y. */
function bandsOf(c: MeasuredChild, across: boolean): readonly Band[] {
  const e = c.extent;
  if (c.shape !== undefined) return across ? c.shape.rows : c.shape.columns;
  // Without a shape, the extent is one band.
  return across ? [{ from: e.y, to: e.y + e.height, min: e.x, max: e.x + e.width }] : [{ from: e.x, to: e.x + e.width, min: e.y, max: e.y + e.height }];
}

/**
 * This function packs subtrees in a row, from the first to the last. Each subtree goes to its smallest place.
 * There, each of its bands is at the gap or more from each band of the subtrees before it.
 * A subtree does not go before the subtree before it.
 */
function pack(bands: readonly (readonly Band[])[], gap: number): number[] {
  const places: number[] = [];
  // The bands of the packed subtrees, at their places. Only the far side (max) of each band counts.
  let packed: Band[] = [];
  bands.forEach((own, i) => {
    let place = i === 0 ? 0 : at(places, i - 1);
    for (const b of own) {
      for (const p of packed) {
        if (p.from < b.to && b.from < p.to) place = Math.max(place, p.max - b.min + gap);
      }
    }
    places.push(place);
    packed = [...packed, ...own.map((b) => ({ ...b, min: b.min + place, max: b.max + place }))];
    // A long row merges its bands. A merged band covers more, so the packing stays correct, with more space.
    if (packed.length > 256) packed = mergeBands(packed, 128);
  });
  return places;
}

/** This function mirrors a subtree on the axis of the row: the band from `min` to `max` goes from `-max` to `-min`. */
function flip(bands: readonly Band[]): Band[] {
  return bands.map((b) => ({ ...b, min: -b.max, max: -b.min }));
}

/** This function gives the places of mirrored subtrees in the coordinates of the row. */
function mirror(places: readonly number[]): number[] {
  return places.map((p) => -p);
}
