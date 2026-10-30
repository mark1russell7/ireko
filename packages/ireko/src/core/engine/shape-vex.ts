/**
 * The shape of a linked node with the shapes module of Vex (`shape.generated.js`). The script `scripts/vex-shapes.mjs`
 * writes the module. This code is an experiment: the package does not import it, so the bundle does not change. The
 * tests and the benchmarks turn it on with `setLinkedShape(vexLinkedShape)`.
 */
import { at } from "../at.ts";
import type { Size } from "../geometry.ts";
import type { Shape } from "../strategy.ts";
import { nodeShape, VEX_ERROR, type ShapeRecord, type VexList } from "./shape.generated.js";
import { boxShape, MAX_BANDS, type ShapePart } from "./shape.ts";

/** This function tells if a value of the module is its error value. */
function isError(v: unknown): v is typeof VEX_ERROR {
  return v === VEX_ERROR;
}

/** This function gives the values of a list of the module. An error item is a shape that is not finite. */
function valuesOf<T>(list: VexList<T> | typeof VEX_ERROR): T[] {
  if (isError(list)) throw new RangeError("ireko: the shape of a node is not finite.");
  const o = new Array<T>(list.length);
  for (let i = 0; i < list.length; i++) {
    const v = at(list, i);
    if (isError(v)) throw new RangeError("ireko: the shape of a node is not finite.");
    o[i] = v;
  }
  return o;
}

/**
 * This function gives the shape of a linked node with the shapes module of Vex. The records of the module are the
 * children. A node without children has the shape of its box, as in the code of ireko. The bands go in and out as
 * plain arrays (the option `lists: "plain"` of the compiler).
 */
export function vexLinkedShape(own: Size, parts: readonly ShapePart[]): Shape {
  if (parts.length === 0) return boxShape(own);
  const records = new Array<ShapeRecord>(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const p = at(parts, i);
    records[i] = { ox: p.x, oy: p.y, rows: p.shape.rows, cols: p.shape.columns };
  }
  // The module gives the shape of the node at each record. The first record has it.
  const value = at(nodeShape(records, { w: own.width, h: own.height, limit: MAX_BANDS }), 0);
  const axes = valuesOf(value);
  return { rows: valuesOf(at(axes, 0)), columns: valuesOf(at(axes, 1)) };
}
