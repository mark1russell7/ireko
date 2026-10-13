import type { Parsed } from "./parse";
import { validateGraph } from "../../../graph/validate";
import { makePhase, type Phase } from "./contracts";
export type Validation = { issues: ReturnType<typeof validateGraph> };

export function validate(p: Parsed): Validation {
  return { issues: validateGraph(p.graph) };
}

export const ValidatePhase: Phase<Parsed, Validation> = makePhase("validate", validate);
