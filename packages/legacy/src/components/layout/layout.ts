import { Config } from "../config";
import { Vector } from "../core/geometry";
import { NodeConfig } from "../graph/types";
import { LayoutChildrenMode } from "./layout.enum";
import { LayoutTuning } from "./layout.tuning";
import { MappedGrid } from "./strategies/grid/grid.mapped";
import { LayoutSnapshot } from "./types";
// NEW: strategy-level audits (optional)
export type StrategyAuditIssue = {
  code: string;                 // e.g. "RADIAL_CHILD_OFF_RING"
  severity: "warn" | "error";
  parentId: string;
  childId?: string;
  detail?: unknown;
};
/* ----------- contracts ----------- */
export type PreferredSizeParam = {
  count: number;
  nodeSize: Vector;
  spacing: number;
  mode: LayoutChildrenMode;
};
export type PreferredSizeReturn = Vector;

export type NestedFrameParam = {
  children: NodeConfig[];
  parentSize: Vector;
  spacing: number;
};
export type NestedFramesReturn = {
  ip: number;
  content: Vector;
  grid: MappedGrid;
};

export type PlaceChildrenParam = {
  mode: LayoutChildrenMode;
  children: NodeConfig[];
  parent: NodeConfig;
  origin: Vector;      // absolute anchor for GRAPH mode
  level: number;
  nodeSize: Vector;
  spacing: number;
  parentSize: Vector;  // parent’s box (already decided)
};

/** Legacy return (kept for back-compat) */
export type PlaceChildrenReturn = Record<string, Vector>;

/** New, extended placement contract (strategies fully own child sizing) */
export type PlaceChildrenExReturn = {
  /** centers: local to parent if mode=NESTED; absolute if mode=GRAPH */
  centers: Record<string, Vector>;
  /** per-child size override (usually a square) when parent is NESTED */
  sizes?: Record<string, Vector>;
};
export type AuditParentParam = 
{
    parentId: string;
    childIds: string[];
    snapshot: LayoutSnapshot;
    spacing: number;
    tuning: Config<LayoutTuning>;
}
/* ----------- strategy base ----------- */
export abstract class Layout {
  /** Frames/grid helpers (used by Grid) */
  abstract nestedFrames(args: NestedFrameParam): NestedFramesReturn;

  /** Simple centers (legacy) */
  abstract placeChildren(args: PlaceChildrenParam): PlaceChildrenReturn;

  /** Extended placement with optional per-child sizes (preferred) */
  placeChildrenEx?(
    args: PlaceChildrenParam & { childModes: Record<string, LayoutChildrenMode> }
  ): PlaceChildrenExReturn;

  /** Preferred size for a node when it behaves as a NESTED container */
  abstract preferredSize(args: PreferredSizeParam): PreferredSizeReturn;


  // Optional: strategies can add their own audits
  auditParent?( args: AuditParentParam): StrategyAuditIssue[];
}
