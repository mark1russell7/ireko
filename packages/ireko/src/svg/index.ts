/**
 * The SVG export of ireko. `toSVG` gives a standalone SVG document as a string. It operates in Node and in a browser.
 * The document paints in three layers: the containers, then the edges, then the other nodes. Thus an edge is above the
 * container that holds its ends, and below the boxes that it connects.
 */
import { round3 } from "../core/geometry.ts";
import type { Layout, PlacedEdge, PlacedNode } from "../core/model.ts";
import { clipRoots, isContainer, mount, paintOrder, type Renderer, type RendererOptions, type Surface } from "../render/renderer.ts";
import { lightTheme, themeOf, type Theme } from "../render/theme.ts";
import type { Frame, FrameNode } from "../render/tween.ts";
import type { View } from "../render/viewport.ts";

export type { Renderer, RendererOptions } from "../render/renderer.ts";
export { isContainer } from "../render/renderer.ts";

/** The options of `toSVG`. */
export interface SvgOptions {
  /** The colors and the fonts. The values replace the values of `lightTheme`. */
  readonly theme?: Partial<Theme>;
  /** The space around the layout, in pixels. The default is 16. */
  readonly padding?: number;
  /** The title of the document, for assistive technology. */
  readonly title?: string;
  /** If false, the export has no labels. The default is true. */
  readonly labels?: boolean;
  /** If false, the export has no background rectangle. The default is true. */
  readonly background?: boolean;
}

/** This function gives the layout as a standalone SVG document. */
export function toSVG(layout: Layout, options: SvgOptions = {}): string {
  const theme = themeOf(options.theme, lightTheme);
  const pad = options.padding ?? 16;
  const b = layout.bounds;
  const vx = b.x - pad;
  const vy = b.y - pad;
  const vw = b.width + 2 * pad;
  const vh = b.height + 2 * pad;
  const labels = options.labels !== false;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  const clipOf = (n: PlacedNode): PlacedNode | undefined => {
    for (let c = n.container; c !== undefined; c = byId.get(c)?.container) {
      const holder = byId.get(c);
      if (holder?.clip === true) return holder;
    }
    return undefined;
  };
  const clipAttr = (n: PlacedNode): string => {
    const holder = clipOf(n);
    return holder === undefined ? "" : ` clip-path="url(#${clipId(holder.id)})"`;
  };

  const containers = layout.nodes.filter(isContainer);
  const others = layout.nodes.filter((n) => !isContainer(n));
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(vx)} ${num(vy)} ${num(vw)} ${num(vh)}" width="${num(vw)}" height="${num(vh)}" role="img" font-family="${esc(theme.fontFamily)}" font-size="${num(theme.fontSize)}">`);
  if (options.title !== undefined) out.push(`<title>${esc(options.title)}</title>`);
  const clips = containers.filter((n) => n.clip);
  if (clips.length > 0) {
    out.push("<defs>");
    for (const c of clips) out.push(`<clipPath id="${clipId(c.id)}"><rect x="${num(c.x)}" y="${num(c.y)}" width="${num(c.width)}" height="${num(c.height)}" rx="${num(theme.radius * c.scale)}"/></clipPath>`);
    out.push("</defs>");
  }
  if (options.background !== false) out.push(`<rect class="ireko-background" x="${num(vx)}" y="${num(vy)}" width="${num(vw)}" height="${num(vh)}" fill="${esc(theme.background)}"/>`);

  out.push(`<g class="ireko-containers">`);
  for (const n of containers) {
    out.push(`<g class="ireko-container" data-id="${esc(n.id)}"${clipAttr(n)}>`);
    out.push(`<rect x="${num(n.x)}" y="${num(n.y)}" width="${num(n.width)}" height="${num(n.height)}" rx="${num(theme.radius * n.scale)}" fill="${esc(theme.containerFill)}" stroke="${esc(theme.containerStroke)}"/>`);
    if (labels) {
      const size = theme.fontSize * n.scale;
      out.push(`<text x="${num(n.x + 8 * n.scale)}" y="${num(n.y + 6 * n.scale + size)}" font-size="${num(size)}" fill="${esc(theme.mutedText)}">${esc(n.label)}</text>`);
    }
    out.push("</g>");
  }
  out.push("</g>");

  out.push(`<g class="ireko-edges" fill="none">`);
  for (const e of layout.edges) out.push(edgeOf(e, theme, byId));
  out.push("</g>");

  out.push(`<g class="ireko-nodes">`);
  for (const n of others) {
    out.push(`<g class="ireko-node" data-id="${esc(n.id)}"${clipAttr(n)}>`);
    out.push(`<rect x="${num(n.x)}" y="${num(n.y)}" width="${num(n.width)}" height="${num(n.height)}" rx="${num(theme.radius * n.scale)}" fill="${esc(theme.nodeFill)}" stroke="${esc(theme.nodeStroke)}"/>`);
    if (labels) out.push(`<text x="${num(n.x + n.width / 2)}" y="${num(n.y + n.height / 2)}" font-size="${num(theme.fontSize * n.scale)}" text-anchor="middle" dominant-baseline="central" fill="${esc(theme.text)}">${esc(n.label)}</text>`);
    out.push("</g>");
  }
  out.push("</g>");
  out.push("</svg>");
  return out.join("\n");
}

