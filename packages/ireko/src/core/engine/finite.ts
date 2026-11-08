/**
 * The check of the numbers that the Vex sheets give. Each size of the input is finite, but a sum of sizes can overflow.
 * The engine does not throw for that: it gives the finding `NON_FINITE` and uses a finite value.
 */
import type { Issue } from "../model.ts";

/** The place of a number in the layout: the node and the name of the value, for example `width` or `scale`. A value of the whole layout has no node. */
export interface NumberSite {
  readonly node?: string;
  readonly field: string;
  readonly phase: "measure" | "place";
}

/**
 * This function gives `value` if it is a finite number. For a different value, for example an error of Vex after an
 * overflow, it adds the finding `NON_FINITE` to `issues` and gives `fallback`.
 */
export function finite(value: unknown, fallback: number, site: NumberSite, issues: Issue[]): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const owner = site.node === undefined ? "the layout" : `the node "${site.node}"`;
  issues.push({
    code: "NON_FINITE",
    severity: "error",
    message: `The ${site.field} of ${owner} is not a finite number. A sum of large sizes can overflow. The engine uses ${String(fallback)}.`,
    ...(site.node === undefined ? {} : { node: site.node }),
    detail: { field: site.field, phase: site.phase, fallback },
  });
  return fallback;
}
