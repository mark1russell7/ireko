/**
 * The repulsion of the far boxes of the relaxation, with the method of Barnes and Hut.
 *
 * A tree divides the area of the centers into square cells. A cell with more than one box has 4 smaller cells.
 * A far cell repels a box as one box at the mean of its centers, with the sum of its repulsions.
 * Thus one force step uses about `n log n` operations for `n` boxes. The exact sum uses `n²` operations.
 *
 * A cell is far from a box when its width, divided by the distance from its middle to the box, is less than `theta`.
 * A box in a cell is nearer to the middle than the width of the cell. Thus, with a `theta` of 1 or less, a far cell
 * does not contain the box, and a box does not repel itself.
 *
 * The same centers give the same tree and the same sums.
 */
import { int, num } from "./typed.ts";

/** The deepest level of the tree. A cell at this level keeps each of its boxes in a list, so boxes at the same place do not make an endless tree. */
const DEPTH = 24;

/** The repulsion of the far boxes. */
export interface FarField {
  /** This function makes the tree from the centers of the boxes. */
  build(): void;
  /**
   * This function writes the repulsion on the box `i` at the point (`x`, `y`) into `out`: the x part, then the y part.
   * A near box repels from its center at the time of the read. A far cell repels from its mean at the time of `build`.
   */
  sum(i: number, x: number, y: number, out: Float64Array): void;
}

/**
 * This function makes the repulsion of the far boxes for the centers `xs` and `ys`.
 * `floor` is the square of the smallest distance, and `repulsion` is the strength between two boxes.
 */
export function farField(xs: Float64Array, ys: Float64Array, theta: number, floor: number, repulsion: number): FarField {
  const count = xs.length;
  const theta2 = theta * theta;
  // The cells. The cell 0 is the root. A list grows when the tree needs more cells.
  let room = 2 * count + 16;
  /** The 4 smaller cells of each cell: an index, or 0 for no cell. */
  let kids = new Int32Array(4 * room);
  /** The first box of the list of a cell with no smaller cells, plus 1. The value 0 means that the cell has smaller cells. */
  let first = new Int32Array(room);
  let mass = new Float64Array(room);
  /** The sum of the centers of a cell during `build`, then their mean. */
  let meanX = new Float64Array(room), meanY = new Float64Array(room);
  let midX = new Float64Array(room), midY = new Float64Array(room), half = new Float64Array(room);
  /** The next box in the list of a cell, plus 1. */
  const next = new Int32Array(count);
  // Each cell that `sum` opens puts 4 cells at most on the stack, and it takes 1 cell off.
  const stack = new Int32Array(3 * DEPTH + 8);
  let used = 0;

  const grow = (): void => {
    room *= 2;
    const wider = (list: Float64Array): Float64Array<ArrayBuffer> => {
      const out = new Float64Array(room);
      out.set(list);
      return out;
    };
    const kids2 = new Int32Array(4 * room), first2 = new Int32Array(room);
    kids2.set(kids);
    first2.set(first);
    kids = kids2;
    first = first2;
    mass = wider(mass);
    meanX = wider(meanX);
    meanY = wider(meanY);
    midX = wider(midX);
    midY = wider(midY);
    half = wider(half);
  };

  /** This function makes a cell with the one box `b`. */
  const cell = (b: number, x: number, y: number, h: number): number => {
    if (used === room) grow();
    const c = used++;
    midX[c] = x;
    midY[c] = y;
    half[c] = h;
    mass[c] = 1;
    meanX[c] = num(xs, b);
    meanY[c] = num(ys, b);
    first[c] = b + 1;
    next[b] = 0;
    kids.fill(0, 4 * c, 4 * c + 4);
    return c;
  };

  /** This function makes the smaller cell of the cell `k` that contains the box `b`, with the one box `b`. */
  const split = (k: number, b: number): void => {
    const h = num(half, k) / 2;
    const right = num(xs, b) >= num(midX, k), low = num(ys, b) >= num(midY, k);
    // `cell` can make a longer list of the cells, so the new cell is a value before the write into that list.
    const made = cell(b, num(midX, k) + (right ? h : -h), num(midY, k) + (low ? h : -h), h);
    kids[4 * k + (right ? 1 : 0) + (low ? 2 : 0)] = made;
  };

  const insert = (b: number): void => {
    const x = num(xs, b), y = num(ys, b);
    let k = 0;
    for (let depth = 0; ; depth++) {
      const list = int(first, k);
      mass[k] = num(mass, k) + 1;
      meanX[k] = num(meanX, k) + x;
      meanY[k] = num(meanY, k) + y;
      if (list !== 0) {
        // The cell has one box, or it is at the deepest level.
        if (depth >= DEPTH) {
          next[b] = list;
          first[k] = b + 1;
          return;
        }
        first[k] = 0;
        split(k, list - 1);
      }
      const to = int(kids, 4 * k + (x >= num(midX, k) ? 1 : 0) + (y >= num(midY, k) ? 2 : 0));
      if (to === 0) {
        split(k, b);
        return;
      }
      k = to;
    }
  };

  return {
    build(): void {
      used = 0;
      if (count === 0) return;
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (let b = 0; b < count; b++) {
        const x = num(xs, b), y = num(ys, b);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
      const side = Math.max(right - left, bottom - top);
      // The root is a square around the centers. It has the box 0, and each other box goes in.
      cell(0, (left + right) / 2, (top + bottom) / 2, side > 0 && side < Infinity ? side / 2 : 0.5);
      for (let b = 1; b < count; b++) insert(b);
      for (let k = 0; k < used; k++) {
        const m = num(mass, k);
        meanX[k] = num(meanX, k) / m;
        meanY[k] = num(meanY, k) / m;
      }
    },
    sum(i: number, x: number, y: number, out: Float64Array): void {
      let fx = 0, fy = 0, depth = 0;
      stack[depth++] = 0;
      while (depth > 0) {
        const k = int(stack, --depth);
        const list = int(first, k);
        if (list !== 0) {
          // Each box of the cell repels from its center.
          for (let b = list - 1; b >= 0; b = int(next, b) - 1) {
            if (b === i) continue;
            const dx = x - num(xs, b), dy = y - num(ys, b);
            const d2 = Math.max(floor, dx * dx + dy * dy);
            const pull = repulsion / (d2 * Math.sqrt(d2));
            fx += dx * pull;
            fy += dy * pull;
          }
          continue;
        }
        const width = 2 * num(half, k);
        const mx = x - num(midX, k), my = y - num(midY, k);
        if (width * width < theta2 * (mx * mx + my * my)) {
          // The cell is far: it repels as one box at the mean of its centers.
          const dx = x - num(meanX, k), dy = y - num(meanY, k);
          const d2 = Math.max(floor, dx * dx + dy * dy);
          const pull = (num(mass, k) * repulsion) / (d2 * Math.sqrt(d2));
          fx += dx * pull;
          fy += dy * pull;
          continue;
        }
        for (let q = 3; q >= 0; q--) {
          const to = int(kids, 4 * k + q);
          if (to !== 0) stack[depth++] = to;
        }
      }
      out[0] = fx;
      out[1] = fy;
    },
  };
}
