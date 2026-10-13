import { Vector } from "../../core/geometry";
import type { Edge } from "../api/contracts";
import type { LayoutSnapshot } from "../types";
import type { EdgeRouter, RoutedEdge } from "../registries/router.registry";
import { type AnchorKind, resolveEndpoints } from "../../render/ports/anchoring";

// /** Simple Manhattan "L" router: choose the shorter elbow. */
// export class OrthoRouter implements EdgeRouter {
//   route(e: Edge, snapshot: LayoutSnapshot): Partial<RoutedEdge> | undefined {
//     const a = snapshot.boxes[e.source];
//     const b = snapshot.boxes[e.target];
//     if (!a || !b) return undefined;

//     const ac = a.position.add(a.size.halve());
//     const bc = b.position.add(b.size.halve());

//     const turnHFirst = [ac, new Vector(bc.x, ac.y), bc];
//     const turnVFirst = [ac, new Vector(ac.x, bc.y), bc];

//     const len = (pts: Vector[]) => {
//       let t = 0;
//       for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
//       return t;
//     };

//     const path = len(turnHFirst) <= len(turnVFirst) ? turnHFirst : turnVFirst;
//     return { polyline: path };
//   }
// }

/** Manhattan ‘L’: pick shorter elbow; uses the same anchoring. */
export class OrthoRouter implements EdgeRouter {
  constructor(private anchor: AnchorKind = "center") {}
  route(e: Edge, snapshot: LayoutSnapshot): Partial<RoutedEdge> | undefined {
    const a = snapshot.boxes[e.source], b = snapshot.boxes[e.target];
    if (!a || !b) return undefined;
    const { A, B } = resolveEndpoints(a, b, this.anchor);

    const H = new Vector(B.x, A.y);
    const V = new Vector(A.x, B.y);

    const len = (pts: Vector[]) => {
      // let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);

      let t = 0; for (let i = 1; i < pts.length; i++) t += pts[i].subtract(pts[i-1]).length();
      return t;
    };

    const path = len([A, H, B]) <= len([A, V, B]) ? [A, H, B] : [A, V, B];
    return { polyline: path };
  }
}

