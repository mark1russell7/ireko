import type { GraphInput, ComputeOptions } from "../api/contracts";
import { parse } from "./phases/parse";
import { validate } from "./phases/validate";
import { plan } from "./phases/plan";
import { place } from "./phases/place";
import { route } from "./phases/route";
import { post } from "./phases/post";
import type { SystemContext } from "./context";
import { createDefaultSystem } from "./context";
import type { LayoutSnapshot } from "../types";
import { Vector } from "../../core/geometry";
import { InMemoryLayoutRegistry } from "../registries/layout.registry";
import { EdgeLineType, LayoutTypes } from "../layout.enum";
import { GridLayout } from "../strategies/grid/grid.layout";
import { RadialLayout } from "../strategies/radial/radial.layout";
import { createDefaultIteratorRegistry } from "../iterator/iterator.registry";
import { runAudit } from "../../tooling/diagnostics/audit";

export type ComputeResult =
  | { ok: true; snapshot: LayoutSnapshot; issues: ReturnType<typeof validate>["issues"] }
  | { ok: false; issues: ReturnType<typeof validate>["issues"] };

export class PipelineEngine {
  constructor(private ctx: SystemContext = createDefaultSystem()) {}

  run(input: GraphInput, opts: ComputeOptions = {}): ComputeResult {
    const parsed = parse(input, this.ctx);
    const { issues } = validate(parsed);

    const severity = opts.onValidateIssues ?? "ok";
    if (severity === "error" && issues.length) return { ok: false, issues };
    if (severity === "warn" && issues.length) this.ctx.log.warn("validate: issues", { count: issues.length, issues });

    // Effective knobs
    const nodeSize = opts.nodeSize ?? new Vector(110, 54);
    const spacing = opts.spacing ?? 24;

    // ---- Per-call derived configs (no global mutation) ----
    const effectiveTunings = opts.tuningOverride ? this.ctx.tunings.derive(opts.tuningOverride) : this.ctx.tunings;
    const effectiveLimits = opts.limitsOverride ? this.ctx.limits.derive(opts.limitsOverride) : this.ctx.limits;

    // Layout registry must be recreated when tunings change (strategies capture tunings).
    const effectiveLayouts = new InMemoryLayoutRegistry();
    // engine/engine.ts
    effectiveLayouts.register(
      LayoutTypes.Grid,
      new GridLayout(effectiveTunings, effectiveLimits, createDefaultIteratorRegistry(effectiveTunings))
    );
    effectiveLayouts.register(
      LayoutTypes.Radial,
      new RadialLayout(effectiveTunings, effectiveLimits)
    );

    const localCtx: SystemContext = {
      ...this.ctx,
      tunings: effectiveTunings,
      limits: effectiveLimits,
      layouts: effectiveLayouts,
    };

    const pln = plan(parsed);
    const placed = place(parsed, pln, localCtx, {
      nodeSize,
      spacing,
      collectOverlaps: !!opts.collectOverlaps,
    });

    const routed = route(placed, localCtx, undefined, opts.routerName ?? EdgeLineType.Straight);
    let snapshot = post(routed);

    // Diagnostics audit (non-fatal, attach to meta)
    try {
      // const audit = auditSnapshot(snapshot, pln, effectiveTunings, { spacing });
      const audit = runAudit(snapshot, pln, localCtx, { spacing });

      if (audit.length) {
        localCtx.log.warn("audit: issues", { count: audit.length, audit });
      }
      snapshot = { ...snapshot, meta: { ...(snapshot.meta ?? {}), audit } };
    } catch (e) {
      localCtx.log.warn("audit failed", { err: String(e) });
    }

    return { ok: true, snapshot, issues };
  }
}
