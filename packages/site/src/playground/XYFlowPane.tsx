/**
 * The React Flow pane of the playground. The playground loads it only when the reader selects React Flow, so the other
 * renderers do not load React Flow.
 */
import "@xyflow/react/dist/style.css";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import type { Layout } from "ireko";
import { edgeTypes, nodeTypes, toXYFlow } from "ireko/xyflow";
import { useMemo, type ReactElement } from "react";

/** The pane. A change of the layout gives React Flow new positions. */
export default function XYFlowPane({ layout, onPick }: { layout: Layout; onPick: (id: string | undefined) => void }): ReactElement {
  const flow = useMemo(() => toXYFlow(layout), [layout]);
  return (
    <ReactFlow
      nodes={flow.nodes}
      edges={flow.edges}
      edgeTypes={edgeTypes}
      nodeTypes={nodeTypes}
      fitView
      nodesConnectable={false}
      onNodeClick={(_, node) => onPick(node.id)}
      onPaneClick={() => onPick(undefined)}
      proOptions={{ hideAttribution: false }}
    >
      <Background gap={16} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
