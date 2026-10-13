/**
 * The SVG export of ireko. `toSVG` gives a standalone SVG document as a string. It operates in Node and in a browser.
 * The document paints in three layers: the containers, then the edges, then the other nodes. Thus an edge is above the
 * container that holds its ends, and below the boxes that it connects.
 */
import { round3 } from "../core/geometry.ts";
import type { Layout, PlacedEdge, PlacedNode } from "../core/model.ts";

/** The colors and the fonts of the SVG export. */
export interface SvgTheme {
  readonly background: string;
  readonly nodeFill: string;
  readonly nodeStroke: string;
  readonly containerFill: string;
  readonly containerStroke: string;
  readonly text: string;
  readonly mutedText: string;
  readonly edge: string;
  readonly extraEdge: string;
  readonly radius: number;
  readonly fontSize: number;
  readonly fontFamily: string;
}

/** The default theme: ink on paper, the same as the site. */
export const defaultTheme: SvgTheme = {
  background: "#f5f6f9",
  nodeFill: "#ffffff",
  nodeStroke: "#454f67",
  containerFill: "#eef1f6",
  containerStroke: "#aeb6c7",
  text: "#151c2e",
  mutedText: "#5f6880",
  edge: "#7a8399",
  extraEdge: "#2346c4",
  radius: 6,
  fontSize: 13,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

/** The options of `toSVG`. */
export interface SvgOptions {
  /** The colors and the fonts. The values replace the values of `defaultTheme`. */
  readonly theme?: Partial<SvgTheme>;
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
  const theme: SvgTheme = { ...defaultTheme, ...options.theme };
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

/** This function tells if a node is a container: a node in the nested mode with children. */
export function isContainer(n: PlacedNode): boolean {
  return n.mode === "nested" && n.childCount > 0;
}

function edgeOf(e: PlacedEdge, theme: SvgTheme, byId: ReadonlyMap<string, PlacedNode>): string {
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
