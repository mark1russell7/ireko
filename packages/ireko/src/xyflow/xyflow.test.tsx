import type { Edge, EdgeProps, Node } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEngine, defineStrategy, layout } from "../core/index.ts";
import { defectsOf } from "../test/invariants.ts";
import { ReactFlowProvider } from "@xyflow/react";
import { edgeTypes, GroupNode, layoutFlow, nodeTypes, pathOf, PolylineEdge, toXYFlow, type IrekoEdgeData } from "./index.tsx";

describe("toXYFlow", () => {
  it("gives parents before children, positions relative to the container, and the ireko edge type", () => {
    const out = layout({ root: { id: "r", children: [{ id: "g", mode: "nested", children: [{ id: "a" }, { id: "b", children: [{ id: "c" }] }] }] }, edges: [{ id: "x", source: "a", target: "r" }] });
    const flow = toXYFlow(out);
    const ids = flow.nodes.map((n) => n.id);
    expect(ids).toEqual(["r", "g", "a", "b", "c"]);
    const g = out.nodes.find((n) => n.id === "g");
    const a = out.nodes.find((n) => n.id === "a");
    const fa = flow.nodes.find((n) => n.id === "a");
    expect(fa?.parentId).toBe("g");
    expect(fa?.extent).toBe("parent");
    expect(fa?.position).toEqual({ x: (a?.x ?? 0) - (g?.x ?? 0), y: (a?.y ?? 0) - (g?.y ?? 0) });
    expect(flow.nodes.find((n) => n.id === "c")?.parentId).toBe("g");
    expect(flow.nodes.find((n) => n.id === "g")?.type).toBe("group");
    expect(flow.nodes.find((n) => n.id === "r")?.type).toBe("default");
    expect(flow.edges.find((e) => e.id === "x")?.type).toBe("ireko");
    expect(toXYFlow(out, { nodeType: () => "card", edgeType: "smooth" }).nodes[0]?.type).toBe("card");
  });

  it("keeps the label of an edge", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }, { id: "b" }] }, edges: [{ id: "x", source: "a", target: "b", label: "calls" }] });
    const flow = toXYFlow(out);
    expect(flow.edges.find((e) => e.id === "x")?.label).toBe("calls");
    expect(flow.edges.find((e) => e.id !== "x")).not.toHaveProperty("label");
  });
});

/** This function gives the properties that React Flow gives to an edge component. */
function props(data: Partial<IrekoEdgeData> | undefined): EdgeProps<Edge<Partial<IrekoEdgeData>>> {
  return { id: "e", source: "a", target: "b", sourceX: 0, sourceY: 0, targetX: 10, targetY: 20, sourcePosition: "bottom", targetPosition: "top", data } as unknown as EdgeProps<Edge<Partial<IrekoEdgeData>>>;
}

