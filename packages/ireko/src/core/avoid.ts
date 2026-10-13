/**
 * The router `avoid`: horizontal and vertical segments that go around the other boxes.
 * It makes a sparse grid from the edges of the obstacles, and an A* search finds the shortest route with few bends.
 * Each box grows by a margin, so a route keeps a distance from each box. Without a route, it gives the orthogonal route.
 */
import { at } from "./at.ts";
import { centerOf, type Point, type Rect } from "./geometry.ts";
import { defineRouter, nestedPair, type Router } from "./router.ts";
import { orthogonal } from "./routers.ts";
import type { Direction } from "./strategy.ts";

/** The distance between a route and a box, in pixels. */
const MARGIN = 10;
/** The cost of one bend, in pixels of length. A route with fewer bends is better, also when it is a little longer. */
const BEND = 40;
/** A value smaller than each distance of a layout. */
const EPSILON = 1e-6;

type Side = "top" | "bottom" | "left" | "right";
const SIDES: readonly Side[] = ["bottom", "right", "top", "left"];
const OUT: Readonly<Record<Side, Point>> = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
/** The side of the parent where a tree edge starts, and the side of the child where it ends. */
const FROM: Readonly<Record<Direction, Side>> = { down: "bottom", up: "top", left: "left", right: "right" };
const INTO: Readonly<Record<Direction, Side>> = { down: "top", up: "bottom", left: "right", right: "left" };

/** The router `avoid`. */
export const avoid: Router = defineRouter({
  type: "avoid",
  description: "The avoid router draws horizontal and vertical segments that go around the other boxes.",
  obstacles: true,
  route(input) {
    const { source, target, direction } = input;
    if (nestedPair(source, target)) return [centerOf(source), centerOf(target)];
    const boxes = [...(input.obstacles ?? []), source, target].map((r) => grow(r, MARGIN));
    const found = search(source, target, boxes, direction);
    return found ?? orthogonal.route(input);
  },
});

/** This function gives a rectangle that is larger by `m` on each side. */
function grow(r: Rect, m: number): Rect {
  return { x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m };
}

/** This function gives the middle of a side of a box. */
function portOf(r: Rect, side: Side): Point {
  const c = centerOf(r);
  return { x: c.x + (OUT[side].x * r.width) / 2, y: c.y + (OUT[side].y * r.height) / 2 };
}

/** This function gives the point at the margin outside the middle of a side. The search starts and ends there. */
function stubOf(r: Rect, side: Side): Point {
  const p = portOf(r, side);
  return { x: p.x + OUT[side].x * MARGIN, y: p.y + OUT[side].y * MARGIN };
}

/** This function gives the index of a value in a sorted axis: the index of the nearest value. */
function find(sorted: readonly number[], v: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at(sorted, mid) < v - EPSILON) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** This function gives the sorted values without duplicates. */
function axis(values: readonly number[]): number[] {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted.filter((v, i) => i === 0 || v - at(sorted, i - 1) > EPSILON);
}

/**
 * This function searches the grid. A state is a point and the axis of the last segment (0 for x, 1 for y).
 * The cost of a step is its length, plus `BEND` when the axis changes.
 */
