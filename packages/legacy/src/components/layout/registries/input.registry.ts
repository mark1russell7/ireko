import type { GraphInput } from "../api/contracts";
import { InputKind } from "../layout.enum";
import { fromTree } from "../../graph/builders/tree";
import { Parsed } from "../engine/phases/parse";

export interface InputAdapter<K extends InputKind = InputKind> {
  kind: K;
  parse(input: Extract<GraphInput, { kind: K }>): Parsed;
}

export interface InputAdapterRegistry {
  get<K extends InputKind>(kind: K): InputAdapter<K>;
  register<K extends InputKind>(adapter: InputAdapter<K>): void;
  list(): InputKind[];
}

export class InMemoryInputAdapterRegistry implements InputAdapterRegistry {
  private map = new Map<InputKind, InputAdapter<any>>();
  get<K extends InputKind>(kind: K) {
    const a = this.map.get(kind);
    if (!a) throw new Error(`Input adapter not registered: ${kind}`);
    return a as InputAdapter<K>;
  }
  register<K extends InputKind>(adapter: InputAdapter<K>) { this.map.set(adapter.kind, adapter); }
  list() { return Array.from(this.map.keys()); }
}

export function createDefaultInputRegistry(): InputAdapterRegistry {
  const reg = new InMemoryInputAdapterRegistry();

  // Tree → Graph (keeps original tree)
  reg.register<InputKind.Tree>({
    kind: InputKind.Tree,
    parse: (input) => {
      const graph = fromTree(input.root);
      return { graph, tree: input.root };
    },
  });

  // Graph → Graph (heuristic parents from first inbound edge)
  reg.register<InputKind.Graph>({
    kind: InputKind.Graph,
    parse: (input) => {
      const parents: Record<string, string | undefined> = {};
      const inbound = new Map<string, string[]>();
      for (const id of Object.keys(input.nodes)) inbound.set(id, []);
      for (const e of input.edges) inbound.get(e.target)?.push(e.source);
      for (const [k, v] of inbound.entries()) parents[k] = v.length > 0 ? v[0] : undefined;
      return { graph: { nodes: input.nodes, edges: input.edges, parents } };
    },
  });

  return reg;
}

/** Convenience helper you asked for */
export function registerInputAdapter(ctx: { input: InputAdapterRegistry }, adapter: InputAdapter<any>): void {
  ctx.input.register(adapter);
}