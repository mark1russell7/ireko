// Barrel for core/geometry. 19 modules import from "core/geometry" directly;
// this file was lost in commit 0192ac4 ("migrate") which split the old index.ts
// into vectors.ts / shapes.ts / types.ts — without it the project does not build.
export * from "./types";
export * from "./vectors";
export * from "./shapes";
