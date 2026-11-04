/**
 * ireko/shapes: the layout of `ireko`, with the shapes of linked nodes from a module of the Vex compiler.
 *
 * ```ts
 * import { layout } from "ireko/shapes";
 *
 * const result = layout({ root: { id: "root", layout: "tree", children: [{ id: "a" }, { id: "b" }] } });
 * ```
 *
 * This entry gives the same layout as `ireko`, to the bit. Only the code of the shapes is different.
 *
 * @packageDocumentation
 */
import { createEngine } from "../core/engine.ts";
import { vexLinkedShape } from "../core/engine/shape-vex.ts";
import type { Layout, LayoutInput, LayoutOptions } from "../core/model.ts";

const engine = createEngine({ linkedShape: vexLinkedShape });

/** This function gives the layout of `input`, as `layout` of `ireko` does. */
export function layout(input: LayoutInput, options?: LayoutOptions): Layout {
  return engine.layout(input, options);
}
