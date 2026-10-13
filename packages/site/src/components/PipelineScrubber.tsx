/**
 * The pipeline of the engine, one step at a time. The `trace` option of the engine gives the output of each phase.
 * The measure pass goes from the leaves up: each subtree gets its size before its parent. The place pass goes from
 * the root down. Then the router draws the edges, and the audit examines the result.
 */
import { createEngine, type Layout, type PlacedNode, type Rect, type Size } from "ireko";
import { isContainer } from "ireko/render";
import { parse } from "ireko/text";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { DOC_OPTIONS } from "../lib/docs.ts";
import { useReducedMotion } from "../lib/theme.ts";

const engine = createEngine();

const SOURCES: readonly { readonly label: string; readonly source: string }[] = [
  { label: "Mixed tree", source: "r { a { a1 a2 a3 } b nested { b1 b2 b3 b4 } c radial { c1 c2 c3 } }\na1 -> b" },
  { label: "Rings", source: "hub radial nested { g1 nested { a b c } g2 radial nested { d e f g } g3 { h i } }" },
  { label: "Deep", source: "x { y { z { z1 z2 } w } v nested { v1 v2 } }" },
];

/** The part of a node record of the normalize phase that this widget reads. */
interface Record {
  readonly id: string;
  readonly depth: number;
  readonly children: readonly number[];
}

/** The output of the trace that this widget reads. */
interface Captured {
  readonly records: readonly Record[];
  readonly box: readonly Size[];
  readonly extent: readonly Rect[];
  readonly layout: Layout;
}

type Step = { readonly phase: "normalize" } | { readonly phase: "measure"; readonly index: number } | { readonly phase: "place"; readonly index: number } | { readonly phase: "route" } | { readonly phase: "audit" };

const isObject = (x: unknown): x is { readonly [key: string]: unknown } => typeof x === "object" && x !== null;

/** This function reads the records of the normalize phase. It gives undefined for data of another form. */
function recordsOf(data: unknown): Record[] | undefined {
  if (!isObject(data) || !Array.isArray(data["nodes"])) return undefined;
  const out: Record[] = [];
  for (const n of data["nodes"] as unknown[]) {
    if (!isObject(n) || typeof n["id"] !== "string" || typeof n["depth"] !== "number" || !Array.isArray(n["children"])) return undefined;
    out.push({ id: n["id"], depth: n["depth"], children: (n["children"] as unknown[]).filter((c): c is number => typeof c === "number") });
  }
  return out;
}

/** This function reads the sizes and the extents of the measure phase. */
function measureOf(data: unknown): { box: Size[]; extent: Rect[] } | undefined {
  if (!isObject(data) || !Array.isArray(data["box"]) || !Array.isArray(data["extent"])) return undefined;
  return { box: data["box"] as Size[], extent: data["extent"] as Rect[] };
}

/** This function lays out a text and keeps the output of each phase. */
function capture(source: string): Captured | undefined {
  const parsed = parse(source);
  if (!parsed.ok) return undefined;
  let records: Record[] | undefined;
  let m: { box: Size[]; extent: Rect[] } | undefined;
  const layout = engine.layout(parsed.input, {
    ...DOC_OPTIONS,
    trace: (event) => {
      if (event.phase === "normalize") records = recordsOf(event.data);
      if (event.phase === "measure") m = measureOf(event.data);
    },
  });
  if (records === undefined || m === undefined) return undefined;
  return { records, box: m.box, extent: m.extent, layout };
}

/** This function gives the steps: the measure pass from the last record to the first, and the place pass from the first. */
function stepsOf(c: Captured): Step[] {
  const parents = c.records.flatMap((r, i) => (r.children.length > 0 ? [i] : []));
  return [{ phase: "normalize" }, ...parents.toReversed().map((index): Step => ({ phase: "measure", index })), ...parents.map((index): Step => ({ phase: "place", index })), { phase: "route" }, { phase: "audit" }];
}

/** This function gives the indexes of a subtree, in pre-order. */
function subtree(records: readonly Record[], index: number): number[] {
  const out: number[] = [];
  const stack = [index];
  for (let i = stack.pop(); i !== undefined; i = stack.pop()) {
    out.push(i);
    stack.push(...(records[i]?.children ?? []).toReversed());
  }
  return out;
}

