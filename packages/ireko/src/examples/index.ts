/**
 * Example inputs. Each example shows one idea of ireko. The golden tests lay out each example, and the gallery of the
 * site shows each example on its own page.
 */
import type { LayoutInput, LayoutOptions, NodeSpec } from "../core/model.ts";

/** One example: an input, its options and a text for the gallery. */
export interface Example {
  /** The identifier of the example. It is also the file name of its golden files and the address of its page. */
  readonly name: string;
  readonly title: string;
  /** One or two sentences for the gallery. */
  readonly description: string;
  readonly input: LayoutInput;
  readonly options?: LayoutOptions;
}

const leaves = (prefix: string, count: number): NodeSpec[] => Array.from({ length: count }, (_, i) => ({ id: `${prefix}${String(i + 1)}` }));

/** The examples, in the order of the gallery. */
export const examples: readonly Example[] = [
  {
    name: "jqy-demo",
    title: "The demo of Jqy",
    description: "The default demo of Jqy 0.x, the first version of the project. The old engine put 55 overlapping pairs in it. The two-pass engine puts none.",
    input: {
      root: {
        id: "root",
        children: [
          { id: "A", layout: "radial", mode: "nested", children: leaves("A", 3) },
          { id: "B", layout: "grid", children: leaves("B", 4) },
          { id: "C", layout: "radial", mode: "nested", children: leaves("C", 4) },
        ],
      },
    },
  },
  {
    name: "org-chart",
    title: "Organization chart",
    description: "Linked grids make a tree. Each team is as wide as its subtree, so no two teams overlap.",
    input: {
      root: {
        id: "ceo",
        label: "CEO",
        layout: { type: "grid", columns: 3 },
        children: [
          { id: "cto", label: "CTO", layout: { type: "grid", columns: 3 }, children: [{ id: "platform", label: "Platform" }, { id: "product", label: "Product" }, { id: "data", label: "Data" }] },
          { id: "cfo", label: "CFO", children: [{ id: "finance", label: "Finance" }] },
          { id: "coo", label: "COO", layout: { type: "grid", columns: 2 }, children: [{ id: "ops", label: "Operations" }, { id: "support", label: "Support" }] },
        ],
      },
    },
    options: { router: "orthogonal" },
  },
  {
    name: "mind-map",
    title: "Mind map",
    description: "A radial root with four fans. Each fan opens away from the root, and each ring is large enough for the subtrees on it.",
    input: {
      root: {
        id: "idea",
        label: "Big idea",
        layout: "radial",
        children: [
          { id: "why", label: "Why", layout: { type: "radial", sweep: 180, startAngle: -180 }, children: leaves("why-", 3) },
          { id: "how", label: "How", layout: { type: "radial", sweep: 180, startAngle: -90 }, children: leaves("how-", 3) },
          { id: "who", label: "Who", layout: { type: "radial", sweep: 180, startAngle: 0 }, children: leaves("who-", 2) },
          { id: "when", label: "When", layout: { type: "radial", sweep: 180, startAngle: 90 }, children: leaves("when-", 2) },
        ],
      },
    },
  },
  {
    name: "architecture",
    title: "System architecture",
    description: "Nested containers hold services. Extra edges connect services in different containers.",
    input: {
      root: {
        id: "system",
        label: "System",
        mode: "nested",
        layout: { type: "grid", columns: 2, header: 28 },
        children: [
          { id: "edge", label: "Edge", mode: "nested", layout: { type: "grid", header: 28 }, children: [{ id: "cdn", label: "CDN" }, { id: "gateway", label: "Gateway" }] },
          { id: "services", label: "Services", mode: "nested", layout: { type: "grid", header: 28 }, children: [{ id: "auth", label: "Auth" }, { id: "orders", label: "Orders" }, { id: "billing", label: "Billing" }, { id: "search", label: "Search" }] },
          { id: "data", label: "Data", mode: "nested", layout: { type: "grid", columns: 3, header: 28 }, children: [{ id: "postgres", label: "Postgres" }, { id: "redis", label: "Redis" }, { id: "kafka", label: "Kafka" }] },
          { id: "observability", label: "Observability", mode: "nested", layout: { type: "grid", header: 28 }, children: [{ id: "logs", label: "Logs" }, { id: "metrics", label: "Metrics" }] },
        ],
      },
      edges: [
        { source: "gateway", target: "auth" },
        { source: "gateway", target: "orders" },
        { source: "orders", target: "postgres" },
        { source: "billing", target: "kafka" },
        { source: "search", target: "redis" },
      ],
    },
  },
  {
    name: "nested-rings",
    title: "Rings in rings",
    description: "Radial containers inside a radial container. A container with one child puts it at the center.",
    input: {
      root: {
        id: "galaxy",
        layout: "radial",
        mode: "nested",
        children: [
          { id: "sun", layout: "radial", mode: "nested", children: leaves("planet-", 5) },
          { id: "binary", layout: "radial", mode: "nested", children: leaves("star-", 2) },
          { id: "lonely", layout: "radial", mode: "nested", children: [{ id: "moon" }] },
        ],
      },
    },
    options: { nodeSize: { width: 72, height: 32 }, spacing: 12 },
  },
  {
    name: "mixed",
    title: "Mixed strategies",
    description: "Each container selects its own strategy and mode: a radial container of grids, with a linked tree inside one cell.",
    input: {
      root: {
        id: "hub",
        layout: "radial",
        mode: "nested",
        children: [
          { id: "grid-a", mode: "nested", children: leaves("a", 4) },
          { id: "tree", children: [{ id: "t1", children: leaves("t1-", 2) }, { id: "t2" }] },
          { id: "grid-b", mode: "nested", layout: { type: "grid", columns: 3 }, children: leaves("b", 6) },
        ],
      },
    },
    options: { nodeSize: { width: 64, height: 32 }, spacing: 14 },
  },
  {
    name: "sizes",
    title: "Boxes of different sizes",
    description: "Each column is as wide as its widest box, and each row is as tall as its tallest box.",
    input: {
      root: {
        id: "board",
        mode: "nested",
        layout: { type: "grid", columns: 3 },
        children: [
          { id: "wide", size: { width: 260, height: 40 } },
          { id: "tall", size: { width: 60, height: 160 } },
          { id: "square", size: { width: 90, height: 90 } },
          { id: "small", size: { width: 40, height: 30 } },
          { id: "medium", size: { width: 140, height: 70 } },
          { id: "long", size: { width: 200, height: 50 } },
        ],
      },
    },
  },
  {
    name: "sides",
    title: "Children on each side",
    description: "The grid strategy puts linked children below, above, left or right of their parent.",
    input: {
      root: {
        id: "center",
        mode: "nested",
        layout: { type: "grid", columns: 2 },
        children: [
          { id: "down", layout: { type: "grid", side: "bottom" }, children: leaves("d", 2) },
          { id: "up", layout: { type: "grid", side: "top" }, children: leaves("u", 2) },
          { id: "right", layout: { type: "grid", side: "right" }, children: leaves("r", 2) },
          { id: "left", layout: { type: "grid", side: "left" }, children: leaves("l", 2) },
        ],
      },
    },
    options: { nodeSize: { width: 64, height: 32 }, spacing: 16 },
  },
  {
    name: "fan",
    title: "A fan",
    description: "A radial strategy with a sweep of 120 degrees. Each child is at the middle of an equal part of the arc.",
    input: { root: { id: "source", layout: { type: "radial", startAngle: 30, sweep: 120 }, children: leaves("ray-", 5) } },
    options: { nodeSize: { width: 72, height: 32 } },
  },
  {
    name: "fit-scale",
    title: "Fit: scale",
    description: "A container with a fixed size. Its content becomes smaller to fit, and the labels become smaller too.",
    input: {
      root: {
        id: "frame",
        mode: "nested",
        layout: { type: "grid", columns: 2 },
        children: [
          { id: "small-window", mode: "nested", fit: "scale", size: { width: 240, height: 160 }, children: leaves("w", 12) },
          { id: "big-window", mode: "nested", fit: "grow", children: leaves("g", 4) },
        ],
      },
    },
  },
  {
    name: "fit-clip",
    title: "Fit: clip",
    description: "A container with a fixed size and the fit clip. The content keeps its size, and the renderer cuts it at the edge.",
    input: { root: { id: "viewport", mode: "nested", fit: "clip", size: { width: 300, height: 140 }, children: leaves("item-", 9) } },
  },
  {
    name: "routers",
    title: "Orthogonal edges",
    description: "The orthogonal router draws horizontal and vertical segments, and turns at the middle of each gap.",
    input: {
      root: { id: "main", layout: { type: "grid", columns: 4 }, children: [{ id: "parse" }, { id: "check" }, { id: "plan" }, { id: "run", children: leaves("step-", 3) }] },
      edges: [{ source: "parse", target: "check" }, { source: "check", target: "plan" }, { source: "plan", target: "run" }],
    },
    options: { router: "orthogonal", nodeSize: { width: 80, height: 36 } },
  },
  {
    name: "fractal",
    title: "A fractal",
    description: "Three levels of nested containers. The strategy changes at each level: a grid of rings of grids.",
    input: { root: fractal("f", 0) },
    options: { nodeSize: { width: 28, height: 28 }, spacing: 8, header: 14 },
  },
  {
    name: "wide",
    title: "A wide tree",
    description: "Linked children make one row by default, so no edge crosses a sibling. The orthogonal router draws a comb.",
    input: { root: { id: "hub", children: leaves("leaf-", 12) } },
    options: { nodeSize: { width: 64, height: 28 }, spacing: 12, router: "orthogonal" },
  },
];

function fractal(id: string, level: number): NodeSpec {
  if (level === 3) return { id, label: "" };
  return {
    id,
    label: "",
    mode: "nested",
    layout: level === 0 ? { type: "grid", columns: 3 } : level === 1 ? "radial" : "grid",
    children: Array.from({ length: level === 0 ? 3 : 4 }, (_, i) => fractal(`${id}.${String(i + 1)}`, level + 1)),
  };
}
