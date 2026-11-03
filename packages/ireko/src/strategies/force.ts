/**
 * The opt-in strategy `force` and the function `relaxForces`. The strategy is not built in, so a caller of `layout`
 * that does not use it does not pay for it. Register it with `createEngine`:
 *
 * ```ts
 * import { createEngine } from "ireko";
 * import { forceStrategy } from "ireko/strategies/force";
 *
 * const engine = createEngine({ strategies: [forceStrategy] });
 * ```
 */
import { builder, type Builder } from "../core/build.ts";
import type { ForceOptions } from "../core/strategies/force.ts";

export { force as forceStrategy, type ForceOptions } from "../core/strategies/force.ts";
export { MAX_SPRING_STRENGTH, relaxForces, RELAX_DEFAULTS, type RelaxEdge, type RelaxNode, type RelaxOptions } from "../core/relax.ts";

/** The builder of the strategy `force`. The engine of the layout must have the strategy `forceStrategy`. */
export const force: Builder<ForceOptions> = builder<ForceOptions>("force");
