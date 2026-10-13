import { Vector } from "../../core/geometry";
// import type { Edge } from "../api/contracts";
// import type { LayoutSnapshot } from "../types";
// import type { EdgeRouter, RoutedEdge } from "../registries/router.registry";
// import type { Box } from "../types";
// import { resolveEndpoints, AnchorKind } from "./ports/anchoring";

// export function routeLine(a: Box, b: Box, opts?: { anchor?: AnchorKind }): WireRoute {
//   const { A, B } = resolveEndpoints(a, b, opts?.anchor ?? "center");
//   return { polyline: [A, B] };
// }
import type { Edge } from "../api/contracts";
import type { LayoutSnapshot } from "../types";
import type { EdgeRouter, RoutedEdge } from "../registries/router.registry";
import { resolveEndpoints, type AnchorKind } from "../../render/ports/anchoring";

/** Straight segment; optionally center/perimeter anchoring. */
export class LineRouter implements EdgeRouter {
  constructor(private anchor: AnchorKind = "center") {}
  route(e: Edge, snapshot: LayoutSnapshot): Partial<RoutedEdge> | undefined {
    const a = snapshot.boxes[e.source], b = snapshot.boxes[e.target];
    if (!a || !b) return undefined;
    const { A, B } = resolveEndpoints(a, b, this.anchor);
    return { polyline: [A, B] };
  }
}

/** Simple center-to-center straight router. */
// export class LineRouter implements EdgeRouter {
//   route(e: Edge, snapshot: LayoutSnapshot): Partial<RoutedEdge> | undefined {
//     const a = snapshot.boxes[e.source]; const b = snapshot.boxes[e.target];
//     if (!a || !b) return undefined;
//     const ac = a.position.add(a.size.halve());
//     const bc = b.position.add(b.size.halve());
//     return { polyline: [ac, bc].map((v) => new Vector(v.x, v.y)) };
//   }
// }
