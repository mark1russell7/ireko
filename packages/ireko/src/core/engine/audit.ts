/**
 * The audit phase. It examines the placed layout and reports its defects:
 * - `OVERLAP`: two boxes overlap, and neither box contains the other through the nested mode.
 * - `ESCAPE`: a node is not inside the nested container that holds it.
 * - the findings of each strategy (`Strategy.audit`).
 * A box inside a container with the fit `clip` counts only for its visible part.
 */
import { at, atKey } from "../at.ts";
import { contains, overlaps, type Rect } from "../geometry.ts";
import type { Issue, PlacedNode } from "../model.ts";
import type { Measurement } from "./measure.ts";
import type { Placed } from "./place.ts";
import type { Context, Normalized } from "./types.ts";

/** The tolerance of the audit, in pixels. The engine rounds to three decimals, so a smaller value finds false defects. */
export const TOLERANCE = 0.5;
/** The largest number of `OVERLAP` findings in one layout. The detail of the last finding gives the full count. */
export const MAX_OVERLAP_ISSUES = 100;

/** This function adds the findings of the audit to `issues`. */
export function audit(norm: Normalized, m: Measurement, placed: Placed, ctx: Context, issues: Issue[]): void {
  const nodes = placed.nodes;
  const clipRoot = clipRoots(nodes, placed.container);
  overlapsOf(nodes, holdsOf(norm), clipRoot, issues);

  nodes.forEach((node, i) => {
    const c = at(placed.container, i);
    if (c < 0) return;
    const holder = at(nodes, c);
    if (holder.clip) return;
    if (!contains(holder, node, TOLERANCE)) {
      issues.push({ code: "ESCAPE", severity: "warning", message: `The node "${node.id}" is not inside its container "${holder.id}".`, node: node.id, detail: { container: holder.id } });
    }
  });

  norm.nodes.forEach((record, i) => {
    if (record.children.length === 0) return;
    const strategy = atKey(ctx.strategies, at(m.layout, i));
    if (strategy.audit === undefined) return;
    const node = at(nodes, i);
    const children = record.children.map((c) => at(nodes, c));
    try {
      issues.push(...strategy.audit({ node, children, options: m.options[i], gap: at(m.gap, i) }));
    } catch (error) {
      issues.push({ code: "STRATEGY_FAILED", severity: "warning", message: `The audit of the strategy "${strategy.type}" threw for the node "${node.id}": ${error instanceof Error ? error.message : String(error)}`, node: node.id });
    }
  });
}

/** This function gives, for each node, the index of the nearest container with the fit `clip` that holds it, or -1. */
/**
 * This function gives the density of boxes on one axis: the sum of their sizes, divided by the length that they cover.
 * The density is the mean number of open boxes in a sweep along that axis.
 */
function densityOf(entries: readonly { readonly r: Rect }[], axis: "x" | "y"): number {
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const { r } of entries) {
    const from = axis === "x" ? r.x : r.y;
    const size = axis === "x" ? r.width : r.height;
    sum += size;
    min = Math.min(min, from);
    max = Math.max(max, from + size);
  }
  return max > min ? sum / (max - min) : 0;
}

function clipRoots(nodes: readonly PlacedNode[], container: readonly number[]): number[] {
  const out: number[] = nodes.map(() => -1);
  for (let i = 0; i < nodes.length; i++) {
    const c = at(container, i);
    if (c < 0) continue;
    out[i] = at(nodes, c).clip ? c : at(out, c);
  }
  return out;
}

/**
 * This function gives a test: does the node `a` hold the node `b` through nested containers? The container of a node
 * is its nearest nested ancestor, so `a` holds `b` when `a` is nested and `b` is in its subtree. In the pre-order,
 * a subtree is a range of indexes. Thus the test takes constant time.
 */
function holdsOf(norm: Normalized): (a: number, b: number) => boolean {
  const n = norm.nodes.length;
  const end = new Int32Array(n);
  // The reverse pre-order visits the children of a node before the node.
  for (let i = n - 1; i >= 0; i--) {
    const children = at(norm.nodes, i).children;
    end[i] = children.length === 0 ? i + 1 : at(end, at(children, children.length - 1));
  }
  return (a, b) => b > a && b < at(end, a) && at(norm.nodes, a).mode === "nested";
}

function visible(nodes: readonly PlacedNode[], i: number, clipRoot: readonly number[]): Rect | undefined {
  const node = at(nodes, i);
  const r = at(clipRoot, i);
  if (r < 0) return node;
  const root = at(nodes, r);
  const x = Math.max(node.x, root.x);
  const y = Math.max(node.y, root.y);
  const width = Math.min(node.x + node.width, root.x + root.width) - x;
  const height = Math.min(node.y + node.height, root.y + root.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : undefined;
}

/**
 * This function finds the overlapping pairs with a sweep. It sorts the boxes by their start on one axis, and it compares
 * each box only with the boxes that are still open. The cost is O(n log n + k) for k candidate pairs.
 * The sweep goes along the axis where the boxes overlap less. A column of boxes (a deep linked chain) shares one
 * range of x, so a sweep over x compares each pair. A sweep over y compares only neighbors.
 */
function overlapsOf(nodes: readonly PlacedNode[], holds: (a: number, b: number) => boolean, clipRoot: readonly number[], issues: Issue[]): void {
  const entries = nodes.map((_, i) => ({ r: visible(nodes, i, clipRoot), i })).filter((e): e is { r: Rect; i: number } => e.r !== undefined);
  const alongY = densityOf(entries, "y") < densityOf(entries, "x");
  const start = (r: Rect): number => (alongY ? r.y : r.x);
  const end = (r: Rect): number => (alongY ? r.y + r.height : r.x + r.width);
  const order = entries.toSorted((a, b) => start(a.r) - start(b.r) || a.i - b.i);
  let open: { r: Rect; i: number }[] = [];
  let count = 0;

  for (const cur of order) {
    open = open.filter((o) => end(o.r) - TOLERANCE > start(cur.r));
    for (const o of open) {
      if (!overlaps(o.r, cur.r, TOLERANCE)) continue;
      if (holds(o.i, cur.i) || holds(cur.i, o.i)) continue;
      count++;
      if (count <= MAX_OVERLAP_ISSUES) {
        const [a, b] = o.i < cur.i ? [o.i, cur.i] : [cur.i, o.i];
        const issue: Issue = { code: "OVERLAP", severity: "warning", message: `The boxes "${at(nodes, a).id}" and "${at(nodes, b).id}" overlap.`, node: at(nodes, b).id, detail: { with: at(nodes, a).id } };
        issues.push(issue);
      }
    }
    open.push(cur);
  }
  if (count > MAX_OVERLAP_ISSUES) {
    issues.push({ code: "OVERLAP", severity: "warning", message: `The layout has ${String(count)} overlapping pairs. The audit reports the first ${String(MAX_OVERLAP_ISSUES)}.`, detail: { count } });
  }
}
