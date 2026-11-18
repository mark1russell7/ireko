/**
 * One separation pass of the relaxation (step 3), with a grid of cells.
 *
 * The pass has the same result as a test of each pair of boxes `i` and `j` with `i < j`. The order of the tests is the
 * order of `i` and then of `j`. A pair that is nearer than `margin` on both axes moves apart. The grid finds the boxes
 * near the box `i`, so the pass does not test each pair. For boxes that are apart, one pass uses approximately `n`
 * operations, not `n²`.
 *
 * The result is the same for these reasons:
 *
 * - A pair that does not overlap changes nothing. Thus a pass can ignore each pair that the grid does not give.
 * - Each box is in the cell of its center. The cell of a number does not decrease when the number increases.
 *   An overlap on the x axis means that the centers are nearer than half of the two widths plus `margin`.
 *   Thus the center of `j` is in a cell between the cell of the left limit and the cell of the right limit of `i`.
 *   The limits use the largest width of a box. The y axis is the same.
 * - The pass sorts the boxes that the grid gives, so the order of `j` is the same.
 * - When the box `i` moves to other cells, the pass asks the grid again, for the boxes after the last `j`.
 * - When the box `j` moves, it goes to its new cell.
 *
 * When a number is not finite, or is very large, the grid has one cell. That grid gives each box, so the pass
 * tests each pair.
 */
import { flag, int, num } from "./typed.ts";

/** Above this value, a move can make a number that is not finite, and the cell of such a number has no meaning. */
const LARGE = 1e150;

/**
 * This function makes the separation pass for the centers `xs` and `ys`, the sizes `ws` and `hs` and the fixed boxes.
 * The pass moves the centers. Its parameter tells if the pass can use the x axis. It gives `true` if a box moved.
 */
