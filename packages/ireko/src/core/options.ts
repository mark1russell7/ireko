/**
 * Option schemas. A strategy declares the type, the default, the range and the description of each option.
 * The engine uses the schema to examine the options of a node. The site uses it for the configurator and the reference.
 */
import type { Issue } from "./model.ts";

/** The schema of a number option. */
export interface NumberOption {
  readonly type: "number";
  readonly default: number;
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
  readonly description: string;
}

/** The schema of a boolean option. */
export interface BooleanOption {
  readonly type: "boolean";
  readonly default: boolean;
  readonly description: string;
}

/** The schema of an option with a fixed set of string values. */
export interface EnumOption<V extends string = string> {
  readonly type: "enum";
  readonly values: readonly V[];
  readonly default: V;
  readonly description: string;
}

/** The schema of one option. */
export type OptionSpec = NumberOption | BooleanOption | EnumOption;

/** The schema type that matches the value type `T`. */
export type OptionSpecFor<T> = [T] extends [number] ? NumberOption : [T] extends [boolean] ? BooleanOption : [T] extends [string] ? EnumOption<T> : never;

/** The schema of all options of a strategy. */
export type OptionSchema<O> = { readonly [K in keyof O]-?: OptionSpecFor<O[K]> };

/** This function gives the default value of each option of a schema. */
export function defaultsOf<O>(schema: OptionSchema<O>): O {
  const out: Record<string, unknown> = {};
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Each value of a schema is an option spec.
  for (const [key, spec] of Object.entries(schema) as [string, OptionSpec][]) out[key] = spec.default;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A schema of O has one spec for each key of O.
  return out as O;
}

/**
 * This function merges the raw options of a node with the defaults of a schema.
 * A value with the wrong type or out of range gives a warning, and the default replaces it.
 * A key that the schema does not know gives a warning.
 * The keys in `ignore` belong to the engine, so the function skips them.
 */
export function resolveOptions(
  specs: Readonly<Record<string, OptionSpec>>,
  raw: Readonly<Record<string, unknown>> | undefined,
  context: { readonly node: string; readonly layout: string; readonly ignore: ReadonlySet<string> },
  issues: Issue[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(specs)) out[key] = spec.default;
  if (raw === undefined) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (key === "type" || context.ignore.has(key)) continue;
    const spec = specs[key];
    if (spec === undefined) {
      issues.push(invalid(context, key, value, `The strategy "${context.layout}" has no option "${key}".`));
      continue;
    }
    const problem = checkValue(spec, value);
    if (problem === undefined) out[key] = value;
    else issues.push(invalid(context, key, value, problem));
  }
  return out;
}

function checkValue(spec: OptionSpec, value: unknown): string | undefined {
  switch (spec.type) {
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "The value must be a finite number.";
      if (spec.integer === true && !Number.isInteger(value)) return "The value must be an integer.";
      if (spec.min !== undefined && value < spec.min) return `The value must be ${String(spec.min)} or more.`;
      if (spec.max !== undefined && value > spec.max) return `The value must be ${String(spec.max)} or less.`;
      return undefined;
    }
    case "boolean":
      return typeof value === "boolean" ? undefined : "The value must be true or false.";
    case "enum":
      return typeof value === "string" && spec.values.includes(value) ? undefined : `The value must be one of: ${spec.values.join(", ")}.`;
  }
}

function invalid(context: { readonly node: string; readonly layout: string }, key: string, value: unknown, problem: string): Issue {
  return {
    code: "INVALID_OPTION",
    severity: "warning",
    message: `Node "${context.node}", option "${key}": ${problem} The engine uses the default.`,
    node: context.node,
    detail: { layout: context.layout, option: key, value },
  };
}
