/**
 * The strategy `grid` puts the children in rows and columns. In the linked mode, the default is one row: a tree.
 * A column is as wide as the widest extent in it. A row is as tall as the tallest extent in it.
 * Thus a child with a large subtree gets a large cell, and no two subtrees overlap.
 */
import { at } from "../at.ts";
import type { Point } from "../geometry.ts";
import { defineStrategy, type Strategy } from "../strategy.ts";

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
    const n = children.length;
    const vertical = mode === "linked" && (options.side === "left" || options.side === "right");
    // A linked tree reads best as one row: then no edge crosses a sibling box.
    const auto = mode === "linked" ? (vertical ? 1 : n) : Math.ceil(Math.sqrt(n));
    const columns = options.columns > 0 ? Math.min(options.columns, n) : auto;
    const rows = Math.ceil(n / columns);

    const colW: number[] = Array.from({ length: columns }, () => 0);
    const rowH: number[] = Array.from({ length: rows }, () => 0);
    children.forEach((child, i) => {
      const c = i % columns;
      const r = Math.floor(i / columns);
      colW[c] = Math.max(at(colW, c), child.extent.width);
      rowH[r] = Math.max(at(rowH, r), child.extent.height);
    });
    if (options.uniform) {
      const w = Math.max(...colW);
      const h = Math.max(...rowH);
      colW.fill(w);
      rowH.fill(h);
    }
    const colX = offsetsOf(colW, gap);
    const rowY = offsetsOf(rowH, gap);
    const width = sum(colW) + gap * (columns - 1);
    const height = sum(rowH) + gap * (rows - 1);
    const align = options.align === "auto" ? (mode === "linked" ? "start" : "center") : options.align;

    // The top-left corner of each child box, relative to the top-left corner of the grid.
    const cells: Point[] = children.map((child, i) => {
      const c = i % columns;
      const r = Math.floor(i / columns);
      const ex = at(colX, c) + place(options.justify, at(colW, c) - child.extent.width);
      const ey = at(rowY, r) + place(align, at(rowH, r) - child.extent.height);
      return { x: ex - child.extent.x, y: ey - child.extent.y };
    });

    if (mode === "nested") return { offsets: cells, content: { x: 0, y: 0, width, height } };

    const distance = options.distance > 0 ? options.distance : gap * 1.5;
    const origin = clusterOrigin(options.side, self.width, self.height, width, height, distance);
    return { offsets: cells.map((p) => ({ x: origin.x + p.x, y: origin.y + p.y })) };
  },
});

function clusterOrigin(side: GridOptions["side"], selfW: number, selfH: number, w: number, h: number, distance: number): Point {
  switch (side) {
    case "bottom":
      return { x: selfW / 2 - w / 2, y: selfH + distance };
    case "top":
      return { x: selfW / 2 - w / 2, y: -distance - h };
    case "right":
      return { x: selfW + distance, y: selfH / 2 - h / 2 };
    case "left":
      return { x: -distance - w, y: selfH / 2 - h / 2 };
  }
}

function place(where: "start" | "center" | "end", free: number): number {
  switch (where) {
    case "start":
      return 0;
    case "center":
      return free / 2;
    case "end":
      return free;
  }
}

function offsetsOf(sizes: readonly number[], gap: number): number[] {
  const out: number[] = [];
  let cursor = 0;
  for (const s of sizes) {
    out.push(cursor);
    cursor += s + gap;
  }
  return out;
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
