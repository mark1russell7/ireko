import { Shapes } from "../core/geometry/shapes";
import { Vector } from "../core/geometry/vectors";

/** The boxes of a snapshot. The July audit (bug 2) found this export missing. */
export type Box = Pick<Shapes.Box, "id" | "position" | "size" | "parentId" | "depth">;

export type Wire = { id: string; source: string; target: string; polyline?: Vector[] };

export type LayoutStats = {
  nodeCount: number;
  edgeCount: number;
  maxDepth: number;
  bounds: { position: Vector; size: Vector };
  overlaps?: Array<[string, string]>;
};

export type LayoutSnapshot = Readonly<{
  boxes: Readonly<Record<string, Box>>;
  wires: ReadonlyArray<Wire>;
  stats: LayoutStats;
  version: number;
  meta?: Record<string, unknown>;
}>;
