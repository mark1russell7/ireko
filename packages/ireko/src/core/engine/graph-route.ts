/**
 * The graph route phase. It gives all the boxes and all the edges to a graph router, and its routes replace the routes
 * of the route phase.
 *
 * - The obstacles are all the boxes, the containers too. A root in the nested mode holds each other box, so it is not an obstacle.
 * - An edge between a container and a box inside it keeps its route. The two boxes have no clear border between them.
 * - A route that goes through a box gives the finding `EDGE_THROUGH_BOX`. An end of the edge and a container that holds an end do not count.
 * - A missing or bad route, or a router that throws, gives the finding `ROUTER_FAILED`. The edge keeps its route.
 */
import { clean } from "../geometry.ts";
import type { Issue, PlacedEdge, PlacedNode } from "../model.ts";
import type { GraphRoute, GraphRouter } from "../router.ts";

/** This function gives the edges with the routes of `router`. It adds its findings to `issues`. */
export function graphRoute(router: GraphRouter, nodes: readonly PlacedNode[], edges: readonly PlacedEdge[], issues: Issue[]): PlacedEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = nodes.find((n) => n.parent === undefined);
  const frame = root?.mode === "nested" ? root.id : undefined;
  /** This function tells if the box `a` holds the box `b` through nested containers. */
  const holds = (a: string, b: string): boolean => {
    for (let c = byId.get(b)?.container; c !== undefined; c = byId.get(c)?.container) if (c === a) return true;
    return false;
  };
  const name = router.name ?? "graph";
  const failed = (edge: string | undefined, problem: string): void => {
    issues.push({ code: "ROUTER_FAILED", severity: "error", message: `The graph router "${name}" ${problem} The edge keeps its first route.`, ...(edge === undefined ? {} : { edge }) });
  };

  const routed = edges.filter((e) => !holds(e.source, e.target) && !holds(e.target, e.source));
  let routes: readonly GraphRoute[];
  try {
    const result = router.route({
      nodes: nodes
        .filter((n) => n.id !== frame)
        .map((n) => ({ id: n.id, box: { x: n.x, y: n.y, w: n.width, h: n.height }, ...(n.container === undefined || n.container === frame ? {} : { parent: n.container }) })),
      edges: routed.map((e) => ({ id: e.id, source: { node: e.source }, target: { node: e.target } })),
    });
    // A router of the user can give anything, so the check reads the result as unknown data first.
    const raw: unknown = result.routes;
    if (!Array.isArray(raw)) throw new TypeError("The result has no list of routes.");
    routes = result.routes;
  } catch (error) {
    failed(undefined, `threw: ${error instanceof Error ? error.message : String(error)}`);
    return [...edges];
  }

  const byEdge = new Map(routes.map((r) => [r.edge, r]));
  const wanted = new Set(routed.map((e) => e.id));
  return edges.map((e) => {
    if (!wanted.has(e.id)) return e;
    const route = byEdge.get(e.id);
    const points: unknown = route?.points;
    if (route === undefined || !Array.isArray(points) || points.length < 2 || !route.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      failed(e.id, `gave no route or a bad route for the edge "${e.id}".`);
      return e;
    }
    const listed: readonly string[] = Array.isArray(route.through) ? route.through : [];
    const through = listed.filter((id) => id !== e.source && id !== e.target && !holds(id, e.source) && !holds(id, e.target));
    if (through.length > 0) {
      issues.push({ code: "EDGE_THROUGH_BOX", severity: "warning", message: `The edge "${e.id}" goes through the boxes ${through.map((id) => `"${id}"`).join(", ")}.`, edge: e.id, detail: { boxes: through, router: name } });
    }
    return { ...e, points: route.points.map((p) => ({ x: clean(p.x), y: clean(p.y) })) };
  });
}
