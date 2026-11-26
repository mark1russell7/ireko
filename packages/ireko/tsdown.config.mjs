// A plain ES module, not TypeScript: Node.js 22.12 (the floor of "engines") cannot load a TypeScript config without the
// package unrun. defineConfig gives the editor the types.
import { defineConfig } from "tsdown";

// The build of the package for npm: one ES module and its declarations for each entry point, in dist/.
// The workspace (the tests and the site) uses the source. publishConfig in package.json gives npm the build.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    text: "src/text/index.ts",
    svg: "src/svg/index.ts",
    dom: "src/dom/index.ts",
    canvas: "src/canvas/index.ts",
    render: "src/render/index.ts",
    react: "src/react/index.tsx",
    xyflow: "src/xyflow/index.tsx",
    examples: "src/examples/index.ts",
    "strategies/force": "src/strategies/force.ts",
    shapes: "src/shapes/index.ts",
  },
  outDir: "dist",
  format: "esm",
  // The core and the renderers operate in a browser, a worker and Node.js.
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: true,
  outputOptions: {
    // A source map names a bundled package by its path in node_modules, not by its path in the pnpm store.
    // The store path contains the version (.pnpm/<name>@<version>/node_modules/<name>/). With that path, an update of a
    // dependency with the same code changes a shipped file, and the release check stops the update.
    // On Windows the path comes with backslashes: the map gets forward slashes on each OS.
    // scripts/smoke.mjs fails when a source map in the tarball names a store path.
    sourcemapPathTransform: (source) => source.replaceAll("\\", "/").replace(/node_modules\/\.pnpm\/[^/]+\/node_modules\//g, "node_modules/"),
  },
  // React and React Flow are optional peers: the build imports them, and does not include them.
  // The escape of @mark1russell7/text goes into the build, so the package keeps no runtime dependencies.
  deps: {
    neverBundle: [/^react($|\/)/, /^react-dom($|\/)/, /^@xyflow\/react($|\/)/],
    alwaysBundle: [/^@mark1russell7\/text$/],
  },
  clean: true,
});
