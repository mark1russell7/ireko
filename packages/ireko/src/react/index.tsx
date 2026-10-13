/**
 * The React bindings of ireko.
 * - `useLayout` gives the layout of an input, and makes it again only when the input or the options change.
 * - `LayoutSvg` draws a layout as an SVG element. It operates in server rendering, so a static page can show a layout.
 * - `LayoutView` draws a layout with a live renderer (SVG, DOM or Canvas), with pan, zoom and animations.
 */
import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from "react";
import { mountCanvas } from "../canvas/index.ts";
import { layout as defaultLayout, type Engine, type Layout, type LayoutInput, type LayoutOptions, type PlacedNode } from "../core/index.ts";
import { mountDom } from "../dom/index.ts";
import { isContainer, type Renderer } from "../render/renderer.ts";
import { haloOf, labelAt, LABEL_SCALE } from "../render/label.ts";
import { lightTheme, themeOf, type Theme } from "../render/theme.ts";
import type { Viewport } from "../render/viewport.ts";
import { mountSvg } from "../svg/index.ts";

/** This hook gives the layout of `input`. It makes the layout again only when `input`, `options` or `engine` change. */
export function useLayout(input: LayoutInput, options?: LayoutOptions, engine?: Engine): Layout {
  return useMemo(() => (engine === undefined ? defaultLayout(input, options) : engine.layout(input, options)), [engine, input, options]);
}

