/**
 * The shapes of the subtrees, for the strategies with `shapes: true`. A shape is a list of bands on each axis.
 * A shape has at most `MAX_BANDS` bands on each axis. The engine joins neighbor bands, and a joined band covers both.
 * Thus a shape always covers each box of its subtree, and a deep tree costs a fixed amount of work for each node.
 */
import { at } from "../at.ts";
import type { Size } from "../geometry.ts";
import type { Band, Shape } from "../strategy.ts";

/** The largest number of bands on each axis of a shape. */
export const MAX_BANDS = 64;

/** This function gives the shape of one box with its top-left corner at the origin. */
export function boxShape(size: Size): Shape {
  return {
    rows: [{ from: 0, to: size.height, min: 0, max: size.width }],
    columns: [{ from: 0, to: size.width, min: 0, max: size.height }],
  };
}

/** This function moves a shape by `dx` and `dy`. */
export function moveShape(shape: Shape, dx: number, dy: number): Shape {
  return {
    rows: shape.rows.map((b) => ({ from: b.from + dy, to: b.to + dy, min: b.min + dx, max: b.max + dx })),
    columns: shape.columns.map((b) => ({ from: b.from + dx, to: b.to + dx, min: b.min + dy, max: b.max + dy })),
  };
}

/** This function joins shapes into one shape that covers all of them. */
export function joinShapes(shapes: readonly Shape[]): Shape {
  return { rows: mergeBands(shapes.flatMap((s) => s.rows)), columns: mergeBands(shapes.flatMap((s) => s.columns)) };
}

/**
 * This function merges bands into bands that do not overlap, in the order of `from`. Where bands overlap, the merged
 * band covers all of them. Neighbor bands with the same interval become one band. The result has at most `limit` bands.
 */
export function mergeBands(bands: readonly Band[], limit: number = MAX_BANDS): Band[] {
  const valid = bands.filter((b) => b.to > b.from && b.max >= b.min);
  if (valid.length === 0) return [];
  // A sweep over the cut points: the active bands cover the interval between two cuts.
  const cuts = [...new Set(valid.flatMap((b) => [b.from, b.to]))].toSorted((a, b) => a - b);
  const starts = valid.toSorted((a, b) => a.from - b.from);
  const out: Band[] = [];
  let active: Band[] = [];
  let next = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const from = at(cuts, i);
    const to = at(cuts, i + 1);
    active = active.filter((b) => b.to > from);
    for (; next < starts.length && at(starts, next).from <= from; next++) active.push(at(starts, next));
    if (active.length === 0) continue;
    let min = Infinity;
    let max = -Infinity;
    for (const b of active) {
      if (b.min < min) min = b.min;
      if (b.max > max) max = b.max;
    }
    const last = out[out.length - 1];
    if (last !== undefined && last.to === from && last.min === min && last.max === max) out[out.length - 1] = { ...last, to };
    else out.push({ from, to, min, max });
  }
  return coarsen(out, limit);
}

/** This function joins pairs of neighbor bands until at most `limit` bands remain. A joined band covers both bands. */
function coarsen(bands: Band[], limit: number): Band[] {
  let out = bands;
  while (out.length > limit) {
    const next: Band[] = [];
    for (let i = 0; i < out.length; i += 2) {
      const a = at(out, i);
      const b = out[i + 1];
      next.push(b === undefined ? a : { from: a.from, to: b.to, min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) });
    }
    out = next;
  }
  return out;
}

/** One part of the shape of a linked node: the shape of a child and its offset in the box of the node. */
export interface ShapePart {
  readonly shape: Shape;
  readonly x: number;
  readonly y: number;
}

/**
 * The code that gives the shape of a linked node with children. It joins the box of the node with the shape of each
 * child at its offset.
 */
export type LinkedShape = (own: Size, parts: readonly ShapePart[]) => Shape;

/** This function gives the shape of a linked node with the code of ireko: `joinShapes` of the moved parts. */
export function handLinkedShape(own: Size, parts: readonly ShapePart[]): Shape {
  return joinShapes([boxShape(own), ...parts.map((p) => moveShape(p.shape, p.x, p.y))]);
}

// The switch of the shapes: the code that the measure pass uses. The default is the code of ireko.
let linked: LinkedShape = handLinkedShape;

/** This function gives the shape of a linked node with the code of the switch. The measure pass uses it. */
export function linkedShape(own: Size, parts: readonly ShapePart[]): Shape {
  return linked(own, parts);
}

/**
 * This function sets the code of the switch, and gives the code that it replaces. The package does not export it. The
 * tests and the benchmarks use it to compare the code of ireko with the shapes module of Vex (`shape-vex.ts`).
 */
export function setLinkedShape(code: LinkedShape): LinkedShape {
  const before = linked;
  linked = code;
  return before;
}
