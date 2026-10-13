/**
 * The route phase. It makes the tree edges and the extra edges, and it asks the router for the points of each edge.
 */
import { at } from "../at.ts";
import { clean, type Point, type Rect } from "../geometry.ts";
import type { Issue, PlacedEdge, PlacedNode } from "../model.ts";
import { straight } from "../routers.ts";
import type { Router } from "../router.ts";
import type { Direction } from "../strategy.ts";
import type { Context, Normalized } from "./types.ts";

/** This function gives the routed edges. It adds its findings to `issues`. */
export function route(norm: Normalized, nodes: readonly PlacedNode[], ctx: Context, issues: Issue[], direction: readonly (Direction | undefined)[] = []): PlacedEdge[] {
  const out: PlacedEdge[] = [];
  const ids = new Set<string>();
  const { router, treeEdges } = ctx.options;
  const near = router.obstacles === true ? obstaclesOf(norm, nodes) : undefined;

  const add = (id: string, kind: PlacedEdge["kind"], s: number, t: number, extra?: { label?: string; data?: unknown }): void => {
    // A tree edge goes in the direction of the strategy of its parent.
    const dir = kind === "tree" ? direction[s] : undefined;
    const source = at(nodes, s);
    const target = at(nodes, t);
    let unique = id;
    for (let k = 2; ids.has(unique); k++) unique = `${id}#${String(k)}`;
    if (unique !== id) issues.push({ code: "DUPLICATE_ID", severity: "warning", message: `Two edges have the identifier "${id}". The engine renames the second edge "${unique}".`, edge: unique });
    ids.add(unique);
    out.push({
      id: unique,
      source: source.id,
      target: target.id,
      kind,
      points: routeSafely(router, { id: unique, kind, source, target, ...(dir === undefined ? {} : { direction: dir }), ...(near === undefined ? {} : { obstacles: near(s, t) }) }, issues),
      ...(extra?.label === undefined ? {} : { label: extra.label }),
      ...(extra?.data === undefined ? {} : { data: extra.data }),
    });
  };

  if (treeEdges !== "none") {
    norm.nodes.forEach((node, i) => {
      if (node.parent < 0) return;
      const parent = at(norm.nodes, node.parent);
      if (treeEdges === "all" || parent.mode === "linked") add(`${parent.id}->${node.id}`, "tree", node.parent, i);
    });
  }
  for (const e of norm.edges) {
    add(e.id, "extra", e.source, e.target, {
      ...(typeof e.spec.label === "string" ? { label: e.spec.label } : {}),
      ...(e.spec.data === undefined ? {} : { data: e.spec.data }),
    });
  }
  return out;
}

/** The largest number of obstacles of one edge. The nearest boxes count. */
export const MAX_OBSTACLES = 32;

/**
 * This function gives a function that gives the obstacles of an edge between the nodes `s` and `t`.
 * An obstacle is a box that is not an end of the edge and that does not hold an end through nested containers.
 * The boxes inside an end do not count either. The nearest `MAX_OBSTACLES` boxes to the line between the ends count.
 */
function obstaclesOf(norm: Normalized, nodes: readonly PlacedNode[]): (s: number, t: number) => Rect[] {
  const n = norm.nodes.length;
  // In the pre-order, the subtree of a node is the range of indexes from the node to end[node].
  const end = new Int32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const children = at(norm.nodes, i).children;
    end[i] = children.length === 0 ? i + 1 : at(end, at(children, children.length - 1));
  }
  const holds = (a: number, b: number): boolean => b > a && b < at(end, a) && at(norm.nodes, a).mode === "nested";
  return (s, t) => {
    const a = at(nodes, s);
    const b = at(nodes, t);
    const middle = { x: (a.x + a.width / 2 + b.x + b.width / 2) / 2, y: (a.y + a.height / 2 + b.y + b.height / 2) / 2 };
    const found: { r: Rect; d: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (i === s || i === t || holds(i, s) || holds(i, t) || holds(s, i) || holds(t, i)) continue;
      const r = at(nodes, i);
      const d = Math.hypot(r.x + r.width / 2 - middle.x, r.y + r.height / 2 - middle.y);
      found.push({ r: { x: r.x, y: r.y, width: r.width, height: r.height }, d });
    }
    return found.toSorted((p, q) => p.d - q.d).slice(0, MAX_OBSTACLES).map((f) => f.r);
  };
}

function routeSafely(router: Router, input: Parameters<Router["route"]>[0], issues: Issue[]): Point[] {
  try {
    const points = router.route(input);
    // A router of the user can give anything, so the check reads the route as unknown data first.
    const raw: unknown = points;
    if (Array.isArray(raw) && raw.length >= 2 && points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      return points.map((p) => ({ x: clean(p.x), y: clean(p.y) }));
    }
    issues.push({ code: "ROUTER_FAILED", severity: "error", message: `The router "${router.type}" gave a bad route for the edge "${input.id}". The engine uses "straight".`, edge: input.id });
  } catch (error) {
    issues.push({ code: "ROUTER_FAILED", severity: "error", message: `The router "${router.type}" threw for the edge "${input.id}": ${error instanceof Error ? error.message : String(error)} The engine uses "straight".`, edge: input.id });
  }
  return straight.route(input).map((p) => ({ x: clean(p.x), y: clean(p.y) }));
}
