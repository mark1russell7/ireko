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
  },
  outDir: "dist",
  format: "esm",
  // The core and the renderers operate in a browser, a worker and Node.js.
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: true,
  // React and React Flow are optional peers: the build imports them, and does not include them.
  deps: { neverBundle: [/^react($|\/)/, /^react-dom($|\/)/, /^@xyflow\/react($|\/)/] },
  clean: true,
});
