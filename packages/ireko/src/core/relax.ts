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
 * A strength has a limit of 0.5. With a larger strength, one spring step moves the two ends past the spring
 * length, and the springs can oscillate.
 */
import { at } from "./at.ts";
import type { Point, Rect } from "./geometry.ts";

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
};

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

/** A box during the relaxation: its center and its size. */
interface Body {
  readonly id: string;
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;
  readonly fixed: boolean;
}

/**
 * This function relaxes the boxes, and gives the top-left corner of each box, by its identifier.
 * It throws a `RangeError` in these conditions:
 *
 * - Two nodes have the same identifier, or a spring names an identifier with no node.
 * - A size, a strength or an option is not a finite number of 0 or more, or a position is not finite.
 * - The option `minDistance` is 0.
 * - A strength is more than `MAX_SPRING_STRENGTH`, or `iterations` or `separationPasses` is not an integer.
 */
export function relaxForces(nodes: readonly RelaxNode[], edges: readonly RelaxEdge[], options: Partial<RelaxOptions> & Pick<RelaxOptions, "bound">): Map<string, Point> {
  const all = { ...RELAX_DEFAULTS, ...options };
  const { iterations, springLength, repulsion, margin, inset, minDistance, centering, maxStep, separationPasses, bound } = all;
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
  const bodies: Body[] = nodes
    .toSorted((a, b) => byId(a.id, b.id))
    .map((n) => ({ id: n.id, x: n.rect.x + n.rect.width / 2, y: n.rect.y + n.rect.height / 2, w: n.rect.width, h: n.rect.height, fixed: n.fixed === true }));
  const index = new Map<string, number>();
  bodies.forEach((b, i) => {
    if (index.has(b.id)) throw new RangeError(`ireko: two nodes of the relaxation have the same id "${b.id}".`);
    index.set(b.id, i);
  });
  const springs = edges
    .map((e) => {
      const from = index.get(e.from), to = index.get(e.to);
      if (from === undefined || to === undefined) throw new RangeError(`ireko: a spring names an unknown node "${from === undefined ? e.from : e.to}".`);
      return { a: Math.min(from, to), b: Math.max(from, to), k: e.strength };
    })
    .filter((s) => s.a !== s.b)
    .toSorted((p, q) => p.a - q.a || p.b - q.b || p.k - q.k);
  const body = (i: number): Body => at(bodies, i);

  // Step 1: the forces. Each free box moves in turn, so a box sees the new place of each box before it.
  const cx = width / 2, cy = height / 2;
  for (let step = 0; step < iterations; step++) {
    const cooling = 1 - step / iterations;
    for (let i = 0; i < bodies.length; i++) {
      const n = body(i);
      if (n.fixed) continue;
      let fx = 0, fy = 0;
      for (let j = 0; j < bodies.length; j++) {
        if (i === j) continue;
        const m = body(j);
        const dx = n.x - m.x, dy = n.y - m.y;
        const d2 = Math.max(floor, dx * dx + dy * dy);
        const f = repulsion / d2;
        const d = Math.sqrt(d2);
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }
      fx += (cx - n.x) * centering;
      fy += (cy - n.y) * centering;
      n.x += Math.max(-maxStep, Math.min(maxStep, fx)) * cooling;
      n.y += Math.max(-maxStep, Math.min(maxStep, fy)) * cooling;
    }
    for (const s of springs) {
      const a = body(s.a), b = body(s.b);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const pull = (d - springLength) * s.k;
      const ux = dx / d, uy = dy / d;
      if (!a.fixed) { a.x += ux * pull; a.y += uy * pull; }
      if (!b.fixed) { b.x -= ux * pull; b.y -= uy * pull; }
    }
  }

  // Step 2: the clamp.
  const clamp = (n: Body): void => {
    n.x = Math.min(Math.max(n.x, n.w / 2 + inset), Math.max(n.w / 2 + inset, width - n.w / 2 - inset));
    n.y = Math.max(n.y, n.h / 2 + inset);
  };
  const overlap = (a: Body, b: Body): boolean =>
    (a.w + b.w) / 2 + margin - Math.abs(a.x - b.x) > 0 && (a.h + b.h) / 2 + margin - Math.abs(a.y - b.y) > 0;
  for (const n of bodies) if (!n.fixed) clamp(n);

  // Step 3: the separation passes.
  let settled = false;
  for (let pass = 0; pass < separationPasses && !settled; pass++) {
    let moved = false;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = body(i), b = body(j);
        const ox = (a.w + b.w) / 2 + margin - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 + margin - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy && pass % 2 === 0) {
          const push = (ox / 2 + 1) * (a.x < b.x ? -1 : 1);
          if (!a.fixed) a.x += push;
          if (!b.fixed) b.x -= push;
        } else {
          const push = (oy / 2 + 1) * (a.y < b.y ? -1 : 1);
          if (!a.fixed) a.y += push;
          if (!b.fixed) b.y -= push;
        }
      }
    }
    for (const n of bodies) if (!n.fixed) clamp(n);
    settled = !moved;
  }

  // Step 4: the sweep down, only when step 3 did not settle.
  if (!settled) {
    const placed = bodies.filter((n) => n.fixed);
    const free = bodies.filter((n) => !n.fixed).toSorted((a, b) => a.y - b.y || byId(a.id, b.id));
    for (const n of free) {
      for (let hit = placed.find((o) => overlap(n, o)); hit !== undefined; hit = placed.find((o) => overlap(n, o))) {
        n.y = hit.y + (n.h + hit.h) / 2 + margin + 1;
      }
      placed.push(n);
    }
  }
  return new Map(bodies.map((n) => [n.id, { x: n.x - n.w / 2, y: n.y - n.h / 2 }]));
}
