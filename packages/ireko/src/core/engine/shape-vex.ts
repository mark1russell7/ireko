/**
 * The shape of a linked node with the shapes module of Vex (`shape.generated.js`). The script `scripts/vex-shapes.mjs`
 * writes the module. This code is an experiment: the package does not import it, so the bundle does not change. The
 * tests and the benchmarks turn it on with `setLinkedShape(vexLinkedShape)`.
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

/** This function gives the values of a list of Vex. An error in the list is a value that is not finite. */
function valuesOf<T>(list: VexList<T>): T[] {
  return list.items.map((item) => {
    if (!item.result.ok) throw new RangeError("ireko: the shape of a node is not finite.");
    return item.result.value;
  });
}

/**
 * This function gives the shape of a linked node with the shapes module of Vex. The records of the module are the
 * children. A node without children has the shape of its box, as in the code of ireko.
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
