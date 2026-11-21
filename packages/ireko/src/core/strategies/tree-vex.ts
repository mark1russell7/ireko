/**
 * The strategy `tree` with a module of the Vex compiler (`tree.generated.js`). The module comes from the program
 * `TREE_PROGRAM` of mark1russell7/vex. The entry `ireko/shapes` uses this strategy, and the entry `ireko` does not
 * import it. The strategy has the type, the options and the description of the strategy `tree` of ireko, so an engine
 * with it replaces the built-in strategy.
 */
import { defineStrategy, type MeasuredChild, type Strategy } from "../strategy.ts";
import { DIRECTION } from "./side.ts";
import { tree, type TreeOptions } from "./tree.ts";
import { treeOf, type TreeRecord } from "./tree.generated.js";

/** This function gives the record of one child for the module. */
function recordOf(child: MeasuredChild, i: number): TreeRecord {
  const e = child.extent;
  const shape = child.shape;
  return {
    i,
    bw: child.box.width,
    bh: child.box.height,
    ex: e.x,
    ey: e.y,
    ew: e.width,
    eh: e.height,
    shaped: shape !== undefined,
    rows: shape?.rows ?? [],
    cols: shape?.columns ?? [],
  };
}

/** The strategy `tree`, with the offsets from the module of Vex. */
export const vexTree: Strategy<TreeOptions> = defineStrategy<TreeOptions>({
  type: tree.type,
  description: tree.description,
  shapes: true,
  options: tree.options,
  arrange({ mode, self, children, options, gap }) {
    const values = treeOf(children.map(recordOf), { ...options, mode, gap, selfW: self.width, selfH: self.height });
    // An error of Vex is an offset that is not finite. The check of the engine then uses the grid, as for the code of ireko.
    const offsets = values.map((v) => ("vexError" in v ? { x: Number.NaN, y: Number.NaN } : { x: v.x, y: v.y }));
    return mode === "nested" ? { offsets } : { offsets, direction: DIRECTION[options.side] };
  },
});
