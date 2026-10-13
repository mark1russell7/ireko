import { 
  Vector 
} from "../../../core/geometry";
import {
  type PreferredSizeParam,
  type AuditParentParam,
  type PreferredSizeReturn, 
  Layout, 
  type PlaceChildrenReturn, 
  type PlaceChildrenParam,
  type NestedFramesReturn, 
  type PlaceChildrenExReturn
} from "../../layout";
import { LayoutChildrenMode } from "../../layout.enum";
import { MappedGrid } from "../grid/grid.mapped";
import { Config } from "../../../config";
import { LayoutTuning } from "../../layout.tuning";
import { IterationLimits } from "../../limits";
import { mapIndexBounded } from "../../../iteration/iterate";
import { type AuditIssue } from "../../../tooling/diagnostics/audit";

/** geometry helper for nested-radial child square side */
function radialChildSquareSide(tuning: Config<LayoutTuning>, n: number, parentSize: Vector, spacing: number): number {
  const pad = tuning.get("outerPad")(spacing);
  const g   = tuning.get("itemPad")(spacing);
  const R   = Math.max(1, Math.min(parentSize.x, parentSize.y) / 2 - pad);
  const sin = Math.sin(Math.PI / Math.max(1, n));
  const denom = 1 + sin;
  const sBound = (2 * R * sin - g * (1 + sin)) / Math.max(denom, 1e-6);
  const f = tuning.get("nestedChildMaxFraction")();
  const sMax = Math.min(sBound, 2 * R * f);
  return Math.floor(Math.max(8, sMax));
}

export class RadialLayout extends Layout {
  constructor(
    private tuning: Config<LayoutTuning>,
    private limits: Config<IterationLimits>
  ) { super(); }

  nestedFrames = (): NestedFramesReturn => ({
    ip: 0,
    content: new Vector(0, 0),
    grid: MappedGrid.emptyMapped(new Vector(0, 0), () => ({ id: "" })),
  });

  /* ---------- extended placement (owns child sizing for NESTED) ---------- */
  placeChildrenEx = (args: PlaceChildrenParam & { childModes: Record<string, LayoutChildrenMode> }): PlaceChildrenExReturn => {
    const { children, origin, nodeSize, spacing, level, parentSize, mode, childModes } = args;
    const maxPer = this.limits.get("maxChildrenPerNode");
    const policy = this.limits.get("onLimit");
    const safeChildren = mapIndexBounded(children.length, maxPer, policy, (i) => children[i]);

    if (mode === LayoutChildrenMode.GRAPH) {
      // Absolute ring around origin+anchor
      const base = this.tuning.get("radialBase")(nodeSize, spacing);
      const r = Math.max(this.tuning.get("minRadius")(), base * (1 + level * this.tuning.get("radialLevelScale")()));
      const a = this.tuning.get("anchor")({ mode: LayoutChildrenMode.GRAPH, parentSize, spacing });
      const c = origin.add(a);

      const start = this.tuning.get("startAngle")();
      const cw = this.tuning.get("clockwise")();

      const centers: Record<string, Vector> = {};
      for (let i = 0; i < safeChildren.length; i++) {
        const ang = this.tuning.get("angleOf")(i, safeChildren.length, start, cw);
        centers[safeChildren[i].id] = Vector.scalar(ang).trig().scale(r).add(c).round();
      }
      return { centers };
    }

    // NESTED: local centers inside parent’s inner rect with pad offset
    const padOuter = this.tuning.get("outerPad")(spacing);
    const inner = parentSize.round().subtract(Vector.scalar(2 * padOuter)).clamp(1, Infinity);
    const R = inner.min() / 2;
    const g = this.tuning.get("itemPad")(spacing);

    const sBase = radialChildSquareSide(this.tuning, safeChildren.length, parentSize, spacing);

    // sizes per child (scale down if the child is also a nested container)
    const sizes: Record<string, Vector> = {};
    for (const ch of safeChildren) {
      const m = childModes[ch.id] ?? LayoutChildrenMode.GRAPH;
      const k = (m === LayoutChildrenMode.NESTED) ? this.tuning.get("nestedContainerScale")(level + 1) : 1;
      sizes[ch.id] = Vector.scalar(Math.floor(sBase * k));
    }

    // choose a radius safe for the largest child
    const sMax = Object.values(sizes).reduce((mx, v) => Math.max(mx, v.x), 0);
    const r = Math.max(this.tuning.get("minRadius")(), R - (sMax + g) / 2);
    // const r = Math.max(this.tuning.get("minRadius")(), R - (sMax / 2 + g));

      // local center (include pad offset)
    const cLocal = Vector.scalar(padOuter).add(inner.scale(1 / 2));
    const start = this.tuning.get("startAngle")();
    const cw = this.tuning.get("clockwise")();

    const centers: Record<string, Vector> = {};
    for (let i = 0; i < safeChildren.length; i++) {
      const ang = this.tuning.get("angleOf")(i, safeChildren.length, start, cw);
      centers[safeChildren[i].id] = Vector.scalar(ang).trig().scale(r).add(cLocal);
    }
    return { centers, sizes };
  };

