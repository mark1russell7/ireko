/**
 * The relaxation with a test of each pair of boxes: no lists of numbers, no grid and no tree. It is slow but easy
 * to trust. The tests compare `relaxForces` with it, bit for bit.
 *
 * The steps are the steps of `relaxForces` with a `theta` of 0. The function does not examine its arguments.
 */
import { at } from "../core/at.ts";
import type { Point } from "../core/geometry.ts";
import type { RelaxEdge, RelaxNode, RelaxOptions } from "../core/relax.ts";

/** A box of the relaxation: its center, its size and its state. */
interface Body {
  readonly id: string;
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;
  readonly fixed: boolean;
}

/** The order of two identifiers: the order of their UTF-16 code units. */
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** This function relaxes the boxes with a test of each pair, and gives the top-left corner of each box, by its identifier. */
export function relaxEachPair(nodes: readonly RelaxNode[], edges: readonly RelaxEdge[], options: Omit<RelaxOptions, "theta">): Map<string, Point> {
  const { iterations, springLength, repulsion, margin, inset, minDistance, centering, maxStep, separationPasses, bound } = options;
  const width = bound.width, height = bound.height;
  const floor = minDistance * minDistance;
  const bodies: Body[] = nodes
    .toSorted((a, b) => byId(a.id, b.id))
    .map((n) => ({ id: n.id, x: n.rect.x + n.rect.width / 2, y: n.rect.y + n.rect.height / 2, w: n.rect.width, h: n.rect.height, fixed: n.fixed === true }));
  const index = new Map(bodies.map((b, i) => [b.id, i]));
  const springs = edges
    .map((e) => {
      const from = index.get(e.from) ?? 0, to = index.get(e.to) ?? 0;
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
      if (!a.fixed) {
        a.x += ux * pull;
        a.y += uy * pull;
      }
      if (!b.fixed) {
        b.x -= ux * pull;
        b.y -= uy * pull;
      }
    }
  }

  // Step 2: the clamp.
  const clamp = (n: Body): void => {
    n.x = Math.min(Math.max(n.x, n.w / 2 + inset), Math.max(n.w / 2 + inset, width - n.w / 2 - inset));
    n.y = Math.max(n.y, n.h / 2 + inset);
  };
  const overlap = (a: Body, b: Body): boolean => (a.w + b.w) / 2 + margin - Math.abs(a.x - b.x) > 0 && (a.h + b.h) / 2 + margin - Math.abs(a.y - b.y) > 0;
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
