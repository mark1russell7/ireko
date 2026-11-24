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
  /**
   * The boxes that the edge must not cross: the boxes near the edge, without its two ends and the containers that hold
   * them. The engine gives them only to a router with `obstacles: true`.
   */
  readonly obstacles?: readonly Rect[];
}

/** A router: one way to draw an edge between two boxes. */
export interface Router {
  /** The name that `LayoutOptions.router` uses to select the router. */
  readonly type: string;
  /** One sentence for the reference of the site. */
  readonly description: string;
  /** If true, each input has its `obstacles`. The engine then does more work for each edge. */
  readonly obstacles?: boolean;
  /** This function gives the points of the edge, from the source box to the target box. */
  route(input: RouteInput): readonly Point[];
}

/** A box of the input of a graph router. `w` is the width and `h` is the height. The values are absolute. */
export interface GraphBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A node of the input of a graph router: a box that the routes must not go through. */
export interface GraphNode {
  readonly id: string;
  readonly box: GraphBox;
  /** The identifier of the nested container that holds the node, if that container is a node of the input. */
  readonly parent?: string;
}

/** An edge of the input of a graph router. */
export interface GraphEdge {
  readonly id: string;
  readonly source: { readonly node: string };
  readonly target: { readonly node: string };
}

/** The input of `GraphRouter.route`: all the boxes and all the edges of one layout. */
export interface GraphRouterInput {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** The route of one edge from a graph router. */
export interface GraphRoute {
  /** The identifier of the edge. */
  readonly edge: string;
  /** The points of the route, from the source box to the target box, in absolute coordinates. */
  readonly points: readonly Point[];
  /** The identifiers of the boxes that the route goes through. A clean route does not have this field. */
  readonly through?: readonly string[];
}

/** The output of `GraphRouter.route`. */
export interface GraphRouterResult {
  readonly routes: readonly GraphRoute[];
}

/**
 * A graph router routes all the edges of a layout together, with all the boxes in view. A router of
 * `@mark1russell7/highways`, for example `cornersRouter`, has this shape.
 */
export interface GraphRouter {
  /** The name of the router. The findings of the engine show it. */
  readonly name?: string;
  /** This function gives the routes of the edges. The same input must give the same routes. */
  route(input: GraphRouterInput): GraphRouterResult;
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
