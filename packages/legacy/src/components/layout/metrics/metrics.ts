import { Shapes } from "../../core/geometry/shapes";
import { Vector } from "../../core/geometry/vectors";
import type { Box, Wire, LayoutStats, LayoutSnapshot } from "../types";

export type Bounds = { position: Vector; size: Vector };

export function boundsOf(boxes: Iterable<Box>): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  for (const b of boxes) {
    any = true;
    minX = Math.min(minX, b.position.x);
    minY = Math.min(minY, b.position.y);
    maxX = Math.max(maxX, b.position.x + b.size.x);
    maxY = Math.max(maxY, b.position.y + b.size.y);
  }
  if (!any) return { position: new Vector(0, 0), size: new Vector(0, 0) };
  return { position: new Vector(minX, minY), size: new Vector(maxX - minX, maxY - minY) };
}

export function overlapsOf(boxes : readonly Box[]) : Array<[string, string]> 
{
  const out : Array<[string, string]> = [];
  for (let i : number = 0; i < boxes.length; i++) 
  {
    const A : Box = boxes[i];
    const a2 : Vector = A.position.add(A.size);
    for (let j : number = i + 1; j < boxes.length; j++) 
    {
      const B : Box = boxes[j];
      const b2 : Vector = B.position.add(B.size);

      const a2Bound : Vector = a2.subtract(B.position);
      const b2Bound : Vector = b2.subtract(A.position);

      const separated : boolean = a2Bound.anyNonPositive() || b2Bound.anyNonPositive();
      if (!separated) 
      {
        out.push([A.id, B.id]);
      }
    }
  }
  return out;
}

// src/components/layout/metrics/metrics.ts
export function overlapsOfFast(boxes : readonly Box[], cellSize : number = 128) : Array<[string, string]> 
{
  const grid : Map<string, string[]> = new Map<string, string[]>();
  const key = (x: number, y: number) => `${x}|${y}`;
  const visit = (b: Box, cb: (otherId: string) => void) => 
  {
    const p1 : Vector = b.position.divide(Vector.scalar(cellSize)).floor();
    const p2 : Vector = b.position.add(b.size).divide(Vector.scalar(cellSize)).floor();
    const hit : Set<string> = new Set<string>();

    p1.traverseGridTo(p2, (p) => 
    {
      const k = key(p.x, p.y);
      const ids = grid.get(k) ?? [];
      for (const id of ids) 
      {
        if (!hit.has(id)) 
        {
          cb(id);
          hit.add(id);
        }
      }
    });
  };
  const out: Array<[string, string]> = [];
  for (const b of boxes) 
  {
    visit(
            b, 
            (id) => 
                    {
                      const A = b;
                      const B = boxes.find(x => x.id === id)!;

                      const aBound = A.position.add(A.size).subtract(B.position);
                      const bBound = B.position.add(B.size).subtract(A.position);
                      const sep = aBound.anyNonPositive() || bBound.anyNonPositive();

                      if (!sep) 
                      {
                        out.push([A.id, B.id]);
                      }
                    }
          );
    const p1 = b.position.divide(Vector.scalar(cellSize)).floor();
    const p2 = b.position.subtract(b.size).divide(Vector.scalar(cellSize)).floor();
    p1.traverseGridTo(p2, (p) => {
      const k = key(p.x, p.y);
      const arr = grid.get(k) ?? [];
      arr.push(b.id);
      grid.set(k, arr);
    });
  }
  return out;
}


export function maxDepthOf(boxes: Iterable<Box>): number {
  let md = 0;
  for (const b of boxes) if (b.depth > md) md = b.depth;
  return md;
}

export function edgeLengthStats(wires: readonly Wire[], boxes: Readonly<Record<string, Box>>): { total: number; mean: number; min: number; max: number } {
  let total = 0, min = Infinity, max = -Infinity, count = 0;
  for (const w of wires) {
    let length = 0;
    if (w.polyline && w.polyline.length >= 2) {
      for (let i = 1; i < w.polyline.length; i++) {
        const a = w.polyline[i - 1], b = w.polyline[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        length += Math.hypot(dx, dy);
      }
    } else {
      const a = boxes[w.source], b = boxes[w.target];
      if (!a || !b) continue;
      const ac = a.position.add(a.size.halve()), bc = b.position.add(b.size.halve());
      length = Math.hypot(bc.x - ac.x, bc.y - ac.y);
    }
    total += length; min = Math.min(min, length); max = Math.max(max, length); count++;
  }
  return { total, mean: count ? total / count : 0, min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 0 };
}

/** Compute the built-in LayoutStats (bounds/overlaps/maxDepth/counts). */
export function statsOfSnapshot(s: Pick<LayoutSnapshot, "boxes" | "wires">, opts: { collectOverlaps?: boolean } = {}): LayoutStats {
  const arr = Object.values(s.boxes);
  const bounds = boundsOf(arr);
  const overlaps = opts.collectOverlaps ? overlapsOfFast(arr) : undefined;
  const maxDepth = maxDepthOf(arr);
  return {   
    nodeCount: arr.length,
    edgeCount: s.wires.length,
    maxDepth,
    bounds,
    overlaps,
  };
}
