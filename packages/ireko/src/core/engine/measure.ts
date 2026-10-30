/**
 * The measure phase: the first of the two passes. It visits each node after its children (the reverse of the pre-order),
 * so each strategy sees the measured children. For each node it gives the box size, the extent of the subtree and the
 * placement of each child in the box of the node.
 */
import { at, atKey } from "../at.ts";
import { rectAt, type Rect, type Size } from "../geometry.ts";
import type { Issue, NodeSpec } from "../model.ts";
import { resolveOptions } from "../options.ts";
import { grid } from "../strategies/grid.ts";
import type { AnyStrategy, Arrangement, ChildEdge, Direction, MeasuredChild, Shape } from "../strategy.ts";
import { measureOf, type MeasureColumn, type MeasureRecord } from "./measure.generated.js";
import { boxShape, linkedShape, moveShape, type ShapePart } from "./shape.ts";
import type { Context, Normalized, Placement } from "./types.ts";

/** The keys of a layout object that belong to the engine, not to the strategy. */
export const COMMON_OPTIONS: ReadonlySet<string> = new Set(["gap", "padding", "header"]);

/** The output of the measure phase. Each array has one item for each node, in pre-order. */
export interface Measurement {
  readonly box: readonly Size[];
  /** The extent of each subtree, relative to the top-left corner of its root box. */
  readonly extent: readonly Rect[];
  /** The placement of each node in the box of its parent. The root has the identity placement. */
  readonly placement: readonly Placement[];
  /** The strategy that arranged the children of each node. A failed strategy changes to `grid`. */
  readonly layout: readonly string[];
  /** The resolved strategy options of each node with children. */
  readonly options: readonly unknown[];
  /** The direction of the tree edges of each node, from its strategy. */
  readonly direction: readonly (Direction | undefined)[];
  /** The direction of the edges between the children of each node, from its strategy. */
  readonly flow: readonly (Direction | undefined)[];
  /** For each extra edge, the node with the children that it connects, or -1. */
  readonly owner: readonly number[];
  readonly gap: readonly number[];
}

const IDENTITY: Placement = { x: 0, y: 0, scale: 1 };
/** The record of the node in the sheet of the fit: the root of the sheet, before the records of its children. */
const NODE_RECORD: MeasureRecord = { p: -1, ox: 0, oy: 0, ex: 0, ey: 0, ew: 0, eh: 0 };

