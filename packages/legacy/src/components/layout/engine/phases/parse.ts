import type { GraphInput } from "../../api/contracts";
import type { Graph } from "../../../graph/model";
import type { NodeConfig } from "../../../graph/types";
import { makePhase, type Phase } from "./contracts";
import { SystemContext } from "../context";

export type Parsed = {
  graph: Graph;
  /** If a faithful tree is available, we keep it for high-fidelity placement. */
  tree?: NodeConfig;
};
 export function parse(input: GraphInput, ctx: SystemContext): Parsed {
   return ctx.input.get(input.kind).parse(input as any);
 }

 export const ParsePhase: Phase<{ input: GraphInput; ctx: SystemContext }, Parsed> =
   makePhase("parse", ({ input, ctx }) => parse(input, ctx));