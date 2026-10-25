// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { drawFrame, mountCanvas, type Context2D } from "../canvas/index.ts";
import { layout } from "../core/engine.ts";
import type { NodeSpec, Rect } from "../core/index.ts";
import { mountDom } from "../dom/index.ts";
import { examples } from "../examples/index.ts";
import { mountSvg } from "../svg/index.ts";
import { clipRoots, isContainer, paintOrder, pickIn } from "./renderer.ts";
import { haloOf, labelAt } from "./label.ts";
import { darkTheme, lightTheme, themeOf } from "./theme.ts";
import { easeInOut, frameOf, interpolate, morph, resample } from "./tween.ts";
import { createViewport } from "./viewport.ts";

const boxOf = (r: { x: number; y: number; width: number; height: number }): Rect => ({ x: r.x, y: r.y, width: r.width, height: r.height });
const host = (): HTMLDivElement => {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: 800 });
  Object.defineProperty(el, "clientHeight", { value: 600 });
  document.body.appendChild(el);
  return el;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

/** This function gives the identifiers of the elements of `selector` in a renderer, in the order of the document. */
function ids(r: ReturnType<typeof mountSvg>, selector: string): (string | null)[] {
  return [...r.element.querySelectorAll(selector)].map((el) => el.getAttribute("data-id"));
}

/** A wheel event at the point (0, 0). happy-dom does not set the client coordinates of a wheel event. */
function wheel(deltaY: number): WheelEvent {
  const e = new WheelEvent("wheel", { deltaY, cancelable: true });
  Object.defineProperty(e, "clientX", { value: 0 });
  Object.defineProperty(e, "clientY", { value: 0 });
  return e;
}

/** This function compares boxes to 0.001 pixels. A browser writes a CSS length with six decimals. */
function expectBoxes(actual: readonly Rect[], expected: readonly Rect[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((a, i) => {
    const e = expected[i];
    for (const k of ["x", "y", "width", "height"] as const) expect(a[k]).toBeCloseTo(e?.[k] ?? Number.NaN, 3);
  });
}

/** A 2D context that records the boxes and the texts that `drawFrame` draws. */
function recorder() {
  const boxes: Rect[] = [];
  const texts: string[] = [];
  let path: number[][] = [];
  const ctx = {
    save() {},
    restore() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {
      path = [];
    },
    moveTo(x: number, y: number) {
      path.push([x, y]);
    },
    lineTo() {},
    arcTo(x1: number, y1: number, x2: number, y2: number) {
      path.push([x1, y1, x2, y2]);
    },
    closePath() {
      // The third arc goes from (x, y + h) to (x, y), and the first arc from (x + w, y) to (x + w, y + h).
      const first = path[1];
      const third = path[3];
      if (first !== undefined && third !== undefined) {
        const [x = 0, , , y = 0] = third;
        const [right = 0, , , bottom = 0] = first;
        boxes.push({ x, y, width: right - x, height: bottom - y });
      }
    },
    fill() {},
    stroke() {},
    rect() {},
    clip() {},
    fillText(text: string) {
      texts.push(text);
    },
    strokeText() {},
    lineJoin: "miter",
    setLineDash() {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    globalAlpha: 1,
  };
  return { ctx: ctx as unknown as Context2D, boxes, texts };
}

describe("tween", () => {
  const a = layout({ root: { id: "r", children: [{ id: "x" }, { id: "gone" }] } });
  const b = layout({ root: { id: "r", layout: "radial", children: [{ id: "x" }, { id: "new" }] } });

  it("gives the frame of a layout, and the end layout at t = 1", () => {
    expect(frameOf(a).nodes.every((n) => n.opacity === 1)).toBe(true);
    expect(interpolate(frameOf(a), b, 1)).toEqual(frameOf(b));
  });

  it("moves the boxes, grows the new boxes from their parent, and fades the removed boxes", () => {
    const mid = interpolate(frameOf(a), b, 0.5);
    const x = mid.nodes.find((n) => n.id === "x");
    const ax = a.nodes.find((n) => n.id === "x");
    const bx = b.nodes.find((n) => n.id === "x");
    expect(x?.x).toBeCloseTo(((ax?.x ?? 0) + (bx?.x ?? 0)) / 2, 6);
    expect(mid.nodes.find((n) => n.id === "new")?.opacity).toBe(0.5);
    expect(mid.nodes.find((n) => n.id === "gone")?.opacity).toBe(0.5);
    expect(mid.edges.find((e) => e.id === "r->gone")?.opacity).toBe(0.5);
    expect(mid.edges.find((e) => e.id === "r->new")?.opacity).toBe(0.5);
  });

  it("starts a new box without a parent at its own center", () => {
    const one = layout({ root: { id: "solo" } });
    const other = layout({ root: { id: "other" } });
    const start = interpolate(frameOf(one), other, 0);
    expect(start.nodes[0]?.width).toBe(0);
    expect(start.nodes[0]?.x).toBe(60);
  });

  it("grows a new subtree from its new parent", () => {
    const before = layout({ root: { id: "r" } });
    const after = layout({ root: { id: "r", children: [{ id: "p", children: [{ id: "q" }] }] } });
    const start = interpolate(frameOf(before), after, 0);
    const p = after.nodes.find((n) => n.id === "p");
    const q = start.nodes.find((n) => n.id === "q");
    expect(q?.x).toBe((p?.x ?? 0) + (p?.width ?? 0) / 2);
  });

  it("eases, resamples and morphs polylines", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.25)).toBeCloseTo(0.0625, 6);
    expect(easeInOut(0.75)).toBeCloseTo(0.9375, 6);
    expect(easeInOut(1)).toBe(1);
    expect(resample([], 3)).toEqual([]);
    expect(resample([{ x: 0, y: 0 }, { x: 10, y: 0 }], 3)).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
    expect(resample([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }], 2)).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    expect(resample([{ x: 1, y: 1 }], 1)).toEqual([{ x: 1, y: 1 }]);
    expect(resample([{ x: 1, y: 1 }], 3)).toEqual([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]);
    expect(resample([{ x: 1, y: 1 }, { x: 1, y: 1 }], 1)).toEqual([{ x: 1, y: 1 }]);
    expect(morph([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 10 }, { x: 5, y: 10 }, { x: 10, y: 10 }], 0.5)).toEqual([{ x: 0, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 5 }]);
  });
});

