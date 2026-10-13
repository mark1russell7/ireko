/**
 * The interpolation between two layouts. The renderers use it to animate a change: each box moves from its old place
 * to its new place. The identifiers match the boxes of the two layouts. A new box grows from the place of its parent,
 * and a removed box fades out. This module does not use the DOM.
 */
import { at } from "../core/at.ts";
import { unionAll, type Point, type Rect } from "../core/geometry.ts";
import type { Layout, PlacedEdge, PlacedNode } from "../core/model.ts";

/** A box of one frame of an animation. */
export interface FrameNode extends PlacedNode {
  /** The opacity: 1 for a box that stays, from 0 to 1 for a new box, from 1 to 0 for a removed box. */
  readonly opacity: number;
}

/** An edge of one frame of an animation. */
export interface FrameEdge extends PlacedEdge {
  readonly opacity: number;
}

/** One frame: what a renderer draws. */
export interface Frame {
  readonly nodes: readonly FrameNode[];
  readonly edges: readonly FrameEdge[];
  readonly bounds: Rect;
}

/** This function gives the frame of a layout without an animation. */
export function frameOf(layout: Layout): Frame {
  return {
    nodes: layout.nodes.map((n) => ({ ...n, opacity: 1 })),
    edges: layout.edges.map((e) => ({ ...e, opacity: 1 })),
    bounds: layout.bounds,
  };
}

/** The easing of the animations: slow at the start and at the end. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * This function gives the frame at the time `t` (from 0 to 1) of the change from `from` to `to`.
 * At `t = 1`, the frame is the frame of `to`.
 */
export function interpolate(from: Frame, to: Layout, t: number): Frame {
  if (t >= 1) return frameOf(to);
  const old = new Map(from.nodes.map((n) => [n.id, n]));
  const next = new Map(to.nodes.map((n) => [n.id, n]));
  const nodes: FrameNode[] = to.nodes.map((n) => {
    const a = old.get(n.id) ?? seedOf(n, old, next);
    return {
      ...n,
      x: mix(a.x, n.x, t),
      y: mix(a.y, n.y, t),
      width: mix(a.width, n.width, t),
      height: mix(a.height, n.height, t),
      scale: mix(a.scale, n.scale, t),
      opacity: old.has(n.id) ? mix(a.opacity, 1, t) : t,
    };
  });
  for (const n of from.nodes) if (!next.has(n.id)) nodes.push({ ...n, opacity: n.opacity * (1 - t) });

  const oldEdges = new Map(from.edges.map((e) => [e.id, e]));
  const nextEdges = new Set(to.edges.map((e) => e.id));
  const edges: FrameEdge[] = to.edges.map((e) => {
    const a = oldEdges.get(e.id);
    return a === undefined ? { ...e, opacity: t } : { ...e, points: morph(a.points, e.points, t), opacity: mix(a.opacity, 1, t) };
  });
  for (const e of from.edges) if (!nextEdges.has(e.id)) edges.push({ ...e, opacity: e.opacity * (1 - t) });

  return { nodes, edges, bounds: unionAll([...nodes, from.bounds, to.bounds]) };
}

/** A new box starts as a point at the center of the old box of its parent, or of its new parent. */
function seedOf(n: PlacedNode, old: ReadonlyMap<string, FrameNode>, next: ReadonlyMap<string, PlacedNode>): FrameNode {
  const parent = n.parent === undefined ? undefined : (old.get(n.parent) ?? next.get(n.parent));
  const center = parent === undefined ? { x: n.x + n.width / 2, y: n.y + n.height / 2 } : { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 };
  return { ...n, x: center.x, y: center.y, width: 0, height: 0, opacity: 0 };
}

/** This function moves the points of one polyline to the points of another. The two lines get the same number of points first. */
export function morph(a: readonly Point[], b: readonly Point[], t: number): Point[] {
  const count = Math.max(a.length, b.length);
  const pa = resample(a, count);
  const pb = resample(b, count);
  return pa.map((p, i) => {
    const q = at(pb, i);
    return { x: mix(p.x, q.x, t), y: mix(p.y, q.y, t) };
  });
}

/** This function gives `count` points along a polyline, at equal distances along its length. */
export function resample(points: readonly Point[], count: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === count) return [...points];
  if (points.length === 1) return Array.from({ length: count }, () => at(points, 0));
  // The distance along the line to each point.
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(at(lengths, i - 1) + Math.hypot(at(points, i).x - at(points, i - 1).x, at(points, i).y - at(points, i - 1).y));
  const total = at(lengths, lengths.length - 1);
  const out: Point[] = [];
  for (let k = 0; k < count; k++) {
    const target = count === 1 ? 0 : (total * k) / (count - 1);
    let i = 1;
    while (i < points.length - 1 && at(lengths, i) < target) i++;
    const p = at(points, i - 1);
    const q = at(points, i);
    const span = at(lengths, i) - at(lengths, i - 1);
    const u = span === 0 ? 0 : (target - at(lengths, i - 1)) / span;
    out.push({ x: mix(p.x, q.x, u), y: mix(p.y, q.y, u) });
  }
  return out;
}