/** The widget. */
export default function PipelineScrubber(): ReactElement {
  const [which, setWhich] = useState(0);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const captured = useMemo(() => capture(SOURCES[which]?.source ?? ""), [which]);
  const steps = useMemo(() => (captured === undefined ? [] : stepsOf(captured)), [captured]);
  const step = steps[Math.min(at, steps.length - 1)];

  const last = steps.length - 1;
  // The animation stops at the last step.
  const running = playing && at < last;

  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setAt((a) => Math.min(last, a + 1)), reduced ? 1400 : 900);
    return () => clearInterval(t);
  }, [running, last, reduced]);

  if (captured === undefined || step === undefined) return <></>;
  const { records, box, extent, layout } = captured;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const nodeOf = (i: number): PlacedNode | undefined => byId.get(records[i]?.id ?? "");

  // The state of each node at this step.
  const measured = new Set<number>();
  const placed = new Set<number>();
  let focus: number | undefined;
  for (const s of steps.slice(0, at + 1)) {
    if (s.phase === "measure") {
      for (const i of subtree(records, s.index)) measured.add(i);
      focus = s.index;
    }
    if (s.phase === "place") {
      placed.add(s.index);
      for (const c of records[s.index]?.children ?? []) placed.add(c);
      focus = s.index;
    }
  }
  if (step.phase === "normalize" || step.phase === "route" || step.phase === "audit") focus = undefined;
  const routed = step.phase === "route" || step.phase === "audit";
  const focusRecord = focus === undefined ? undefined : records[focus];

  /** The extent of a subtree, in the coordinates of the layout. */
  const extentRect = (i: number): Rect | undefined => {
    const n = nodeOf(i);
    const b = box[i];
    const e = extent[i];
    if (n === undefined || b === undefined || e === undefined || b.width === 0) return undefined;
    const k = n.width / b.width;
    return { x: n.x + e.x * k, y: n.y + e.y * k, width: e.width * k, height: e.height * k };
  };

  const pad = 24;
  const b = layout.bounds;
  const focusExtent = focus === undefined ? undefined : extentRect(focus);
  const description = describe(step, focusRecord?.id, focus === undefined ? undefined : box[focus], focusExtent, layout);

  return (
    <div className="ik-frame ik-pipeline not-content">
      <div className="ik-toolbar">
        <div className="ik-segmented" role="group" aria-label="The example">
          {SOURCES.map((s, i) => (
            <button
              key={s.label}
              type="button"
              aria-pressed={i === which}
              onClick={() => {
                setWhich(i);
                setAt(0);
                setPlaying(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="ik-spacer" />
        <button type="button" className="ik-button ik-small" onClick={() => setAt((a) => Math.max(0, a - 1))} disabled={at === 0} aria-label="The previous step">
          ←
        </button>
        <button
          type="button"
          className="ik-button ik-small"
          data-variant="primary"
          onClick={() => {
            if (at >= last) setAt(0);
            setPlaying(!running);
          }}
        >
          {running ? "Pause" : at >= last ? "Again" : "Play"}
        </button>
        <button type="button" className="ik-button ik-small" onClick={() => setAt((a) => Math.min(steps.length - 1, a + 1))} disabled={at >= steps.length - 1} aria-label="The next step">
          →
        </button>
      </div>
      <div className="ik-pipeline-phases" aria-hidden="true">
        {(["normalize", "measure", "place", "route", "audit"] as const).map((p) => (
          <span key={p} data-active={step.phase === p} data-done={steps.findIndex((s) => s.phase === p) < at && step.phase !== p}>
            {p}
          </span>
        ))}
      </div>
      <div className="ik-pipeline-body">
        <svg className="ik-pipeline-art ik-svg ik-paper" viewBox={`${String(b.x - pad)} ${String(b.y - pad)} ${String(b.width + 2 * pad)} ${String(b.height + 2 * pad)}`} role="img" aria-label={description}>
          <defs>
            <marker id="ik-pipe-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" className="ik-pipe-arrow" />
            </marker>
          </defs>
          {/* The measure pass: the size of each box and the extent of each subtree, without a position. */}
          {records.map((r, i) => {
            const n = nodeOf(i);
            if (n === undefined || !measured.has(i) || placed.has(i)) return null;
            return <rect key={`m-${r.id}`} className="ik-pipe-ghost" x={n.x} y={n.y} width={n.width} height={n.height} rx={4} />;
          })}
          {focusExtent === undefined || step.phase !== "measure" ? null : (
            <g className="ik-pipe-extent">
              <rect x={focusExtent.x} y={focusExtent.y} width={focusExtent.width} height={focusExtent.height} />
              <text x={focusExtent.x + 4} y={focusExtent.y - 6}>
                {Math.round(focusExtent.width)} × {Math.round(focusExtent.height)}
              </text>
            </g>
          )}
          {/* The place pass: the boxes at their positions, from the root down. */}
          {layout.nodes.map((n) => {
            const i = records.findIndex((r) => r.id === n.id);
            if (!placed.has(i)) return null;
            const container = isContainer(n);
            return (
              <g key={`p-${n.id}`} className={`${container ? "ireko-container" : "ireko-node"} ik-pipe-placed${focus === i ? " ireko-selected" : ""}`}>
                <rect x={n.x} y={n.y} width={n.width} height={n.height} rx={4} />
                {container ? (
                  <text x={n.x + 8} y={n.y + 15} fontSize={11}>
                    {n.label}
                  </text>
                ) : (
                  <text x={n.x + n.width / 2} y={n.y + n.height / 2} fontSize={11} textAnchor="middle" dominantBaseline="central">
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
          {routed ? (
            <g className="ireko-edges ik-pipe-edges" fill="none">
              {layout.edges.map((e) => (
                <polyline key={e.id} points={e.points.map((p) => `${String(p.x)},${String(p.y)}`).join(" ")} strokeWidth={1.25} strokeDasharray={e.kind === "extra" ? "4 3" : undefined} markerEnd="url(#ik-pipe-arrow)" />
              ))}
            </g>
          ) : null}
          {step.phase === "audit" ? (
            <g className="ik-pipe-stamp" transform={`translate(${String(b.x + b.width - 4)} ${String(b.y + 4)})`}>
              <text textAnchor="end">{layout.issues.length === 0 ? "✓ 0 findings" : `${String(layout.issues.length)} findings`}</text>
            </g>
          ) : null}
        </svg>
        <div className="ik-pipeline-side">
          <p className="ik-pipeline-step" aria-live="polite">
            <span className="ik-chip">
              {at + 1} / {steps.length}
            </span>{" "}
            {description}
          </p>
          <ol className="ik-pipeline-tree" aria-label="The tree after the normalize phase">
            {records.map((r, i) => (
              <li key={r.id} style={{ paddingLeft: `${String(r.depth * 0.9)}rem` }} data-measured={measured.has(i)} data-placed={placed.has(i)} data-focus={focus === i}>
                <code>{r.id}</code>
                {box[i] === undefined || !measured.has(i) ? null : (
                  <span className="ik-pipeline-size">
                    {Math.round(box[i].width)}×{Math.round(box[i].height)}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <input className="ik-input ik-pipeline-range" type="range" min={0} max={steps.length - 1} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-label="The step" />
        </div>
      </div>
    </div>
  );
}

/** This function gives the text of a step. */
function describe(step: Step, id: string | undefined, size: Size | undefined, ext: Rect | undefined, layout: Layout): string {
  switch (step.phase) {
    case "normalize":
      return "Normalize: the engine reads the tree, gives each node its strategy and mode, and examines the identifiers and the options. No box has a size yet.";
    case "measure":
      return `Measure ${id ?? ""}: its children have their sizes, so the strategy arranges them. The box is ${size === undefined ? "?" : `${String(Math.round(size.width))} × ${String(Math.round(size.height))}`}, and the subtree needs ${ext === undefined ? "?" : `${String(Math.round(ext.width))} × ${String(Math.round(ext.height))}`}. The engine has no position for it yet.`;
    case "place":
      return `Place ${id ?? ""}: the engine knows the position of ${id ?? "the node"}, so it adds the offsets of the children. The positions go from the root down.`;
    case "route":
      return `Route: all boxes have their positions, so the router draws ${String(layout.edges.length)} edges from border to border.`;
    case "audit":
      return layout.issues.length === 0 ? "Audit: the engine examines each pair of boxes and each container. It finds no overlap and no box outside its container." : `Audit: the engine finds ${String(layout.issues.length)} problems.`;
  }
}
