/**
 * The geometry of the core: points, sizes and rectangles as plain data.
 * Each function is pure. No function changes its arguments.
 */

/** A point in the coordinate space of the layout. The y axis points down. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A width and a height. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A rectangle with its top-left corner and its size. */
export interface Rect extends Point, Size {}

/** The empty rectangle at the origin. */
export const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** This function gives a rectangle at the point `at` with the size `size`. */
export function rectAt(at: Point, size: Size): Rect {
  return { x: at.x, y: at.y, width: size.width, height: size.height };
}

/** This function gives the center of a rectangle. */
export function centerOf(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** This function gives the smallest rectangle that contains `a` and `b`. */
export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** This function gives the smallest rectangle that contains all rectangles. It gives `EMPTY_RECT` for no rectangles. */
export function unionAll(rects: Iterable<Rect>): Rect {
  let out: Rect | undefined;
  for (const r of rects) out = out === undefined ? r : union(out, r);
  return out ?? EMPTY_RECT;
}

/** This function moves a rectangle by `dx` and `dy`. */
export function translate(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, width: r.width, height: r.height };
}

/** This function adds `pad` on each side of a rectangle. A negative `pad` makes the rectangle smaller. */
export function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, width: r.width + 2 * pad, height: r.height + 2 * pad };
}

/**
 * This function tells if two rectangles overlap by more than `tolerance` on both axes.
 * Rectangles that only touch do not overlap.
 */
export function overlaps(a: Rect, b: Rect, tolerance = 0): boolean {
  return (
    a.x < b.x + b.width - tolerance &&
    b.x < a.x + a.width - tolerance &&
    a.y < b.y + b.height - tolerance &&
    b.y < a.y + a.height - tolerance
  );
}

/** This function tells if `outer` contains `inner`, with the tolerance `tolerance` on each side. */
export function contains(outer: Rect, inner: Rect, tolerance = 0): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

/** This function gives the largest distance from the point `from` to a corner of the rectangle `r`. */
export function farthestCorner(from: Point, r: Rect): number {
  const dx = Math.max(Math.abs(r.x - from.x), Math.abs(r.x + r.width - from.x));
  const dy = Math.max(Math.abs(r.y - from.y), Math.abs(r.y + r.height - from.y));
  return Math.hypot(dx, dy);
}

/**
 * This function changes `-0` and the noise of the trigonometry (a magnitude under 1e-9) to `0`.
 * It keeps each other number. JSON cannot hold `-0`, and a CSS length cannot always hold an exponent.
 */
export function clean(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : v;
}

/** This function rounds a number to three decimals. It also changes `-0` to `0`. Exporters use it for short output. */
export function round3(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
}
