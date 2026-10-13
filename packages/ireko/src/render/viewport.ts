/**
 * The viewport: the pan and the zoom of a renderer. Two renderers can share one viewport, so two panes move together.
 * A point of the layout `p` shows on the screen at `p * k + (x, y)`.
 */
import type { Point, Rect } from "../core/geometry.ts";

/** The state of a viewport. */
export interface View {
  readonly x: number;
  readonly y: number;
  /** The zoom factor. */
  readonly k: number;
}

/** A viewport. */
export interface Viewport {
  get(): View;
  set(view: Partial<View>): void;
  /** This function zooms by `factor` and keeps the screen point `at` at the same place. */
  zoom(factor: number, at: Point): void;
  /** This function moves the view by `dx` and `dy` screen pixels. */
  pan(dx: number, dy: number): void;
  /** This function makes `bounds` fill a screen area of `width` by `height`, with `padding` on each side. */
  fit(bounds: Rect, width: number, height: number, padding?: number): void;
  /** This function gives the point of the layout at a screen point. */
  toLayout(screen: Point): Point;
  /** This function gives each change to `listener`. It gives back a function that stops this. */
  subscribe(listener: (view: View) => void): () => void;
  /** This function lets a user pan with a pointer and zoom with the wheel on `element`. It gives a function that stops it. */
  attach(element: HTMLElement): () => void;
}

/** The options of a viewport. */
export interface ViewportOptions {
  readonly minZoom?: number;
  readonly maxZoom?: number;
}

/** This function makes a viewport. */
export function createViewport(options: ViewportOptions = {}): Viewport {
  const min = options.minZoom ?? 0.05;
  const max = options.maxZoom ?? 8;
  let view: View = { x: 0, y: 0, k: 1 };
  const listeners = new Set<(view: View) => void>();
  const clamp = (k: number): number => Math.min(max, Math.max(min, k));
  const emit = (): void => {
    for (const l of listeners) l(view);
  };

  const viewport: Viewport = {
    get: () => view,
    set(next) {
      const k = clamp(next.k ?? view.k);
      const x = next.x ?? view.x;
      const y = next.y ?? view.y;
      if (![x, y, k].every(Number.isFinite)) return;
      view = { x, y, k };
      emit();
    },
    zoom(factor, at) {
      const k = clamp(view.k * factor);
      const ratio = k / view.k;
      viewport.set({ k, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio });
    },
    pan(dx, dy) {
      viewport.set({ x: view.x + dx, y: view.y + dy });
    },
    fit(bounds, width, height, padding = 24) {
      const w = Math.max(1, bounds.width);
      const h = Math.max(1, bounds.height);
      const k = clamp(Math.min((width - 2 * padding) / w, (height - 2 * padding) / h));
      viewport.set({ k, x: (width - w * k) / 2 - bounds.x * k, y: (height - h * k) / 2 - bounds.y * k });
    },
    toLayout(screen) {
      return { x: (screen.x - view.x) / view.k, y: (screen.y - view.y) / view.k };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    attach(element) {
      let drag: { id: number; x: number; y: number } | undefined;
      const local = (e: { clientX: number; clientY: number }): Point => {
        const r = element.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        viewport.zoom(Math.exp(-e.deltaY * 0.0015), local(e));
      };
      const onDown = (e: PointerEvent): void => {
        if (e.button !== 0) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        element.setPointerCapture?.(e.pointerId);
      };
      const onMove = (e: PointerEvent): void => {
        if (drag?.id !== e.pointerId) return;
        viewport.pan(e.clientX - drag.x, e.clientY - drag.y);
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      };
      const onUp = (e: PointerEvent): void => {
        if (drag?.id === e.pointerId) drag = undefined;
      };
      element.addEventListener("wheel", onWheel, { passive: false });
      element.addEventListener("pointerdown", onDown);
      element.addEventListener("pointermove", onMove);
      element.addEventListener("pointerup", onUp);
      element.addEventListener("pointercancel", onUp);
      return () => {
        element.removeEventListener("wheel", onWheel);
        element.removeEventListener("pointerdown", onDown);
        element.removeEventListener("pointermove", onMove);
        element.removeEventListener("pointerup", onUp);
        element.removeEventListener("pointercancel", onUp);
      };
    },
  };
  return viewport;
}
