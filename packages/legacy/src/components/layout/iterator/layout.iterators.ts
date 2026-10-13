import { Shapes, Vector } from "../../core/geometry";
import { AnchorIteratorParams, Iterator, IteratorOps } from "./iterator.types";
import { LayoutChildrenMode, LayoutTypes } from "../layout.enum";
import { Config } from "../../config";
import { LayoutTuning, LayoutTuningConfig } from "../layout.tuning";

/** map unit [0,1]² → top-left rect (position + u * size). */
export const mapToRect = (u: Vector, r: Shapes.Rectangle): Vector =>
  r.getPosition().add(u.multiply(r.getSize()));

/** correct grid centers: ((col+.5)/cols, (row+.5)/rows) */
export const gridUnit = (i: number, n: number, rowCol: Vector): Vector => {
  const coordinates = rowCol.clamp(1, Infinity);
  const cell = new Vector(i % coordinates.x, Math.floor(i / coordinates.x));
  return cell.add(Vector.scalar(1 / 2)).divide(coordinates);
};

export type IteratorsSet = {
  [LayoutTypes.Grid]: Iterator;
  [LayoutTypes.Radial]: Iterator;
};

export const buildIterators = (tuning: Config<LayoutTuning> = LayoutTuningConfig): IteratorsSet => {
  const opsGrid: IteratorOps = {
    unit: gridUnit,
    mapToRect,
    anchor: ({ mode, parentSize, spacing }) =>
      mode === LayoutChildrenMode.GRAPH
        ? tuning.get("anchor")({ mode, parentSize, spacing })
        : new Vector(0, 0),
  };

  const opsRadial: IteratorOps = {
    anchor: ({ mode, parentSize, spacing }: AnchorIteratorParams) =>
      mode === LayoutChildrenMode.GRAPH ? tuning.get("anchor")({ mode, parentSize, spacing }) : new Vector(0, 0),
    angle: (i: number, n: number): number => {
      const start = tuning.get("startAngle")();
      const cw = tuning.get("clockwise")();
      return tuning.get("angleOf")(i, n, start, cw);
    },
  };

  return {
    grid: new Iterator(opsGrid),
    radial: new Iterator(opsRadial),
  };
};
