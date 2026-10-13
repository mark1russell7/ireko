import type { LayoutSnapshot } from "../../layout/types";
import type { Node, Edge } from "reactflow";

export function toReactFlow(snapshot: LayoutSnapshot): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.values(snapshot.boxes).map((b) => {
    const style: React.CSSProperties = {
      width: b.size.x,
      height: b.size.y,
      border: "1px solid #cbd5e1",
      borderRadius: 10,
      background: "#fff",
      fontSize: 12,
      boxSizing: "border-box",
    };
    const rel = b.parentId
      ? { x: b.position.x - (snapshot.boxes[b.parentId].position.x), y: b.position.y - (snapshot.boxes[b.parentId].position.y) }
      : { x: b.position.x, y: b.position.y };
    const base: Node = { id: b.id, position: rel, data: { label: b.id }, style };
    return b.parentId ? { ...base, parentNode: b.parentId, extent: "parent" } : base;
  });


  const edges = snapshot.wires.map((w, i) => {
    const hasPolyline = !!(w.polyline && w.polyline.length >= 2);
    return {
      id: w.id ?? String(i),
      source: w.source,
      target: w.target,
      type: hasPolyline ? "poly" : "default",
      data: hasPolyline
        ? { polyline: w.polyline!.map((p) => ({ x: p.x, y: p.y })) }
        : undefined,
    };
  });

  return { nodes, edges };
}
