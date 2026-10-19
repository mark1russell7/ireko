/**
 * The strategy `radial` puts the children on a ring. Each child subtree fits in a circle of radius `rho` around the
 * center of its box. Two neighbors `i` and `j` need the angle `2 * asin((rho_i + rho_j + gap) / (2 * r))`.
 * On a full ring, the strategy finds the smallest radius `r` at which these angles fill the ring.
 * Thus a small child takes less of the ring than a large child.
 *
 * On a part of a ring, each child is at the middle of an equal part of the arc. The largest circle sets the radius.
 */
import { defineStrategy, type Strategy } from "../strategy.ts";
import { radialOf, type RadialOffset } from "./radial.generated.js";

/** The options of the strategy `radial`. */
export interface RadialOptions {
  /** The angle of the first child, in degrees. The value 0 is to the right, and -90 is at the top. */
  readonly startAngle: number;
  /** The angle of the arc that holds the children, in degrees. The value 360 is a full ring. */
  readonly sweep: number;
  /** If true, the children follow the clockwise direction on the screen. */
  readonly clockwise: boolean;
  /** In the linked mode, the smallest distance between the node and the circle of a child. The value 0 means the gap. */
  readonly distance: number;
}

/** The strategy `radial`. */
export const radial: Strategy<RadialOptions> = defineStrategy<RadialOptions>({
  type: "radial",
  description: "The radial strategy puts the children on a ring. The ring is large enough that no two child subtrees touch.",
  options: {
    startAngle: { type: "number", default: -90, min: -360, max: 360, description: "The angle of the first child, in degrees. The value 0 is to the right, and -90 is at the top." },
    sweep: { type: "number", default: 360, min: 1, max: 360, description: "The angle of the arc that holds the children, in degrees. The value 360 is a full ring." },
    clockwise: { type: "boolean", default: true, description: "If true, the children follow the clockwise direction on the screen." },
    distance: { type: "number", default: 0, min: 0, description: "In the linked mode, the smallest distance between the node and the circle of a child. The value 0 means the gap." },
  },
  arrange({ mode, self, children, options, gap }) {
    // The Vex program of the strategy gives the offset of each child: radial.generated.js, from the pilot of Vex.
    const records = children.map((child, i) => ({ i, bw: child.box.width, bh: child.box.height, ex: child.extent.x, ey: child.extent.y, ew: child.extent.width, eh: child.extent.height }));
    const offsets = radialOf(records, { ...options, mode, gap, selfW: self.width, selfH: self.height }).map((offset): RadialOffset => {
      // An error of Vex is a size that is not finite, for example an overflow of a sum.
      if ("vexError" in offset) throw new RangeError("ireko: the ring of a node has a size that is not finite.");
      return offset;
    });
    return { offsets };
  },
});
