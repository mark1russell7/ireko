import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts", "src/svg/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      // The gates of the family (docs/REVIEW.md §9.2): statements, branches, functions and lines.
      thresholds: { statements: 98, branches: 96, functions: 98, lines: 98 },
    },
  },
});
