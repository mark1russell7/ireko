/**
 * The live panel of the home page. A small document of the text language changes one word at a time, and the layout
 * moves to its new form. The server renders the first step as a static SVG, so the page shows a layout before its
 * script runs.
 */
import { layout, type Layout } from "ireko";
import { LayoutSvg, LayoutView } from "ireko/react";
import { createViewport, easeInOut, type View } from "ireko/render";
import { parse } from "ireko/text";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from "react";
import { href } from "../lib/site.ts";
import { useReducedMotion } from "../lib/theme.ts";

interface Step {
  /** The document. The text between [[ and ]] is the change of this step. */
  readonly source: string;
  readonly caption: string;
}

const STEPS: readonly Step[] = [
  {
    source: `app [[nested]] {
  web { home cart search }
  api { auth orders }
  data { users events }
}`,
    caption: "A nested container holds three linked trees.",
  },
  {
    source: `app nested {
  web [[radial nested]] { home cart search }
  api { auth orders }
  data { users events }
}`,
    caption: "The container web puts its children on a ring inside it.",
  },
  {
    source: `app nested {
  web radial nested { home cart search }
  api [[grid(columns: 1)]] { auth orders }
  data { users events }
}`,
    caption: "The tree api arranges its children in one column.",
  },
  {
    source: `app [[radial]] nested {
  web radial nested { home cart search }
  api grid(columns: 1) { auth orders }
  data { users events }
}`,
    caption: "The root puts its three children on a ring.",
  },
  {
    source: `app radial [[linked]] {
  web radial nested { home cart search }
  api grid(columns: 1) { auth orders }
  data { users events }
}`,
    caption: "The root becomes a node: its children go around it, with edges.",
  },
  {
    source: `app [[grid]] {
  web radial nested { home cart search }
  api grid(columns: 1) { auth orders }
  data [[nested]] { users events }
}`,
    caption: "A tree again. Each container selects its own layout.",
  },
];

const PERIOD = 3400;

/** This function gives the plain text of a step and the place of its change. */
function split(source: string): { before: string; changed: string; after: string; plain: string } {
  const open = source.indexOf("[[");
  const close = source.indexOf("]]");
  const plain = source.replaceAll("[[", "").replaceAll("]]", "");
  if (open < 0 || close < 0) return { before: plain, changed: "", after: "", plain };
  return { before: source.slice(0, open), changed: source.slice(open + 2, close), after: source.slice(close + 2).replaceAll("[[", "").replaceAll("]]", ""), plain };
}

const OPTIONS = { spacing: 14, nodeSize: { width: 64, height: 30 }, header: 20 } as const;

/** The value of "ready" does not change after the first render. Thus no code uses the listener. */
const subscribeNothing = (): (() => void) => () => undefined;

/** The live panel. */
export default function LiveHero(): ReactElement {
  const layouts = useMemo<Layout[]>(
    () =>
      STEPS.map((s) => {
        const r = parse(split(s.source).plain);
        if (!r.ok) throw new Error(r.error.message);
        return layout(r.input, OPTIONS);
      }),
    [],
  );
  const viewport = useMemo(() => createViewport(), []);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  // The server renders the static picture. In the browser, the live view replaces it.
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const running = playing && !reduced;

  // The view moves with the boxes: it fits each step, with the same easing as the animation of the layout.
  useEffect(() => {
    const element = stage.current;
    const target = layouts[step];
    if (element === null || !ready || target === undefined) return undefined;
    const goal = (): View => {
      const probe = createViewport();
      probe.fit(target.bounds, element.clientWidth, element.clientHeight, 22);
      return probe.get();
    };
    const from = viewport.get();
    const to = goal();
    const first = from.k === 1 && from.x === 0 && from.y === 0;
    if (first || reduced) {
      viewport.set(to);
    } else {
      const start = performance.now();
      let raf = 0;
      const tick = (now: number): void => {
        const t = easeInOut(Math.min(1, (now - start) / 750));
        viewport.set({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, k: from.k + (to.k - from.k) * t });
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const observer = new ResizeObserver(() => viewport.set(goal()));
      observer.observe(element);
      return () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
      };
    }
    const observer = new ResizeObserver(() => viewport.set(goal()));
    observer.observe(element);
    return () => observer.disconnect();
  }, [layouts, step, viewport, ready, reduced]);

  // The animation stops when the panel is not on the screen.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = stage.current;
    if (element === null) return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running || !visible) return undefined;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), PERIOD);
    return () => clearInterval(timer);
  }, [running, visible]);

  const current = STEPS[step] ?? STEPS[0];
  const parts = split(current?.source ?? "");
  const shown = layouts[step] ?? layouts[0];
  const playground = href(`playground/#${encodeURIComponent(parts.plain)}`);

  return (
    <figure className="ik-live" aria-label="A live example of ireko">
      <pre className="ik-live-source" aria-label="The source of the layout">
        <code>
          {parts.before}
          <span className="ik-changed">{parts.changed}</span>
          {running ? <span className="ik-caret" aria-hidden="true" /> : null}
          {parts.after}
        </code>
      </pre>
      <div className="ik-live-stage ik-svg ik-paper" ref={stage}>
        {ready && shown !== undefined ? (
          <LayoutView layout={shown} renderer="svg" viewport={viewport} interactive={false} duration={reduced ? 0 : 750} style={{ position: "absolute", inset: "0" }} />
        ) : shown === undefined ? null : (
          <LayoutSvg layout={shown} padding={18} style={{ width: "100%", height: "100%" }} title="A nested layout of the example app" />
        )}
      </div>
      <figcaption className="ik-live-foot">
        <span className="ik-dot" aria-hidden="true" />
        <span aria-live="polite">{current?.caption}</span>
        <span className="ik-spacer" />
        <span className="ik-live-controls">
          <button type="button" className="ik-button ik-small" onClick={() => setStep((s) => (s + STEPS.length - 1) % STEPS.length)} aria-label="The previous step">
            ‹
          </button>
          <span className="ik-chip" aria-label={`Step ${String(step + 1)} of ${String(STEPS.length)}`}>
            {step + 1}/{STEPS.length}
          </span>
          <button type="button" className="ik-button ik-small" onClick={() => setStep((s) => (s + 1) % STEPS.length)} aria-label="The next step">
            ›
          </button>
          <button type="button" className="ik-button ik-small" onClick={() => setPlaying((p) => !p)} aria-pressed={!running}>
            {running ? "Pause" : "Play"}
          </button>
          <a className="ik-button ik-small" href={playground}>
            Edit ↗
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
