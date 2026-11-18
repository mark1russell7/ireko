/**
 * A force-directed relaxation of boxes, as one pure function. Boxes with identifiers, weighted springs between them
 * and a bound go in. The top-left corner of each box comes out. The function changes none of its arguments.
 *
 * The steps are deterministic. The same input gives the same output. The order of the input has no effect. The
 * steps visit the boxes in the order of their identifiers, and the springs in the order of their two identifiers.
 *
 * 1. `iterations` steps, each with a cooling factor of `1 - step / iterations`. In each step, each pair of boxes
 *    repels by `repulsion / d²`, where `d` is at least `minDistance`. Each box goes to the center of the bound by
 *    `centering` times its distance. Each free box moves in turn. Its step has a limit of `maxStep` on each axis
 *    before the cooling. Then each spring pulls its two ends by `(d - springLength) * strength`, along their line.
 * 2. A clamp. The center of each box stays inside the width of the bound, `inset` from each side. The top of each
 *    box stays `inset` below the top of the bound. The bound has no bottom: the content can grow down.
 * 3. At most `separationPasses` separation passes. Each pair that is nearer than `margin` on both axes moves apart on the axis of
 *    the smaller overlap. The odd passes always use the y axis, so a pair at a side wall can move.
 * 4. Only when step 3 ends with an overlap: a sweep down. The sweep takes the fixed boxes first. Then each free box, in
 *    the order of its center y and its identifier, moves down below each placed box that it overlaps. A box below a
 *    placed box does not meet that box again, because its y only increases. Thus each box passes each other box
 *    at most once, and the sweep makes fewer than n² moves.
 *
 * A fixed box pushes the other boxes. It stays at its place.
 *
 * With a `theta` of 0, step 1 reads each pair of boxes. Its time then grows with the square of the number of boxes.
 * With more, a tree of square cells holds the centers (`relax-far.ts`). A cell that is far from a box repels that
 * box as one box, from the mean of its centers. A cell is far when its width is less than `theta` times its distance.
 * Thus the positions are near the positions of a `theta` of 0, but they are not the same.
 *
 * Step 3 reads only the pairs that a grid of cells gives (`relax-apart.ts`). Its result is the result of a test of
 * each pair, bit for bit.
 *
 * A strength has a limit of 0.5. With a larger strength, one spring step moves the two ends past the spring
 * length, and the springs can oscillate.
 */
import { at } from "./at.ts";
import type { Point, Rect } from "./geometry.ts";
import { separation } from "./relax-apart.ts";
import { farField } from "./relax-far.ts";
import { flag, num } from "./typed.ts";

/** A box of the relaxation. */
export interface RelaxNode {
  /** The identifier. It sets the order of the steps, so it is the tie rule. Each node must have a different identifier. */
  readonly id: string;
  /** The box at the start: its top-left corner and its size. */
  readonly rect: Rect;
  /** If true, the box stays at its place. Other boxes go around it. */
  readonly fixed?: boolean;
}

/** A spring between two boxes. A spring from a box to the same box has no effect. */
export interface RelaxEdge {
  readonly from: string;
  readonly to: string;
  /** The stiffness of the spring. */
  readonly strength: number;
}

/** The options of the relaxation. */
export interface RelaxOptions {
  /** The number of force steps. */
  readonly iterations: number;
  /** The length at which a spring has no force. */
  readonly springLength: number;
  /** The strength of the repulsion between two boxes. */
  readonly repulsion: number;
  /** The smallest distance between two boxes after the separation. */
  readonly margin: number;
  /** The distance between a box and a side or the top of the bound. */
  readonly inset: number;
  /** The smallest distance between two centers in the repulsion, more than 0. It prevents a very large force between two near boxes. */
  readonly minDistance: number;
  /** The pull of each box to the center of the bound, as a fraction of its distance to the center. */
  readonly centering: number;
  /** The limit of the force step of a box on each axis, before the cooling. */
  readonly maxStep: number;
  /** The largest number of separation passes (step 3). */
  readonly separationPasses: number;
  /**
   * The accuracy of the repulsion of the far boxes, from 0 to 1. With 0, each pair of boxes repels exactly.
   * With more, a group of far boxes repels as one box, and the relaxation of many boxes is faster.
   */
  readonly theta: number;
  /** The width and the height of the area. The boxes go to its center. */
  readonly bound: { readonly width: number; readonly height: number };
}

