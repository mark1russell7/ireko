/**
 * An independent check of the invariants of a layout. It does not use the audit of the engine: it compares each pair
 * of boxes, so it is slow but easy to trust. The property tests use it as the oracle.
 */
import type { Layout, PlacedNode } from "../core/model.ts";

const EPS = 0.5;

/** This function gives a list of the defects of a layout. An empty list means that the layout is valid. */
export function defectsOf(layout: Layout): string[] {
  const out: string[] = [];
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const chain = (n: PlacedNode): Set<string> => {
    const s = new Set<string>();
    for (let c = n.container; c !== undefined; c = byId.get(c)?.container) s.add(c);
    return s;
  };
  const chains = new Map(layout.nodes.map((n) => [n.id, chain(n)]));

  for (const n of layout.nodes) {
    for (const v of [n.x, n.y, n.width, n.height, n.scale]) if (!Number.isFinite(v)) out.push(`not finite: ${n.id}`);
    if (!(n.width > 0 && n.height > 0)) out.push(`empty box: ${n.id}`);
    if (n.container !== undefined) {
      const c = byId.get(n.container);
      if (c === undefined) out.push(`unknown container: ${n.id}`);
      else if (!c.clip && !(n.x >= c.x - EPS && n.y >= c.y - EPS && n.x + n.width <= c.x + c.width + EPS && n.y + n.height <= c.y + c.height + EPS)) {
        out.push(`escape: ${n.id} from ${c.id}`);
      }
    }
  }
  const nodes = layout.nodes;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a === undefined || b === undefined) continue;
      if (chains.get(a.id)?.has(b.id) === true || chains.get(b.id)?.has(a.id) === true) continue;
      if (a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS) {
        out.push(`overlap: ${a.id} ~ ${b.id}`);
      }
    }
  }
  return out;
}

/** This function gives the distance from a point to the edge of a rectangle. A point inside gives a negative distance. */
export function distanceToBorder(p: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  return -Math.min(p.x - r.x, r.x + r.width - p.x, p.y - r.y, r.y + r.height - p.y);
}
