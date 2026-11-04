// Case b of the size probe: `layout` with the shapes module of this folder wired in. The workflow wires
// `src/core/engine/shape-vex.ts`, but that file reads the module of the bench. Thus this entry has the same code without
// the types, and it reads `shape.generated.js` of this folder.
import { at } from "../src/core/at.ts";
import { boxShape, MAX_BANDS, setLinkedShape } from "../src/core/engine/shape.ts";
import { nodeShape } from "./shape.generated.js";

export { layout } from "../src/core/engine.ts";

function listOf(bands) {
  return { kind: "vex.list", items: bands.map((value, k) => ({ key: String(k), result: { ok: true, value } })) };
}

function valuesOf(list) {
  return list.items.map((item) => {
    if (!item.result.ok) throw new RangeError("ireko: the shape of a node is not finite.");
    return item.result.value;
  });
}

function vexLinkedShape(own, parts) {
  if (parts.length === 0) return boxShape(own);
  const records = parts.map((p) => ({ ox: p.x, oy: p.y, rows: listOf(p.shape.rows), cols: listOf(p.shape.columns) }));
  const value = at(nodeShape(records, { w: own.width, h: own.height, limit: MAX_BANDS }), 0);
  if (!("kind" in value)) throw new RangeError("ireko: the shape of a node is not finite.");
  const axes = valuesOf(value);
  return { rows: valuesOf(at(axes, 0)), columns: valuesOf(at(axes, 1)) };
}

setLinkedShape(vexLinkedShape);
