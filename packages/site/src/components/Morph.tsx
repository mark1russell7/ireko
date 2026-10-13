/**
 * A figure with two or more forms of one layout. The reader selects a form, and the boxes move to their new places.
 * The guide uses it to compare the modes, the fit policies, the routers and the options of a strategy.
 */
import type { LayoutOptions } from "ireko";
import { useMemo, useState, type ReactElement } from "react";
import { DOC_OPTIONS, layoutOfText, playgroundHref } from "../lib/docs.ts";
import LiveStage from "./LiveStage.tsx";
import SourceView from "./SourceView.tsx";

/** One form of the figure. */
export interface MorphState {
  /** The text of the button. */
  readonly label: string;
  /** The text of the layout, in the text language. */
  readonly source: string;
  readonly options?: LayoutOptions;
  /** The caption of this form. */
  readonly note?: string;
}

interface Props {
  readonly states: readonly MorphState[];
  /** The name of the group of buttons, for assistive technology. */
  readonly title: string;
  /** If false, the figure shows only the layout. The default is true. */
  readonly code?: boolean;
  /** The height of the layout, as a CSS length. The default is 18rem. */
  readonly height?: string;
}

/** The figure. */
export default function Morph({ states, title, code = true, height = "18rem" }: Props): ReactElement {
  const [index, setIndex] = useState(0);
  const layouts = useMemo(() => states.map((s) => layoutOfText(s.source, { ...DOC_OPTIONS, ...s.options })), [states]);
  const state = states[index] ?? states[0];
  const out = layouts[index] ?? layouts[0];
  if (state === undefined || out === undefined) return <></>;

  return (
    <figure className="ik-frame ik-morph not-content">
      <div className="ik-toolbar">
        <div className="ik-segmented" role="group" aria-label={title}>
          {states.map((s, i) => (
            <button key={s.label} type="button" aria-pressed={i === index} onClick={() => setIndex(i)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`ik-figure-body${code ? " ik-figure-code" : ""}`} style={{ height }}>
        {code ? <SourceView source={state.source} label="The source of the layout" className="ik-figure-source" /> : null}
        <LiveStage layout={out} label={`${title}: ${state.label}`} className="ik-figure-art" />
      </div>
      <figcaption className="ik-caption ik-figure-caption">
        <span aria-live="polite">{state.note}</span>
        <a href={playgroundHref(state.source)}>Open in the playground →</a>
      </figcaption>
    </figure>
  );
}
