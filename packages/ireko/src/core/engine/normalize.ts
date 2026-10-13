/**
 * The normalize phase. It walks the input tree without recursion and gives a flat list of records in pre-order.
 * It finds the defects of the input: duplicate identifiers, unknown strategies, bad sizes, bad edges and limits.
 * A node with a fatal defect does not go into the list, and neither does its subtree.
 */
import type { EdgeSpec, Fit, Issue, LayoutInput, Mode, NodeSpec } from "../model.ts";
import type { Context, EdgeRecord, NodeRecord, Normalized } from "./types.ts";

const MODES: readonly Mode[] = ["nested", "linked"];
const FITS: readonly Fit[] = ["grow", "scale", "clip"];

/** This function gives the records of the nodes and edges of `input`. It adds its findings to `issues`. */
export function normalize(input: LayoutInput, ctx: Context, issues: Issue[]): Normalized {
  const nodes: NodeRecord[] = [];
  const index = new Map<string, number>();
  const stack: { spec: NodeSpec; parent: number; depth: number }[] = [{ spec: input.root, parent: -1, depth: 0 }];
  let nodeLimit = false;
  let depthLimit = false;

  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const { spec, parent, depth } = item;
    const id: unknown = (spec as { id?: unknown }).id;
    if (typeof id !== "string" || id === "") {
      issues.push({ code: "EMPTY_ID", severity: "error", message: "A node has no identifier. The engine skips the node and its subtree.", ...parentOf(nodes, parent) });
      continue;
    }
    if (index.has(id)) {
      issues.push({ code: "DUPLICATE_ID", severity: "error", message: `Two nodes have the identifier "${id}". The engine skips the second node and its subtree.`, node: id });
      continue;
    }
    if (nodes.length >= ctx.limits.maxNodes) {
      if (!nodeLimit) issues.push({ code: "LIMIT_NODES", severity: "error", message: `The tree has more than ${String(ctx.limits.maxNodes)} nodes. The engine skips the other nodes.`, node: id, detail: { limit: ctx.limits.maxNodes } });
      nodeLimit = true;
      continue;
    }
    if (depth > ctx.limits.maxDepth) {
      if (!depthLimit) issues.push({ code: "LIMIT_DEPTH", severity: "error", message: `The tree is deeper than ${String(ctx.limits.maxDepth)}. The engine skips the deeper nodes.`, node: id, detail: { limit: ctx.limits.maxDepth } });
      depthLimit = true;
      continue;
    }

    const record: NodeRecord = {
      id,
      spec,
      parent,
      depth,
      children: [],
      ...layoutOf(spec, id, ctx, issues),
      mode: enumOf(spec.mode, MODES, "linked", id, "mode", issues),
      fit: enumOf(spec.fit, FITS, "grow", id, "fit", issues),
      size: sizeOf(spec, id, issues),
    };
    const at = nodes.length;
    nodes.push(record);
    index.set(id, at);
    nodes[parent]?.children.push(at);

    const raw: unknown = spec.children;
    const children: readonly NodeSpec[] = Array.isArray(raw) ? (spec.children ?? []) : [];
    let kept = children;
    if (children.length > ctx.limits.maxChildren) {
      issues.push({ code: "LIMIT_CHILDREN", severity: "error", message: `The node "${id}" has ${String(children.length)} children. The limit is ${String(ctx.limits.maxChildren)}, and the engine skips the other children.`, node: id, detail: { limit: ctx.limits.maxChildren, count: children.length } });
      kept = children.slice(0, ctx.limits.maxChildren);
    }
    // The stack gives the last item first, so the children go on it in the reverse order.
    for (let i = kept.length - 1; i >= 0; i--) {
      const child = kept[i];
      if (child !== undefined && child !== null && typeof child === "object") stack.push({ spec: child, parent: at, depth: depth + 1 });
      else issues.push({ code: "EMPTY_ID", severity: "error", message: `A child of "${id}" is not a node. The engine skips it.`, node: id });
    }
  }

  return { nodes, index, edges: edgesOf(input, index, issues) };
}

function parentOf(nodes: readonly NodeRecord[], parent: number): { node?: string } {
  const p = nodes[parent];
  return p === undefined ? {} : { node: p.id };
}

function layoutOf(spec: NodeSpec, id: string, ctx: Context, issues: Issue[]): Pick<NodeRecord, "layout" | "rawLayout"> {
  const ref = spec.layout;
  if (ref === undefined) return { layout: "grid", rawLayout: undefined };
  let type: unknown = ref;
  let raw: Readonly<Record<string, unknown>> | undefined;
  if (typeof ref === "object" && ref !== null) {
    type = ref.type;
    raw = ref;
  }
  if (typeof type !== "string") {
    issues.push({ code: "INVALID_OPTION", severity: "warning", message: `The layout of the node "${id}" has no type. The engine uses "grid".`, node: id });
    return { layout: "grid", rawLayout: undefined };
  }
  if (!ctx.strategies.has(type)) {
    const known = [...ctx.strategies.keys()].join(", ");
    issues.push({ code: "UNKNOWN_LAYOUT", severity: "error", message: `The node "${id}" uses the strategy "${type}", which is not registered. The engine uses "grid". The registered strategies are: ${known}.`, node: id, detail: { layout: type } });
    return { layout: "grid", rawLayout: undefined };
  }
  return { layout: type, rawLayout: raw };
}

function enumOf<V extends string>(value: unknown, values: readonly V[], fallback: V, id: string, key: string, issues: Issue[]): V {
  if (value === undefined) return fallback;
  const found = values.find((v) => v === value);
  if (found !== undefined) return found;
  issues.push({ code: "INVALID_OPTION", severity: "warning", message: `The ${key} of the node "${id}" must be one of: ${values.join(", ")}. The engine uses "${fallback}".`, node: id, detail: { option: key, value } });
  return fallback;
}

function sizeOf(spec: NodeSpec, id: string, issues: Issue[]): NodeRecord["size"] {
  const size = spec.size;
  if (size === undefined) return {};
  const out: { width?: number; height?: number } = {};
  for (const key of ["width", "height"] as const) {
    const v = size[key];
    if (v === undefined) continue;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[key] = v;
    else issues.push({ code: "INVALID_SIZE", severity: "error", message: `The ${key} of the node "${id}" must be a finite number more than 0. The engine uses the default.`, node: id, detail: { [key]: v } });
  }
  return out;
}

function edgesOf(input: LayoutInput, index: ReadonlyMap<string, number>, issues: Issue[]): EdgeRecord[] {
  const out: EdgeRecord[] = [];
  const edges: unknown = input.edges;
  const list: readonly EdgeSpec[] = Array.isArray(edges) ? (input.edges ?? []) : [];
  list.forEach((spec, i) => {
    const id = typeof spec.id === "string" && spec.id !== "" ? spec.id : `edge-${String(i)}`;
    const source = index.get(spec.source);
    const target = index.get(spec.target);
    if (source === undefined || target === undefined) {
      const missing = source === undefined ? spec.source : spec.target;
      issues.push({ code: "UNKNOWN_EDGE_END", severity: "error", message: `The edge "${id}" connects the node "${missing}", which is not in the tree. The engine skips the edge.`, edge: id, detail: { source: spec.source, target: spec.target } });
      return;
    }
    if (source === target) {
      issues.push({ code: "SELF_LOOP", severity: "warning", message: `The edge "${id}" connects the node "${spec.source}" to itself. The engine skips the edge.`, edge: id });
      return;
    }
    out.push({ id, source, target, spec });
  });
  return out;
}
