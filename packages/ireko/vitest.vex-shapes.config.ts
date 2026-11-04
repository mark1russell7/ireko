import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

// The whole suite with the switch of the shapes on: the measure pass uses the shapes module of Vex.
// Start it with `pnpm --filter ireko test:vex-shapes`. The tests and the golden files must not change.
export default mergeConfig(base, defineConfig({ test: { setupFiles: ["src/test/vex-shapes.setup.ts"] } }));
