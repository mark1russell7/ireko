/**
 * The builder: short, typed functions that make a `NodeSpec`. The builder and the text language give the same data.
 *
 * ```ts
 * const spec = grid("root", { columns: 3 },
 *   radial.nested("api", "auth", "users", "billing"),
 *   grid("web", "home", "search", "cart"),
 * );
 * ```
 */
import type { Size } from "./geometry.ts";
import type { Fit, LayoutRef, NodeSpec } from "./model.ts";
import type { GridOptions } from "./strategies/grid.ts";
import type { RadialOptions } from "./strategies/radial.ts";
import type { TreeOptions } from "./strategies/tree.ts";

/** A child of a builder call: a node, or the identifier of a leaf. */
export type Child = NodeSpec | string;

/** The options that each container has, for each strategy. */
export interface ContainerOptions {
  readonly label?: string;
  readonly size?: Partial<Size>;
  readonly fit?: Fit;
  readonly data?: unknown;
  /** The distance between two siblings. */
  readonly gap?: number;
  /** The space inside the edge of a nested container. */
  readonly padding?: number;
  /** The smallest space above the content of a nested container. */
  readonly header?: number;
}

/** The options of a builder call: the options of the strategy and of the container. */
export type BuildOptions<O> = Partial<O> & ContainerOptions;

/** A builder of one strategy. Use it for a linked node, or use `nested` for a container. */
export interface Builder<O> {
  (id: string, ...children: readonly Child[]): NodeSpec;
  (id: string, options: BuildOptions<O>, ...children: readonly Child[]): NodeSpec;
  /** This function makes a nested container: the children are inside its box. */
  nested: {
    (id: string, ...children: readonly Child[]): NodeSpec;
    (id: string, options: BuildOptions<O>, ...children: readonly Child[]): NodeSpec;
  };
}

const NODE_KEYS = new Set(["label", "size", "fit", "data"]);

/** This function makes a builder for the strategy with the type `type`. Use it for a strategy that you register. */
export function builder<O>(type: string): Builder<O> {
  // A node has an identifier, so an object without one is the options of the call.
  const isChild = (x: Child | BuildOptions<O>): x is Child => typeof x === "string" || "id" in x;
  const make =
    (mode: "linked" | "nested") =>
    (id: string, ...rest: readonly (Child | BuildOptions<O>)[]): NodeSpec => {
      const first = rest[0];
      const options: Readonly<Record<string, unknown>> = first === undefined || isChild(first) ? {} : first;
      const strategy: Record<string, unknown> = {};
      const extras: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(options)) {
        if (value === undefined) continue;
        if (NODE_KEYS.has(key)) extras[key] = value;
        else strategy[key] = value;
      }
      const layout: LayoutRef = Object.keys(strategy).length === 0 ? type : { ...strategy, type };
      return { id, ...extras, layout, mode, children: rest.filter(isChild).map(toNode) };
    };
  return Object.assign(make("linked"), { nested: make("nested") });
}

/** This function makes a leaf. */
export function node(id: string, options: Omit<ContainerOptions, "gap" | "padding" | "header"> = {}): NodeSpec {
  return { id, ...options };
}

/** The builder of the strategy `grid`. */
export const grid: Builder<GridOptions> = builder<GridOptions>("grid");
/** The builder of the strategy `radial`. */
export const radial: Builder<RadialOptions> = builder<RadialOptions>("radial");
/** The builder of the strategy `tree`. */
export const tree: Builder<TreeOptions> = builder<TreeOptions>("tree");

function toNode(c: Child): NodeSpec {
  return typeof c === "string" ? { id: c } : c;
}
