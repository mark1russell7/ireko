/**
 * A small playground in a page of the guide: an editor and a live layout. The layout changes while the reader types.
 * While the text has an error, the layout shows the last text without errors.
 */
import { createEngine, type Engine, type LayoutOptions } from "ireko";
import { parse } from "ireko/text";
import { useId, useMemo, useState, type ReactElement } from "react";
import { DOC_OPTIONS, playgroundHref } from "../lib/docs.ts";
import Editor from "./Editor.tsx";
import LiveStage from "./LiveStage.tsx";

interface Props {
  /** The first text, in the text language. */
  readonly source: string;
  /** The options of the layout. They replace the options of the figures. */
  readonly options?: LayoutOptions;
  /** The title of the widget. */
  readonly title?: string;
  /** The height of the widget, as a CSS length. The default is 20rem. */
  readonly height?: string;
  /** The engine. An island of a page gives an engine with more strategies. The default has the built-in strategies. */
  readonly engine?: Engine;
}

const defaultEngine = createEngine();

/** The small playground. */
export default function Try({ source, options, title = "Try it", height = "20rem", engine = defaultEngine }: Props): ReactElement {
  const strategies = useMemo(() => [...engine.strategies.keys()], [engine]);
  const strategySet = useMemo(() => new Set(strategies), [strategies]);
  const first = source.trim();
  const id = useId();
  const [text, setText] = useState(first);
  const [good, setGood] = useState(first);
  const merged = useMemo<LayoutOptions>(() => ({ ...DOC_OPTIONS, ...options }), [options]);

  const change = (next: string): void => {
    setText(next);
    if (parse(next, { strategies }).ok) setGood(next);
  };

  const error = useMemo(() => {
    const parsed = parse(text, { strategies });
    return parsed.ok ? undefined : parsed.error;
  }, [text, strategies]);
  const out = useMemo(() => {
    const parsed = parse(good, { strategies });
    return parsed.ok ? engine.layout(parsed.input, merged) : undefined;
  }, [good, merged, strategies, engine]);

  return (
    <div className="ik-frame ik-try not-content">
      <div className="ik-toolbar">
        <strong className="ik-try-title">{title}</strong>
        <span className="ik-spacer" />
        <button type="button" className="ik-button ik-small" disabled={text === first} onClick={() => change(first)}>
          Reset
        </button>
        {engine === defaultEngine ? (
          <a className="ik-button ik-small" href={playgroundHref(text)}>
            Playground →
          </a>
        ) : null}
      </div>
      <div className="ik-try-body" style={{ height }}>
        <Editor value={text} onChange={change} error={error} strategies={strategySet} label={`${title}: the source of the layout`} className="ik-try-editor" errorId={`${id}-error`} />
        {out === undefined ? null : <LiveStage layout={out} label={`${title}: the layout`} className="ik-try-stage" />}
      </div>
      <p className="ik-caption ik-try-status" id={`${id}-error`} data-state={error === undefined ? "ok" : "error"} aria-live="polite">
        {error === undefined
          ? `${String(out?.nodes.length ?? 0)} boxes, ${String(out?.edges.length ?? 0)} edges. The audit finds ${out?.issues.length === 0 ? "no defect" : `${String(out?.issues.length ?? 0)} findings`}.`
          : `Line ${String(error.line)}, column ${String(error.column)}: ${error.message}`}
      </p>
    </div>
  );
}
