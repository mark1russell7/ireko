// layout/limits/index.ts
import { Config } from "../../config";
import type { LimitAction } from "../../iteration/iterate";

export type LayoutLimits = {
  maxDepth: number;
  maxNodes: number;
  maxChildrenPerNode: number;
  maxEdges: number;
  maxOpsPerPass: number;
  onLimit: LimitAction; // "throw" | "truncate" | "warn"
};

export const defaultLayoutLimits: LayoutLimits = {
  maxDepth: 1000,
  maxNodes: 5000,
  maxChildrenPerNode: 1000,
  maxEdges: 10000,
  maxOpsPerPass: 100_000,
  onLimit: "warn",
};

export const LayoutLimitsConfig = new Config<LayoutLimits>(defaultLayoutLimits);

// (Optional) temporary re-exports to minimize churn while you rename imports.
export type IterationLimits = LayoutLimits;
export const IterationConfig = LayoutLimitsConfig;