function edgeOf(e: PlacedEdge, theme: Theme, byId: ReadonlyMap<string, PlacedNode>): string {
  const points = e.points.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");
  const scale = Math.min(byId.get(e.source)?.scale ?? 1, byId.get(e.target)?.scale ?? 1);
  const extra = e.kind === "extra";
  const stroke = extra ? theme.extraEdge : theme.edge;
  const dash = extra ? ` stroke-dasharray="${num(4 * scale)} ${num(3 * scale)}"` : "";
  return `<polyline class="ireko-edge" data-id="${esc(e.id)}" points="${points}" stroke="${esc(stroke)}" stroke-width="${num(1.25 * scale)}"${dash}/>`;
}

function clipId(id: string): string {
  return `ireko-clip-${id.replace(/[^A-Za-z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}`)}`;
}

/** This function writes a number with three decimals or fewer. */
function num(v: number): string {
  return String(round3(v));
}

/** This function escapes the characters that have a meaning in XML. */
export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SVG = "http://www.w3.org/2000/svg";

/** This function adds a live SVG renderer to `container`. Give it a layout with `update`. */
export function mountSvg(container: HTMLElement, options: RendererOptions = {}): Renderer {
  return mount(container, svgSurface, options);
}

/** This function makes the live SVG surface in `host`. */
export function svgSurface(host: HTMLElement, theme: Theme): Surface {
  const svg = document.createElementNS(SVG, "svg");
  Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", background: theme.background });
  svg.setAttribute("font-family", theme.fontFamily);
  const defs = document.createElementNS(SVG, "defs");
  const stage = document.createElementNS(SVG, "g");
  const layers = [document.createElementNS(SVG, "g"), document.createElementNS(SVG, "g"), document.createElementNS(SVG, "g")] as const;
  layers[1].setAttribute("fill", "none");
  stage.append(...layers);
  svg.append(defs, stage);
  host.appendChild(svg);
  const groups = new Map<string, { readonly g: SVGGElement; readonly rect: SVGRectElement; readonly text: SVGTextElement }>();
  const lines = new Map<string, SVGPolylineElement>();

  const node = (n: FrameNode, layer: SVGGElement, selected: boolean, clip: FrameNode | undefined): void => {
    let entry = groups.get(n.id);
    if (entry === undefined) {
      entry = { g: document.createElementNS(SVG, "g"), rect: document.createElementNS(SVG, "rect"), text: document.createElementNS(SVG, "text") };
      entry.g.dataset["id"] = n.id;
      entry.g.append(entry.rect, entry.text);
      groups.set(n.id, entry);
    }
    const { g, rect, text } = entry;
    if (g.parentNode !== layer) layer.appendChild(g);
    const container = isContainer(n);
    g.setAttribute("class", container ? "ireko-container" : "ireko-node");
    g.setAttribute("opacity", String(n.opacity));
    if (clip === undefined) g.removeAttribute("clip-path");
    else g.setAttribute("clip-path", `url(#${clipId(clip.id)})`);
    setAll(rect, { x: n.x, y: n.y, width: n.width, height: n.height, rx: theme.radius * n.scale, fill: container ? theme.containerFill : theme.nodeFill, stroke: selected ? theme.accent : container ? theme.containerStroke : theme.nodeStroke, "stroke-width": n.scale * (selected ? 2 : 1) });
    const size = theme.fontSize * n.scale;
    text.textContent = n.label;
    if (container) setAll(text, { x: n.x + 8 * n.scale, y: n.y + 6 * n.scale + size, "font-size": size, fill: theme.mutedText, "text-anchor": "start", "dominant-baseline": "auto" });
    else setAll(text, { x: n.x + n.width / 2, y: n.y + n.height / 2, "font-size": size, fill: theme.text, "text-anchor": "middle", "dominant-baseline": "central" });
  };

  return {
    draw(frame: Frame, view: View, selected: ReadonlySet<string>) {
      stage.setAttribute("transform", `translate(${String(view.x)} ${String(view.y)}) scale(${String(view.k)})`);
      const { containers, leaves } = paintOrder(frame.nodes);
      const clips = clipRoots(frame.nodes);
      defs.replaceChildren(...containers.filter((c) => c.clip).map((c) => {
        const path = document.createElementNS(SVG, "clipPath");
        path.id = clipId(c.id);
        const r = document.createElementNS(SVG, "rect");
        setAll(r, { x: c.x, y: c.y, width: c.width, height: c.height });
        path.appendChild(r);
        return path;
      }));
      const seen = new Set<string>();
      for (const n of containers) {
        node(n, layers[0], selected.has(n.id), clips.get(n.id));
        seen.add(n.id);
      }
      for (const n of leaves) {
        node(n, layers[2], selected.has(n.id), clips.get(n.id));
        seen.add(n.id);
      }
      for (const [id, entry] of groups) {
        if (seen.has(id)) continue;
        entry.g.remove();
        groups.delete(id);
      }
      const kept = new Set<string>();
      for (const e of frame.edges) {
        let line = lines.get(e.id);
        if (line === undefined) {
          line = document.createElementNS(SVG, "polyline");
          line.dataset["id"] = e.id;
          lines.set(e.id, line);
          layers[1].appendChild(line);
        }
        setAll(line, { points: e.points.map((p) => `${num(p.x)},${num(p.y)}`).join(" "), stroke: e.kind === "extra" ? theme.extraEdge : theme.edge, "stroke-width": 1.25, opacity: e.opacity, "stroke-dasharray": e.kind === "extra" ? "4 3" : "none" });
        kept.add(e.id);
      }
      for (const [id, line] of lines) {
        if (kept.has(id)) continue;
        line.remove();
        lines.delete(id);
      }
    },
    destroy() {
      svg.remove();
      groups.clear();
      lines.clear();
    },
  };
}

function setAll(el: Element, attrs: Readonly<Record<string, string | number>>): void {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, typeof v === "number" ? num(v) : v);
}