describe("viewport", () => {
  it("pans, zooms around a point, fits and converts points", () => {
    const vp = createViewport({ minZoom: 0.5, maxZoom: 4 });
    const seen: number[] = [];
    const off = vp.subscribe((v) => seen.push(v.k));
    vp.pan(10, 20);
    expect(vp.get()).toEqual({ x: 10, y: 20, k: 1 });
    vp.zoom(2, { x: 10, y: 20 });
    expect(vp.get()).toEqual({ x: 10, y: 20, k: 2 });
    expect(vp.toLayout({ x: 30, y: 40 })).toEqual({ x: 10, y: 10 });
    vp.zoom(100, { x: 0, y: 0 });
    expect(vp.get().k).toBe(4);
    vp.set({ x: Number.NaN });
    vp.set({ k: 2 });
    expect(vp.get().x).not.toBeNaN();
    vp.fit({ x: 0, y: 0, width: 100, height: 50 }, 300, 200, 0);
    expect(vp.get()).toEqual({ x: 0, y: 25, k: 3 });
    vp.fit({ x: 0, y: 0, width: 0, height: 0 }, 300, 200);
    off();
    vp.pan(1, 1);
    // pan, zoom, zoom, set, fit, fit. The NaN does not change the view, and the last pan is after the unsubscribe.
    expect(seen.length).toBe(6);
  });

  it("follows the wheel and the pointer of an element", () => {
    const vp = createViewport();
    const el = host();
    const detach = vp.attach(el);
    el.dispatchEvent(wheel(-100));
    expect(vp.get().k).toBeGreaterThan(1);
    const k = vp.get().k;
    el.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 }));
    el.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 30, clientY: 40 }));
    el.dispatchEvent(new PointerEvent("pointermove", { pointerId: 2, clientX: 300, clientY: 400 }));
    el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    el.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 90, clientY: 90 }));
    el.dispatchEvent(new PointerEvent("pointerdown", { button: 2, pointerId: 3 }));
    el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 9 }));
    expect(vp.get()).toEqual({ x: 30, y: 40, k });
    detach();
    el.dispatchEvent(wheel(-100));
    expect(vp.get().k).toBe(k);
  });
});

describe("theme", () => {
  it("merges a partial theme", () => {
    expect(themeOf(undefined)).toBe(lightTheme);
    expect(themeOf({ accent: "red" }, darkTheme).accent).toBe("red");
    expect(themeOf({}, darkTheme).background).toBe(darkTheme.background);
  });
});

