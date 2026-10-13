/**
 * The contract of a strategy. A strategy arranges the children of one node. The engine does all other work:
 * the recursion, the extents, the padding, the sizing policy and the absolute positions.
 */
import type { Point, Rect, Size } from "./geometry.ts";
import type { Issue, Mode, PlacedNode } from "./model.ts";
import type { OptionSchema, OptionSpec } from "./options.ts";

/**
 * One band of a shape. Between `from` and `to` on one axis, the subtree is between `min` and `max` on the other axis.
 * In the rows of a shape, `from` and `to` are y values. In the columns, they are x values.
 */
export interface Band {
  readonly from: number;
  readonly to: number;
  readonly min: number;
  readonly max: number;
}

/**
 * The shape of a subtree, relative to the top-left corner of its root box. The bands cover each box of the subtree.
 * A tidy strategy uses the shape to put a subtree closer to its neighbors than the extent permits.
 */
export interface Shape {
  /** Horizontal bands, from the top down. */
  readonly rows: readonly Band[];
  /** Vertical bands, from the left to the right. */
  readonly columns: readonly Band[];
}

/** A child after the measure pass. The strategy sees only its sizes. */
export interface MeasuredChild {
  readonly id: string;
  /** The size of the box of the child. */
  readonly box: Size;
  /** The rectangle that holds the child and all of its subtree, relative to the top-left corner of the child box. */
  readonly extent: Rect;
  /** The mode of the children of this child. */
  readonly mode: Mode;
  /** The shape of the subtree of the child. The engine gives it only to a strategy with `shapes: true`. */
  readonly shape?: Shape;
}

/** An edge between the subtrees of two children of a node, as the indexes of the two children. */
export interface ChildEdge {
  readonly from: number;
  readonly to: number;
}

/** The input of `Strategy.arrange`. */
export interface ArrangeInput<O> {
  /** The identifier of the node. */
  readonly id: string;
  readonly mode: Mode;
  /** The size of the box of the node before the arrangement. In the nested mode, the engine can make the box larger. */
  readonly self: Size;
  readonly children: readonly MeasuredChild[];
  /** The defaults of the strategy, merged with the options of the node. */
  readonly options: O;
  /** The distance between two siblings. */
  readonly gap: number;
  /** The depth of the node. The root has the depth 0. */
  readonly depth: number;
  /**
   * The extra edges between the subtrees of two different children, in the order of the input. A layered strategy
   * uses them. The engine always gives this list, so a strategy that gets no list gets it from a test or from the user.
   */
  readonly edges?: readonly ChildEdge[];
}

/** The direction from a node to its children: below, above, on the left or on the right. */
export type Direction = "down" | "up" | "left" | "right";

/** The output of `Strategy.arrange`. */
export interface Arrangement {
  /**
   * In the linked mode, the direction from the node to its children, if the children are on one side of it.
   * A router uses it for the tree edges of the node: the orthogonal router then draws the edges of an organization chart.
   */
  readonly direction?: Direction;
  /**
   * The direction of the edges between the children, for a strategy that puts them in a flow (layers).
   * A router uses it for each extra edge between two children that goes forward in this direction.
   */
  readonly flow?: Direction;
  /**
   * The top-left corner of each child box, in the order of the children.
   * In the linked mode, the coordinates are relative to the top-left corner of the node box.
   * In the nested mode, the coordinates are free: the engine moves the content into the box.
   */
  readonly offsets: readonly Point[];
  /** In the nested mode, an area that the content must hold, in the coordinates of the offsets. The extents of the children always count. */
  readonly content?: Rect;
}

/** The input of `Strategy.audit`. All rectangles are absolute. */
export interface AuditInput<O> {
  readonly node: PlacedNode;
  readonly children: readonly PlacedNode[];
  readonly options: O;
  readonly gap: number;
}

/** A strategy: one way to arrange the children of a node. */
export interface Strategy<O = Record<string, never>> {
  /** The name that a `NodeSpec` uses to select the strategy. */
  readonly type: string;
  /** One sentence for the reference of the site. */
  readonly description: string;
  readonly options: OptionSchema<O>;
  /** If true, each measured child has its `shape`. The engine then does more work for the subtree of this node. */
  readonly shapes?: boolean;
  /** This function arranges the measured children of one node. The engine uses it once for each node with children. */
  arrange(input: ArrangeInput<O>): Arrangement;
  /** This function gives the findings of the strategy for one placed node. */
  audit?(input: AuditInput<O>): readonly Issue[];
}

/**
 * A strategy with options of an unknown type. The registry holds strategies of this type.
 * Each `Strategy<O>` is an `AnyStrategy`.
 */
export interface AnyStrategy {
  readonly type: string;
  readonly description: string;
  readonly options: Readonly<Record<string, OptionSpec>>;
  readonly shapes?: boolean;
  arrange(input: ArrangeInput<unknown>): Arrangement;
  audit?(input: AuditInput<unknown>): readonly Issue[];
}

/** This function gives its argument. It lets TypeScript infer the type of the options of a new strategy. */
export function defineStrategy<O>(strategy: Strategy<O>): Strategy<O> {
  return strategy;
}