export function separation(xs: Float64Array, ys: Float64Array, ws: Float64Array, hs: Float64Array, fixed: Uint8Array, margin: number): (useX: boolean) => boolean {
  const count = xs.length;
  let maxW = 0, maxH = 0;
  for (let b = 0; b < count; b++) {
    maxW = Math.max(maxW, num(ws, b));
    maxH = Math.max(maxH, num(hs, b));
  }
  // A cell is as wide as the largest distance of two centers that overlap, or wider. Thus the limits of a box are in 3 cells at most.
  const reachX = maxW + margin, reachY = maxH + margin;
  /** The most cells on one axis. The grid has approximately 4 cells for each box at most. */
  const most = 2 * Math.floor(Math.sqrt(count)) + 1;
  /** The first box of the list of each cell, plus 1. The value 0 means an empty cell. */
  const head = new Int32Array(most * most);
  /** The next box and the box before in the list of a cell, plus 1, and the cell of each box. */
  const next = new Int32Array(count), before = new Int32Array(count), cellOf = new Int32Array(count);
  /** The boxes near the box `i`, in the order of their indexes. */
  const near = new Int32Array(count);
  let columns = 1, rows = 1, left = 0, top = 0, perX = 0, perY = 0;

  // A number that is not a number goes to the cell 0. A grid of one cell has only the cell 0.
  const column = (x: number): number => {
    const c = Math.floor((x - left) * perX);
    return c > 0 ? (c < columns ? c : columns - 1) : 0;
  };
  const row = (y: number): number => {
    const r = Math.floor((y - top) * perY);
    return r > 0 ? (r < rows ? r : rows - 1) : 0;
  };

  /** This function puts the box `b` at the start of the list of the cell of its center. */
  const link = (b: number): void => {
    const cell = row(num(ys, b)) * columns + column(num(xs, b));
    const old = int(head, cell);
    next[b] = old;
    before[b] = 0;
    if (old !== 0) before[old - 1] = b + 1;
    head[cell] = b + 1;
    cellOf[b] = cell;
  };

  /** This function moves the box `b` to the cell of its center, if that cell changed. */
  const move = (b: number): void => {
    const cell = int(cellOf, b);
    if (row(num(ys, b)) * columns + column(num(xs, b)) === cell) return;
    const after = int(next, b), prior = int(before, b);
    if (prior === 0) head[cell] = after;
    else next[prior - 1] = after;
    if (after !== 0) before[after - 1] = prior;
    link(b);
  };

  // The cells of the last `find`: the first and the last column, and the first and the last row.
  let c0 = 0, c1 = 0, r0 = 0, r1 = 0;

  /** This function writes into `near` the boxes after the box `last` that can overlap a box at (`x`, `y`). It gives their number. */
  const find = (last: number, x: number, y: number, rx: number, ry: number): number => {
    c0 = column(x - rx);
    c1 = column(x + rx);
    r0 = row(y - ry);
    r1 = row(y + ry);
    let found = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (let b = int(head, r * columns + c) - 1; b >= 0; b = int(next, b) - 1) {
          if (b <= last) continue;
          // The list stays in the order of the indexes. A list of a cell is in that order at the start of a pass, so few boxes move here.
          let at = found++;
          for (; at > 0 && int(near, at - 1) > b; at--) near[at] = int(near, at - 1);
          near[at] = b;
        }
      }
    }
    return found;
  };

  return (useX: boolean): boolean => {
    // The grid of this pass: the area of the centers, in cells.
    let right = -Infinity, bottom = -Infinity;
    left = Infinity;
    top = Infinity;
    for (let b = 0; b < count; b++) {
      const x = num(xs, b), y = num(ys, b);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    // A comparison with a number that is not a number is false, so such a number gives the grid of one cell.
    const usual = Math.max(Math.abs(left), Math.abs(right), Math.abs(top), Math.abs(bottom), reachX, reachY) <= LARGE && reachX > 0 && reachY > 0;
    if (usual) {
      const cellW = Math.max(reachX, (right - left) / most), cellH = Math.max(reachY, (bottom - top) / most);
      columns = Math.min(most, Math.floor((right - left) / cellW) + 1);
      rows = Math.min(most, Math.floor((bottom - top) / cellH) + 1);
      perX = 1 / cellW;
      perY = 1 / cellH;
    } else {
      columns = 1;
      rows = 1;
      left = 0;
      top = 0;
      perX = 0;
      perY = 0;
    }
    head.fill(0, 0, columns * rows);
    // The last box goes in first, so each list is in the order of the indexes.
    for (let b = count - 1; b >= 0; b--) link(b);

    let moved = false;
    for (let i = 0; i < count; i++) {
      const aw = num(ws, i), ah = num(hs, i);
      const aFree = !flag(fixed, i);
      const rx = (aw + maxW) / 2 + margin, ry = (ah + maxH) / 2 + margin;
      // The box `i` moves at each overlap, so its center is in two variables until the end of its pairs.
      let ax = num(xs, i), ay = num(ys, i);
      let found = find(i, ax, ay, rx, ry);
      for (let k = 0; k < found; k++) {
        const j = int(near, k);
        const bx = num(xs, j);
        const ox = (aw + num(ws, j)) / 2 + margin - Math.abs(ax - bx);
        if (ox <= 0) continue;
        const by = num(ys, j);
        const oy = (ah + num(hs, j)) / 2 + margin - Math.abs(ay - by);
        if (oy <= 0) continue;
        moved = true;
        const bFree = !flag(fixed, j);
        if (ox < oy && useX) {
          const push = (ox / 2 + 1) * (ax < bx ? -1 : 1);
          if (aFree) ax += push;
          if (bFree) xs[j] = bx - push;
        } else {
          const push = (oy / 2 + 1) * (ay < by ? -1 : 1);
          if (aFree) ay += push;
          if (bFree) ys[j] = by - push;
        }
        if (bFree) move(j);
        // Only the box `i` and the boxes before the next `j` moved. Thus the boxes after `j` in `near` stay correct while the box `i` has the same cells.
        if (aFree && (column(ax - rx) !== c0 || column(ax + rx) !== c1 || row(ay - ry) !== r0 || row(ay + ry) !== r1)) {
          found = find(j, ax, ay, rx, ry);
          k = -1;
        }
      }
      xs[i] = ax;
      ys[i] = ay;
    }
    return moved;
  };
}
