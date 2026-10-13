/**
 * The contract of a router, and the anchors that the built-in routers share.
 * A router gives the points of one edge. The engine uses it after it places the boxes.
 */
import { centerOf, contains, type Point, type Rect } from "./geometry.ts";
import type { Direction } from "./strategy.ts";

/** The input of `Router.route`. The rectangles are absolute. */
export interface RouteInput {
  readonly id: string;
  readonly kind: "tree" | "extra";
  readonly source: Rect;
  readonly target: Rect;
  /** For a tree edge, the direction from the parent to its children, if the strategy of the parent gives one. */
  readonly direction?: Direction;
}

/** A router: one way to draw an edge between two boxes. */
export interface Router {
  /** The name that `LayoutOptions.router` uses to select the router. */
  readonly type: string;
  /** One sentence for the reference of the site. */
  readonly description: string;
  /** This function gives the points of the edge, from the source box to the target box. */
  route(input: RouteInput): readonly Point[];
}

/** This function gives its argument. It gives a new router the type `Router`. */
export function defineRouter(router: Router): Router {
  return router;
}

/**
 * This function gives the point where the line from the center of `box` to `toward` crosses the edge of `box`.
 * It gives the center when `toward` is the center.
 */
export function borderPoint(box: Rect, toward: Point): Point {
  const c = centerOf(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const tx = dx === 0 ? Infinity : box.width / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : box.height / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** This function tells if one rectangle contains the other. An edge between them has no clear border to start from. */
export function nestedPair(a: Rect, b: Rect): boolean {
  return contains(a, b) || contains(b, a);
}
