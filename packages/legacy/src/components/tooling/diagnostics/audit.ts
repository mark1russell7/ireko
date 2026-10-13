import { Config } from "../../config";
import type { SystemContext } from "../../layout/engine/context";
import type { Plan } from "../../layout/engine/phases/plan";
import type { LayoutTuning } from "../../layout/layout.tuning";
import type { LayoutSnapshot } from "../../layout/types";
import { LayoutTypes } from "../../layout/layout.enum";

export type AuditIssue = {
  code: "NESTED_CHILD_NOT_SQUARE" | "NESTED_CHILD_OUTSIDE_PARENT" | "NESTED_CHILD_TOO_BIG" | string;
  severity: "warn" | "error";
  parentId: string;
  childId?: string;
  detail?: unknown;
};

function childrenOf(s: LayoutSnapshot): Record<string, string[]> {
  const kids: Record<string, string[]> = {};
  for (const b of Object.values(s.boxes)) {
    if (b.parentId) (kids[b.parentId] ??= []).push(b.id);
  }
  return kids;
}

function genericNestedChecks(
  s: LayoutSnapshot,
  tuning: Config<LayoutTuning>,
  spacing: number
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const kids = childrenOf(s);
  const pad = tuning.get("outerPad")(spacing);

  for (const [pid, arr] of Object.entries(kids)) {
    const p = s.boxes[pid];
    if (!p) continue;

    const innerW = p.size.x - 2 * pad;
    const innerH = p.size.y - 2 * pad;
    const x1 = p.position.x + pad, y1 = p.position.y + pad;
    const x2 = x1 + innerW,       y2 = y1 + innerH;
    const maxSide = Math.min(innerW, innerH);

    for (const cid of arr) {
      const c = s.boxes[cid];
      if (!c) continue;

      // square-ness
      if (Math.abs(c.size.x - c.size.y) > 0.5) {
        issues.push({ code: "NESTED_CHILD_NOT_SQUARE", severity: "warn", parentId: pid, childId: cid });
      }
      // size bound by parent's inner box
      if (Math.max(c.size.x, c.size.y) > maxSide + 0.5) {
        issues.push({
          code: "NESTED_CHILD_TOO_BIG",
          severity: "warn",
          parentId: pid,
          childId: cid,
          detail: { child: { w: c.size.x, h: c.size.y }, inner: { w: innerW, h: innerH } },
        });
      }
      // fully inside parent's inner rect
      const cx1 = c.position.x, cy1 = c.position.y;
      const cx2 = cx1 + c.size.x, cy2 = cy1 + c.size.y;
      const outside = cx1 < x1 - 0.5 || cy1 < y1 - 0.5 || cx2 > x2 + 0.5 || cy2 > y2 + 0.5;
      if (outside) {
        issues.push({
          code: "NESTED_CHILD_OUTSIDE_PARENT",
          severity: "warn",
          parentId: pid,
          childId: cid,
          detail: { childBox: { x1: cx1, y1: cy1, x2: cx2, y2: cy2 }, parentInner: { x1, y1, x2, y2 } },
        });
      }
    }
  }
  return issues;
}

/** Full audit runner: generic checks + optional strategy-level audits. */
export function runAudit(
  s: LayoutSnapshot,
  plan: Plan,
  ctx: SystemContext,
  opts: { spacing: number }
): AuditIssue[] {
  const generic = genericNestedChecks(s, ctx.tunings, opts.spacing);

  // Strategy-specific audits where available
  const children = childrenOf(s);
  const strategyIssues: AuditIssue[] = [];
  for (const parentId of Object.keys(children)) {
    const layoutKind = plan.layouts[parentId] ?? LayoutTypes.Grid;
    const strat = ctx.layouts.get(layoutKind);
    if (typeof strat.auditParent === "function") {
      const childIds = children[parentId] ?? [];
      const issues = strat.auditParent({ parentId, childIds, snapshot: s, spacing: opts.spacing, tuning: ctx.tunings }) || [];
      strategyIssues.push(...issues);
    }
  }

  return [...generic, ...strategyIssues];
}
