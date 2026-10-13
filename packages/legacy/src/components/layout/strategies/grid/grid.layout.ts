import { Vector, Shapes } from "../../../core/geometry";
import {
  Layout, NestedFrameParam, PlaceChildrenReturn, PreferredSizeParam,
  NestedFramesReturn, PreferredSizeReturn, PlaceChildrenParam, PlaceChildrenExReturn, AuditParentParam
} from "../../layout";
import { LayoutChildrenMode, LayoutTypes } from "../../layout.enum";
import { MappedGrid, MappedGridItemData } from "./grid.mapped";
import { GridItem } from "./grid";
import { Config } from "../../../config";
import { LayoutTuning, LayoutTuningConfig } from "../../layout.tuning";
import { mapIndexBounded, sliceBound } from "../../../iteration/iterate";
import { IterationLimits } from "../../limits";
import { createDefaultIteratorRegistry, IteratorRegistry } from "../../iterator/iterator.registry";
import { AuditIssue } from "../../../tooling/diagnostics/audit";

/* ===== utilities ===== */
export type SplitEvenReturn = { sizes: number[]; offs: number[] };
export const splitEven = (total: number, parts: number): SplitEvenReturn => {
  const base = Math.floor(total / parts);
  const rem = total - base * parts;
  const sizes = Array.from({ length: parts }, (_ , i) => base + (i < rem ? 1 : 0));
  const offs: number[] = new Array(parts);
  let acc = 0;
  for (let i = 0; i < parts; i++) { offs[i] = acc; acc += sizes[i]; }
  return { sizes, offs };
};

export class GridLayout extends Layout {
  constructor(
    private tuning: Config<LayoutTuning> = LayoutTuningConfig,
    private limits: Config<IterationLimits>,
    private iters: IteratorRegistry = createDefaultIteratorRegistry(LayoutTuningConfig)
  ) { 
    super(); 
    
  }

  /* ---------- frames (grid cell mapping inside padded content) ---------- */
  nestedFrames = ({ children, parentSize, spacing }: NestedFrameParam): NestedFramesReturn => {
    const maxPer = this.limits.get("maxChildrenPerNode");
    const policy = this.limits.get("onLimit");
    const safeChildren = sliceBound(children, maxPer, policy);

    const gridSize: Vector = this.tuning.get("rowCol")(safeChildren.length);
    const ip: number = this.tuning.get("itemPad")(spacing);
    const pad: number = this.tuning.get("outerPad")(spacing);
    const content: Vector = parentSize.round().clamp(1, Infinity).subtract(Vector.scalar(2 * pad));
    const contentTopLeft = Vector.scalar(pad);

    const X = splitEven(content.x, gridSize.x);
    const Y = splitEven(content.y, gridSize.y);

    const grid: MappedGrid = MappedGrid.emptyMapped<MappedGridItemData>(gridSize, () => ({ id: "" }));

    for (let i = 0; i < safeChildren.length; i++) {
      const cell = new Vector(i % gridSize.x, Math.floor(i / gridSize.x));
      const position = contentTopLeft.add(new Vector(X.offs[cell.x], Y.offs[cell.y]));
      const size = new Vector(X.sizes[cell.x], Y.sizes[cell.y]);
      grid.set(cell, new GridItem<MappedGridItemData>(cell, new Shapes.Rectangle(size, position), { id: safeChildren[i].id }));
    }

    return { ip, content, grid };
  };

  /* ---------- extended placement (strategies own child sizes) ---------- */
  placeChildrenEx = (args: PlaceChildrenParam & { childModes: Record<string, LayoutChildrenMode> }): PlaceChildrenExReturn => {
    const { children, nodeSize, spacing, origin, parentSize, mode, level, childModes } = args;
    const maxPer = this.limits.get("maxChildrenPerNode");
    const policy = this.limits.get("onLimit");
    const safeChildren = sliceBound(children, maxPer, policy);

    const rowCol: Vector = this.tuning.get("rowCol")(safeChildren.length);
    const ip: number = this.tuning.get("itemPad")(spacing);
    const anchor: Vector = this.iters.get(LayoutTypes.Grid).anchorOffset({ mode, parentSize, spacing });

    if (mode === LayoutChildrenMode.GRAPH) {
      const cell = nodeSize.add(Vector.scalar(2 * ip));
      const total = rowCol.multiply(cell);
      const topLeft = origin.add(anchor).subtract(total.halve());
      const centers: Record<string, Vector> = Object.fromEntries(
        mapIndexBounded(safeChildren.length, safeChildren.length, "truncate", (i: number) => [
          safeChildren[i].id,
          topLeft
            .add(cell.multiply(new Vector(i % rowCol.x, Math.floor(i / rowCol.x))))
            .add(cell.halve())
            .round(),
        ])
      );
      return { centers }; // no forced sizes in GRAPH mode
    }

    // NESTED mode: centers in local space + per-child forced square
    const pad = this.tuning.get("outerPad")(spacing);
    const rect = new Shapes.Rectangle(
      parentSize.subtract(Vector.scalar(2 * pad)),
      new Vector(pad, pad)
    );
    const centersArray = this.iters.get(LayoutTypes.Grid).centersInRect(safeChildren.length, rowCol, rect);

    // compute square side per cell
    const innerCell = rect.getSize().divide(rowCol).subtract(Vector.scalar(2 * ip)).clamp(1, Infinity);
    const baseSide = Math.max(8, Math.floor(Math.min(innerCell.x, innerCell.y)));

    const sizes: Record<string, Vector> = {};
    for (let i = 0; i < safeChildren.length; i++) {
      const ch = safeChildren[i];
      const m = childModes[ch.id] ?? LayoutChildrenMode.GRAPH;
      const k = (m === LayoutChildrenMode.NESTED) ? this.tuning.get("nestedContainerScale")(level + 1) : 1;
      sizes[ch.id] = Vector.scalar(Math.floor(baseSide * k));
    }
    const centers: Record<string, Vector> = Object.fromEntries(safeChildren.map((c, i) => [c.id, centersArray[i]]));
    return { centers, sizes };
  };

