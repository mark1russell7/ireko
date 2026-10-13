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
  overlapsOf(nodes, placed.container, clipRoot, issues);

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
function clipRoots(nodes: readonly PlacedNode[], container: readonly number[]): number[] {
  const out: number[] = nodes.map(() => -1);
  for (let i = 0; i < nodes.length; i++) {
    const c = at(container, i);
    if (c < 0) continue;
    out[i] = at(nodes, c).clip ? c : at(out, c);
  }
  return out;
}

/** This function tells if the node `a` holds the node `b` through a chain of nested containers. */
function holds(a: number, b: number, container: readonly number[]): boolean {
  for (let c = at(container, b); c >= 0; c = at(container, c)) if (c === a) return true;
  return false;
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
 * This function finds the overlapping pairs with a sweep over the x axis. It sorts the boxes by their left edge,
 * and it compares each box only with the boxes that are still open. The cost is O(n log n + k) for k candidate pairs.
 */
function overlapsOf(nodes: readonly PlacedNode[], container: readonly number[], clipRoot: readonly number[], issues: Issue[]): void {
  const rects = nodes.map((_, i) => visible(nodes, i, clipRoot));
  const order = rects
    .map((r, i) => ({ r, i }))
    .filter((e): e is { r: Rect; i: number } => e.r !== undefined)
    .toSorted((a, b) => a.r.x - b.r.x || a.i - b.i);
  let open: { r: Rect; i: number }[] = [];
  let count = 0;

  for (const cur of order) {
    open = open.filter((o) => o.r.x + o.r.width - TOLERANCE > cur.r.x);
    for (const o of open) {
      if (!overlaps(o.r, cur.r, TOLERANCE)) continue;
      if (holds(o.i, cur.i, container) || holds(cur.i, o.i, container)) continue;
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
