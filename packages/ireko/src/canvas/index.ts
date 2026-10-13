/**
 * The Canvas renderer of ireko. It draws each frame again on one canvas, so it is fast for large layouts.
 * `drawFrame` is a pure function of a 2D context, so a test can give it a context that records the calls.
 */
import { clipRoots, isContainer, mount, paintOrder, type Renderer, type RendererOptions, type Surface } from "../render/renderer.ts";
import type { Theme } from "../render/theme.ts";
import type { Frame, FrameNode } from "../render/tween.ts";
import type { View } from "../render/viewport.ts";

export type { Renderer, RendererOptions } from "../render/renderer.ts";

/** The part of `CanvasRenderingContext2D` that `drawFrame` uses. */
export type Context2D = Pick<
  CanvasRenderingContext2D,
  | "save"
  | "restore"
  | "setTransform"
  | "clearRect"
  | "fillRect"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "arcTo"
  | "closePath"
  | "fill"
  | "stroke"
  | "rect"
  | "clip"
  | "fillText"
  | "setLineDash"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "globalAlpha"
>;

/** This function adds a Canvas renderer to `container`. Give it a layout with `update`. */
export function mountCanvas(container: HTMLElement, options: RendererOptions = {}): Renderer {
  return mount(container, canvasSurface, options);
}

/** This function makes the Canvas surface in `host`. */
export function canvasSurface(host: HTMLElement, theme: Theme): Surface {
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  return {
    resize(w, h) {
      width = w;
      height = h;
      const dpr = Math.max(1, devicePixelRatio);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    },
    draw(frame, view, selected) {
      if (ctx === null) return;
      drawFrame(ctx, frame, view, theme, { width, height, dpr: Math.max(1, devicePixelRatio), selected });
    },
    destroy() {
      canvas.remove();
    },
  };
}

/** The screen of `drawFrame`: its size in CSS pixels, its pixel ratio and the selected boxes. */
export interface Screen {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly selected?: ReadonlySet<string>;
}

/** This function draws one frame on a 2D context: the background, the containers, the edges, then the other boxes. */
export function drawFrame(ctx: Context2D, frame: Frame, view: View, theme: Theme, screen: Screen): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, screen.width * screen.dpr, screen.height * screen.dpr);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, screen.width * screen.dpr, screen.height * screen.dpr);
  ctx.setTransform(screen.dpr * view.k, 0, 0, screen.dpr * view.k, screen.dpr * view.x, screen.dpr * view.y);

  const { containers, leaves } = paintOrder(frame.nodes);
  const clips = clipRoots(frame.nodes);
  const selected = screen.selected ?? new Set<string>();
  for (const n of containers) box(ctx, n, theme, selected.has(n.id), clips.get(n.id));
  for (const e of frame.edges) {
    ctx.save();
    ctx.globalAlpha = e.opacity;
    ctx.strokeStyle = e.kind === "extra" ? theme.extraEdge : theme.edge;
    ctx.lineWidth = 1.25;
    ctx.setLineDash(e.kind === "extra" ? [4, 3] : []);
    ctx.beginPath();
    e.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }
  for (const n of leaves) box(ctx, n, theme, selected.has(n.id), clips.get(n.id));
}

function box(ctx: Context2D, n: FrameNode, theme: Theme, selected: boolean, clip: FrameNode | undefined): void {
  const container = isContainer(n);
  ctx.save();
  ctx.globalAlpha = n.opacity;
  if (clip !== undefined) {
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.width, clip.height);
    ctx.clip();
  }
  roundRect(ctx, n.x, n.y, n.width, n.height, Math.min(theme.radius * n.scale, n.width / 2, n.height / 2));
  ctx.fillStyle = container ? theme.containerFill : theme.nodeFill;
  ctx.fill();
  ctx.lineWidth = n.scale * (selected ? 2 : 1);
  ctx.strokeStyle = selected ? theme.accent : container ? theme.containerStroke : theme.nodeStroke;
  ctx.stroke();
  const size = theme.fontSize * n.scale;
  ctx.font = `${String(size)}px ${theme.fontFamily}`;
  ctx.fillStyle = container ? theme.mutedText : theme.text;
  if (container) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(n.label, n.x + 8 * n.scale, n.y + 6 * n.scale);
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.label, n.x + n.width / 2, n.y + n.height / 2);
  }
  ctx.restore();
}

function roundRect(ctx: Context2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
