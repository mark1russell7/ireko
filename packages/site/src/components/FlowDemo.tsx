/**
 * React Flow with `layoutFlow`. The flow has three groups (sub-flows) and edges between them. ireko gives each group
 * a size, and each node a position in its group. Drag a node, then select "Lay out" to put it back.
 */
import "@xyflow/react/dist/style.css";
import { applyNodeChanges, Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeChange } from "@xyflow/react";
import { edgeTypes, layoutFlow, nodeTypes, type LayoutFlowOptions } from "ireko/xyflow";
import { useCallback, useState, type ReactElement } from "react";
import { useColorMode } from "../lib/theme.ts";

const leaf = (id: string, parentId: string): Node => ({ id, parentId, extent: "parent", data: { label: id }, position: { x: 0, y: 0 }, width: 84, height: 34 });
const group = (id: string): Node => ({ id, type: "group", data: { label: id }, position: { x: 0, y: 0 } });

const NODES: readonly Node[] = [
  group("client"),
  leaf("web", "client"),
  leaf("mobile", "client"),
  leaf("cli", "client"),
  group("server"),
  leaf("api", "server"),
  leaf("auth", "server"),
  leaf("orders", "server"),
  leaf("billing", "server"),
  leaf("search", "server"),
  group("storage"),
  leaf("postgres", "storage"),
  leaf("redis", "storage"),
  leaf("s3", "storage"),
];
const EDGES: readonly Edge[] = [
  ["web", "api"],
  ["mobile", "api"],
  ["cli", "api"],
  ["api", "auth"],
  ["api", "orders"],
  ["api", "search"],
  ["orders", "billing"],
  ["orders", "postgres"],
  ["auth", "redis"],
  ["billing", "s3"],
].map(([source = "", target = ""]) => ({ id: `${source}-${target}`, source, target }));

type Choice = "grid" | "radial";

/** The settings of the demo. */
interface Settings {
  readonly root: Choice;
  readonly server: Choice;
  readonly hierarchy: "edges" | "parent";
  readonly router: "straight" | "orthogonal" | "avoid";
}

function optionsOf(s: Settings): LayoutFlowOptions {
  return {
    rootLayout: s.root === "grid" ? { type: "grid", columns: 3, gap: 40 } : "radial",
    // The strategy of the group server, and of the tree of api in it.
    nodeSpec: (n) => (n.id === "server" || n.id === "api" ? { layout: s.server } : undefined),
    hierarchy: s.hierarchy,
    router: s.router,
    spacing: 18,
  };
}

const INITIAL: Settings = { root: "grid", server: "grid", hierarchy: "edges", router: "straight" };
const FIRST = layoutFlow(NODES, EDGES, optionsOf(INITIAL));

/** The demo. A change of a setting lays out the flow again, and the view moves to fit it. */
function Demo(): ReactElement {
  const flow = useReactFlow();
  const colorMode = useColorMode();
  const [settings, setSettings] = useState<Settings>(INITIAL);
  const [nodes, setNodes] = useState<Node[]>(FIRST.nodes);
  const [edges, setEdges] = useState<Edge[]>(FIRST.edges);

  /** This function lays out the flow with the settings `next`. */
  const apply = (next: Settings): void => {
    const laid = layoutFlow(NODES, EDGES, optionsOf(next));
    setSettings(next);
    setNodes(laid.nodes);
    setEdges(laid.edges);
    // React Flow reads the new nodes after the next render.
    setTimeout(() => void flow.fitView({ duration: 400, padding: 0.1 }), 40);
  };
  const set = (patch: Partial<Settings>): void => apply({ ...settings, ...patch });

  // A node that the reader drags has no route: its edges go straight between the handles until the next layout.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    const moved = new Set(changes.flatMap((c) => (c.type === "position" ? [c.id] : [])));
    if (moved.size > 0) setEdges((es) => es.map((e) => (moved.has(e.source) || moved.has(e.target) ? { ...e, data: {} } : e)));
  }, []);

  return (
    <div className="ik-frame ik-flow not-content">
      <div className="ik-toolbar">
        <label>
          <span>Groups</span>
          <select className="ik-select" value={settings.root} onChange={(e) => set({ root: e.target.value === "radial" ? "radial" : "grid" })}>
            <option value="grid">grid</option>
            <option value="radial">radial</option>
          </select>
        </label>
        <label>
          <span>In server</span>
          <select className="ik-select" value={settings.server} onChange={(e) => set({ server: e.target.value === "radial" ? "radial" : "grid" })}>
            <option value="grid">grid</option>
            <option value="radial">radial</option>
          </select>
        </label>
        <label>
          <span>Tree from</span>
          <select className="ik-select" value={settings.hierarchy} onChange={(e) => set({ hierarchy: e.target.value === "parent" ? "parent" : "edges" })}>
            <option value="edges">edges</option>
            <option value="parent">parentId only</option>
          </select>
        </label>
        <label>
          <span>Edges</span>
          <select className="ik-select" value={settings.router} onChange={(e) => set({ router: e.target.value === "orthogonal" || e.target.value === "avoid" ? e.target.value : "straight" })}>
            <option value="straight">straight</option>
            <option value="orthogonal">orthogonal</option>
            <option value="avoid">avoid</option>
          </select>
        </label>
        <span className="ik-spacer" />
        <button type="button" className="ik-button ik-small" data-variant="primary" onClick={() => apply(settings)}>
          Lay out
        </button>
      </div>
      <div className="ik-flow-stage">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} nodesConnectable={false} fitView colorMode={colorMode} minZoom={0.2}>
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

/** The demo, in the provider of React Flow. */
export default function FlowDemo(): ReactElement {
  return (
    <ReactFlowProvider>
      <Demo />
    </ReactFlowProvider>
  );
}
