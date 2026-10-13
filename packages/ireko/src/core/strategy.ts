/**
 * The contract of a strategy. A strategy arranges the children of one node. The engine does all other work:
 * the recursion, the extents, the padding, the sizing policy and the absolute positions.
 */
import type { Point, Rect, Size } from "./geometry.ts";
import type { Issue, Mode, PlacedNode } from "./model.ts";
import type { OptionSchema, OptionSpec } from "./options.ts";

/** A child after the measure pass. The strategy sees only its sizes. */
export interface MeasuredChild {
  readonly id: string;
  /** The size of the box of the child. */
  readonly box: Size;
  /** The rectangle that holds the child and all of its subtree, relative to the top-left corner of the child box. */
  readonly extent: Rect;
  /** The mode of the children of this child. */
  readonly mode: Mode;
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
}

/** The output of `Strategy.arrange`. */
export interface Arrangement {
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
  arrange(input: ArrangeInput<unknown>): Arrangement;
  audit?(input: AuditInput<unknown>): readonly Issue[];
}

/** This function gives its argument. It lets TypeScript infer the type of the options of a new strategy. */
export function defineStrategy<O>(strategy: Strategy<O>): Strategy<O> {
  return strategy;
}