/** This function measures each node of `norm`. It adds its findings to `issues`. */
export function measure(norm: Normalized, ctx: Context, issues: Issue[]): Measurement {
  const n = norm.nodes.length;
  // The loop fills these arrays from the last index to the first.
  const box: Size[] = [];
  const extent: Rect[] = [];
  const placement: Placement[] = Array.from({ length: n }, () => IDENTITY);
  const layout: string[] = [];
  const options: unknown[] = [];
  const direction: (Direction | undefined)[] = Array.from({ length: n }, () => undefined);
  const flow: (Direction | undefined)[] = Array.from({ length: n }, () => undefined);
  const gaps: number[] = [];
  const { spacing, nodeSize } = ctx.options;

  // The shapes: a strategy with `shapes: true` needs the shape of each child. A linked node composes its shape from
  // the shapes of its children, so the need goes down the tree. The pre-order visits each parent before its children.
  const wantsShapes = (i: number): boolean => ctx.strategies.get(at(norm.nodes, i).layout)?.shapes === true;
  const needsShape: boolean[] = Array.from({ length: n }, () => false);
  for (let i = 0; i < n; i++) {
    const p = at(norm.nodes, i).parent;
    if (p >= 0) needsShape[i] = wantsShapes(p) || (at(needsShape, p) && at(norm.nodes, p).mode === "linked");
  }
  const shapes: (Shape | undefined)[] = Array.from({ length: n }, () => undefined);
  const { between, owner } = edgesBetweenChildren(norm);

  for (let i = n - 1; i >= 0; i--) {
    const node = at(norm.nodes, i);
    const own = ownSize(node.spec, node.size, nodeSize, ctx);
    layout[i] = node.layout;
    gaps[i] = spacing;

    if (node.children.length === 0) {
      box[i] = own.size;
      extent[i] = rectAt({ x: 0, y: 0 }, own.size);
      if (at(needsShape, i)) shapes[i] = boxShape(own.size);
      continue;
    }

    const raw = node.rawLayout;
    const gap = commonNumber(raw, "gap", spacing, node.id, issues);
    const padding = commonNumber(raw, "padding", spacing, node.id, issues);
    const header = commonNumber(raw, "header", ctx.options.header, node.id, issues);
    gaps[i] = gap;

    // The reverse pre-order visits each child before its parent, so each child already has its measurement.
    const withShapes = wantsShapes(i);
    const children: MeasuredChild[] = node.children.map((c) => {
      const child = { id: at(norm.nodes, c).id, box: at(box, c), extent: at(extent, c), mode: at(norm.nodes, c).mode };
      const shape = shapes[c];
      return withShapes && shape !== undefined ? { ...child, shape } : child;
    });
    // In the nested mode, a container without a size in its spec has no smallest size: its content sets the size.
    const self = node.mode === "linked" ? own.size : own.explicit;
    const arranged = arrangeSafely(atKey(ctx.strategies, node.layout), node, { self, children, gap, edges: at(between, i) }, issues);
    layout[i] = arranged.layout;
    options[i] = arranged.options;
    direction[i] = arranged.arrangement.direction;
    flow[i] = arranged.arrangement.flow;
    const offsets = arranged.arrangement.offsets;

    // The Vex sheet of the fit gives the bounds, the box and the placements: measure.generated.js, from the pilot of Vex.
    const records: MeasureRecord[] = [NODE_RECORD];
    children.forEach((child, k) => {
      const o = at(offsets, k);
      const e = child.extent;
      records.push({ p: 0, ox: o.x, oy: o.y, ex: e.x, ey: e.y, ew: e.width, eh: e.height });
    });
    const area = arranged.arrangement.content;
    const fit = measureOf(
      records,
      {
        linked: node.mode === "linked",
        content: area !== undefined,
        cx: area?.x ?? 0,
        cy: area?.y ?? 0,
        cw: area?.width ?? 0,
        ch: area?.height ?? 0,
        ownW: own.size.width,
        ownH: own.size.height,
        expW: own.explicit.width,
        expH: own.explicit.height,
        hasW: node.size.width !== undefined,
        hasH: node.size.height !== undefined,
        nodeW: node.size.width ?? 0,
        nodeH: node.size.height ?? 0,
        padding,
        header,
        grow: node.fit === "grow",
        scale: node.fit === "scale",
        clip: node.fit === "clip",
      },
      records.map((r) => r.p),
    );
    node.children.forEach((child, k) => {
      placement[child] = { x: numberAt(fit.lx, k + 1), y: numberAt(fit.ly, k + 1), scale: numberAt(fit.ls, k + 1) };
    });

    if (node.mode === "linked") {
      box[i] = own.size;
      extent[i] = { x: numberAt(fit.bx, 0), y: numberAt(fit.by, 0), width: numberAt(fit.bw, 0), height: numberAt(fit.bh, 0) };
      if (at(needsShape, i)) {
        const parts = node.children.map((c, k): ShapePart => {
          const o = at(offsets, k);
          // A child without a shape counts with its extent: a shape that covers more is still correct.
          const shape = shapes[c] ?? moveShape(boxShape(at(extent, c)), at(extent, c).x, at(extent, c).y);
          return { shape, x: o.x, y: o.y };
        });
        // The switch of the shapes gives the join: the code of ireko by default, or the shapes module of Vex.
        shapes[i] = linkedShape(own.size, parts);
      }
      continue;
    }

    // The nested mode: the sheet moves the content into the box, inside the padding and below the header.
    if (at(fit.small, 0) === true) {
      // A fixed size that cannot hold its own padding: the box grows to hold one pixel of content.
      const size: Size = { width: numberAt(fit.firstW, 0), height: numberAt(fit.firstH, 0) };
      issues.push({ code: "INVALID_SIZE", severity: "warning", message: `The size of the node "${node.id}" is smaller than its padding and header. The engine makes the box larger.`, node: node.id, detail: { size, padding, header } });
    }
    const size: Size = { width: numberAt(fit.sw, 0), height: numberAt(fit.sh, 0) };
    box[i] = size;
    extent[i] = rectAt({ x: 0, y: 0 }, size);
    // The children of a nested node are inside its box, so the box is its shape.
    if (at(needsShape, i)) shapes[i] = boxShape(size);
  }

  return { box, extent, placement, layout, options, direction, flow, owner, gap: gaps };
}

/** The size of the box of a node: from its spec, then from `measure`, then from the default node size. */
function ownSize(spec: NodeSpec, size: { readonly width?: number; readonly height?: number }, fallback: Size, ctx: Context): { size: Size; explicit: Size } {
  const measured = validSize(ctx.options.measure?.(spec));
  return {
    size: { width: size.width ?? measured?.width ?? fallback.width, height: size.height ?? measured?.height ?? fallback.height },
    explicit: { width: size.width ?? measured?.width ?? 0, height: size.height ?? measured?.height ?? 0 },
  };
}

