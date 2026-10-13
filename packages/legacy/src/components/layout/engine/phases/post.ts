import type { LayoutSnapshot } from "../../types";
import { makePhase, type Phase } from "./contracts";

/** Post-processing hook; we keep it as a pass-through while the legacy engine already computed stats. */
export function post(s: LayoutSnapshot): LayoutSnapshot {
  return { ...s, version: s.version ?? Date.now() };
}
export const PostPhase: Phase<LayoutSnapshot, LayoutSnapshot> = makePhase("post", post);
