/**
 * The shape of a linked node with a module of the Vex compiler (`shape.generated.js`). The module comes from the
 * program `NODE_SHAPE` of mark1russell7/vex at commit 18282a1. The entry `ireko/shapes` uses this code, and the entry
 * `ireko` does not import it.
 */
import { at } from "../at.ts";
import type { Size } from "../geometry.ts";
import type { Band, Shape } from "../strategy.ts";
import { nodeShape, type VexBand, type VexList } from "./shape.generated.js";
import { boxShape, MAX_BANDS, type ShapePart } from "./shape.ts";

/** This function gives a list of bands as a list of Vex. */
function listOf(bands: readonly Band[]): VexList<VexBand> {
  return { kind: "vex.list", items: bands.map((value, k) => ({ key: String(k), result: { ok: true, value } })) };
}

/** This function gives the values of a list of Vex. An error in the list is a band with NaN. An infinite end is a value. */
function valuesOf<T>(list: VexList<T>): T[] {
  return list.items.map((item) => {
    if (!item.result.ok) throw new RangeError("ireko: the shape of a node is not finite.");
    return item.result.value;
  });
}

/**
 * This function gives the shape of a linked node with the module. The records of the module are the children. A node
 * without children has the shape of its box, as in the code of ireko.
 */
export function vexLinkedShape(own: Size, parts: readonly ShapePart[]): Shape {
  if (parts.length === 0) return boxShape(own);
  const records = parts.map((p) => ({ ox: p.x, oy: p.y, rows: listOf(p.shape.rows), cols: listOf(p.shape.columns) }));
  // The module gives the shape of the node at each record. The first record has it.
  const value = at(nodeShape(records, { w: own.width, h: own.height, limit: MAX_BANDS }), 0);
  if (!("kind" in value)) throw new RangeError("ireko: the shape of a node is not finite.");
  const axes = valuesOf(value);
  return { rows: valuesOf(at(axes, 0)), columns: valuesOf(at(axes, 1)) };
}