function validSize(s: Size | undefined): Size | undefined {
  if (s === undefined) return undefined;
  return positive(s.width) && positive(s.height) ? s : undefined;
}

function positive(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/** This function gives the number of a column at the index `i`. An error of Vex is a value that is not finite, for example an overflow of a sum. */
function numberAt(column: MeasureColumn, i: number): number {
  const v = at(column, i);
  if (typeof v !== "number") throw new RangeError("ireko: the measure of a node is not finite.");
  return v;
}

function commonNumber(raw: Readonly<Record<string, unknown>> | undefined, key: string, fallback: number, node: string, issues: Issue[]): number {
  const v = raw?.[key];
  if (v === undefined) return fallback;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  issues.push({ code: "INVALID_OPTION", severity: "warning", message: `Node "${node}", option "${key}": The value must be a finite number of 0 or more. The engine uses the default.`, node, detail: { option: key, value: v } });
  return fallback;
}

interface Arranged {
  readonly arrangement: Arrangement;
  readonly layout: string;
  readonly options: unknown;
}

/**
 * This function starts the strategy of a node. A strategy that throws, or that gives a bad arrangement, gives the
 * finding `STRATEGY_FAILED`, and the engine uses the grid strategy for this node.
 */
function arrangeSafely(
  strategy: AnyStrategy,
  node: Normalized["nodes"][number],
  input: { readonly self: Size; readonly children: readonly MeasuredChild[]; readonly gap: number; readonly edges: readonly ChildEdge[] },
  issues: Issue[],
): Arranged {
  const context = { node: node.id, layout: strategy.type, ignore: COMMON_OPTIONS };
  const options = resolveOptions(strategy.options, node.rawLayout, context, issues);
  let problem: string | undefined;
  try {
    const arrangement = strategy.arrange({ id: node.id, mode: node.mode, self: input.self, children: input.children, options, gap: input.gap, depth: node.depth, edges: input.edges });
    problem = check(arrangement, input.children.length);
    if (problem === undefined) return { arrangement, layout: strategy.type, options };
  } catch (error) {
    problem = `It threw: ${error instanceof Error ? error.message : String(error)}`;
  }
  issues.push({ code: "STRATEGY_FAILED", severity: "error", message: `The strategy "${strategy.type}" failed for the node "${node.id}". ${problem} The engine uses "grid".`, node: node.id, detail: { layout: strategy.type } });
  const fallback = resolveOptions(grid.options, undefined, context, issues);
  const safe: AnyStrategy = grid;
  return { arrangement: safe.arrange({ id: node.id, mode: node.mode, self: input.self, children: input.children, options: fallback, gap: input.gap, depth: node.depth }), layout: "grid", options: fallback };
}

function check(arrangement: Arrangement, count: number): string | undefined {
  // A strategy of the user can give anything, so the check reads the arrangement as unknown data.
  const offsets: unknown = arrangement.offsets;
  if (!Array.isArray(offsets) || offsets.length !== count) return `It gave ${Array.isArray(offsets) ? String(offsets.length) : "no"} offsets for ${String(count)} children.`;
  if (!arrangement.offsets.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return "It gave an offset that is not finite.";
  const c = arrangement.content;
  if (c !== undefined && ![c.x, c.y, c.width, c.height].every(Number.isFinite)) return "It gave a content area that is not finite.";
  return undefined;
}

/**
 * This function gives, for each node, the extra edges between the subtrees of two of its children. An edge belongs to
 * the lowest common ancestor of its ends. An edge with an end at that ancestor connects no two children, so it is in no list.
 */
function edgesBetweenChildren(norm: Normalized): { between: ChildEdge[][]; owner: number[] } {
  const n = norm.nodes.length;
  const out: ChildEdge[][] = Array.from({ length: n }, () => []);
  const owner: number[] = norm.edges.map(() => -1);
  if (norm.edges.length === 0) return { between: out, owner };
  // The place of each node among the children of its parent.
  const place = new Int32Array(n);
  for (const node of norm.nodes) node.children.forEach((c, k) => (place[c] = k));
  norm.edges.forEach((e, index) => {
    // Each ancestor of the source, with the node below it on the path from the source (-1 for the source).
    const below = new Map<number, number>();
    for (let x = e.source, prev = -1; x >= 0; prev = x, x = at(norm.nodes, x).parent) below.set(x, prev);
    for (let y = e.target, prev = -1; y >= 0; prev = y, y = at(norm.nodes, y).parent) {
      const fromChild = below.get(y);
      if (fromChild === undefined) continue;
      if (fromChild >= 0 && prev >= 0) {
        at(out, y).push({ from: at(place, fromChild), to: at(place, prev) });
        owner[index] = y;
      }
      break;
    }
  });
  return { between: out, owner };
}