describe("PolylineEdge", () => {
  it("draws the route, or a straight line without a route", () => {
    expect(pathOf([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe("M 1 2 L 3 4");
    expect(renderToStaticMarkup(<svg>{PolylineEdge(props({ points: [{ x: 0, y: 0 }, { x: 0, y: 9 }, { x: 5, y: 9 }] }))}</svg>)).toContain('d="M 0 0 L 0 9 L 5 9"');
    expect(renderToStaticMarkup(<svg>{PolylineEdge(props(undefined))}</svg>)).toContain('d="M 0 0 L 10 20"');
    const marked = { ...props({ points: [] }), markerEnd: "url(#m)", markerStart: "url(#s)", style: { stroke: "red" }, interactionWidth: 5 };
    expect(renderToStaticMarkup(<svg>{PolylineEdge(marked)}</svg>)).toContain('marker-end="url(#m)"');
    expect(edgeTypes.ireko).toBe(PolylineEdge);
    expect(renderToStaticMarkup(<svg>{PolylineEdge({ ...props({ points: [{ x: 0, y: 0 }, { x: 8, y: 0 }] }), label: "calls" })}</svg>)).toContain("d=\"M 0 0 L 8 0\"");
  });
});

describe("GroupNode", () => {
  it("draws the label and two handles", () => {
    const nodeProps = { id: "g", data: { label: "Group" }, type: "group", selected: false, dragging: false, zIndex: 0, selectable: true, deletable: true, draggable: true, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0 } as unknown as Parameters<typeof GroupNode>[0];
    const html = renderToStaticMarkup(<ReactFlowProvider>{GroupNode(nodeProps)}</ReactFlowProvider>);
    expect(html).toContain("Group");
    expect(html.match(/react-flow__handle/g)?.length).toBeGreaterThanOrEqual(2);
    const empty = renderToStaticMarkup(<ReactFlowProvider>{GroupNode({ ...nodeProps, data: {} })}</ReactFlowProvider>);
    expect(empty).not.toContain("Group");
    expect(nodeTypes.group).toBe(GroupNode);
  });
});

describe("layoutFlow", () => {
  const nodes: Node[] = [
    { id: "group", position: { x: 0, y: 0 }, data: { label: "Group" } },
    { id: "a", parentId: "group", position: { x: 0, y: 0 }, data: { label: "A" }, measured: { width: 80, height: 30 } },
    { id: "b", parentId: "group", position: { x: 0, y: 0 }, data: { label: "B" }, width: 90, height: 40 },
    { id: "c", parentId: "group", position: { x: 0, y: 0 }, data: {} },
    { id: "top", position: { x: 0, y: 0 }, data: { label: "Top" } },
    { id: "orphan", parentId: "missing", position: { x: 0, y: 0 }, data: {} },
  ];
  const edges: Edge[] = [
    { id: "e1", source: "a", target: "b" },
    { id: "e2", source: "b", target: "a" },
    { id: "e3", source: "top", target: "a" },
    { id: "e4", source: "a", target: "a" },
    { id: "e5", source: "a", target: "ghost" },
    { id: "e6", source: "a", target: "c" },
    { id: "e7", source: "top", target: "group" },
  ];

  it("sizes the groups, keeps the measured sizes, and routes the edges", () => {
    const out = layoutFlow(nodes, edges);
    expect(defectsOf(out.layout)).toEqual([]);
    expect(out.layout.issues).toEqual([]);
    const group = out.nodes.find((n) => n.id === "group");
    expect(group?.width).toBeGreaterThan(80);
    const a = out.layout.nodes.find((n) => n.id === "a");
    expect([a?.width, a?.height]).toEqual([80, 30]);
    expect(out.layout.nodes.find((n) => n.id === "b")?.width).toBe(90);
    // e1 and e6 make a tree in the group: a is the parent of b and c. e2 would make a cycle, so it is an extra edge.
    expect(out.layout.nodes.find((n) => n.id === "b")?.parent).toBe("a");
    expect(out.layout.nodes.find((n) => n.id === "c")?.parent).toBe("a");
    for (const id of ["e1", "e2", "e3", "e6", "e7"]) expect(out.edges.find((e) => e.id === id)?.type).toBe("ireko");
    expect(out.edges.find((e) => e.id === "e4")).toBe(edges[3]);
    expect(out.edges.find((e) => e.id === "e5")).toBe(edges[4]);
    const placedA = out.nodes.find((n) => n.id === "a");
    expect(placedA?.position.x).toBeGreaterThanOrEqual(0);
    expect(out.nodes.find((n) => n.id === "orphan")?.position).toBeDefined();
  });

  it("uses only parentId with the hierarchy parent, and the settings of each node", () => {
    const out = layoutFlow(nodes, edges, {
      hierarchy: "parent",
      rootLayout: { type: "radial" },
      nodeSpec: (n) => (n.id === "group" ? { layout: "radial", mode: "nested", fit: "grow" } : undefined),
    });
    expect(out.layout.nodes.find((n) => n.id === "b")?.parent).toBe("group");
    expect(out.layout.nodes.find((n) => n.id === "group")?.layout).toBe("radial");
    expect(defectsOf(out.layout)).toEqual([]);
  });

  it("keeps a node that the engine skips, such as a duplicate identifier", () => {
    const twice: Node[] = [{ id: "d", position: { x: 5, y: 5 }, data: {} }, { id: "d", position: { x: 7, y: 7 }, data: {} }];
    const out = layoutFlow(twice, []);
    expect(out.layout.issues.map((i) => i.code)).toEqual(["DUPLICATE_ID"]);
    expect(out.nodes).toHaveLength(2);
  });

  it("uses the engine of the options", () => {
    const pile = defineStrategy({ type: "column", description: "One column.", options: {}, arrange: ({ children }) => ({ offsets: children.map((_, i) => ({ x: 0, y: i * 100 })) }) });
    const out = layoutFlow([{ id: "x", position: { x: 0, y: 0 }, data: {} }, { id: "y", position: { x: 0, y: 0 }, data: {} }], [], { engine: createEngine({ strategies: [pile] }), rootLayout: "column", edgeType: "custom" });
    expect(out.nodes.map((n) => n.position.y)).toEqual([0, 100]);
  });
});