describe("P9: the renderers draw the same boxes", () => {
  for (const example of examples) {
    it(`for the example ${example.name}`, () => {
      const out = layout(example.input, example.options);
      const expected = out.nodes.map(boxOf);

      const dom = mountDom(host(), { duration: 0 });
      dom.update(out);
      const domBoxes = out.nodes.map((n) => {
        const el = dom.element.querySelector<HTMLElement>(`[data-id="${CSS.escape(n.id)}"]`);
        return { x: parseFloat(el?.style.left ?? ""), y: parseFloat(el?.style.top ?? ""), width: parseFloat(el?.style.width ?? ""), height: parseFloat(el?.style.height ?? "") };
      });
      expectBoxes(domBoxes, expected);

      const svg = mountSvg(host(), { duration: 0 });
      svg.update(out);
      const svgBoxes = out.nodes.map((n) => {
        const rect = svg.element.querySelector(`g[data-id="${CSS.escape(n.id)}"] > rect`);
        const num = (k: string): number => Number(rect?.getAttribute(k));
        return { x: num("x"), y: num("y"), width: num("width"), height: num("height") };
      });
      expectBoxes(svgBoxes, expected);

      const rec = recorder();
      drawFrame(rec.ctx, frameOf(out), { x: 0, y: 0, k: 1 }, lightTheme, { width: 800, height: 600, dpr: 2 });
      const { containers, leaves } = paintOrder(frameOf(out).nodes);
      const order = [...containers, ...leaves];
      rec.boxes.forEach((b, i) => {
        const n = order[i];
        if (n === undefined) throw new Error("extra box");
        expect(b.x).toBeCloseTo(n.x, 6);
        expect(b.y).toBeCloseTo(n.y, 6);
        expect(b.width).toBeCloseTo(n.width, 6);
        expect(b.height).toBeCloseTo(n.height, 6);
      });
      expect(rec.boxes).toHaveLength(out.nodes.length);
      const edgeLabels = out.edges.flatMap((e) => (e.label === undefined ? [] : [e.label]));
      expect(rec.texts.toSorted()).toEqual([...out.nodes.map((n) => n.label), ...edgeLabels].toSorted());
    });
  }
});

