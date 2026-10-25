/**
 * The view of a live layout follows its layout. After each change, the view moves to fit the new bounds, with the
 * easing of the boxes. The reader can still pan and zoom between two changes.
 */
import type { Rect } from "ireko";
import { createViewport, easeInOut, type View, type Viewport } from "ireko/render";
import { useEffect, useRef, type RefObject } from "react";

/** The options of `useFollowFit`. */
export interface FollowOptions {
  /** The space around the layout, in pixels. The default is 20. */
  readonly padding?: number;
  /** The time of the movement, in milliseconds. The default is 320, the time of the boxes. Use 0 for no movement. */
  readonly duration?: number;
  /** If false, the hook does nothing. The default is true. */
  readonly enabled?: boolean;
  /** The largest zoom, so a small layout does not fill a large element. The default is 2. */
  readonly maxZoom?: number;
}

/** This hook moves the view of `viewport` to fit `bounds` in the element `stage`, after each change of `bounds`. */
export function useFollowFit(viewport: Viewport, stage: RefObject<HTMLElement | null>, bounds: Rect | undefined, options: FollowOptions = {}): void {
  const { padding = 20, duration = 320, enabled = true, maxZoom = 2 } = options;
  const x = bounds?.x;
  const y = bounds?.y;
  const width = bounds?.width;
  const height = bounds?.height;
  // The renderer fits the layout when it mounts, before this hook runs. Thus the first fit snaps, also when the view is not the identity.
  const fitted = useRef(false);

  useEffect(() => {
    const element = stage.current;
    if (!enabled || element === null || x === undefined || y === undefined || width === undefined || height === undefined) return undefined;
    const goal = (): View => {
      const probe = createViewport({ maxZoom });
      probe.fit({ x, y, width, height }, element.clientWidth, element.clientHeight, padding);
      return probe.get();
    };
    const observer = new ResizeObserver(() => viewport.set(goal()));
    const from = viewport.get();
    const to = goal();
    const first = !fitted.current || (from.k === 1 && from.x === 0 && from.y === 0);
    fitted.current = true;
    if (first || duration <= 0) {
      viewport.set(to);
      observer.observe(element);
      return () => observer.disconnect();
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      // The time of a frame can come before the start: the browser gives the start time of the frame.
      const t = easeInOut(Math.min(1, Math.max(0, (now - start) / duration)));
      viewport.set({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, k: from.k + (to.k - from.k) * t });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [viewport, stage, x, y, width, height, padding, duration, enabled, maxZoom]);
}