  /* ---------- legacy centers (kept for back-compat) ---------- */
  placeChildren = (args: PlaceChildrenParam): PlaceChildrenReturn =>
    args.mode === LayoutChildrenMode.NESTED ? this.nestedCenters(args) : this.graphCenters(args);

  private nestedCenters({ children, parentSize, nodeSize, spacing }: PlaceChildrenParam): PlaceChildrenReturn {
    const maxPer = this.limits.get("maxChildrenPerNode");
    const policy = this.limits.get("onLimit");

    const padOuter = this.tuning.get("outerPad")(spacing);
    const inner: Vector = parentSize.round().subtract(Vector.scalar(2 * padOuter)).clamp(1, Infinity);

    const c: Vector = Vector.scalar(padOuter).add(inner.scale(1 / 2));
    const start = this.tuning.get("startAngle")();
    const cw = this.tuning.get("clockwise")();
    const ip = this.tuning.get("itemPad")(spacing);

    const baseR = inner.min() / 2 - Math.max(0, nodeSize.max() / 2 + ip);
    const r = Math.max(this.tuning.get("minRadius")(), baseR);

    return Object.fromEntries(
      mapIndexBounded(children.length, maxPer, policy, (i) => [
        children[i].id,
        Vector.scalar(this.tuning.get("angleOf")(i, children.length, start, cw)).trig().scale(r).add(c),
      ])
    );
  }

  private graphCenters({ children, origin, nodeSize, spacing, level, parentSize }: PlaceChildrenParam): PlaceChildrenReturn {
    const maxPer = this.limits.get("maxChildrenPerNode");
    const policy = this.limits.get("onLimit");

    const base = this.tuning.get("radialBase")(nodeSize, spacing);
    const r = Math.max(this.tuning.get("minRadius")(), base * (1 + level * this.tuning.get("radialLevelScale")()));
    const a = this.tuning.get("anchor")({ mode: LayoutChildrenMode.GRAPH, parentSize, spacing });
    const c = origin.add(a);

    const start = this.tuning.get("startAngle")();
    const cw = this.tuning.get("clockwise")();

    return Object.fromEntries(
      mapIndexBounded(children.length, maxPer, policy, (i) => [
        children[i].id,
        Vector.scalar(this.tuning.get("angleOf")(i, children.length, start, cw)).trig().scale(r).add(c).round(),
      ])
    );
  }

  preferredSize = ({ count, nodeSize, spacing, mode }: PreferredSizeParam): PreferredSizeReturn =>
    mode === LayoutChildrenMode.NESTED
      ? this.tuning.get("nestedRadialPreferred")(count, nodeSize, spacing)
      : nodeSize;
  auditParent = ({ parentId, childIds, snapshot, spacing, tuning }: AuditParentParam) => {
    const issues : AuditIssue[] = [];
    const p = snapshot.boxes[parentId];
    if (!p) return issues;

    const pad = tuning.get("outerPad")(spacing);
    const inner = p.size.subtract(Vector.scalar(2 * pad));
    const R = inner.min() / 2;
    const g = tuning.get("itemPad")(spacing);

    // match placement: radius is chosen off the LARGEST child
    const sizes = childIds
      .map((cid) => snapshot.boxes[cid])
      .filter(Boolean)
      .map((c) => Math.max(c!.size.x, c!.size.y));
    const sMax = sizes.length ? Math.max(...sizes) : 0;

    const rExpected = Math.max(tuning.get("minRadius")(), R - (sMax + g) / 2);
    const innerCenter = p.position.add(Vector.scalar(pad)).add(inner.scale(1 / 2));

    for (const cid of childIds) {
      const c = snapshot.boxes[cid];
      if (!c) continue;
      const center = c.position.add(c.size.halve());
      const dist = center.subtract(innerCenter).length();
      if (Math.abs(dist - rExpected) > 1.0) {
        issues.push({
          code: "RADIAL_CHILD_OFF_RING",
          severity: "warn",
          parentId,
          childId: cid,
          detail: { dist, rExpected },
        });
      }
    }
    return issues;
};

}
