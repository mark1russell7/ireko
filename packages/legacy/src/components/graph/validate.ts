import type { Graph } from "./model";

export type ValidationIssue = {
  code: "DUPLICATE_NODE" | "MISSING_NODE" | "SELF_LOOP";
  message: string;
  nodeId?: string;
  edge?: { source: string; target: string };
};

export function validateGraph(g: Graph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const id of Object.keys(g.nodes)) {
    if (ids.has(id)) issues.push({ code: "DUPLICATE_NODE", message: `Duplicate node id ${id}`, nodeId: id });
    ids.add(id);
  }
  for (const e of g.edges) {
    if (e.source === e.target) issues.push({ code: "SELF_LOOP", message: `Self-loop ${e.source}`, edge: e });
    if (!g.nodes[e.source]) issues.push({ code: "MISSING_NODE", message: `Missing source ${e.source}`, edge: e });
    if (!g.nodes[e.target]) issues.push({ code: "MISSING_NODE", message: `Missing target ${e.target}`, edge: e });
  }
  return issues;
}
