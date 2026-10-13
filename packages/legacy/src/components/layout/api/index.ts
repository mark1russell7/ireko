import type { GraphInput, ComputeOptions } from "./contracts";
import { PipelineEngine } from "../engine/engine";
import type { SystemContext } from "../engine/context";
import { createDefaultSystem } from "../engine/context";
import type { LayoutSnapshot } from "../types";
import { toReactFlow } from "../../tooling/exporters/reactflow";
import { snapshotToSVG } from "../../tooling/exporters/svg";
import { InputAdapter, registerInputAdapter } from "../registries/input.registry";

export interface LayoutAPI {
  compute(input: GraphInput, options?: ComputeOptions): LayoutSnapshot;
  toReactFlow(snapshot: LayoutSnapshot): ReturnType<typeof toReactFlow>;
  toSVG(snapshot: LayoutSnapshot): string;
  registerInputAdapter(adapter: InputAdapter<any>): void;
}

export function createLayoutAPI(ctx: SystemContext = createDefaultSystem()): LayoutAPI {
  const engine = new PipelineEngine(ctx);
  return {
    compute: (input, options) => {
      const res = engine.run(input, options);
      if (!res.ok) throw new Error(JSON.stringify(res.issues));
      return res.snapshot;
    },
    toReactFlow,
    toSVG: snapshotToSVG,
    registerInputAdapter: (adapter) => registerInputAdapter(ctx, adapter),
  };
}

export type { GraphInput, ComputeOptions } from "./contracts";
export type { LayoutSnapshot } from "../types";
