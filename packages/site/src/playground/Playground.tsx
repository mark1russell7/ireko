/**
 * The playground. The editor of the text language is on the left, and the live layout is on the right.
 * The side panel has the settings of the selected node and the findings of the audit. A link holds the whole state.
 */
import { createEngine, type Engine, type Issue, type Layout, type LayoutInput, type LayoutOptions, type NodeSpec } from "ireko";
import { examples } from "ireko/examples";
import { LayoutView } from "ireko/react";
import { createViewport } from "ireko/render";
import { toSVG } from "ireko/svg";
import { parse, print } from "ireko/text";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import Editor from "../components/Editor.tsx";
import { href } from "../lib/site.ts";
import { useSiteTheme } from "../lib/theme.ts";
import { randomTree } from "./fuzz.ts";
import Inspector from "./Inspector.tsx";
import { findNode, updateNode } from "./spec.ts";
import { readHash, writeHash, type PlaygroundState, type RendererKind } from "./state.ts";

const XYFlowPane = lazy(() => import("./XYFlowPane.tsx"));

const START = `# A layout of ireko. Edit the text, or select a box.
app "My app" nested grid(columns: 2) {
  web radial nested { home cart search account }
  api { auth orders payments }
  data nested { postgres redis kafka }
  jobs radial { email reports }
}
web -> api "calls"
api -> data
`;

const DEFAULT: PlaygroundState = { text: START, renderer: "svg", router: "straight", spacing: 20 };
const RENDERERS: readonly { readonly kind: RendererKind; readonly label: string }[] = [
  { kind: "svg", label: "SVG" },
  { kind: "dom", label: "DOM" },
  { kind: "canvas", label: "Canvas" },
  { kind: "xyflow", label: "React Flow" },
];

interface Result {
  readonly layout: Layout;
  readonly input: LayoutInput;
  /** The time of the parse and the layout. It is a measurement for the reader, not an input of the layout. */
  readonly ms: number;
}

/** This function gives the layout of a text without errors, or undefined for a text with an error. */
function layoutOf(engine: Engine, strategies: readonly string[], text: string, options: LayoutOptions): Result | undefined {
  const start = performance.now();
  const parsed = parse(text, { strategies });
  if (!parsed.ok) return undefined;
  const layout = engine.layout(parsed.input, options);
  return { layout, input: parsed.input, ms: performance.now() - start };
}