  /* ---------- legacy centers (kept for back-compat) ---------- */
  placeChildren = (args: PlaceChildrenParam): PlaceChildrenReturn => {
    const { children, nodeSize, spacing, origin, parentSize, mode } = args;
    const maxPer = this.limits.get("maxChildrenPerNode");
    const policy = this.limits.get("onLimit");
    const safeChildren = sliceBound(children, maxPer, policy);

    const rowCol: Vector = this.tuning.get("rowCol")(safeChildren.length);
    const ip: number = this.tuning.get("itemPad")(spacing);
    const anchor: Vector = this.iters.get(LayoutTypes.Grid).anchorOffset({ mode, parentSize, spacing });

    switch (mode) {
      case LayoutChildrenMode.GRAPH: {
        const cell = nodeSize.add(Vector.scalar(2 * ip));
        const total = rowCol.multiply(cell);
        const topLeft = origin.add(anchor).subtract(total.halve());
        return Object.fromEntries(
          mapIndexBounded(
            safeChildren.length,
            safeChildren.length,
            "truncate",
            (i: number) => [
              safeChildren[i].id,
              topLeft
                .add(cell.multiply(new Vector(i % rowCol.x, Math.floor(i / rowCol.x))))
                .add(cell.halve())
                .round(),
            ]
          )
        );
      }
      case LayoutChildrenMode.NESTED: {
        const pad = this.tuning.get("outerPad")(spacing);
        const rect = new Shapes.Rectangle(
          parentSize.subtract(Vector.scalar(2 * pad)),
          new Vector(pad, pad)
        );
        const centers = this.iters.get(LayoutTypes.Grid).centersInRect(safeChildren.length, rowCol, rect);
        return Object.fromEntries(safeChildren.map((c, i) => [c.id, centers[i]]));
      }
    }
  };

  preferredSize = ({ count, nodeSize, spacing }: PreferredSizeParam): PreferredSizeReturn => {
    const rowCol: Vector = this.tuning.get("rowCol")(count);
    const ip: number = this.tuning.get("itemPad")(spacing);
    const pad: number = this.tuning.get("outerPad")(spacing);
    const cell: Vector = nodeSize.add(Vector.scalar(2 * ip));
    const inner: Vector = rowCol.multiply(cell);
    return inner.add(Vector.scalar(2 * pad));
  };
  auditParent = ({ parentId, childIds, snapshot, spacing, tuning }: AuditParentParam) => {
    const issues : AuditIssue[] = [];
    const p = snapshot.boxes[parentId];
    if (!p) return issues;

    const pad = tuning.get("outerPad")(spacing);
    const inner = p.size.subtract(Vector.scalar(2 * pad));
    const rowCol = tuning.get("rowCol")(childIds.length);
    const ip = tuning.get("itemPad")(spacing);

    // The per-cell usable area the strategy tries to honor
    const innerCell = inner.divide(rowCol).subtract(Vector.scalar(2 * ip)).clamp(1, Infinity);

    for (const cid of childIds) {
      const c = snapshot.boxes[cid];
      if (!c) continue;
      if (c.size.x > innerCell.x + 0.5 || c.size.y > innerCell.y + 0.5) {
        issues.push({
          code: "GRID_CHILD_TOO_BIG_FOR_CELL",
          severity: "warn",
          parentId,
          childId: cid,
          detail: { cell: { x: innerCell.x, y: innerCell.y }, child: { x: c.size.x, y: c.size.y } },
        });
      }
    }
    return issues;
  };

}