describe("live renderers", () => {
  const first = layout({ root: { id: "r", mode: "nested", children: [{ id: "a" }, { id: "b" }] }, edges: [{ source: "a", target: "b" }] });
  const second = layout({ root: { id: "r", children: [{ id: "a" }, { id: "c" }] } });
  const clipped = layout({ root: { id: "v", mode: "nested", fit: "clip", size: { width: 100, height: 60 }, children: [{ id: "a" }, { id: "b" }] } });

  for (const [name, mountIt] of [["dom", mountDom], ["svg", mountSvg]] as const) {
    it(`${name}: updates the elements, selects, picks, fits and goes away`, () => {
      const el = host();
      const r = mountIt(el, { duration: 0 });
      expect(r.pick({ x: 1, y: 1 })).toBeUndefined();
      r.fit();
      r.update(first);
      expect(r.element.querySelectorAll("[data-id]").length).toBe(4);
      r.select(["a"]);
      r.update(second);
      expect(r.element.querySelector('[data-id="b"]')).toBeNull();
      expect(r.element.querySelector('[data-id="c"]')).not.toBeNull();
      r.update(clipped);
      expect(r.element.innerHTML).toContain("clip");
      r.update(first);
      r.fit(10);
      const view = r.viewport.get();
      const a = first.nodes.find((n) => n.id === "a");
      if (a === undefined) throw new Error("a");
      expect(r.pick({ x: (a.x + 2) * view.k + view.x, y: (a.y + 2) * view.k + view.y })).toBe("a");
      const root = first.nodes[0];
      if (root === undefined) throw new Error("root");
      expect(r.pick({ x: (root.x + 1) * view.k + view.x, y: (root.y + 1) * view.k + view.y })).toBe("r");
      expect(r.pick({ x: -9999, y: -9999 })).toBeUndefined();
      r.destroy();
      expect(el.children.length).toBe(0);
    });
  }

  it("canvas: draws, resizes and goes away", () => {
    const fake = recorder();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fake.ctx as unknown as CanvasRenderingContext2D);
    const el = host();
    const r = mountCanvas(el, { duration: 0, interactive: false });
    r.update(first);
    r.select(["a"]);
    r.update(clipped);
    expect(fake.boxes.length).toBeGreaterThan(0);
    r.destroy();
    expect(el.children.length).toBe(0);
  });

  it("canvas: draws nothing without a 2D context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const r = mountCanvas(host(), { duration: 0 });
    expect(() => r.update(first)).not.toThrow();
    r.destroy();
  });

  it("animates from one layout to the next, and stops for reduced motion", () => {
    let now = 0;
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const r = mountDom(host(), { duration: 100, fit: false });
    r.update(first);
    r.update(second);
    now = 50;
    queue.shift()?.(now);
    const c = r.element.querySelector<HTMLElement>('[data-id="c"]');
    expect(Number(c?.style.opacity)).toBeGreaterThan(0);
    expect(Number(c?.style.opacity)).toBeLessThan(1);
    now = 200;
    queue.shift()?.(now);
    expect(r.element.querySelector<HTMLElement>('[data-id="c"]')?.style.opacity).toBe("1");
    expect(queue).toHaveLength(0);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    r.update(first);
    expect(queue).toHaveLength(0);
    r.destroy();
  });

  it("gives no negative size when the time of a frame comes before the start", () => {
    let now = 100;
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const r = mountDom(host(), { duration: 100, fit: false });
    r.update(first);
    r.update(second);
    now = 90;
    queue.shift()?.(now);
    const c = r.element.querySelector<HTMLElement>('[data-id="c"]');
    expect(Number.parseFloat(c?.style.width ?? "")).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(c?.style.height ?? "")).toBeGreaterThanOrEqual(0);
    r.destroy();
  });

  it("works without ResizeObserver, and with a container of size 0", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const el = document.createElement("div");
    document.body.appendChild(el);
    const r = mountSvg(el, { duration: 0 });
    r.update(first);
    expect(r.viewport.get()).toEqual({ x: 0, y: 0, k: 1 });
    r.destroy();
  });

  it("keeps the paint order of the canvas when a node becomes a container around containers", () => {
    // The loop of the home page goes from "app" linked to "app" nested around the containers "web" and "data".
    const children: NodeSpec[] = [
      { id: "web", mode: "nested", children: [{ id: "w1" }] },
      { id: "data", mode: "nested", children: [{ id: "d1" }] },
    ];
    const linked = layout({ root: { id: "app", children } });
    const nested = layout({ root: { id: "app", mode: "nested", children } });
    for (const mountOf of [mountSvg, mountDom]) {
      const r = mountOf(host(), { duration: 0 });
      for (const out of [linked, nested, linked, nested]) {
        r.update(out);
        const { containers, leaves } = paintOrder(frameOf(out).nodes);
        expect(ids(r, ".ireko-container")).toEqual(containers.map((n) => n.id));
        expect(ids(r, ".ireko-node")).toEqual(leaves.map((n) => n.id));
      }
      r.destroy();
    }
  });

  it("draws the edge labels in each renderer, and removes them with their edges", () => {
    const input = { root: { id: "r", children: [{ id: "a" }, { id: "b" }] }, edges: [{ source: "a", target: "b", label: "a <to> b" }] };
    const withLabel = layout(input);
    const without = layout({ root: input.root });
    for (const mountOf of [mountSvg, mountDom]) {
      const r = mountOf(host(), { duration: 0 });
      r.update(withLabel);
      const label = r.element.querySelector(".ireko-edge-labels [data-id]");
      expect(label?.textContent).toBe("a <to> b");
      r.update(without);
      expect(r.element.querySelector(".ireko-edge-labels [data-id]")).toBeNull();
      r.destroy();
    }
    const rec = recorder();
    drawFrame(rec.ctx, frameOf(withLabel), { x: 0, y: 0, k: 1 }, { ...lightTheme, background: "transparent" }, { width: 800, height: 600, dpr: 1 });
    expect(rec.texts).toContain("a <to> b");
  });

  it("puts a label at the middle of the length of its route", () => {
    expect(labelAt([])).toEqual({ x: 0, y: 0 });
    expect(labelAt([{ x: 5, y: 5 }])).toEqual({ x: 5, y: 5 });
    expect(labelAt([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toEqual({ x: 5, y: 0 });
    // An L route of length 10 + 30: the middle is 10 units along the second segment.
    expect(labelAt([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }])).toEqual({ x: 10, y: 10 });
    // A segment of length 0 does not count.
    expect(labelAt([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 8 }])).toEqual({ x: 0, y: 4 });
    expect(labelAt([{ x: 3, y: 3 }, { x: 3, y: 3 }])).toEqual({ x: 3, y: 3 });
    expect(haloOf(lightTheme)).toBe(lightTheme.background);
    expect(haloOf({ ...lightTheme, background: "transparent" })).toBe(lightTheme.nodeFill);
  });

  it("keeps the paint order and the clip roots", () => {
    const f = frameOf(clipped);
    expect(paintOrder(f.nodes).containers.map((n) => n.id)).toEqual(["v"]);
    expect([...clipRoots(f.nodes).keys()]).toEqual(["a", "b"]);
    expect(isContainer({ mode: "nested", childCount: 0 })).toBe(false);
    expect(pickIn({ ...f, nodes: f.nodes.map((n) => ({ ...n, opacity: 0 })) }, { x: 1, y: 1 })).toBeUndefined();
  });
});
