/**
 * The strategy "spiral": the children go on a spiral, from the center out. The page "Write a strategy" shows this file
 * as its example, and its live editor uses it.
 */
import { createEngine, defineStrategy, type Engine, type MeasuredChild, type Point } from "ireko";

/** The options of the strategy "spiral". */
export interface SpiralOptions {
  /** The distance between two turns, as a factor of the size of the largest child. */
  readonly growth: number;
  /** If true, the spiral turns in the clockwise direction on the screen. */
  readonly clockwise: boolean;
}

/** This function gives the radius of the smallest circle around the center of the box that holds the whole subtree. */
function rhoOf(child: MeasuredChild): number {
  const cx = child.box.width / 2;
  const cy = child.box.height / 2;
  const { x, y, width, height } = child.extent;
  return Math.max(Math.hypot(x - cx, y - cy), Math.hypot(x + width - cx, y - cy), Math.hypot(x - cx, y + height - cy), Math.hypot(x + width - cx, y + height - cy));
}

/** The strategy. */
export const spiral = defineStrategy<SpiralOptions>({
  type: "spiral",
  description: "The spiral strategy puts the children on a spiral, from the center out.",
  options: {
    growth: { type: "number", default: 1, min: 1, max: 4, description: "The distance between two turns, as a factor of the size of the largest child." },
    clockwise: { type: "boolean", default: true, description: "If true, the spiral turns in the clockwise direction on the screen." },
  },
  arrange({ mode, self, children, options, gap }) {
    const rhos = children.map(rhoOf);
    const largest = Math.max(...rhos);
    // The radius grows by one turn distance for each full turn, so two turns never touch.
    const perRadian = ((2 * largest + gap) * options.growth) / (2 * Math.PI);
    // In the linked mode, the spiral starts outside the box of the node.
    const start = mode === "linked" ? Math.hypot(self.width, self.height) / 2 + largest + gap : 0;
    const direction = options.clockwise ? 1 : -1;
    const at = (theta: number): Point => {
      const r = start + perRadian * theta;
      return { x: r * Math.cos(direction * theta), y: r * Math.sin(direction * theta) };
    };

    const centers: Point[] = [];
    let theta = 0;
    children.forEach((_, i) => {
      // Walk along the spiral until the circle of this child touches no circle before it.
      const clear = (p: Point): boolean => centers.every((c, j) => Math.hypot(p.x - c.x, p.y - c.y) >= (rhos[i] ?? 0) + (rhos[j] ?? 0) + gap);
      for (let guard = 0; !clear(at(theta)) && guard < 100_000; guard++) theta += 0.02;
      centers.push(at(theta));
    });

    // An offset is the top-left corner of a child box. In the linked mode, it is relative to the box of the node.
    const origin = mode === "linked" ? { x: self.width / 2, y: self.height / 2 } : { x: 0, y: 0 };
    return { offsets: children.map((c, i) => ({ x: origin.x + (centers[i]?.x ?? 0) - c.box.width / 2, y: origin.y + (centers[i]?.y ?? 0) - c.box.height / 2 })) };
  },
});

/** An engine with the strategy "spiral" and the built-in strategies. */
export const spiralEngine: Engine = createEngine({ strategies: [spiral] });