/** The default options, except the bound. */
export const RELAX_DEFAULTS: Omit<RelaxOptions, "bound"> = {
  iterations: 150,
  springLength: 340,
  repulsion: 90_000,
  margin: 12,
  inset: 4,
  minDistance: 20,
  centering: 0.005,
  maxStep: 30,
  separationPasses: 300,
  theta: 0,
};

/** The largest value of the option `theta`. With more, a far group of boxes can contain the box that it repels. */
export const MAX_THETA = 1;

/** The largest strength of a spring. With a larger strength, one step moves the two ends past the spring length. */
export const MAX_SPRING_STRENGTH = 0.5;

/** This function throws a `RangeError` if the value is not a finite number of 0 or more (or not an integer, if it must be one). */
function check(what: string, value: number, integer = false, max = Infinity): void {
  if (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) {
    const limit = max < Infinity ? ` and ${String(max)} or less` : "";
    throw new RangeError(`ireko: ${what} must be a finite${integer ? " integer" : " number"} of 0 or more${limit}, not ${String(value)}.`);
  }
}

/** The order of two identifiers: the order of their UTF-16 code units, the same in each locale. */
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * This function relaxes the boxes, and gives the top-left corner of each box, by its identifier.
 * It throws a `RangeError` in these conditions:
 *
 * - Two nodes have the same identifier, or a spring names an identifier with no node.
 * - A size, a strength or an option is not a finite number of 0 or more, or a position is not finite.
 * - The option `minDistance` is 0.
 * - A strength is more than `MAX_SPRING_STRENGTH`, or `iterations` or `separationPasses` is not an integer.
 * - The option `theta` is more than `MAX_THETA`.
 */
