import { JSX, useMemo } from "react";
import { LayoutTypes, LayoutChildrenMode, InputKind, EdgeLineType } from "../../layout/layout.enum";
import { Target } from "../../adapters/env";
import { createLayoutAPI } from "../../layout/api";
import type { GraphInput } from "../../layout/api";
import { Vector } from "../../core/geometry";
import { LayoutView } from "../../render/views/LayoutView";
import { NodeConfig } from "../../graph/types";
function cloneNodeConfig(n: NodeConfig): NodeConfig {
  return {
    id: n.id,
    layout: n.layout,
    // keep "mode" if you store it on the node
    ...(n as any).mode ? { mode: (n as any).mode } : {},
    position: n.position ? new Vector(n.position.x, n.position.y) : undefined,
    children: n.children?.map(cloneNodeConfig),
  };
}
const RENDERERS: Target[] = [Target.DOM, Target.Canvas, Target.ReactFlow];
const LAYOUTS: LayoutTypes[] = [LayoutTypes.Grid, LayoutTypes.Radial];
const MODES: LayoutChildrenMode[] = [LayoutChildrenMode.GRAPH, LayoutChildrenMode.NESTED];

const TREE: NodeConfig = Object.freeze({
  id: "root",
  position: new Vector(120, 60),
  layout: LayoutTypes.Grid,
  children: [
    { id: "A", layout: LayoutTypes.Radial, children: [{ id: "A1" }, { id: "A2" }, { id: "A3" }] },
    { id: "B", layout: LayoutTypes.Grid,   children: [{ id: "B1" }, { id: "B2" }, { id: "B3" }, { id: "B4" }] },
    { id: "C", layout: LayoutTypes.Radial, children: [{ id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }] },
  ],
});

export function TestbedMatrix(): JSX.Element {
  const api = useMemo(() => createLayoutAPI(), []);
  const input: GraphInput = { kind: InputKind.Tree, root: TREE };
  const spacing = 24;
  const nodeSize = new Vector(110, 54);

  return (
    <div style={{ padding: 16, display: "grid", gap: 16, gridTemplateColumns: "repeat(3, minmax(320px, 1fr))" }}>
      {RENDERERS.flatMap((r) =>
        LAYOUTS.flatMap((L) =>
          MODES.map((M) => {
            const cfg = cloneNodeConfig(TREE);
            // apply mode on all nodes for this cell
            const setMode = (n: NodeConfig) => { (n as any).mode = M; (n.children ?? []).forEach(setMode); };
            setMode(cfg);
            // apply layout at root for visual variation
            cfg.layout = L;

            const snap = api.compute(input.kind === InputKind.Tree ? { kind: InputKind.Tree, root: cfg } : input, {
              nodeSize, spacing, routerName: EdgeLineType.Straight,
            });

            const key = `${r}-${L}-${M}`;
            return (
              <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", height: 240, position: "relative" }}>
                <div style={{ padding: 6, fontSize: 12, color: "#334155", borderBottom: "1px solid #e5e7eb" }}>
                  {r} • {L} • {M}
                </div>
                <div style={{ position: "absolute", inset: "28px 0 0 0" }}>
                  <LayoutView kind={r} snapshot={snap} />
                </div>
              </div>
            );
          })
        )
      )}
    </div>
  );
}
