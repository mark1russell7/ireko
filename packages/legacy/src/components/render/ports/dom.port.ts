import type { RenderPort, RenderSession } from "./types";
import type { LayoutSnapshot } from "../../layout/types";
import type { Theme } from "../../adapters/theme";
import { defaultTheme } from "../../adapters/theme";
import type { ViewportController } from "./viewport";

export class DomPort implements RenderPort {
  mount(
    container: HTMLElement,
    initial: LayoutSnapshot,
    theme: Theme = defaultTheme,
    opts?: { viewport?: ViewportController; interactive?: boolean }
  ): RenderSession {
    const root = document.createElement("div");
    Object.assign(root.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden" });
    container.appendChild(root);

    // content layer gets translate/scale
    const content = document.createElement("div");
    Object.assign(content.style, { position: "absolute", inset: "0", transformOrigin: "0 0", willChange: "transform" });
    root.appendChild(content);

    // edges
    const svgNS = "http://www.w3.org/2000/svg";
    const svg: SVGSVGElement = document.createElementNS(svgNS, "svg") as SVGSVGElement;
    Object.assign(svg.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none", zIndex: "0" });
    content.appendChild(svg);

    // nodes
    const nodesLayer = document.createElement("div");
    Object.assign(nodesLayer.style, { position: "absolute", left: "0", top: "0", zIndex: "1" });
    content.appendChild(nodesLayer);

    const vp = opts?.viewport;
    const syncTransform = () => {
      if (!vp) return;
      const { x, y, scale } = vp.get();
      content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };
    const offVp = vp?.onChange(syncTransform);
    syncTransform();
    const nodeEls = new Map<string, HTMLDivElement>();
    const edgeEls = new Map<string, SVGElement>();

    const draw = (s: LayoutSnapshot) => {
      // nodesLayer.querySelectorAll("[data-node]").forEach((n) => n.remove());
      // while (svg.firstChild) svg.removeChild(svg.firstChild);

      const b = s.stats.bounds;
      const stageW = Math.max(1, Math.ceil(b.size.x));
      const stageH = Math.max(1, Math.ceil(b.size.y));
      Object.assign(nodesLayer.style, { width: `${stageW}px`, height: `${stageH}px` });
      svg.setAttribute("width", String(stageW));
      svg.setAttribute("height", String(stageH));

      // wires (local coords inside stage)
      const nextEdgeIds = new Set<string>();
      for (const w of s.wires) {
          const id = w.id!;
          nextEdgeIds.add(id);
          let el = edgeEls.get(id);
          if (!el) {
            el = w.polyline?.length
              ? document.createElementNS(svgNS, "polyline")
              : document.createElementNS(svgNS, "line");
            edgeEls.set(id, el);
            svg.appendChild(el);
          }
          if (w.polyline?.length) {
            (el as SVGPolylineElement).setAttribute("points", w.polyline.map(p => `${p.x - b.position.x},${p.y - b.position.y}`).join(" "));
          } else {
            const a = s.boxes[w.source], c = s.boxes[w.target];
            if (!a || !c) continue;
            const A = a.position.add(a.size.halve()).subtract(b.position);
            const B = c.position.add(c.size.halve()).subtract(b.position);
            (el as SVGLineElement).setAttribute("x1", String(A.x));
            (el as SVGLineElement).setAttribute("y1", String(A.y));
            (el as SVGLineElement).setAttribute("x2", String(B.x));
            (el as SVGLineElement).setAttribute("y2", String(B.y));
          }
          el.setAttribute("stroke", theme.wire.stroke);
          el.setAttribute("stroke-width", String(theme.wire.width));
          (el as any).style = "pointer-events:none";
        }
           // remove stale edges
      for (const [id, el] of edgeEls) if (!nextEdgeIds.has(id)) { el.remove(); edgeEls.delete(id); }
 // --- Nodes ---
      const nextNodeIds = new Set<string>();
      for (const bx of Object.values(s.boxes).sort((a, c) => a.depth - c.depth || a.id.localeCompare(c.id))) {
        nextNodeIds.add(bx.id);
        let el = nodeEls.get(bx.id);
        if (!el) {
          el = document.createElement("div");
          el.dataset.node = bx.id;
          el.style.position = "absolute";
          el.style.border = `1px solid ${theme.node.border}`;
          el.style.borderRadius = `${theme.node.radius}px`;
          el.style.background = theme.node.bg;
          el.style.boxSizing = "border-box";
          el.style.fontSize = `${theme.node.fontSize}px`;
          el.style.color = theme.node.text;
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          (el.style as any).userSelect = "none";
          el.textContent = bx.id;
          nodeEls.set(bx.id, el);
          nodesLayer.appendChild(el);
        }
        el.style.left = `${bx.position.x - b.position.x}px`;
        el.style.top = `${bx.position.y - b.position.y}px`;
        el.style.width = `${bx.size.x}px`;
        el.style.height = `${bx.size.y}px`;
      }
      // remove stale nodes
      for (const [id, el] of nodeEls) if (!nextNodeIds.has(id)) { el.remove(); nodeEls.delete(id); }
    }

    draw(initial);
    let detachInputs: (() => void) | undefined;
    if (opts?.interactive && vp) detachInputs = vp.attachWheelAndDrag(root);

    return {
      draw,
      destroy: () => {
        try { offVp?.(); detachInputs?.(); if (root.parentNode === container) container.removeChild(root); else root.remove?.(); } catch {}
      },
    };
  }
}
