
import type { Graph } from "../model";
import type { NodeAttrs, Edge } from "../../layout/api/contracts";
import { NodeConfig } from "../types";

/** Build a normalized Graph from your existing NodeConfig tree. */
export function fromTree(root: NodeConfig): Graph {
  const nodes: Record<string, NodeAttrs> = {};
  const edges: Edge[] = [];
  const parents: Record<string, string | undefined> = {};

  const walk = (n: NodeConfig, parent?: NodeConfig) => {
    nodes[n.id] = {
      label: n.label ?? n.id,
      position: n.position,
      layout: n.layout,
      mode: n.mode, // NEW
    };
    if (parent) {
      parents[n.id] = parent.id;
      edges.push({ source: parent.id, target: n.id });
    } else {
      parents[n.id] = undefined;
    }
    (n.children ?? []).forEach((c) => walk(c, n));
  };
  walk(root, undefined);

  return { nodes, edges, parents, rootId: root.id };
}