function search(source: Rect, target: Rect, boxes: readonly Rect[], direction: Direction | undefined): Point[] | undefined {
  const toward = { x: centerOf(target).x - centerOf(source).x, y: centerOf(target).y - centerOf(source).y };
  const starts = (direction === undefined ? SIDES : [FROM[direction]]).map((side) => ({ side, stub: stubOf(source, side) }));
  const ends = (direction === undefined ? SIDES : [INTO[direction]]).map((side) => ({ side, stub: stubOf(target, side) }));
  const all = [...starts, ...ends].map((e) => e.stub);

  // The grid lines: the edges of each box, the stubs and a frame around everything.
  const left = Math.min(...boxes.map((b) => b.x), ...all.map((p) => p.x)) - MARGIN;
  const right = Math.max(...boxes.map((b) => b.x + b.width), ...all.map((p) => p.x)) + MARGIN;
  const top = Math.min(...boxes.map((b) => b.y), ...all.map((p) => p.y)) - MARGIN;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height), ...all.map((p) => p.y)) + MARGIN;
  const xs = axis([left, right, ...boxes.flatMap((b) => [b.x, b.x + b.width]), ...all.map((p) => p.x)]);
  const ys = axis([top, bottom, ...boxes.flatMap((b) => [b.y, b.y + b.height]), ...all.map((p) => p.y)]);
  const w = xs.length;
  const h = ys.length;
  // Each edge of a box is a grid line, so a box covers a range of indexes on each axis. The search then tests one
  // array item for each point and each step, not each box.
  const free = new Uint8Array(w * h).fill(1);
  const openX = new Uint8Array(w * h).fill(1);
  const openY = new Uint8Array(w * h).fill(1);
  for (const b of boxes) {
    const x0 = find(xs, b.x);
    const x1 = find(xs, b.x + b.width);
    const y0 = find(ys, b.y);
    const y1 = find(ys, b.y + b.height);
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const k = j * w + i;
        // A point strictly inside the box is not free.
        if (i > x0 && i < x1 && j > y0 && j < y1) free[k] = 0;
        // A step from (i, j) to (i + 1, j) is closed when its middle is inside the box. The same for (i, j + 1).
        if (i < x1 && j > y0 && j < y1) openX[k] = 0;
        if (j < y1 && i > x0 && i < x1) openY[k] = 0;
      }
    }
  }
  // A step between two neighbor grid points is open when its middle is outside each box.
  const open = (i: number, j: number, di: number, dj: number): boolean => {
    const k = j + dj;
    const l = i + di;
    if (l < 0 || l >= w || k < 0 || k >= h || at(free, k * w + l) === 0) return false;
    if (di !== 0) return at(openX, j * w + Math.min(i, l)) === 1;
    return at(openY, Math.min(j, k) * w + i) === 1;
  };
  const indexOf = (p: Point): number => {
    const i = xs.findIndex((x) => Math.abs(x - p.x) <= EPSILON);
    const j = ys.findIndex((y) => Math.abs(y - p.y) <= EPSILON);
    return i < 0 || j < 0 ? -1 : j * w + i;
  };

  // The goals: the stubs of the target, with the axis of the last segment into the target.
  const goals = new Map<number, { side: Side; axis: number }>();
  for (const e of ends) {
    const g = indexOf(e.stub);
    if (g >= 0 && at(free, g) === 1) goals.set(g, { side: e.side, axis: e.side === "top" || e.side === "bottom" ? 1 : 0 });
  }
  if (goals.size === 0) return undefined;
  const goalPoints = [...goals.keys()].map((g) => ({ x: at(xs, g % w), y: at(ys, Math.floor(g / w)) }));
  const estimate = (i: number, j: number): number => Math.min(...goalPoints.map((g) => Math.abs(g.x - at(xs, i)) + Math.abs(g.y - at(ys, j))));

  const size = w * ys.length * 2;
  const cost = new Float64Array(size).fill(Infinity);
  const back = new Int32Array(size).fill(-1);
  const heap = new Heap();
  for (const s of starts) {
    const g = indexOf(s.stub);
    if (g < 0 || at(free, g) === 0) continue;
    const first = s.side === "top" || s.side === "bottom" ? 1 : 0;
    // A side that faces away from the target costs one bend more.
    const away = OUT[s.side].x * toward.x + OUT[s.side].y * toward.y < 0 ? BEND : 0;
    const state = g * 2 + first;
    if (away < at(cost, state)) {
      cost[state] = away;
      heap.push(state, away + estimate(g % w, Math.floor(g / w)));
    }
  }

  let best = -1;
  let bestCost = Infinity;
  for (let state = heap.pop(); state >= 0; state = heap.pop()) {
    const c = at(cost, state);
    if (c >= bestCost) break;
    const g = state >> 1;
    const last = state & 1;
    const goal = goals.get(g);
    if (goal !== undefined) {
      const total = c + (goal.axis === last ? 0 : BEND);
      if (total < bestCost) {
        bestCost = total;
        best = state;
      }
    }
    const i = g % w;
    const j = Math.floor(g / w);
    for (const [di, dj, ax] of STEPS) {
      if (!open(i, j, di, dj)) continue;
      const next = (j + dj) * w + (i + di);
      const length = Math.abs(at(xs, i + di) - at(xs, i)) + Math.abs(at(ys, j + dj) - at(ys, j));
      const nc = c + length + (ax === last ? 0 : BEND);
      const ns = next * 2 + ax;
      if (nc < at(cost, ns)) {
        cost[ns] = nc;
        back[ns] = state;
        heap.push(ns, nc + estimate(i + di, j + dj));
      }
    }
  }
  if (best < 0) return undefined;

  // The route: from the port of the source, through the grid, to the port of the target.
  const path: Point[] = [];
  for (let state = best; state >= 0; state = at(back, state)) {
    const g = state >> 1;
    path.push({ x: at(xs, g % w), y: at(ys, Math.floor(g / w)) });
  }
  path.reverse();
  const begin = at(path, 0);
  const start = starts.find((e) => Math.abs(e.stub.x - begin.x) <= EPSILON && Math.abs(e.stub.y - begin.y) <= EPSILON);
  const end = goals.get(best >> 1);
  if (start === undefined || end === undefined) return undefined;
  return simplify([portOf(source, start.side), ...path, portOf(target, end.side)]);
}

/** The steps of the search: the change of the column, the change of the row, and the axis. */
const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 1],
  [0, -1, 1],
];

/** This function removes the points in the middle of a straight line. */
function simplify(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    if (b !== undefined && Math.abs(b.x - p.x) <= EPSILON && Math.abs(b.y - p.y) <= EPSILON) continue;
    if (a !== undefined && b !== undefined && ((Math.abs(a.x - b.x) <= EPSILON && Math.abs(b.x - p.x) <= EPSILON) || (Math.abs(a.y - b.y) <= EPSILON && Math.abs(b.y - p.y) <= EPSILON))) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

/** A binary heap of states, by priority. */
class Heap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (at(this.keys, p) <= at(this.keys, i)) break;
      this.swap(i, p);
      i = p;
    }
  }

  /** This function gives the item with the smallest priority, or -1 for an empty heap. */
  pop(): number {
    if (this.items.length === 0) return -1;
    const top = at(this.items, 0);
    const lastItem = this.items.pop() ?? -1;
    const lastKey = this.keys.pop() ?? 0;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && at(this.keys, l) < at(this.keys, m)) m = l;
        if (r < this.items.length && at(this.keys, r) < at(this.keys, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const item = at(this.items, a);
    const key = at(this.keys, a);
    this.items[a] = at(this.items, b);
    this.keys[a] = at(this.keys, b);
    this.items[b] = item;
    this.keys[b] = key;
  }
}