export function relaxForces(nodes: readonly RelaxNode[], edges: readonly RelaxEdge[], options: Partial<RelaxOptions> & Pick<RelaxOptions, "bound">): Map<string, Point> {
  const all = { ...RELAX_DEFAULTS, ...options };
  const { iterations, springLength, repulsion, margin, inset, minDistance, centering, maxStep, separationPasses, theta, bound } = all;
  check("the option theta", theta, false, MAX_THETA);
  for (const key of ["springLength", "repulsion", "margin", "inset", "minDistance", "centering", "maxStep"] as const) check(`the option ${key}`, all[key]);
  if (minDistance === 0) throw new RangeError("ireko: the option minDistance must be more than 0.");
  check("the option iterations", iterations, true);
  check("the option separationPasses", separationPasses, true);
  check("the width of the bound", bound.width);
  check("the height of the bound", bound.height);
  for (const n of nodes) {
    if (!Number.isFinite(n.rect.x) || !Number.isFinite(n.rect.y)) throw new RangeError(`ireko: the position of the node "${n.id}" is not finite.`);
    check(`the width of the node "${n.id}"`, n.rect.width);
    check(`the height of the node "${n.id}"`, n.rect.height);
  }
  for (const e of edges) check(`the strength of the spring "${e.from}" to "${e.to}"`, e.strength, false, MAX_SPRING_STRENGTH);
  const width = bound.width, height = bound.height;
  const floor = minDistance * minDistance;
  // The boxes, in the order of their identifiers. The center and the size of each box are in lists of 64-bit numbers:
  // the steps read each pair of boxes many times, and such a list keeps the numbers of all the boxes together in memory.
  const sorted = nodes.toSorted((a, b) => byId(a.id, b.id));
  const count = sorted.length;
  const xs = Float64Array.from(sorted, (n) => n.rect.x + n.rect.width / 2);
  const ys = Float64Array.from(sorted, (n) => n.rect.y + n.rect.height / 2);
  const ws = Float64Array.from(sorted, (n) => n.rect.width);
  const hs = Float64Array.from(sorted, (n) => n.rect.height);
  const fixed = Uint8Array.from(sorted, (n) => (n.fixed === true ? 1 : 0));
  const index = new Map<string, number>();
  sorted.forEach((n, i) => {
    if (index.has(n.id)) throw new RangeError(`ireko: two nodes of the relaxation have the same id "${n.id}".`);
    index.set(n.id, i);
  });
  const springs = edges
    .map((e) => {
      const from = index.get(e.from), to = index.get(e.to);
      if (from === undefined || to === undefined) throw new RangeError(`ireko: a spring names an unknown node "${from === undefined ? e.from : e.to}".`);
      return { a: Math.min(from, to), b: Math.max(from, to), k: e.strength };
    })
    .filter((s) => s.a !== s.b)
    .toSorted((p, q) => p.a - q.a || p.b - q.b || p.k - q.k);
  const isFree = (i: number): boolean => !flag(fixed, i);

  // Step 1: the forces. Each free box moves in turn, so a box sees the new place of each box before it.
  const cx = width / 2, cy = height / 2;
  const far = theta > 0 ? farField(xs, ys, theta, floor, repulsion) : undefined;
  const sum = new Float64Array(2);
  for (let step = 0; step < iterations; step++) {
    const cooling = 1 - step / iterations;
    far?.build();
    for (let i = 0; i < count; i++) {
      if (!isFree(i)) continue;
      const nx = num(xs, i), ny = num(ys, i);
      let fx = 0, fy = 0;
      if (far === undefined) {
        for (let j = 0; j < count; j++) {
          if (i === j) continue;
          const dx = nx - num(xs, j), dy = ny - num(ys, j);
          const d2 = Math.max(floor, dx * dx + dy * dy);
          const f = repulsion / d2;
          const d = Math.sqrt(d2);
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      } else {
        far.sum(i, nx, ny, sum);
        fx = num(sum, 0);
        fy = num(sum, 1);
      }
      fx += (cx - nx) * centering;
      fy += (cy - ny) * centering;
      xs[i] = nx + Math.max(-maxStep, Math.min(maxStep, fx)) * cooling;
      ys[i] = ny + Math.max(-maxStep, Math.min(maxStep, fy)) * cooling;
    }
    for (const s of springs) {
      const ax = num(xs, s.a), ay = num(ys, s.a), bx = num(xs, s.b), by = num(ys, s.b);
      const dx = bx - ax, dy = by - ay;
      const d = Math.max(1, Math.hypot(dx, dy));
      const pull = (d - springLength) * s.k;
      const ux = dx / d, uy = dy / d;
      if (isFree(s.a)) { xs[s.a] = ax + ux * pull; ys[s.a] = ay + uy * pull; }
      if (isFree(s.b)) { xs[s.b] = bx - ux * pull; ys[s.b] = by - uy * pull; }
    }
  }

  // Step 2: the clamp.
  const clamp = (i: number): void => {
    const w = num(ws, i);
    xs[i] = Math.min(Math.max(num(xs, i), w / 2 + inset), Math.max(w / 2 + inset, width - w / 2 - inset));
    ys[i] = Math.max(num(ys, i), num(hs, i) / 2 + inset);
  };
  for (let i = 0; i < count; i++) if (isFree(i)) clamp(i);

  // Step 3: the separation passes. The even passes can use the x axis.
  let settled = false;
  const separate = separation(xs, ys, ws, hs, fixed, margin);
  for (let pass = 0; pass < separationPasses && !settled; pass++) {
    settled = !separate(pass % 2 === 0);
    for (let i = 0; i < count; i++) if (isFree(i)) clamp(i);
  }

  // Step 4: the sweep down, only when step 3 did not settle.
  if (!settled) {
    const placed: number[] = [];
    const free: number[] = [];
    for (let i = 0; i < count; i++) (isFree(i) ? free : placed).push(i);
    // The index of a box is its place in the order of the identifiers.
    free.sort((a, b) => num(ys, a) - num(ys, b) || a - b);
    for (const n of free) {
      const nx = num(xs, n), nw = num(ws, n), nh = num(hs, n);
      let ny = num(ys, n);
      // After each move, the search of a placed box that overlaps starts again at the first placed box.
      let k = 0;
      while (k < placed.length) {
        const o = at(placed, k);
        const oh = num(hs, o), oy = num(ys, o);
        if ((nw + num(ws, o)) / 2 + margin - Math.abs(nx - num(xs, o)) > 0 && (nh + oh) / 2 + margin - Math.abs(ny - oy) > 0) {
          ny = oy + (nh + oh) / 2 + margin + 1;
          k = 0;
        } else k++;
      }
      ys[n] = ny;
      placed.push(n);
    }
  }
  const out = new Map<string, Point>();
  sorted.forEach((n, i) => out.set(n.id, { x: num(xs, i) - num(ws, i) / 2, y: num(ys, i) - num(hs, i) / 2 }));
  return out;
}
