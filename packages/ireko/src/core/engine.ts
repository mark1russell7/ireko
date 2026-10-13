/**
 * The engine: it holds the strategies, the routers and the limits, and it starts the phases of the pipeline.
 * An engine does not change after it is made. `extend` gives a new engine.
 */
import { clean, unionAll, type Rect } from "./geometry.ts";
import { IrekoError, type Issue, type Layout, type LayoutInput, type LayoutOptions } from "./model.ts";
import { audit } from "./engine/audit.ts";
import { measure } from "./engine/measure.ts";
import { normalize } from "./engine/normalize.ts";
import { place } from "./engine/place.ts";
import { route } from "./engine/route.ts";
import type { Context, Limits, Resolved } from "./engine/types.ts";
import type { Router } from "./router.ts";
import { orthogonal, straight } from "./routers.ts";
import { avoid } from "./avoid.ts";
import { grid } from "./strategies/grid.ts";
import { radial } from "./strategies/radial.ts";
import { tree } from "./strategies/tree.ts";
import type { AnyStrategy } from "./strategy.ts";

export type { Limits } from "./engine/types.ts";

/** The configuration of an engine. Each item is optional. */
export interface EngineConfig {
  /** More strategies. A strategy with the type of a built-in strategy replaces it. */
  readonly strategies?: readonly AnyStrategy[];
  /** More routers. A router with the type of a built-in router replaces it. */
  readonly routers?: readonly Router[];
  /** The default options of each layout of this engine. The options of one call replace them. */
  readonly defaults?: LayoutOptions;
  readonly limits?: Partial<Limits>;
}

/** An engine: it makes layouts with its strategies and routers. */
export interface Engine {
  /** This function gives the layout of `input`. It throws only in the strict mode, or for an input that is not an object. */
  layout(input: LayoutInput, options?: LayoutOptions): Layout;
  /** This function gives a new engine with more strategies, routers or defaults. It does not change this engine. */
  extend(config: EngineConfig): Engine;
  readonly strategies: ReadonlyMap<string, AnyStrategy>;
  readonly routers: ReadonlyMap<string, Router>;
  readonly limits: Limits;
}

/** The built-in strategies. */
export const builtinStrategies: readonly AnyStrategy[] = [grid, radial, tree];
/** The built-in routers. */
export const builtinRouters: readonly Router[] = [straight, orthogonal, avoid];
/** The default limits. */
export const defaultLimits: Limits = { maxNodes: 100_000, maxDepth: 10_000, maxChildren: 10_000 };

/** This function makes an engine with the built-in strategies and routers, and the items of `config`. */
export function createEngine(config: EngineConfig = {}): Engine {
  const strategies = new Map<string, AnyStrategy>();
  for (const s of [...builtinStrategies, ...(config.strategies ?? [])]) strategies.set(s.type, s);
  const routers = new Map<string, Router>();
  for (const r of [...builtinRouters, ...(config.routers ?? [])]) routers.set(r.type, r);
  const limits: Limits = { ...defaultLimits, ...config.limits };
  const defaults = config.defaults ?? {};

  const engine: Engine = {
    strategies,
    routers,
    limits,
    layout(input, options = {}) {
      return run(input, { ...defaults, ...options }, strategies, routers, limits);
    },
    extend(more) {
      return createEngine({
        strategies: [...strategies.values(), ...(more.strategies ?? [])],
        routers: [...routers.values(), ...(more.routers ?? [])],
        defaults: { ...defaults, ...more.defaults },
        limits: { ...limits, ...more.limits },
      });
    },
  };
  return Object.freeze(engine);
}

const defaultEngine: Engine = createEngine();

/** This function gives the layout of `input` with the default engine. */
export function layout(input: LayoutInput, options?: LayoutOptions): Layout {
  return defaultEngine.layout(input, options);
}

function run(
  input: LayoutInput,
  options: LayoutOptions,
  strategies: ReadonlyMap<string, AnyStrategy>,
  routers: ReadonlyMap<string, Router>,
  limits: Limits,
): Layout {
  if (typeof input !== "object" || input === null || typeof input.root !== "object" || input.root === null) {
    throw new TypeError("ireko: the input must be an object with a root node: { root: { id: \"...\" } }.");
  }
  const issues: Issue[] = [];
  const resolved = resolve(options, routers, issues);
  const ctx: Context = { strategies, limits, options: resolved };
  const trace = resolved.trace;

  const norm = normalize(input, ctx, issues);
  trace?.({ phase: "normalize", data: norm });
  const m = measure(norm, ctx, issues);
  trace?.({ phase: "measure", data: m });
  const placed = place(norm, m, ctx);
  trace?.({ phase: "place", data: placed });
  const edges = route(norm, placed.nodes, ctx, issues, m.direction);
  trace?.({ phase: "route", data: edges });
  if (resolved.audit) {
    audit(norm, m, placed, ctx, issues);
    trace?.({ phase: "audit", data: issues });
  }

  const points: Rect[] = edges.flatMap((e) => e.points.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 })));
  const b = unionAll([...placed.nodes, ...points]);
  const bounds: Rect = { x: clean(b.x), y: clean(b.y), width: clean(b.width), height: clean(b.height) };
  const result: Layout = { nodes: placed.nodes, edges, bounds, issues };
  if (resolved.strict) {
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) throw new IrekoError(errors);
  }
  return result;
}

function resolve(o: LayoutOptions, routers: ReadonlyMap<string, Router>, issues: Issue[]): Resolved {
  const spacing = nonNegative(o.spacing, 24, "spacing", issues);
  const nodeSize = o.nodeSize !== undefined && positive(o.nodeSize.width) && positive(o.nodeSize.height) ? o.nodeSize : invalidSize(o.nodeSize, issues);
  let router = routers.get(o.router ?? "straight");
  if (router === undefined) {
    issues.push({ code: "UNKNOWN_ROUTER", severity: "error", message: `The router "${String(o.router)}" is not registered. The engine uses "straight". The registered routers are: ${[...routers.keys()].join(", ")}.`, detail: { router: o.router } });
    router = straight;
  }
  const treeEdges = o.treeEdges === "all" || o.treeEdges === "none" ? o.treeEdges : "linked";
  const origin = o.origin !== undefined && Number.isFinite(o.origin.x) && Number.isFinite(o.origin.y) ? o.origin : { x: 0, y: 0 };
  return {
    spacing,
    nodeSize,
    header: nonNegative(o.header, 24, "header", issues),
    router,
    treeEdges,
    origin,
    measure: o.measure,
    audit: o.audit !== false,
    strict: o.strict === true,
    trace: o.trace,
  };
}

function positive(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

function invalidSize(size: LayoutOptions["nodeSize"], issues: Issue[]): { width: number; height: number } {
  if (size !== undefined) issues.push({ code: "INVALID_SIZE", severity: "error", message: "The option nodeSize must have a finite width and height more than 0. The engine uses 120 by 48.", detail: { nodeSize: size } });
  return { width: 120, height: 48 };
}

function nonNegative(v: number | undefined, fallback: number, key: string, issues: Issue[]): number {
  if (v === undefined) return fallback;
  if (Number.isFinite(v) && v >= 0) return v;
  issues.push({ code: "INVALID_OPTION", severity: "warning", message: `The option ${key} must be a finite number of 0 or more. The engine uses ${String(fallback)}.`, detail: { option: key, value: v } });
  return fallback;
}
