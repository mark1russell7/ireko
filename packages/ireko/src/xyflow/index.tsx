/**
 * The React Flow adapter of ireko (`@xyflow/react` 12).
 * - `toXYFlow` gives the nodes and the edges of React Flow for a layout. A nested child gets `parentId`.
 * - `PolylineEdge` draws the route of an ireko edge. Register it with `edgeTypes`.
 * - `layoutFlow` gives positions to the nodes of an existing flow: the automatic layout of nested sub-flows.
 */
import { BaseEdge, Handle, Position, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import type { ReactElement } from "react";
import { createEngine, type Engine, type LayoutOptions, type LayoutRef, type Mode, type Fit, type Layout, type NodeSpec, type PlacedEdge, type PlacedNode, type Point } from "../core/index.ts";
import { labelAt } from "../render/label.ts";
import { isContainer } from "../render/renderer.ts";

/** The data of a node that `toXYFlow` makes. */
export interface IrekoNodeData extends Record<string, unknown> {
  readonly label: string;
  /** The box of the node in the layout. */
  readonly ireko: PlacedNode;
}

/** The data of an edge that `toXYFlow` or `layoutFlow` makes. */
export interface IrekoEdgeData extends Record<string, unknown> {
  /** The points of the route, in the coordinates of the flow. */
  readonly points: readonly Point[];
}

/** A node of React Flow that `toXYFlow` makes. */
export type IrekoNode = Node<IrekoNodeData>;
/** An edge of React Flow with the route of ireko. */
export type IrekoEdge = Edge<IrekoEdgeData>;

/** The options of `toXYFlow`. */
export interface ToXYFlowOptions {
  /** This function gives the type of a node. The default is `group` for a container and `default` for the other nodes. */
  readonly nodeType?: (node: PlacedNode) => string | undefined;
  /** The type of the edges. The default is `ireko`. Register `PolylineEdge` with this type. */
  readonly edgeType?: string;
}

/** This function gives the nodes and the edges of React Flow for a layout. A parent comes before its children. */
export function toXYFlow(layout: Layout, options: ToXYFlowOptions = {}): { nodes: IrekoNode[]; edges: IrekoEdge[] } {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const nodes = layout.nodes.map((n): IrekoNode => {
    const holder = n.container === undefined ? undefined : byId.get(n.container);
    const position = holder === undefined ? { x: n.x, y: n.y } : { x: n.x - holder.x, y: n.y - holder.y };
    return {
      id: n.id,
      type: options.nodeType?.(n) ?? (isContainer(n) ? "group" : "default"),
      position,
      width: n.width,
      height: n.height,
      data: { label: n.label, ireko: n },
      ...(holder === undefined ? {} : { parentId: holder.id, extent: "parent" as const }),
    };
  });
  const edges = layout.edges.map((e: PlacedEdge): IrekoEdge => ({ id: e.id, source: e.source, target: e.target, type: options.edgeType ?? "ireko", data: { points: e.points }, ...(e.label === undefined ? {} : { label: e.label }) }));
  return { nodes, edges };
}

/** This function gives the SVG path of a polyline. */
export function pathOf(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${String(p.x)} ${String(p.y)}`).join(" ");
}

/** This component draws the route of an ireko edge. Without a route, it draws a straight line between the handles. */
export function PolylineEdge({ data, sourceX, sourceY, targetX, targetY, markerEnd, markerStart, style, label, interactionWidth }: EdgeProps<Edge<Partial<IrekoEdgeData>>>): ReactElement {
  const points = data?.points !== undefined && data.points.length >= 2 ? data.points : [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }];
  // The label goes at the middle of the length of the route, as in the other renderers.
  const middle = labelAt(points);
  return (
    <BaseEdge
      path={pathOf(points)}
      {...(markerEnd === undefined ? {} : { markerEnd })}
      {...(markerStart === undefined ? {} : { markerStart })}
      {...(style === undefined ? {} : { style })}
      {...(label === undefined ? {} : { label, labelX: middle.x, labelY: middle.y })}
      {...(interactionWidth === undefined ? {} : { interactionWidth })}
    />
  );
}

/** The edge types of ireko. Give them to the `edgeTypes` property of `ReactFlow`. Keep the object outside a component. */
export const edgeTypes: { readonly ireko: typeof PolylineEdge } = { ireko: PolylineEdge };

/**
 * This component draws a container: its label at the top left, and two handles that a reader does not see.
 * React Flow draws an edge only between two handles, so a container needs handles for its edges.
 */
export function GroupNode({ data }: NodeProps<Node<{ label?: unknown }>>): ReactElement {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0 }} />
      <div className="ireko-xyflow-label" style={{ position: "absolute", left: 8, top: 5, fontSize: 12, opacity: 0.75 }}>
        {typeof data.label === "string" ? data.label : null}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={{ opacity: 0 }} />
    </>
  );
}

/** The node types of ireko. Give them to the `nodeTypes` property of `ReactFlow`. The type `group` replaces the group of React Flow. */
export const nodeTypes: { readonly group: typeof GroupNode } = { group: GroupNode };

/** The layout settings of one node of a flow. */
export interface FlowNodeSpec {
  readonly layout?: LayoutRef;
  readonly mode?: Mode;
  readonly fit?: Fit;
}

/** The options of `layoutFlow`. */
export interface LayoutFlowOptions extends LayoutOptions {
  /** This function gives the strategy, the mode and the fit of a node. A node with children has the mode `nested` by default. */
  readonly nodeSpec?: (node: Node) => FlowNodeSpec | undefined;
  /** The strategy that arranges the nodes without a parent. The default is `grid`. */
  readonly rootLayout?: LayoutRef;
  /**
   * With `edges` (the default), an edge between two nodes of the same group makes a tree.
   * The target becomes a linked child of the source, if it has no parent yet. With `parent`, only `parentId` makes the tree.
   */
  readonly hierarchy?: "edges" | "parent";
  /** The engine. Give an engine with your strategies. */
  readonly engine?: Engine;
  /** The type of the edges. The default is `ireko`. */
  readonly edgeType?: string;
}

const ROOT = "\u0000ireko-root";

/**
 * This function gives positions to the nodes of a flow, and routes to its edges.
 * A group (a node with `parentId` children) gets a size that holds its children. A leaf keeps its measured size.
 */
export function layoutFlow<N extends Node, E extends Edge>(nodes: readonly N[], edges: readonly E[], options: LayoutFlowOptions = {}): { nodes: N[]; edges: E[]; layout: Layout } {
  const ids = new Set(nodes.map((n) => n.id));
  const parent = new Map<string, string>();
  const groups = new Set<string>();
  for (const n of nodes) {
    if (n.parentId !== undefined && ids.has(n.parentId)) {
      parent.set(n.id, n.parentId);
      groups.add(n.parentId);
    }
  }
  const group = (id: string): string | undefined => (groups.has(parent.get(id) ?? "") ? parent.get(id) : undefined);
  const linked = new Map<string, string>();
  const treeEdges = new Map<string, E>();
  if (options.hierarchy !== "parent") {
    for (const e of edges) {
      if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
      if (linked.has(e.target) || group(e.source) !== group(e.target) || reaches(e.target, e.source, linked)) continue;
      linked.set(e.target, e.source);
      treeEdges.set(`${e.source}->${e.target}`, e);
    }
  }

  const children = new Map<string, string[]>();
  for (const n of nodes) {
    const p = linked.get(n.id) ?? group(n.id) ?? ROOT;
    const list = children.get(p) ?? [];
    list.push(n.id);
    children.set(p, list);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const build = (id: string): NodeSpec => {
    const n = byId.get(id);
    const kids = (children.get(id) ?? []).map(build);
    if (n === undefined) return { id, mode: "nested", layout: withPadding(options.rootLayout ?? "grid"), children: kids };
    const own = options.nodeSpec?.(n) ?? {};
    const hasGroupChildren = groups.has(id);
    const width = n.measured?.width ?? n.width;
    const height = n.measured?.height ?? n.height;
    return {
      id,
      label: typeof n.data["label"] === "string" ? n.data["label"] : id,
      ...(hasGroupChildren ? {} : { size: { ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }) } }),
      ...(own.layout === undefined ? {} : { layout: own.layout }),
      mode: own.mode ?? (hasGroupChildren ? "nested" : "linked"),
      ...(own.fit === undefined ? {} : { fit: own.fit }),
      children: kids,
    };
  };

  const extra = edges.filter((e) => !treeEdges.has(`${e.source}->${e.target}`) && ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  const engine = options.engine ?? defaultEngine;
  const result = engine.layout({ root: build(ROOT), edges: extra.map((e) => ({ id: e.id, source: e.source, target: e.target })) }, options);
  const placed = new Map(result.nodes.map((n) => [n.id, n]));
  const routes = new Map<string, readonly Point[]>();
  for (const e of result.edges) routes.set(e.kind === "tree" ? e.id : `extra:${e.id}`, e.points);

  const outNodes = nodes.map((n): N => {
    const box = placed.get(n.id);
    if (box === undefined) return n;
    const g = group(n.id);
    const holder = g === undefined ? undefined : placed.get(g);
    const position = holder === undefined ? { x: box.x, y: box.y } : { x: box.x - holder.x, y: box.y - holder.y };
    return groups.has(n.id) ? { ...n, position, width: box.width, height: box.height } : { ...n, position };
  });
  const outEdges = edges.map((e): E => {
    const points = routes.get(`${e.source}->${e.target}`) ?? routes.get(`extra:${e.id}`);
    return points === undefined ? e : { ...e, type: options.edgeType ?? "ireko", data: { ...e.data, points } };
  });
  // The invisible root is not a node of the flow: the layout loses it, and its children lose their reference to it.
  const visible = result.nodes
    .filter((n) => n.id !== ROOT)
    .map((n): PlacedNode => {
      const { parent: up, container: holder, ...rest } = n;
      return {
        ...rest,
        depth: n.depth - 1,
        ...(up === undefined || up === ROOT ? {} : { parent: up }),
        ...(holder === undefined || holder === ROOT ? {} : { container: holder }),
      };
    });
  return { nodes: outNodes, edges: outEdges, layout: { ...result, nodes: visible } };
}

const defaultEngine: Engine = createEngine();

/** The invisible root has no padding and no header, so the top nodes keep their places. */
function withPadding(ref: LayoutRef): LayoutRef {
  return typeof ref === "string" ? { type: ref, padding: 0, header: 0 } : { padding: 0, header: 0, ...ref };
}

/** This function tells if `from` reaches `to` through the linked parents. Thus a new edge cannot make a cycle. */
function reaches(from: string, to: string, linked: ReadonlyMap<string, string>): boolean {
  for (let c: string | undefined = to; c !== undefined; c = linked.get(c)) if (c === from) return true;
  return false;
}
