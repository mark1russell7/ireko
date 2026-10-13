import type { RenderPort, RenderSession } from "./types";
import type { LayoutSnapshot } from "../../layout/types";
import type { Theme } from "../../adapters/theme";
import { defaultTheme } from "../../adapters/theme";
import { CanvasRenderer2D } from "../../adapters/targets/canvas.core";
import type { ViewportController } from "./viewport";

export class CanvasPort implements RenderPort {
  mount(
    container: HTMLElement,
    initial: LayoutSnapshot,
    theme: Theme = defaultTheme,
    opts?: { viewport?: ViewportController; interactive?: boolean }
  ): RenderSession {
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    container.appendChild(canvas);

    // REPLACE: compute DPR on demand
    const getDpr = () => Math.max(1, (window.devicePixelRatio as number) || 1);
    let dpr = getDpr();
    const sizeCanvas = () => {
      dpr = getDpr(); // <— recompute here
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    sizeCanvas();

    const ctx = canvas.getContext("2d")!;
    const themeNoBg: Theme = { ...theme, canvas: { ...theme.canvas, bg: "rgba(0,0,0,0)" } };
    const renderer = new CanvasRenderer2D(canvas, themeNoBg);

    const toLegacy = (s: LayoutSnapshot) => ({
      boxes: Object.fromEntries(Object.values(s.boxes).map((b) => [
        b.id, { id: b.id, getPosition: () => b.position, getSize: () => b.size, parentId: b.parentId, depth: b.depth },
      ])),
      wires: s.wires.map((w) => ({ id: w.id, source: w.source, target: w.target, polyline: w.polyline })),
    });

    const applyTransform = (s: LayoutSnapshot) => {
      // clear screen in device coords
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = theme.canvas.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const b = s.stats.bounds;
      const scale = opts?.viewport?.get().scale ?? 1;
      const x = opts?.viewport?.get().x ?? 0;
      const y = opts?.viewport?.get().y ?? 0;

      // world → screen: (P - b.pos) * scale + (x,y), then DPR
      const e = x - b.position.x * scale;
      const f = y - b.position.y * scale;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * e, dpr * f);
    };

    let last = initial;
    applyTransform(initial);
    renderer.fullDraw(toLegacy(initial));

    const draw = (s: LayoutSnapshot) => {
      last = s;
      applyTransform(s);
      renderer.fullDraw(toLegacy(s)); // always full redraw — avoids transform/diff mismatch
    };

    const ro = new ResizeObserver(() => {
      sizeCanvas();
      applyTransform(last);
      renderer.fullDraw(toLegacy(last));
    });
    ro.observe(container);

    const offVp = opts?.viewport?.onChange(() => { draw(last); });
    let detachInputs: (() => void) | undefined;
    if (opts?.interactive && opts.viewport) detachInputs = opts.viewport.attachWheelAndDrag(canvas);

    // (optional) react to DPR changes (Chrome/Edge)
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDprChange = () => { sizeCanvas(); applyTransform(last); renderer.fullDraw(toLegacy(last)); };
    mq.addEventListener?.("change", onDprChange);
    return {
      draw,
      destroy: () => {
        try {
          ro.disconnect(); offVp?.(); detachInputs?.();
          if (canvas.parentNode === container) container.removeChild(canvas); else canvas.remove?.();
        } catch {}
      },
    };
  }
}
