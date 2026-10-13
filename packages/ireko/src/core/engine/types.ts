/**
 * The internal types of the engine. The phases share them. They are not part of the public API.
 */
import type { Point, Size } from "../geometry.ts";
import type { EdgeSpec, Fit, LayoutOptions, Mode, NodeSpec, TraceEvent, TreeEdges } from "../model.ts";
import type { Router } from "../router.ts";
import type { AnyStrategy } from "../strategy.ts";

/** The safety limits of an engine. */
export interface Limits {
  /** The largest number of nodes in one layout. */
  readonly maxNodes: number;
  /** The largest depth of a node. The root has the depth 0. */
  readonly maxDepth: number;
  /** The largest number of children of one node. */
  readonly maxChildren: number;
}

/** The layout options after the engine applies the defaults. */
export interface Resolved {
  readonly spacing: number;
  readonly nodeSize: Size;
  readonly header: number;
  readonly router: Router;
  readonly treeEdges: TreeEdges;
  readonly origin: Point;
  readonly measure: LayoutOptions["measure"];
  readonly audit: boolean;
  readonly strict: boolean;
  readonly trace: ((event: TraceEvent) => void) | undefined;
}

/** The context that each phase receives. */
export interface Context {
  readonly strategies: ReadonlyMap<string, AnyStrategy>;
  readonly limits: Limits;
  readonly options: Resolved;
}

/** One node after the normalize phase. The index of a record is its place in the pre-order of the tree. */
export interface NodeRecord {
  readonly id: string;
  readonly spec: NodeSpec;
  /** The index of the parent, or -1 for the root. */
  readonly parent: number;
  readonly depth: number;
  /** The indexes of the children, in the order of the spec. */
  readonly children: number[];
  /** The type of the strategy. It is always a registered type. */
  readonly layout: string;
  /** The raw options of the strategy, from the spec. */
  readonly rawLayout: Readonly<Record<string, unknown>> | undefined;
  readonly mode: Mode;
  readonly fit: Fit;
  /** The valid dimensions of `spec.size`. */
  readonly size: { readonly width?: number; readonly height?: number };
}

/** An edge of the input after the normalize phase. Both ends are nodes of the tree. */
export interface EdgeRecord {
  readonly id: string;
  readonly source: number;
  readonly target: number;
  readonly spec: EdgeSpec;
}

/** The output of the normalize phase. */
export interface Normalized {
  readonly nodes: readonly NodeRecord[];
  readonly index: ReadonlyMap<string, number>;
  readonly edges: readonly EdgeRecord[];
}

/** The place of a child box in the coordinate space of its parent box. */
export interface Placement {
  readonly x: number;
  readonly y: number;
  /** The scale of the coordinate space of the child. It is less than 1 inside a container with the fit `scale`. */
  readonly scale: number;
}
