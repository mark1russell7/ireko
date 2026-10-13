import "reactflow/dist/style.css";
import { JSX, useEffect, useMemo, useState } from "react";
import { NodeConfig } from "./graph/types";
import { Vector } from "./core/geometry";
import { EdgeLineType, InputKind, LayoutChildrenMode, LayoutTypes } from "./layout/layout.enum";
import { LabeledSlider, Segmented } from "./ui/controls/controls";
import { Shell } from "./ui/styles/styles";
import { Configurator } from "./ui/controls/Configurator";
import { Target } from "./adapters/env";
import { LayoutView } from "./render/views/LayoutView";
import { createLayoutAPI } from "./layout/api";
import type { GraphInput } from "./layout/api";
import { ConsoleLogger, LogLevel } from "./core/logging/logger";
import { createDefaultSystem } from "./layout/engine/context";

const DEMO: NodeConfig = {
  id: "root",
  label: "Root",
  position: new Vector(200, 60),
  children: [
    { id: "A", label: "A", children: [{ id: "A1" }, { id: "A2" }, { id: "A3" }] },
    { id: "B", label: "B", children: [{ id: "B1" }, { id: "B2" }, { id: "B3" }, { id: "B4" }] },
    { id: "C", label: "C", children: [{ id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }] },
  ],
};
Object.freeze(DEMO);

const DEMO_MIXED: NodeConfig = {
  id: "root",
  label: "Root",
  position: new Vector(200, 60),
  layout: LayoutTypes.Grid,
  children: [
    { id: "A", label: "A", layout: LayoutTypes.Radial, children: [{ id: "A1" }, { id: "A2" }, { id: "A3" }] },
    { id: "B", label: "B", layout: LayoutTypes.Grid, children: [{ id: "B1" }, { id: "B2" }, { id: "B3" }, { id: "B4" }] },
    { id: "C", label: "C", layout: LayoutTypes.Radial, children: [{ id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }] },
  ],
};
Object.freeze(DEMO_MIXED);

export type ParentChildLayoutsDemoProps = { config?: NodeConfig };

