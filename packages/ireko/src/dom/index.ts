/**
 * The DOM renderer of ireko. Each box is an element, so a page can style it with CSS and a user can select its text.
 * The edges are in one SVG element. The renderer keeps an element for each identifier and changes only its style.
 */
import { round3 } from "../core/geometry.ts";
import { clipRoots, isContainer, mount, paintOrder, type Renderer, type RendererOptions, type Surface } from "../render/renderer.ts";
import { haloOf, labelAt, LABEL_SCALE } from "../render/label.ts";
import type { Theme } from "../render/theme.ts";
import type { Frame, FrameNode } from "../render/tween.ts";
import type { View } from "../render/viewport.ts";

export type { Renderer, RendererOptions } from "../render/renderer.ts";

const SVG = "http://www.w3.org/2000/svg";

/** This function adds a DOM renderer to `container`. Give it a layout with `update`. */
export function mountDom(container: HTMLElement, options: RendererOptions = {}): Renderer {
  return mount(container, domSurface, options);
}

/** This function makes the DOM surface in `host`. */
export function domSurface(host: HTMLElement, theme: Theme): Surface {
  const stage = document.createElement("div");
  Object.assign(stage.style, { position: "absolute", left: "0", top: "0", transformOrigin: "0 0", fontFamily: theme.fontFamily });
  host.style.background = theme.background;
  const containerLayer = document.createElement("div");
  const edgeLayer = document.createElementNS(SVG, "svg");
  edgeLayer.setAttribute("width", "1");
  edgeLayer.setAttribute("height", "1");
  Object.assign(edgeLayer.style, { position: "absolute", left: "0", top: "0", overflow: "visible", pointerEvents: "none" });
  const leafLayer = document.createElement("div");
  const labelLayer = document.createElement("div");
  labelLayer.className = "ireko-edge-labels";
  stage.append(containerLayer, edgeLayer, leafLayer, labelLayer);
  host.appendChild(stage);

  const boxes = new Map<string, { readonly el: HTMLDivElement; readonly label: HTMLSpanElement }>();
  const lines = new Map<string, SVGPolylineElement>();
  const texts = new Map<string, HTMLSpanElement>();
  const halo = haloOf(theme);

  // The element of a node goes to the position `index` of its layer. Thus the layer keeps the paint order of the canvas.
  const box = (n: FrameNode, layer: HTMLElement, index: number, selected: boolean, clip: FrameNode | undefined): void => {
    let entry = boxes.get(n.id);
    const container = isContainer(n);
    if (entry === undefined) {
      entry = { el: document.createElement("div"), label: document.createElement("span") };
      entry.el.dataset["id"] = n.id;
      entry.el.appendChild(entry.label);
      boxes.set(n.id, entry);
    }
    const { el, label } = entry;
    const at = layer.children[index];
    if (at !== el) layer.insertBefore(el, at ?? null);
    el.className = `${container ? "ireko-container" : "ireko-node"}${selected ? " ireko-selected" : ""}`;
    label.textContent = n.label;
    Object.assign(el.style, {
      position: "absolute",
      boxSizing: "border-box",
      left: px(n.x),
      top: px(n.y),
      width: px(n.width),
      height: px(n.height),
      borderRadius: `${String(theme.radius * n.scale)}px`,
      border: `${String(n.scale * (selected ? 2 : 1))}px solid ${selected ? theme.accent : container ? theme.containerStroke : theme.nodeStroke}`,
      background: container ? theme.containerFill : theme.nodeFill,
      color: container ? theme.mutedText : theme.text,
      fontSize: `${String(theme.fontSize * n.scale)}px`,
      opacity: String(n.opacity),
      display: "flex",
      alignItems: container ? "flex-start" : "center",
      justifyContent: container ? "flex-start" : "center",
      padding: container ? `${String(5 * n.scale)}px ${String(8 * n.scale)}px` : "0",
      overflow: "hidden",
      whiteSpace: "nowrap",
      clipPath: clip === undefined ? "" : `polygon(${corners(clip, n)})`,
    });
  };

  return {
    draw(frame: Frame, view: View, selected: ReadonlySet<string>) {
      stage.style.transform = `translate(${String(view.x)}px, ${String(view.y)}px) scale(${String(view.k)})`;
      const { containers, leaves } = paintOrder(frame.nodes);
      const clips = clipRoots(frame.nodes);
      const seen = new Set<string>();
      containers.forEach((n, i) => {
        box(n, containerLayer, i, selected.has(n.id), clips.get(n.id));
        seen.add(n.id);
      });
      leaves.forEach((n, i) => {
        box(n, leafLayer, i, selected.has(n.id), clips.get(n.id));
        seen.add(n.id);
      });
      for (const [id, entry] of boxes) {
        if (seen.has(id)) continue;
        entry.el.remove();
        boxes.delete(id);
      }

      const kept = new Set<string>();
      for (const e of frame.edges) {
        let line = lines.get(e.id);
        if (line === undefined) {
          line = document.createElementNS(SVG, "polyline");
          line.setAttribute("fill", "none");
          line.dataset["id"] = e.id;
          lines.set(e.id, line);
          edgeLayer.appendChild(line);
        }
        line.setAttribute("points", e.points.map((p) => `${String(round3(p.x))},${String(round3(p.y))}`).join(" "));
        line.setAttribute("stroke", e.kind === "extra" ? theme.extraEdge : theme.edge);
        line.setAttribute("stroke-width", "1.25");
        line.setAttribute("opacity", String(e.opacity));
        if (e.kind === "extra") line.setAttribute("stroke-dasharray", "4 3");
        else line.removeAttribute("stroke-dasharray");
        kept.add(e.id);
      }
      for (const [id, line] of lines) {
        if (kept.has(id)) continue;
        line.remove();
        lines.delete(id);
      }

      const labelled = new Set<string>();
      for (const e of frame.edges) {
        if (e.label === undefined || e.label === "") continue;
        let text = texts.get(e.id);
        if (text === undefined) {
          text = document.createElement("span");
          text.className = "ireko-edge-label";
          text.dataset["id"] = e.id;
          texts.set(e.id, text);
          labelLayer.appendChild(text);
        }
        const p = labelAt(e.points);
        text.textContent = e.label;
        Object.assign(text.style, {
          position: "absolute",
          left: px(p.x),
          top: px(p.y),
          transform: "translate(-50%, -50%)",
          padding: "0 3px",
          borderRadius: "3px",
          background: halo,
          color: theme.mutedText,
          fontSize: `${String(theme.fontSize * LABEL_SCALE)}px`,
          whiteSpace: "nowrap",
          opacity: String(e.opacity),
          pointerEvents: "none",
        });
        labelled.add(e.id);
      }
      for (const [id, text] of texts) {
        if (labelled.has(id)) continue;
        text.remove();
        texts.delete(id);
      }
    },
    destroy() {
      stage.remove();
      boxes.clear();
      lines.clear();
      texts.clear();
    },
  };
}

/** This function gives the corners of the clip rectangle `clip`, relative to the box `n`, for a CSS polygon. */
/** This function writes a CSS length with three decimals or fewer, and without an exponent. */
function px(v: number): string {
  return `${String(round3(v))}px`;
}

function corners(clip: FrameNode, n: FrameNode): string {
  const x0 = clip.x - n.x;
  const y0 = clip.y - n.y;
  const x1 = x0 + clip.width;
  const y1 = y0 + clip.height;
  return [`${px(x0)} ${px(y0)}`, `${px(x1)} ${px(y0)}`, `${px(x1)} ${px(y1)}`, `${px(x0)} ${px(y1)}`].join(", ");
}
