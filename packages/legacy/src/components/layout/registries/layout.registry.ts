import type { Layout } from "../layout";
import { LayoutTypes } from "../layout.enum";

export type LayoutKind = LayoutTypes;

export interface LayoutRegistry {
  has(kind: LayoutKind): boolean;
  get(kind: LayoutKind): Layout;
  register(kind: LayoutKind, strategy: Layout): void;
  list(): LayoutKind[];
}

export class InMemoryLayoutRegistry implements LayoutRegistry {
  private map = new Map<LayoutKind, Layout>();
  has(kind: LayoutKind) { return this.map.has(kind); }
  get(kind: LayoutKind) {
    const v = this.map.get(kind);
    if (!v) throw new Error(`Layout strategy not registered: ${kind}`);
    return v;
  }
  register(kind: LayoutKind, strategy: Layout) { this.map.set(kind, strategy); }
  list() { return Array.from(this.map.keys()); }
}