export const ParentChildLayoutsDemo = ({ config = DEMO_MIXED }: ParentChildLayoutsDemoProps): JSX.Element => {
  const [adapter, setAdapter] = useState<Target.DOM | Target.Canvas | Target.ReactFlow>(Target.DOM);
  const [spacing, setSpacing] = useState(24);
  const [nodeW, setNodeW] = useState(110);
  const [nodeH, setNodeH] = useState(54);
  const LIMITS = { spacing: { min: 0, max: 80 }, nodeW: { min: 40, max: 240 }, nodeH: { min: 30, max: 180 } };

  const [layoutName, setLayoutName] = useState<LayoutTypes>(LayoutTypes.Grid);
  const [modes, setModes] = useState<Record<string, LayoutChildrenMode>>({
    root: LayoutChildrenMode.GRAPH,
    A: LayoutChildrenMode.NESTED,
    B: LayoutChildrenMode.GRAPH,
    C: LayoutChildrenMode.NESTED,
  });
  const [scope, setScope] = useState<"all" | string>("all");
  const [applyToSubtree, setApplyToSubtree] = useState(true);

  const effectiveConfig = useMemo<NodeConfig>(() => {
    const clone = (n: NodeConfig): NodeConfig => ({ ...n, children: (n.children ?? []).map(clone) });
    const copy: NodeConfig = clone(config);

    // apply layout selection to scope (existing behavior)
    const setLayout = (n: NodeConfig): void => {
      if (scope === "all" || n.id === scope) n.layout = layoutName;
      if (applyToSubtree || scope === "all") (n.children ?? []).forEach(setLayout);
    };
    setLayout(copy);

    // NEW: apply modes map everywhere it’s provided
    const applyMode = (n: NodeConfig): void => {
      const m = modes[n.id];
      if (m !== undefined) n.mode = m;
      (n.children ?? []).forEach(applyMode);
    };
    applyMode(copy);

    return copy;
  }, [config, layoutName, scope, applyToSubtree, modes]);

  const nodeSize: Vector = useMemo(() => new Vector(Math.max(20, nodeW), Math.max(20, nodeH)), [nodeW, nodeH]);

  const [logLevel, setLogLevel] = useState<LogLevel>(LogLevel.Warn);

  const api = useMemo(() => {
    const ctx = createDefaultSystem({ log: new ConsoleLogger(logLevel) });
    return createLayoutAPI(ctx);
  }, [logLevel]);

  const input: GraphInput = useMemo(() => (
    { kind: InputKind.Tree, root: effectiveConfig }), [effectiveConfig]);

  const [routerName, setRouterName] = useState<EdgeLineType>(EdgeLineType.Straight);
  const snapshot = useMemo(
    () =>
      api.compute(input, {
        nodeSize,
        spacing,
        collectOverlaps: false,
        routerName,
      }),
    [api, input, nodeSize, spacing, routerName]
  );

  const nestedGridActive = useMemo(
    () => layoutName === LayoutTypes.Grid && Object.keys(modes).some((id) => (modes[id] ?? LayoutChildrenMode.GRAPH) === LayoutChildrenMode.NESTED),
    [layoutName, modes]
  );

  // useEffect(() => {
  //   if (nestedGridActive) {
  //     setSpacing(LIMITS.spacing.min);
  //     setNodeW(LIMITS.nodeW.max);
  //     setNodeH(LIMITS.nodeH.max);
  //   }
  // }, [nestedGridActive]);
  const recommended = { spacing: LIMITS.spacing.min, nodeW: LIMITS.nodeW.max, nodeH: LIMITS.nodeH.max };

  return (
    <div style={Shell.outer}>
      <div style={Shell.bar}>
        <Segmented<LogLevel>
          label="Log"
          value={logLevel}
          onChange={setLogLevel}
          options={[
            { label: "Off",  value: LogLevel.Off },
            { label: "Warn", value: LogLevel.Warn },
            { label: "Info", value: LogLevel.Info },
            { label: "Debug",value: LogLevel.Debug },
          ]}
        />

        <Segmented<Target.DOM | Target.Canvas | Target.ReactFlow>
          label="Right Pane"
          value={adapter}
          onChange={setAdapter}
          options={[
            { label: "DOM", value: Target.DOM },
            { label: "Canvas", value: Target.Canvas },
            { label: "ReactFlow", value: Target.ReactFlow },
          ]}
        />
        <LabeledSlider label="Spacing" value={spacing} min={LIMITS.spacing.min} max={LIMITS.spacing.max} onChange={setSpacing} />
        <LabeledSlider label="Node W" value={nodeW} min={LIMITS.nodeW.min} max={LIMITS.nodeW.max} onChange={setNodeW} /> 
        <LabeledSlider label="Node H" value={nodeH} min={LIMITS.nodeH.min} max={LIMITS.nodeH.max} onChange={setNodeH} />
        {nestedGridActive && (
          <button
            onClick={() => {
              setSpacing(recommended.spacing);
              setNodeW(recommended.nodeW);
              setNodeH(recommended.nodeH);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #d0d7de",
              background: "#f8fafc",
              fontSize: 12,
              marginLeft: 8,
              color : "black"
            }}
            title="Snap spacing & node size to grid-friendly values"
          >
            Apply Slider Recommendations
          </button>
        )}
        
        <Configurator
          root={config}
          modes={modes}
          setModes={setModes}
          layout={layoutName}
          setLayout={setLayoutName}
          scope={scope}
          setScope={setScope}
          applyToSubtree={applyToSubtree}
          setApplyToSubtree={setApplyToSubtree}
          routerName={routerName}
          setRouterName={setRouterName}
        />
      </div>

      <div style={Shell.left}>
        <div style={Shell.title}>Graph (Edges)</div>
        <div style={Shell.rf}>
          <LayoutView kind={Target.ReactFlow} snapshot={snapshot} unifiedZoom showZoomControls />
        </div>
      </div>

      <div style={Shell.right}>
        <div style={Shell.title}>Right Pane: {adapter}</div>
        <div style={{ position: "absolute", inset: 0 }}>
          <LayoutView kind={adapter} snapshot={snapshot} unifiedZoom showZoomControls />
        </div>
      </div>
    </div>
  );
};
