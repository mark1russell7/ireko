/**
 * The stage of a live figure. The server renders a static SVG, so the page shows the layout before its script runs.
 * In the browser, a live renderer replaces it: a new layout animates, and the view follows the bounds.
 */
import type { Layout } from "ireko";
import { LayoutSvg, LayoutView, type RendererKind } from "ireko/react";
import { createViewport, type Viewport } from "ireko/render";
import { useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactElement } from "react";
import { useFollowFit } from "../lib/follow.ts";
import { useReducedMotion, useSiteTheme } from "../lib/theme.ts";

interface Props {
  readonly layout: Layout;
  /** The text for assistive technology. */
  readonly label: string;
  readonly renderer?: RendererKind;
  /** The viewport. Give the same viewport to two stages to move them together. With a shared viewport, the stage does not follow the bounds. */
  readonly viewport?: Viewport;
  /** The space around the layout, in pixels. The default is 20. */
  readonly padding?: number;
  /** The time of the animation, in milliseconds. The default is 450. */
  readonly duration?: number;
  readonly selected?: readonly string[];
  readonly onPick?: (id: string | undefined) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** The value of "ready" does not change after the first render. Thus no code uses the listener. */
const subscribeNothing = (): (() => void) => () => undefined;

/** The stage. */
export default function LiveStage({ layout, label, renderer = "svg", viewport: shared, padding = 20, duration = 450, selected, onPick, className, style }: Props): ReactElement {
  const own = useMemo(() => createViewport(), []);
  const viewport = shared ?? own;
  const stage = useRef<HTMLDivElement>(null);
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const reduced = useReducedMotion();
  const theme = useSiteTheme();
  useFollowFit(viewport, stage, layout.bounds, { padding, duration: reduced ? 0 : duration, enabled: ready && shared === undefined });

  return (
    <div ref={stage} className={`ik-stage ik-svg ik-paper ${className ?? ""}`} style={style} role="group" aria-label={label}>
      {ready ? (
        <LayoutView
          layout={layout}
          renderer={renderer}
          viewport={viewport}
          theme={renderer === "svg" ? undefined : theme}
          duration={reduced ? 0 : duration}
          selected={selected}
          onPick={onPick}
        />
      ) : (
        <LayoutSvg layout={layout} padding={padding} title={label} />
      )}
    </div>
  );
}
