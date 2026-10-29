/**
 * The shape of a linked node with the shapes module of Vex (`shape.generated.js`). The script `scripts/vex-shapes.mjs`
 * writes the module. This code is an experiment: the package does not import it, so the bundle does not change. The
 * tests and the benchmarks turn it on with `setLinkedShape(vexLinkedShape)`.
 */
import { at } from "../at.ts";
import type { Size } from "../geometry.ts";
import type { Band, Shape } from "../strategy.ts";
import { nodeShape, type VexList } from "./shape.generated.js";
import { boxShape, MAX_BANDS, type ShapePart } from "./shape.ts";

/** This function gives the value of an item of a list of Vex. An error in the list is a shape that is not finite. */
function valueOf<T>(item: { result: { ok: true; value: T } | { ok: false } }): T {
  const r = item.result;
  if (!r.ok) throw new RangeError("ireko: the shape of a node is not finite.");
  return r.value;
}

/** This function gives the values of a list of Vex. An error in the list is a band with NaN. An infinite end is a value. */
function valuesOf<T>(list: VexList<T>): T[] {
  const items = list.items;
  const o = new Array<T>(items.length);
  for (let i = 0; i < items.length; i++) o[i] = valueOf(at(items, i));
  return o;
}

/**
 * This function gives the shape of a linked node with the shapes module of Vex. The records of the module are the
 * children. A node without children has the shape of its box, as in the code of ireko. The bands go into the module
 * as plain arrays (SHAPEWIRE wrapper, bench only: the input check of the module takes a plain array).
 */
export function vexLinkedShape(own: Size, parts: readonly ShapePart[]): Shape {
  if (parts.length === 0) return boxShape(own);
  const records = new Array<{ ox: number; oy: number; rows: readonly Band[]; cols: readonly Band[] }>(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const p = at(parts, i);
    records[i] = { ox: p.x, oy: p.y, rows: p.shape.rows, cols: p.shape.columns };
  }
  // The module gives the shape of the node at each record. The first record has it.
  const value = at(nodeShape(records as never, { w: own.width, h: own.height, limit: MAX_BANDS }), 0);
  if (!("kind" in value)) throw new RangeError("ireko: the shape of a node is not finite.");
  return { rows: valuesOf(valueOf(at(value.items, 0))), columns: valuesOf(valueOf(at(value.items, 1))) };
}
