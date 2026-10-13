/**
 * The core of ireko: the model, the engine, the strategies and the routers.
 * The core imports nothing from the DOM, React or a renderer.
 */
export { centerOf, contains, inflate, overlaps, rectAt, translate, union, unionAll, type Point, type Rect, type Size } from "./geometry.ts";
export * from "./model.ts";
export { defaultsOf, type BooleanOption, type EnumOption, type NumberOption, type OptionSchema, type OptionSpec, type OptionSpecFor } from "./options.ts";
export * from "./strategy.ts";
export { borderPoint, defineRouter, type RouteInput, type Router } from "./router.ts";
export { straight, orthogonal } from "./routers.ts";
export { avoid } from "./avoid.ts";
export { grid as gridStrategy, type GridOptions } from "./strategies/grid.ts";
export { radial as radialStrategy, type RadialOptions } from "./strategies/radial.ts";
export { tree as treeStrategy, type TreeOptions } from "./strategies/tree.ts";
export { layers as layersStrategy, type LayersOptions } from "./strategies/layers.ts";
export { BUILTIN_STRATEGY_NAMES } from "./strategies/names.ts";
export { builder, grid, layers, node, radial, tree, type Builder, type BuildOptions, type Child, type ContainerOptions } from "./build.ts";
export { createEngine, layout, builtinStrategies, builtinRouters, defaultLimits, type Engine, type EngineConfig, type Limits } from "./engine.ts";
