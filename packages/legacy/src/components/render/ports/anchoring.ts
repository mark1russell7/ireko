import { Vector } from "../../core/geometry";
import type { Box } from "../../layout/types";

export type AnchorKind = "center" | "perimeter";

/** Rectangle perimeter intersection from center toward target */
function perimeterAnchor(from: Box, towardCenter: Vector): Vector {
  const c = from.position.add(from.size.halve());
  const d = towardCenter.subtract(c);
  const dx = d.x, dy = d.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return c;

  const hw = from.size.x / 2, hh = from.size.y / 2;
  const tx = dx > 0 ? hw / dx : -hw / dx; // parameter to hit vertical side
  const ty = dy > 0 ? hh / dy : -hh / dy; // parameter to hit horizontal side
  const t = Math.min(Math.abs(tx), Math.abs(ty));
  return c.add(d.scale(t));
}

export function resolveEndpoints(a: Box, b: Box, kind: AnchorKind): { A: Vector; B: Vector } {
  const ca = a.position.add(a.size.halve());
  const cb = b.position.add(b.size.halve());

  if (kind === "center") return { A: ca, B: cb };
  return { A: perimeterAnchor(a, cb), B: perimeterAnchor(b, ca) };
}
