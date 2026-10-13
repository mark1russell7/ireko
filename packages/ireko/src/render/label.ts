/**
 * The place and the colors of an edge label. Each renderer puts the label at the middle of the route.
 * A halo in the color of the background keeps the label readable over the lines.
 */
import type { Point } from "../core/geometry.ts";
import type { Theme } from "./theme.ts";

/** This function gives the point at the middle of the length of a route. A route with no points gives the origin. */
export function labelAt(points: readonly Point[]): Point {
  const first = points[0];
  if (first === undefined) return { x: 0, y: 0 };
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1] ?? first, points[i] ?? first);
  let left = total / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] ?? first;
    const b = points[i] ?? first;
    const d = distance(a, b);
    if (d > 0 && left <= d) return { x: a.x + ((b.x - a.x) * left) / d, y: a.y + ((b.y - a.y) * left) / d };
    left -= d;
  }
  return points[points.length - 1] ?? first;
}

/**
 * This function gives the color of the halo of a label: the background of the theme. A theme with a transparent
 * background gives the fill of a node, because a halo needs a solid color.
 */
export function haloOf(theme: Theme): string {
  const bg = theme.background.trim().toLowerCase();
  return bg === "transparent" || bg === "none" || bg === "" ? theme.nodeFill : theme.background;
}

/** The size of the text of an edge label, relative to the size of the text of a node. */
export const LABEL_SCALE = 0.85;

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
