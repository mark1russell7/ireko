/**
 * The strategy `force` arranges the children with a force-directed relaxation (`relaxForces`): a network with no
 * hierarchy. The children repel each other, and each extra edge between two children is a spring. The relaxation
 * moves the extent of each child, so no two subtrees overlap.
 *
 * The start is a grid in the order of the identifiers of the children. Thus the result depends on the identifiers,
 * not on the order of the children. A new name that keeps the order of the identifiers gives the same positions.
 */
import { at } from "../at.ts";
import { relaxForces, type RelaxEdge, type RelaxNode } from "../relax.ts";
import { defineStrategy, type Strategy } from "../strategy.ts";

/** The options of the strategy `force`. */
export interface ForceOptions {
  /** The number of force steps. */
  readonly iterations: number;
  /** The length at which a spring has no force. The value 0 means 2 times the mean of the larger side of each extent. */
  readonly springLength: number;
  /** The strength of the repulsion between two children. The value 0 means the square of the spring length. */
  readonly repulsion: number;
  /** The stiffness of the spring of each edge, 0.5 at most. With more, one spring step moves the two ends past the spring length. */
  readonly strength: number;
  /** The smallest distance between two extents. The value 0 means the gap. */
  readonly margin: number;
  /** In the linked mode, the distance between the node and its children. The value 0 means 1.5 times the gap. */
  readonly distance: number;
}

/** The order of two identifiers: the order of their UTF-16 code units. */
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The strategy `force`. */
export const force: Strategy<ForceOptions> = defineStrategy<ForceOptions>({
  type: "force",
  description: "The force strategy arranges the children with a force-directed relaxation. Each edge between two children is a spring.",
  options: {
    iterations: { type: "number", default: 150, min: 0, integer: true, description: "The number of force steps." },
    springLength: { type: "number", default: 0, min: 0, description: "The length at which a spring has no force. With 0, it is 2 times the mean of the larger side of each extent." },
    repulsion: { type: "number", default: 0, min: 0, description: "The strength of the repulsion between two children. With 0, it is the square of the spring length." },
    strength: { type: "number", default: 0.08, min: 0, max: 0.5, description: "The stiffness of the spring of each edge, 0.5 at most. With more, one spring step moves the two ends past the spring length." },
    margin: { type: "number", default: 0, min: 0, description: "The smallest distance between two extents. With 0, it is the gap." },
    distance: { type: "number", default: 0, min: 0, description: "In the linked mode, the distance between the node and its children. With 0, it is 1.5 times the gap." },
  },
  arrange({ mode, self, children, options, gap, edges = [] }) {
    const k = children.length;
    if (k === 0) return mode === "nested" ? { offsets: [], content: { x: 0, y: 0, width: 0, height: 0 } } : { offsets: [], direction: "down" };
    const margin = options.margin > 0 ? options.margin : gap;
    const springLength = options.springLength > 0 ? options.springLength : (2 * children.reduce((sum, c) => sum + Math.max(c.extent.width, c.extent.height), 0)) / k;
    const repulsion = options.repulsion > 0 ? options.repulsion : springLength * springLength;

    // The start: a grid in the order of the identifiers, with cells as large as the largest extent and the margin.
    const order = children.map((c, i) => ({ id: c.id, i })).toSorted((a, b) => byId(a.id, b.id));
    const columns = Math.ceil(Math.sqrt(k));
    const rows = Math.ceil(k / columns);
    const cellW = Math.max(...children.map((c) => c.extent.width)) + margin;
    const cellH = Math.max(...children.map((c) => c.extent.height)) + margin;
    const nodes: RelaxNode[] = order.map(({ id, i }, place) => {
      const extent = at(children, i).extent;
      return { id, rect: { x: (place % columns) * cellW, y: Math.floor(place / columns) * cellH, width: extent.width, height: extent.height } };
    });
    const springs: RelaxEdge[] = edges.map((e) => ({ from: at(children, e.from).id, to: at(children, e.to).id, strength: options.strength }));
    const placed = relaxForces(nodes, springs, {
      iterations: options.iterations,
      springLength,
      repulsion,
      margin,
      inset: 0,
      bound: { width: columns * cellW, height: rows * cellH },
    });

    // The extents start at (0, 0). The offset of a child is the corner of its box, not of its extent.
    const corners = children.map((c) => placed.get(c.id) ?? { x: 0, y: 0 });
    const left = Math.min(...corners.map((p) => p.x)), top = Math.min(...corners.map((p) => p.y));
    const width = Math.max(...children.map((c, i) => at(corners, i).x - left + c.extent.width));
    const height = Math.max(...children.map((c, i) => at(corners, i).y - top + c.extent.height));
    if (mode === "nested") {
      const offsets = children.map((c, i) => ({ x: at(corners, i).x - left - c.extent.x, y: at(corners, i).y - top - c.extent.y }));
      return { offsets, content: { x: 0, y: 0, width, height } };
    }
    // In the linked mode, the children go below the node, at the middle.
    const dx = (self.width - width) / 2 - left, dy = self.height + (options.distance > 0 ? options.distance : 1.5 * gap) - top;
    const offsets = children.map((c, i) => ({ x: at(corners, i).x + dx - c.extent.x, y: at(corners, i).y + dy - c.extent.y }));
    return { offsets, direction: "down" };
  },
});
