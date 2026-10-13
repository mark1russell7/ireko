// src/components/layout/iterator/iterator.registry.ts
import { LayoutTypes } from "../layout.enum";
import { Iterator } from "./iterator.types";
import { buildIterators } from "./layout.iterators";
import { LayoutTuning, LayoutTuningConfig } from "../layout.tuning";
import { Config } from "../../config";

export type LayoutIteratorKind = LayoutTypes;

export interface IteratorRegistry {
  has(kind: LayoutIteratorKind): boolean;
  get(kind: LayoutIteratorKind): Iterator;
  register(kind: LayoutIteratorKind, iterator: Iterator): void;
  list(): LayoutIteratorKind[];
}

export class InMemoryIteratorRegistry implements IteratorRegistry {
  private map = new Map<LayoutIteratorKind, Iterator>();
  has(kind: LayoutIteratorKind) { return this.map.has(kind); }
  get(kind: LayoutIteratorKind) {
    const v = this.map.get(kind);
    if (!v) throw new Error(`Iterator not registered: ${kind}`);
    return v;
  }
  register(kind: LayoutIteratorKind, it: Iterator) { this.map.set(kind, it); }
  list() { return Array.from(this.map.keys()); }
}

/** Build a default registry from the current tuning config. */
export function createDefaultIteratorRegistry(tuning: Config<LayoutTuning> = LayoutTuningConfig): IteratorRegistry {
  const reg = new InMemoryIteratorRegistry();
  const set = buildIterators(tuning);
  reg.register(LayoutTypes.Grid, set.grid);
  reg.register(LayoutTypes.Radial, set.radial);
  return reg;
}
