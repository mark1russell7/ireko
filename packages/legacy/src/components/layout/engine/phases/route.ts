import type { LayoutSnapshot } from "../../types";
import type { SystemContext } from "../context";
import type { Edge } from "../../api/contracts";
import { sliceBound } from "../../../iteration/iterate";
import { EdgeLineType } from "../../layout.enum";

/** Route wires using the chosen router; respects edge limits policy. */
export function route(
  snapshot: LayoutSnapshot,
  ctx: SystemContext,
  _edges?: Edge[],
  routerName : EdgeLineType = EdgeLineType.Straight
): LayoutSnapshot {
  const router = ctx.routers.get(routerName);
  const maxEdges = ctx.limits.get("maxEdges");
  const policy = ctx.limits.get("onLimit");

  const wires = sliceBound(snapshot.wires as any[], maxEdges, policy, ctx.log, "route:wires").map((w, i) => {
    const routed = router.route({ id: w.id ?? String(i), source: w.source, target: w.target }, snapshot);
    return routed?.polyline ? { ...w, polyline: routed.polyline } : w;
  });

  return { ...snapshot, wires };
}
// (phase wrapper intentionally not exported; engine calls route(snapshot, ctx) directly)