/** The properties of `LayoutSvg`. */
export interface LayoutSvgProps {
  readonly layout: Layout;
  readonly theme?: Partial<Theme> | undefined;
  /** The space around the layout, in pixels. The default is 16. */
  readonly padding?: number;
  /** The title of the image, for assistive technology. */
  readonly title?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** This component draws a layout as an SVG element. It has no state and no effects. */
export function LayoutSvg({ layout, theme: partial, padding = 16, title, className, style }: LayoutSvgProps): ReactElement {
  const theme = themeOf(partial, lightTheme);
  const b = layout.bounds;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const clipOf = (n: PlacedNode): string | undefined => {
    for (let c = n.container; c !== undefined; c = byId.get(c)?.container) if (byId.get(c)?.clip === true) return `url(#ireko-clip-${safe(c)})`;
    return undefined;
  };
  const containers = layout.nodes.filter(isContainer);
  const leaves = layout.nodes.filter((n) => !isContainer(n));
  const labelled = layout.edges.filter((e) => e.label !== undefined && e.label !== "");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${String(b.x - padding)} ${String(b.y - padding)} ${String(b.width + 2 * padding)} ${String(b.height + 2 * padding)}`}
      role="img"
      className={className}
      style={style}
      fontFamily={theme.fontFamily}
    >
      {title === undefined ? null : <title>{title}</title>}
      <defs>
        {containers
          .filter((c) => c.clip)
          .map((c) => (
            <clipPath key={c.id} id={`ireko-clip-${safe(c.id)}`}>
              <rect x={c.x} y={c.y} width={c.width} height={c.height} />
            </clipPath>
          ))}
      </defs>
      <g className="ireko-containers">
        {containers.map((n) => (
          <g key={n.id} className="ireko-container" data-id={n.id} clipPath={clipOf(n)}>
            <rect x={n.x} y={n.y} width={n.width} height={n.height} rx={theme.radius * n.scale} fill={theme.containerFill} stroke={theme.containerStroke} />
            <text x={n.x + 8 * n.scale} y={n.y + 6 * n.scale + theme.fontSize * n.scale} fontSize={theme.fontSize * n.scale} fill={theme.mutedText}>
              {n.label}
            </text>
          </g>
        ))}
      </g>
      <g className="ireko-edges" fill="none">
        {layout.edges.map((e) => (
          <polyline
            key={e.id}
            data-id={e.id}
            points={e.points.map((p) => `${String(p.x)},${String(p.y)}`).join(" ")}
            stroke={e.kind === "extra" ? theme.extraEdge : theme.edge}
            strokeWidth={1.25}
            strokeDasharray={e.kind === "extra" ? "4 3" : undefined}
          />
        ))}
      </g>
      <g className="ireko-nodes">
        {leaves.map((n) => (
          <g key={n.id} className="ireko-node" data-id={n.id} clipPath={clipOf(n)}>
            <rect x={n.x} y={n.y} width={n.width} height={n.height} rx={theme.radius * n.scale} fill={theme.nodeFill} stroke={theme.nodeStroke} />
            <text x={n.x + n.width / 2} y={n.y + n.height / 2} fontSize={theme.fontSize * n.scale} textAnchor="middle" dominantBaseline="central" fill={theme.text}>
              {n.label}
            </text>
          </g>
        ))}
      </g>
      {labelled.length === 0 ? null : (
        <g className="ireko-edge-labels" textAnchor="middle" dominantBaseline="central" fill={theme.mutedText} stroke={haloOf(theme)} strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
          {labelled.map((e) => {
            const p = labelAt(e.points);
            return (
              <text key={e.id} className="ireko-edge-label" data-id={e.id} x={p.x} y={p.y} fontSize={theme.fontSize * LABEL_SCALE}>
                {e.label}
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}

/** The live renderers of `LayoutView`. */
export type RendererKind = "svg" | "dom" | "canvas";

/** The properties of `LayoutView`. */
export interface LayoutViewProps {
  readonly layout: Layout;
  /** The renderer. The default is `svg`. */
  readonly renderer?: RendererKind;
  readonly theme?: Partial<Theme> | undefined;
  /** The viewport. Give the same viewport to two views to move them together. */
  readonly viewport?: Viewport | undefined;
  /** The time of the animation from one layout to the next, in milliseconds. The default is 320. */
  readonly duration?: number | undefined;
  /** If true, the user can pan and zoom. The default is true. */
  readonly interactive?: boolean | undefined;
  /** The identifiers of the selected boxes. */
  readonly selected?: readonly string[] | undefined;
  /** This function receives the identifier of the box that the user clicks, or undefined for the background. */
  readonly onPick?: ((id: string | undefined) => void) | undefined;
  readonly className?: string;
  readonly style?: CSSProperties;
}

const MOUNT = { svg: mountSvg, dom: mountDom, canvas: mountCanvas } as const;

/** This component draws a layout with a live renderer. A change of the layout animates the boxes. */
export function LayoutView({ layout, renderer = "svg", theme, viewport, duration, interactive, selected, onPick, className, style }: LayoutViewProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<Renderer | undefined>(undefined);
  const latest = useRef(layout);
  const latestTheme = useRef(theme);
  // The key stands for the theme object, so an equal theme in a new object does not mount the renderer again.
  const themeKey = JSON.stringify(theme ?? {});

  // This effect comes first, so a renderer that the next effect mounts draws the newest layout and theme.
  useEffect(() => {
    latest.current = layout;
    latestTheme.current = theme;
  });

  useEffect(() => {
    const element = host.current;
    if (element === null) return undefined;
    // An empty key means no theme, so the renderer uses its default theme.
    const current = themeKey === "{}" ? undefined : latestTheme.current;
    const r = MOUNT[renderer](element, {
      ...(current === undefined ? {} : { theme: current }),
      ...(viewport === undefined ? {} : { viewport }),
      ...(duration === undefined ? {} : { duration }),
      ...(interactive === undefined ? {} : { interactive }),
    });
    live.current = r;
    r.update(latest.current);
    return () => {
      r.destroy();
      live.current = undefined;
    };
  }, [renderer, viewport, duration, interactive, themeKey]);

  useEffect(() => {
    live.current?.update(layout);
  }, [layout]);

  useEffect(() => {
    live.current?.select(selected ?? []);
  }, [selected]);

  useEffect(() => {
    const element = host.current;
    if (element === null || onPick === undefined) return undefined;
    let down: { x: number; y: number } | undefined;
    const onDown = (e: PointerEvent): void => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent): void => {
      // A drag is a pan, not a click.
      if (down === undefined || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const r = element.getBoundingClientRect();
      onPick(live.current?.pick({ x: e.clientX - r.left, y: e.clientY - r.top }));
    };
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointerup", onUp);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointerup", onUp);
    };
  }, [onPick]);

  return <div ref={host} className={className} style={{ position: "relative", width: "100%", height: "100%", ...style }} />;
}

function safe(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}`);
}
