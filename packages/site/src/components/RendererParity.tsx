/**
 * One layout in three live renderers with one viewport. A pan or a zoom in one pane moves all panes. A change of the
 * layout animates in all panes at the same time, because each renderer draws the same frames.
 */
import type { LayoutOptions } from "ireko";
import type { RendererKind } from "ireko/react";
import { createViewport } from "ireko/render";
import { useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from "react";
import { DOC_OPTIONS, layoutOfText } from "../lib/docs.ts";
import { useFollowFit } from "../lib/follow.ts";
import { useReducedMotion } from "../lib/theme.ts";
import LiveStage from "./LiveStage.tsx";

const FORMS: readonly { readonly label: string; readonly source: string; readonly options?: LayoutOptions }[] = [
  { label: "Grid", source: "app nested { web radial nested { home cart search } api { auth orders } data nested { users events } }\nweb -> api" },
  { label: "Ring", source: "app radial nested { web radial nested { home cart search } api { auth orders } data nested { users events } }\nweb -> api" },
  { label: "Tree", source: "app { web radial nested { home cart search } api { auth orders } data nested { users events } }\nweb -> api", options: { router: "orthogonal" } },
];
const PANES: readonly { readonly kind: RendererKind; readonly label: string; readonly note: string }[] = [
  { kind: "svg", label: "SVG", note: "ireko/svg: one element for each box. CSS can style it." },
  { kind: "dom", label: "DOM", note: "ireko/dom: one div for each box." },
  { kind: "canvas", label: "Canvas", note: "ireko/canvas: one canvas for thousands of boxes." },
];

/** The value of "ready" does not change after the first render. Thus no code uses the listener. */
const subscribeNothing = (): (() => void) => () => undefined;

/** The widget. */
export default function RendererParity(): ReactElement {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const layouts = useMemo(() => FORMS.map((f) => layoutOfText(f.source, { ...DOC_OPTIONS, ...f.options })), []);
  const out = layouts[index] ?? layouts[0];
  const viewport = useMemo(() => createViewport(), []);
  const first = useRef<HTMLDivElement>(null);
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const reduced = useReducedMotion();
  useFollowFit(viewport, first, out?.bounds, { padding: 16, duration: reduced ? 0 : 450, enabled: ready });
  if (out === undefined) return <></>;

  return (
    <div className="ik-frame ik-parity not-content">
      <div className="ik-toolbar">
        <div className="ik-segmented" role="group" aria-label="The form of the layout">
          {FORMS.map((f, i) => (
            <button key={f.label} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="ik-spacer" />
        <span className="ik-try-hint">Drag or zoom a pane. Click a box.</span>
      </div>
      <div className="ik-parity-body">
        {PANES.map((p, i) => (
          <div key={p.kind} className="ik-parity-pane" ref={i === 0 ? first : undefined}>
            <span className="ik-parity-label">{p.label}</span>
            <LiveStage layout={out} renderer={p.kind} viewport={viewport} label={`The ${p.label} renderer`} selected={selected === undefined ? [] : [selected]} onPick={setSelected} />
          </div>
        ))}
      </div>
      <p className="ik-caption ik-parity-notes">
        {PANES.map((p) => (
          <span key={p.kind}>{p.note}</span>
        ))}
      </p>
    </div>
  );
}
