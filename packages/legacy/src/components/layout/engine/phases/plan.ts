import type { Parsed } from "./parse";
import { LayoutChildrenMode, LayoutTypes } from "../../../layout/layout.enum";
import { makePhase, type Phase } from "./contracts";
export type Plan = {
  rootId?: string;
  /** chosen layout per node (defaults to Grid) */
  layouts: Record<string, LayoutTypes>;
  /** chosen mode per node (defaults to GRAPH) */
  modes: Record<string, LayoutChildrenMode>;
};

export function plan(p: Parsed): Plan {
  const layouts: Record<string, LayoutTypes> = {};
  const modes: Record<string, LayoutChildrenMode> = {};

  for (const [id, attrs] of Object.entries(p.graph.nodes)) {
    layouts[id] = attrs.layout ?? LayoutTypes.Grid;
    modes[id] = attrs.mode ?? LayoutChildrenMode.GRAPH;
  }
  return { rootId: p.graph.rootId, layouts, modes };
}

export const PlanPhase: Phase<Parsed, Plan> = makePhase("plan", plan);
