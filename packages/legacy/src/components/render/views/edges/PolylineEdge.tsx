import { memo } from "react";
import type { EdgeProps } from "reactflow";

/** Draws an absolute polyline from snapshot (no RF auto-routing). */
function PolylineEdgeBase({ id, data }: EdgeProps) {
  const pts = (data?.polyline as Array<{ x: number; y: number }> | undefined) ?? [];
  const d =
    pts.length >= 2
      ? `M ${pts.map((p) => `${p.x},${p.y}`).join(" L ")}`
      : undefined;

  if (!d) return null;
  return (
    <g>
      <path id={id} d={d} fill="none" stroke="#94a3b8" strokeWidth={1} />
    </g>
  );
}

export const PolylineEdge = memo(PolylineEdgeBase);
export default PolylineEdge;
