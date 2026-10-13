/**
 * The data model of ireko: the input that a user gives, and the layout that the engine gives back.
 * All types are plain data. JSON can hold each value without loss.
 */
import type { Point, Rect, Size } from "./geometry.ts";

/** The place of the children of a node. In the `nested` mode, the children are inside the node box. In the `linked` mode, they are around it. */
export type Mode = "nested" | "linked";

/**
 * The sizing policy of a nested container with a size in its spec.
 * With `grow`, the container grows to fit its content. With `scale`, the content becomes smaller to fit the container.
 * With `clip`, the content keeps its size and the renderer cuts it at the container edge.
 */
export type Fit = "grow" | "scale" | "clip";

/** The strategy of a node: the name of a strategy, or the name with options. */
export type LayoutRef = string | LayoutWithOptions;

/** The name of a strategy and its options. */
export interface LayoutWithOptions {
  readonly type: string;
  readonly [option: string]: unknown;
}

/** One node of the input tree. */
export interface NodeSpec {
  /** The identifier of the node. Each node of a tree has a different identifier. */
  readonly id: string;
  /** The text that a renderer shows. The default is the identifier. */
  readonly label?: string;
  /** The size of a leaf box. For a nested container, the smallest size, or the fixed size with the fit `scale` or `clip`. */
  readonly size?: Partial<Size>;
  /** The strategy that arranges the children. The default is `grid`. */
  readonly layout?: LayoutRef;
  /** The place of the children. The default is `linked`. */
  readonly mode?: Mode;
  /** The sizing policy of a nested container. The default is `grow`. */
  readonly fit?: Fit;
  readonly children?: readonly NodeSpec[];
  /** Data of the user. The engine copies it to the output and does not read it. */
  readonly data?: unknown;
}

/** An edge that is not a parent-child edge of the tree. */
export interface EdgeSpec {
  readonly id?: string;
  readonly source: string;
  readonly target: string;
  readonly label?: string;
  readonly data?: unknown;
}

/** The input of one layout: a tree, and more edges between its nodes. */
export interface LayoutInput {
  readonly root: NodeSpec;
  readonly edges?: readonly EdgeSpec[];
}

/** The tree edges that the engine adds. `linked` adds an edge to each linked child. `all` adds an edge to each child. */
export type TreeEdges = "linked" | "all" | "none";

/** The options of one layout. Each option has a default. */
export interface LayoutOptions {
  /** The base distance in pixels. The default gap and padding come from it. The default is 24. */
  readonly spacing?: number;
  /** The size of a leaf without a size in its spec. The default is 120 by 48. */
  readonly nodeSize?: Size;
  /** The smallest space above the content of a nested container, for its label. The padding counts as a part of it. The default is 24. */
  readonly header?: number;
  /** The router of the edges. The default is `straight`. */
  readonly router?: string;
  /** The tree edges of the output. The default is `linked`. */
  readonly treeEdges?: TreeEdges;
  /** The position of the top-left corner of the root box. The default is the origin. */
  readonly origin?: Point;
  /** This function gives the size of a leaf. A host can use it to measure the label. */
  readonly measure?: (node: NodeSpec) => Size | undefined;
  /** If true, the engine finds overlaps and other defects after the layout. The default is true. */
  readonly audit?: boolean;
  /** If true, the engine throws an `IrekoError` when it finds an error. The default is false. */
  readonly strict?: boolean;
  /** This function receives the output of each phase. The site uses it to show the pipeline. */
  readonly trace?: (event: TraceEvent) => void;
}

/** The output of one phase of the pipeline. */
export interface TraceEvent {
  readonly phase: "normalize" | "measure" | "place" | "route" | "audit";
  readonly data: unknown;
}

/** The severity of a finding. An error changes the output. A warning does not. */
export type Severity = "error" | "warning";

/** A finding of the engine: a defect of the input, a limit, or a defect of the layout. */
export interface Issue {
  readonly code: IssueCode;
  readonly severity: Severity;
  readonly message: string;
  readonly node?: string;
  readonly edge?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

/** The codes of the findings. Each code has a page in the reference of the site. */
export type IssueCode =
  | "DUPLICATE_ID"
  | "EMPTY_ID"
  | "UNKNOWN_LAYOUT"
  | "UNKNOWN_ROUTER"
  | "INVALID_OPTION"
  | "INVALID_SIZE"
  | "UNKNOWN_EDGE_END"
  | "SELF_LOOP"
  | "LIMIT_NODES"
  | "LIMIT_DEPTH"
  | "LIMIT_CHILDREN"
  | "STRATEGY_FAILED"
  | "ROUTER_FAILED"
  | "OVERLAP"
  | "ESCAPE"
  | (string & {});

/** One box of the layout. The position and the size are absolute. */
export interface PlacedNode extends Rect {
  readonly id: string;
  readonly label: string;
  /** The identifier of the parent in the tree. The root has none. */
  readonly parent?: string;
  /** The nested container that holds this node. A node in the linked mode of its parent has none. */
  readonly container?: string;
  readonly depth: number;
  /** The mode of the children of this node. */
  readonly mode: Mode;
  /** The strategy that arranged the children of this node. */
  readonly layout: string;
  /** The scale of the coordinate space of this node. It is less than 1 inside a container with the fit `scale`. */
  readonly scale: number;
  /** If true, a renderer cuts the children at the edge of this box (the fit `clip`). */
  readonly clip: boolean;
  /** The number of children. */
  readonly childCount: number;
  readonly data?: unknown;
}

/** One edge of the layout, with its route. */
export interface PlacedEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  /** `tree` for a parent-child edge, `extra` for an edge of `LayoutInput.edges`. */
  readonly kind: "tree" | "extra";
  /** The points of the route. The first point is on the source box, and the last point is on the target box. */
  readonly points: readonly Point[];
  readonly label?: string;
  readonly data?: unknown;
}

/** The output of one layout. */
export interface Layout {
  /** The boxes, in paint order. Each container comes before the nodes inside it. */
  readonly nodes: readonly PlacedNode[];
  readonly edges: readonly PlacedEdge[];
  /** The smallest rectangle that contains each box and each edge. */
  readonly bounds: Rect;
  readonly issues: readonly Issue[];
}

/** The error that `layout` throws in the strict mode. It holds each finding with the severity `error`. */
export class IrekoError extends Error {
  readonly issues: readonly Issue[];

  constructor(issues: readonly Issue[]) {
    const first = issues[0];
    super(first === undefined ? "The layout failed." : `${first.code}: ${first.message}${issues.length > 1 ? ` (and ${String(issues.length - 1)} more)` : ""}`);
    this.name = "IrekoError";
    this.issues = issues;
  }
}
