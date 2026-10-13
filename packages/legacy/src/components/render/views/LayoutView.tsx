import { JSX, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import type { LayoutSnapshot } from "../../layout/types";
import { Target } from "../../adapters/env";
import { defaultTheme, type Theme } from "../../adapters/theme";
import { DomPort } from "../ports/dom.port";
import { CanvasPort } from "../ports/canvas.port";
import { toReactFlow } from "../../tooling/exporters/reactflow";
import type { RenderSession } from "../ports/types";
import { ViewportController } from "../ports/viewport";
import PolylineEdge from "./edges/PolylineEdge";

type Props = {
  kind: Target;
  snapshot: LayoutSnapshot;
  theme?: Theme;
  unifiedZoom?: boolean;
  showZoomControls?: boolean;
};

export const LayoutView = ({ kind, snapshot, theme = defaultTheme, unifiedZoom = true, showZoomControls = true }: Props): JSX.Element => {
  const { nodes, edges } = useMemo(() => toReactFlow(snapshot), [snapshot]);

  const ref = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<RenderSession | null>(null);
  const vpRef = useRef<ViewportController | null>(unifiedZoom ? new ViewportController() : null);

  // mount/dismount port when kind changes
  useEffect(() => {
    sessionRef.current?.destroy();
    sessionRef.current = null;

    if (ref.current && (kind === Target.DOM || kind === Target.Canvas)) {
      const opts = { viewport: vpRef.current ?? undefined, interactive: true };
      sessionRef.current =
        kind === Target.DOM
          ? new DomPort().mount(ref.current, snapshot, theme, opts)
          : new CanvasPort().mount(ref.current, snapshot, theme, opts);

      // initial fit (and immediate draw) on mount
      if (vpRef.current) {
        vpRef.current.fitTo(ref.current, snapshot.stats.bounds, 24);
      }
      sessionRef.current.draw(snapshot);
    }

    return () => { sessionRef.current?.destroy(); sessionRef.current = null; };
  }, [kind, theme]); // snapshot is drawn again below

  // redraw on data changes
  useEffect(() => {
    // keep viewport fitting optional; we don't auto-fit on every data change
    sessionRef.current?.draw(snapshot);
  }, [snapshot]);

  // top bar controls for zoom
  const [dummy, setDummy] = useState(0); // force refresh label
  useEffect(() => {
    if (!vpRef.current) return;
    const off = vpRef.current.onChange(() => setDummy((v) => v + 1));
    return off; // <— unsubscribe
  }, []);

  const ZoomBar = () => {
    if (!showZoomControls || !vpRef.current) return null;
    const s = vpRef.current.get();
    return (
      <div style={{
        position: "absolute", top: 8, right: 8, zIndex: 5,
        display: "flex", gap: 6, background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb",
        borderRadius: 8, padding: "6px 8px", alignItems: "center"
      }}>
        <button onClick={() => vpRef.current!.fitTo(ref.current, snapshot.stats.bounds, 24)}>Fit</button>
        <button onClick={() => vpRef.current!.set({ scale: s.scale * 1.1 })}>+</button>
        <button onClick={() => vpRef.current!.set({ scale: s.scale / 1.1 })}>−</button>
        <button onClick={() => vpRef.current!.set({ scale: 1 })}>100%</button>
        <span style={{ fontFamily: "monospace", fontSize: 12, marginLeft: 6 }}>{Math.round(s.scale * 100)}%</span>
      </div>
    );
  };
  const edgeTypes = useMemo(() => ({ poly: PolylineEdge }), []);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {kind === Target.ReactFlow ? (
        <ReactFlow nodes={nodes} edges={edges} edgeTypes={edgeTypes} fitView>
          <Background gap={16} />
          <Controls />
        </ReactFlow>
      ) : (
        <div ref={ref} style={{ position: "absolute", inset: 0 }}>
          <ZoomBar />
        </div>
      )}
    </div>
  );
};