/** This function gives the reader a file with the text. */
function download(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** The playground. */
export default function Playground(): ReactElement {
  const engine = useMemo(() => createEngine(), []);
  const names = useMemo(() => [...engine.strategies.keys()], [engine]);
  const strategies = useMemo(() => new Set(names), [names]);
  const [state, setState] = useState<PlaygroundState>(DEFAULT);
  // The newest text without a syntax error. While the text has an error, the layout shows this text.
  const [goodText, setGoodText] = useState(DEFAULT.text);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const viewport = useMemo(() => createViewport(), []);
  const theme = useSiteTheme();
  const update = (patch: Partial<Omit<PlaygroundState, "text">>): void => setState((s) => ({ ...s, ...patch }));

  /** This function sets the text. A text without a syntax error also becomes the good text. */
  const setText = useCallback(
    (text: string): void => {
      setState((s) => ({ ...s, text }));
      if (parse(text, { strategies: names }).ok) setGoodText(text);
    },
    [names],
  );

  // The state of a shared link.
  useEffect(() => {
    void readHash(location.hash, DEFAULT).then((s) => {
      if (s === undefined) return;
      setState(s);
      if (parse(s.text, { strategies: names }).ok) setGoodText(s.text);
    });
  }, [names]);

  const error = useMemo(() => {
    const parsed = parse(state.text, { strategies: names });
    return parsed.ok ? undefined : parsed.error;
  }, [state.text, names]);
  const options = useMemo<LayoutOptions>(() => ({ spacing: state.spacing, router: state.router, nodeSize: { width: 92, height: 38 } }), [state.spacing, state.router]);
  const result = useMemo(() => layoutOf(engine, names, goodText, options), [engine, names, goodText, options]);
  const shown = result?.layout;
  const issues: readonly Issue[] = error === undefined ? (shown?.issues ?? []) : [];
  const selectedNode = selected === undefined || result === undefined ? undefined : findNode(result.input.root, selected);

  const changeNode = useCallback(
    (node: NodeSpec): void => {
      if (selected === undefined || result === undefined || error !== undefined) return;
      const root = updateNode(result.input.root, selected, () => node);
      const edges = result.input.edges;
      // The printer gives the canonical form. The comments at the top of the text stay.
      const comments = /^(?:\s*(?:#|\/\/)[^\n]*\n)*/.exec(state.text)?.[0] ?? "";
      setText(comments + print(edges === undefined ? { root } : { root, edges }, { strategies: names }));
    },
    [selected, result, error, state.text, setText, names],
  );

  const share = async (): Promise<void> => {
    const hash = await writeHash(state);
    history.replaceState(null, "", hash);
    try {
      await navigator.clipboard.writeText(location.href);
      setNotice("The link is on the clipboard.");
    } catch {
      setNotice("The link is in the address bar.");
    }
  };

  const loadExample = (name: string): void => {
    const example = examples.find((e) => e.name === name);
    if (example === undefined) return;
    setSelected(undefined);
    setText(`# ${example.title}: ${example.description}\n${print(example.input)}`);
    update({ router: example.options?.router === "orthogonal" ? "orthogonal" : "straight", spacing: example.options?.spacing ?? 20 });
  };

  const fuzz = (): void => {
    const seed = Math.floor(Math.random() * 1e9);
    setSelected(undefined);
    setText(`# A random tree. Its seed is ${String(seed)}.\n${print({ root: randomTree(seed) })}`);
  };

  useEffect(() => {
    if (notice === "") return undefined;
    const t = setTimeout(() => setNotice(""), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  const fitView = (): void => {
    const pane = document.querySelector<HTMLElement>(".pg-stage");
    if (shown !== undefined && pane !== null) viewport.fit(shown.bounds, pane.clientWidth, pane.clientHeight);
  };

  return (
    <div className="pg">
      <header className="pg-top">
        <a className="pg-brand" href={href("")}>
          <img src={href("favicon.svg")} alt="" width="24" height="24" />
          <span>ireko</span>
          <span className="pg-sub">playground</span>
        </a>
        <label className="pg-control">
          <select className="ik-select" value="" onChange={(e) => loadExample(e.target.value)} aria-label="Load an example">
            <option value="">Examples…</option>
            {examples.map((e) => (
              <option key={e.name} value={e.name}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <div className="ik-segmented" role="group" aria-label="Renderer">
          {RENDERERS.map((r) => (
            <button key={r.kind} type="button" aria-pressed={state.renderer === r.kind} onClick={() => update({ renderer: r.kind })}>
              {r.label}
            </button>
          ))}
        </div>
        <label className="pg-control">
          <span>Edges</span>
          <select className="ik-select" value={state.router} onChange={(e) => update({ router: e.target.value === "orthogonal" ? "orthogonal" : "straight" })}>
            <option value="straight">straight</option>
            <option value="orthogonal">orthogonal</option>
          </select>
        </label>
        <label className="pg-control">
          <span>Spacing {state.spacing}</span>
          <input className="ik-input" type="range" min={0} max={48} value={state.spacing} onChange={(e) => update({ spacing: Number(e.target.value) })} />
        </label>
        <span className="ik-spacer" />
        <button type="button" className="ik-button ik-small" onClick={fuzz} title="Make a random tree">
          Fuzz
        </button>
        <button type="button" className="ik-button ik-small" onClick={fitView} disabled={state.renderer === "xyflow"}>
          Fit
        </button>
        <button type="button" className="ik-button ik-small" disabled={shown === undefined} onClick={() => shown !== undefined && download("ireko-layout.svg", "image/svg+xml", toSVG(shown))}>
          SVG
        </button>
        <button type="button" className="ik-button ik-small" disabled={shown === undefined} onClick={() => shown !== undefined && download("ireko-layout.json", "application/json", JSON.stringify(shown, null, 2))}>
          JSON
        </button>
        <button type="button" className="ik-button ik-small" data-variant="primary" onClick={() => void share()}>
          Share
        </button>
        <span className="ik-sr" aria-live="polite">
          {notice}
        </span>
        {notice === "" ? null : (
          <span className="pg-notice" role="status">
            {notice}
          </span>
        )}
      </header>

      <main className="pg-main">
        <section className="pg-source" aria-label="The source">
          <Editor value={state.text} onChange={setText} error={error} strategies={strategies} label="The source of the layout, in the text language of ireko" className="pg-editor" />
          <p className="pg-status" id="ik-editor-error" data-state={error === undefined ? "ok" : "error"}>
            {error === undefined
              ? `${String(shown?.nodes.length ?? 0)} boxes, ${String(shown?.edges.length ?? 0)} edges, laid out in ${(result?.ms ?? 0).toFixed(1)} ms.`
              : `Line ${String(error.line)}, column ${String(error.column)}: ${error.message}`}
          </p>
        </section>

        <section className="pg-view ik-svg ik-paper" aria-label="The layout">
          <div className="pg-stage">
            {shown === undefined ? null : state.renderer === "xyflow" ? (
              <Suspense fallback={<p className="pg-hint">Loading React Flow…</p>}>
                <XYFlowPane layout={shown} onPick={setSelected} />
              </Suspense>
            ) : (
              <LayoutView
                layout={shown}
                renderer={state.renderer}
                viewport={viewport}
                theme={state.renderer === "svg" ? undefined : theme}
                selected={selected === undefined ? [] : [selected]}
                onPick={setSelected}
              />
            )}
          </div>
          {error === undefined ? null : <p className="pg-stale">The layout shows the last text without errors.</p>}
        </section>

        <aside className="pg-side" aria-label="The settings and the findings">
          {selectedNode === undefined ? (
            <section className="pg-panel">
              <h2>Settings</h2>
              <p className="pg-hint">Select a box to change its strategy, its mode and its options. The text changes too.</p>
            </section>
          ) : (
            <Inspector node={selectedNode} engine={engine} onChange={changeNode} onClose={() => setSelected(undefined)} />
          )}
          <section className="pg-panel" aria-label="The findings of the audit">
            <h2>
              Findings <span className="ik-chip" data-state={issues.length === 0 ? "pass" : "fail"}>{issues.length}</span>
            </h2>
            {issues.length === 0 ? (
              <p className="pg-hint">The audit finds no overlap, no box outside its container and no bad option.</p>
            ) : (
              <ul className="pg-issues">
                {issues.map((issue) => (
                  <li key={`${issue.code}:${issue.node ?? ""}:${issue.message}`}>
                    <button type="button" className="pg-issue" onClick={() => issue.node !== undefined && setSelected(issue.node)}>
                      <span className="ik-chip" data-state={issue.severity === "error" ? "fail" : undefined}>
                        {issue.code}
                      </span>
                      <span>{issue.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="pg-panel">
            <h2>The language</h2>
            <pre className="pg-cheat">{`id "label" strategy(options) mode fit WxH {
  children
}
a -> b "edge label"`}</pre>
            <p className="pg-hint">
              Strategies: <code>grid</code>, <code>radial</code>, <code>tree</code>. Modes: <code>linked</code>, <code>nested</code>. Fit: <code>grow</code>, <code>scale</code>, <code>clip</code>.{" "}
              <a href={href("learn/text-language/")}>The full guide</a>.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
