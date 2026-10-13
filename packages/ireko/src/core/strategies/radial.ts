/**
 * The strategy `radial` puts the children on a ring. Each child subtree fits in a circle of radius `rho` around the
 * center of its box. Two neighbors `i` and `j` need the angle `2 * asin((rho_i + rho_j + gap) / (2 * r))`.
 * On a full ring, the strategy finds the smallest radius `r` at which these angles fill the ring.
 * Thus a small child takes less of the ring than a large child.
 *
 * On a part of a ring, each child is at the middle of an equal part of the arc. The largest circle sets the radius.
 */
import { at } from "../at.ts";
import { farthestCorner } from "../geometry.ts";
import { defineStrategy, type MeasuredChild, type Strategy } from "../strategy.ts";

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
    const n = children.length;
    const rhos = children.map(rhoOf);
    const rhoMax = Math.max(...rhos);
    const direction = options.clockwise ? 1 : -1;
    const start = (options.startAngle * Math.PI) / 180;
    const full = options.sweep >= 360;
    // In the linked mode, no child circle can touch the circle of the node.
    const floor = mode === "linked" ? Math.hypot(self.width, self.height) / 2 + rhoMax + (options.distance > 0 ? options.distance : gap) : 0;

    let r: number;
    let angles: number[];
    if (n === 1) {
      r = floor;
      angles = [full ? start : start + (direction * (options.sweep * Math.PI) / 180) / 2];
    } else if (full && n <= PAIRWISE_LIMIT) {
      // The angle that each pair of neighbors needs. The pair (n - 1, 0) closes the ring.
      const need = rhos.map((rho, i) => rho + at(rhos, (i + 1) % n) + gap);
      // Neighbors that keep apart do not prove that all pairs keep apart: two large circles can touch across a small
      // one. The search keeps "hi" at a radius where all pairs keep apart.
      const ok = (radius: number): boolean => {
        const a = anglesAt(radius, need, start, direction);
        return a !== undefined && pairsApart(a, rhos, radius, gap);
      };
      let lo = Math.max(floor, smallestRadius(need, 2 * Math.PI));
      if (ok(lo)) r = lo;
      else {
        let hi = lo * 2;
        while (!ok(hi)) hi *= 2;
        for (let k = 0; k < 50; k++) {
          const mid = (lo + hi) / 2;
          if (ok(mid)) hi = mid;
          else lo = mid;
        }
        r = hi;
      }
      angles = at([anglesAt(r, need, start, direction)].filter((a): a is number[] => a !== undefined), 0);
    } else if (full) {
      // A ring with very many children: equal angles and the largest circle. This is safe for all pairs, and fast.
      const step = (2 * Math.PI) / n;
      r = Math.max(floor, (2 * rhoMax + gap) / (2 * Math.sin(step / 2)));
      angles = children.map((_, i) => start + direction * i * step);
    } else {
      // On a part of a ring, each child is at the middle of an equal part of the arc. Thus the gap between the last
      // and the first child is never smaller than the step.
      const step = (options.sweep * Math.PI) / 180 / n;
      r = Math.max(floor, (2 * rhoMax + gap) / (2 * Math.sin(step / 2)));
      angles = children.map((_, i) => start + direction * (i + 0.5) * step);
    }

    const center = mode === "linked" ? { x: self.width / 2, y: self.height / 2 } : { x: 0, y: 0 };
    const offsets = children.map((child, i) => {
      const angle = at(angles, i);
      return { x: center.x + r * Math.cos(angle) - child.box.width / 2, y: center.y + r * Math.sin(angle) - child.box.height / 2 };
    });
    return { offsets };
  },
});

/** Above this number of children, a full ring uses equal angles, because the check of all pairs costs O(n^2). */
const PAIRWISE_LIMIT = 256;

/** This function gives the angle of each child at the radius `r`, or undefined if the angles do not fit in the ring. */
function anglesAt(r: number, need: readonly number[], start: number, direction: number): number[] | undefined {
  const steps = need.map((d) => 2 * Math.asin(Math.min(1, d / (2 * r))));
  const spare = (2 * Math.PI - steps.reduce((a, b) => a + b, 0)) / need.length;
  if (spare < -1e-9) return undefined;
  const out: number[] = [];
  let angle = start;
  for (const step of steps) {
    out.push(angle);
    angle += direction * (step + Math.max(0, spare));
  }
  return out;
}

/** This function tells if the circles of all pairs of children keep apart by the gap. */
function pairsApart(angles: readonly number[], rhos: readonly number[], r: number, gap: number): boolean {
  for (let i = 0; i < angles.length; i++) {
    for (let j = i + 1; j < angles.length; j++) {
      const d = Math.abs(at(angles, i) - at(angles, j)) % (2 * Math.PI);
      const chord = 2 * r * Math.sin(Math.min(d, 2 * Math.PI - d) / 2);
      if (chord < at(rhos, i) + at(rhos, j) + gap - 1e-7) return false;
    }
  }
  return true;
}

/** This function gives the radius of the circle around the center of a child box that holds its extent. */
function rhoOf(child: MeasuredChild): number {
  return farthestCorner({ x: child.box.width / 2, y: child.box.height / 2 }, child.extent);
}

/**
 * This function gives the smallest radius at which the chords `need` fit in the angle `total`.
 * The sum of the angles `2 * asin(d / (2 * r))` gets smaller when `r` gets larger, so a bisection finds the radius.
 */
function smallestRadius(need: readonly number[], total: number): number {
  const angle = (r: number): number => need.reduce((sum, d) => sum + 2 * Math.asin(Math.min(1, d / (2 * r))), 0);
  let lo = Math.max(...need) / 2;
  if (angle(lo) <= total) return lo;
  let hi = lo * 2;
  while (angle(hi) > total) hi *= 2;
  for (let k = 0; k < 64; k++) {
    const mid = (lo + hi) / 2;
    if (angle(mid) > total) lo = mid;
    else hi = mid;
  }
  return hi;
}
