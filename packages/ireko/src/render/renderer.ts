/**
 * The loop that each live renderer shares. A surface (DOM, SVG or Canvas) only draws one frame. This loop owns the
 * rest: the animation from one layout to the next, the viewport, the size of the element and the hit test.
 */
import type { Point } from "../core/geometry.ts";
import type { Layout } from "../core/model.ts";
import { lightTheme, themeOf, type Theme } from "./theme.ts";
import { easeInOut, frameOf, interpolate, type Frame, type FrameNode } from "./tween.ts";
import { createViewport, type View, type Viewport } from "./viewport.ts";

/** A surface: the part of a renderer that draws. */
export interface Surface {
  /** This function draws one frame with the view `view`. */
  draw(frame: Frame, view: View, selected: ReadonlySet<string>): void;
  /** This function tells the surface its new size, in CSS pixels. */
  resize?(width: number, height: number): void;
  destroy(): void;
}

/** The options of a live renderer. */
export interface RendererOptions {
  /** The colors and the fonts. The values replace the values of `lightTheme`. */
  readonly theme?: Partial<Theme>;
  /** The viewport. Give the same viewport to two renderers to move them together. */
  readonly viewport?: Viewport;
  /** If true, the user can pan and zoom with the pointer and the wheel. The default is true. */
  readonly interactive?: boolean;
  /** The time of the animation from one layout to the next, in milliseconds. The default is 320. Use 0 for no animation. */
  readonly duration?: number;
  /** If true, the first layout fills the element. The default is true. */
  readonly fit?: boolean;
}

/** A live renderer. */
export interface Renderer {
  /** The element that the renderer adds to the container. */
  readonly element: HTMLElement;
  readonly viewport: Viewport;
  /** This function draws a new layout. The boxes move from their old places to their new places. */
  update(layout: Layout): void;
  /** This function makes the current layout fill the element. */
  fit(padding?: number): void;
  /** This function marks the boxes with the identifiers `ids`. */
  select(ids: Iterable<string>): void;
  /** This function gives the identifier of the box at a point of the element, or undefined. A box above another box comes first. */
  pick(point: Point): string | undefined;
  destroy(): void;
}

/** This function adds a live renderer to `container`. `create` makes the surface in the element of the renderer. */
export function mount(container: HTMLElement, create: (host: HTMLElement, theme: Theme) => Surface, options: RendererOptions = {}): Renderer {
  const host = document.createElement("div");
  host.className = "ireko";
  Object.assign(host.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden", touchAction: "none" });
  container.appendChild(host);
  const theme = themeOf(options.theme, lightTheme);
  const surface = create(host, theme);
  const viewport = options.viewport ?? createViewport();
  const duration = options.duration ?? 320;
  let frame: Frame | undefined;
  let layout: Layout | undefined;
  let selected: ReadonlySet<string> = new Set();
  let raf = 0;
  let fitted = options.fit === false;

  const draw = (): void => {
    if (frame !== undefined) surface.draw(frame, viewport.get(), selected);
  };
  const size = (): { width: number; height: number } => ({ width: host.clientWidth, height: host.clientHeight });

  const offView = viewport.subscribe(draw);
  const detach = options.interactive === false ? undefined : viewport.attach(host);
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    const s = size();
    surface.resize?.(s.width, s.height);
    draw();
  }) : undefined;
  observer?.observe(host);
  surface.resize?.(size().width, size().height);

  const renderer: Renderer = {
    element: host,
    viewport,
    update(next) {
      cancelAnimationFrame(raf);
      layout = next;
      const from = frame;
      if (!fitted) {
        fitted = true;
        const s = size();
        if (Math.min(s.width, s.height) > 0) viewport.fit(next.bounds, s.width, s.height);
      }
      if (from === undefined || duration <= 0 || reducedMotion()) {
        frame = frameOf(next);
        draw();
        return;
      }
      const start = performance.now();
      const step = (now: number): void => {
        // The time of a frame can come before the start: the browser gives the start time of the frame.
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        frame = interpolate(from, next, easeInOut(t));
        draw();
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    },
    fit(padding) {
      const s = size();
      if (layout !== undefined) viewport.fit(layout.bounds, s.width, s.height, padding);
    },
    select(ids) {
      selected = new Set(ids);
      draw();
    },
    pick(point) {
      if (frame === undefined) return undefined;
      return pickIn(frame, viewport.toLayout(point));
    },
    destroy() {
      cancelAnimationFrame(raf);
      offView();
      detach?.();
      observer?.disconnect();
      surface.destroy();
      host.remove();
    },
  };
  return renderer;
}

/** This function gives the identifier of the top box at a point of the layout. */
export function pickIn(frame: Frame, p: Point): string | undefined {
  const { containers, leaves } = paintOrder(frame.nodes);
  for (const list of [leaves, containers]) {
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      if (n !== undefined && n.opacity > 0 && p.x >= n.x && p.x <= n.x + n.width && p.y >= n.y && p.y <= n.y + n.height) return n.id;
    }
  }
  return undefined;
}

/** This function tells if a node is a container: a node in the nested mode with children. */
export function isContainer(n: { readonly mode: string; readonly childCount: number }): boolean {
  return n.mode === "nested" && n.childCount > 0;
}

/** This function splits the nodes into the two layers of the paint order: the containers, then the other nodes. */
export function paintOrder(nodes: readonly FrameNode[]): { containers: FrameNode[]; leaves: FrameNode[] } {
  const containers: FrameNode[] = [];
  const leaves: FrameNode[] = [];
  for (const n of nodes) (isContainer(n) ? containers : leaves).push(n);
  return { containers, leaves };
}

/** This function gives, for each node, the nearest container with the fit `clip` that holds it. */
export function clipRoots(nodes: readonly FrameNode[]): Map<string, FrameNode> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, FrameNode>();
  for (const n of nodes) {
    for (let c = n.container; c !== undefined; c = byId.get(c)?.container) {
      const holder = byId.get(c);
      if (holder?.clip === true) {
        out.set(n.id, holder);
        break;
      }
    }
  }
  return out;
}

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
