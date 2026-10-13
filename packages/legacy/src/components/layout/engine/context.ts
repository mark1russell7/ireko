import { Config } from "../../config";
import { LayoutTuning, LayoutTuningConfig } from "../../layout/layout.tuning";
import { IterationConfig, IterationLimits } from "../limits";
import { Logger, NoopLogger } from "../../core/logging/logger";
import { InMemoryLayoutRegistry } from "../registries/layout.registry";
import { InMemoryRouterRegistry } from "../registries/router.registry";
import { GridLayout } from "../strategies/grid/grid.layout";
import { RadialLayout } from "../strategies/radial/radial.layout";
import { LineRouter } from "../routers/line.router";
import type { LayoutRegistry } from "../registries/layout.registry";
import type { RouterRegistry } from "../registries/router.registry";
import { LayoutTypes } from "../layout.enum";
import { OrthoRouter } from "../routers/ortho.router";
import { createDefaultIteratorRegistry } from "../iterator/iterator.registry";
import { createDefaultInputRegistry, type InputAdapterRegistry } from "../registries/input.registry";

export type SystemContext = {
  log: Logger;
  tunings: Config<LayoutTuning>;
  limits: Config<IterationLimits>;
  layouts: LayoutRegistry;
  routers: RouterRegistry;
  input: InputAdapterRegistry;
};

export function createDefaultSystem(overrides?: Partial<SystemContext>): SystemContext {
  const tunings = overrides?.tunings ?? LayoutTuningConfig;
  const limits = overrides?.limits ?? IterationConfig;

  const layouts =
    overrides?.layouts ??
    (() => {
      const layoutRegistry = new InMemoryLayoutRegistry();
      // ⬇️ replace strategy registrations to pass limits too
      layoutRegistry.register(
        LayoutTypes.Grid,
        new GridLayout(tunings, limits, createDefaultIteratorRegistry(tunings))
      );
      layoutRegistry.register(
        LayoutTypes.Radial,
        new RadialLayout(tunings, limits)
      );


      return layoutRegistry;
    })();

  const routers =
    overrides?.routers ??
    (() => {
      const routerRegistry = new InMemoryRouterRegistry();
      routerRegistry.register("line", new LineRouter());
      routerRegistry.register("ortho", new OrthoRouter());
      return routerRegistry;
    })();
  const input = overrides?.input ?? createDefaultInputRegistry();

  return {
    log: overrides?.log ?? new NoopLogger(),
    tunings,
    limits,
    layouts,
    routers,
    input
  };
}
