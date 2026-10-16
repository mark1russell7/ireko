/**
 * The strategy `grid` puts the children in rows and columns. In the linked mode, the default is one row: a tree.
 * A column is as wide as the widest extent in it. A row is as tall as the tallest extent in it.
 * Thus a child with a large subtree gets a large cell, and no two subtrees overlap.
 */
import { at } from "../at.ts";
import { defineStrategy, type Strategy } from "../strategy.ts";
import { gridOf, type GridCell } from "./grid.generated.js";
import { DIRECTION } from "./side.ts";

/** The options of the strategy `grid`. */
export interface GridOptions {
  /**
   * The number of columns. With the value 0, the nested mode makes a grid that is approximately square,
   * and the linked mode makes one row (one column on the left and right sides).
   */
  readonly columns: number;
  /** The horizontal place of a child in its cell. */
  readonly justify: "start" | "center" | "end";
  /** The vertical place of a child in its cell. With `auto`, linked children align at the top and nested children at the center. */
  readonly align: "auto" | "start" | "center" | "end";
  /** If true, all cells have the size of the largest cell. */
  readonly uniform: boolean;
  /** In the linked mode, the side of the node where the children go. */
  readonly side: "bottom" | "top" | "left" | "right";
  /** In the linked mode, the distance between the node and its children. The value 0 means 1.5 times the gap. */
  readonly distance: number;
}

/** The strategy `grid`. */
export const grid: Strategy<GridOptions> = defineStrategy<GridOptions>({
  type: "grid",
  description: "The grid strategy puts the children in rows and columns. Each column and each row is as large as its largest child.",
  options: {
    columns: { type: "number", default: 0, min: 0, integer: true, description: "The number of columns. With 0, the nested mode makes an approximately square grid, and the linked mode makes one row." },
    justify: { type: "enum", values: ["start", "center", "end"], default: "center", description: "The horizontal place of a child in its cell." },
    align: { type: "enum", values: ["auto", "start", "center", "end"], default: "auto", description: "The vertical place of a child in its cell. With auto, linked children align at the top, and nested children at the center." },
    uniform: { type: "boolean", default: false, description: "If true, all cells have the size of the largest cell." },
    side: { type: "enum", values: ["bottom", "top", "left", "right"], default: "bottom", description: "In the linked mode, the side of the node where the children go." },
    distance: { type: "number", default: 0, min: 0, description: "In the linked mode, the distance between the node and its children. The value 0 means 1.5 times the gap." },
  },
  arrange({ mode, self, children, options, gap }) {
    // The Vex program of the strategy gives the cell of each child: grid.generated.js, from the pilot of Vex.
    const records = children.map((child, i) => ({ i, x: child.extent.x, y: child.extent.y, w: child.extent.width, h: child.extent.height }));
    const cells = gridOf(records, { ...options, mode, gap, selfW: self.width, selfH: self.height }).map((cell): GridCell => {
      // An error of Vex is a size that is not finite, for example an overflow of a sum.
      if ("vexError" in cell) throw new RangeError("ireko: the grid of a node has a size that is not finite.");
      return cell;
    });
    const offsets = cells.map((cell) => ({ x: cell.x, y: cell.y }));
    const { width, height } = at(cells, 0);
    if (mode === "nested") return { offsets, content: { x: 0, y: 0, width, height } };
    return { offsets, direction: DIRECTION[options.side] };
  },
});
