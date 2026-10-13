import type { Edge } from "../api/contracts";
import type { Vector } from "../../core/geometry";
import type { LayoutSnapshot } from "../types";

export interface RoutedEdge { id: string; source: string; target: string; polyline?: Vector[]; }

export interface EdgeRouter {
  /** Return polyline/segments for an edge, or undefined for straight center line by consumer. */
  route(e: Edge, snapshot: LayoutSnapshot): Partial<RoutedEdge> | undefined;
}

export interface RouterRegistry {
  get(name: string): EdgeRouter;
  register(name: string, router: EdgeRouter): void;
}

export class InMemoryRouterRegistry implements RouterRegistry {
  private map = new Map<string, EdgeRouter>();
  get(name: string) {
    const r = this.map.get(name);
    if (!r) throw new Error(`Router not registered: ${name}`);
    return r;
  }
  register(name: string, router: EdgeRouter) { this.map.set(name, router); }
}
