/**
 * The route phase. It makes the tree edges and the extra edges, and it asks the router for the points of each edge.
 */
import { at } from "../at.ts";
import { clean, type Point } from "../geometry.ts";
import type { Issue, PlacedEdge, PlacedNode } from "../model.ts";
import { straight } from "../routers.ts";
import type { Router } from "../router.ts";
import type { Context, Normalized } from "./types.ts";

/** This function gives the routed edges. It adds its findings to `issues`. */
export function route(norm: Normalized, nodes: readonly PlacedNode[], ctx: Context, issues: Issue[]): PlacedEdge[] {
  const out: PlacedEdge[] = [];
  const ids = new Set<string>();
  const { router, treeEdges } = ctx.options;

  const add = (id: string, kind: PlacedEdge["kind"], s: number, t: number, extra?: { label?: string; data?: unknown }): void => {
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
      points: routeSafely(router, { id: unique, kind, source, target }, issues),
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
