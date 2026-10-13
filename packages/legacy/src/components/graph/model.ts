import type { NodeAttrs, Edge } from "../layout/api/contracts";

export type Graph = {
  nodes: Record<string, NodeAttrs>;
  edges: Edge[];
  /** parent map derived from tree or heuristics (optional for general graphs) */
  parents?: Record<string, string | undefined>;
  rootId?: string;
};
