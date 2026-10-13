import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
    // The property tests make thousands of random layouts. The coverage makes them slower.
    testTimeout: 60_000,
    // The benchmarks (pnpm bench). CI reports them each night and does not fail on them.
    benchmark: { include: ["src/**/*.bench.ts"] },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // The test helpers and the example data are not the product.
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.bench.ts", "src/test/**", "src/examples/**"],
      // The gates of the family (docs/REVIEW.md §9.2): statements, branches, functions and lines.
      thresholds: { statements: 98, branches: 96, functions: 98, lines: 98 },
    },
  },
});
