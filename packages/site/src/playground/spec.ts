/** Small functions that read and change one node of a spec. Each function gives a new spec and keeps the old one. */
import type { LayoutRef, NodeSpec } from "ireko";

/** This function gives the node with the identifier `id`, or undefined. */
export function findNode(root: NodeSpec, id: string): NodeSpec | undefined {
  const stack = [root];
  for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
    if (n.id === id) return n;
    stack.push(...(n.children ?? []));
  }
  return undefined;
}

/** This function gives a new tree in which `change` replaced the node with the identifier `id`. */
export function updateNode(root: NodeSpec, id: string, change: (node: NodeSpec) => NodeSpec): NodeSpec {
  if (root.id === id) return change(root);
  const children = root.children;
  if (children === undefined) return root;
  let changed = false;
  const next = children.map((c) => {
    const updated = updateNode(c, id, change);
    if (updated !== c) changed = true;
    return updated;
  });
  return changed ? { ...root, children: next } : root;
}

/** This function splits the layout of a node into its type and its options. */
export function layoutParts(ref: LayoutRef | undefined): { readonly type: string; readonly options: Readonly<Record<string, unknown>> } {
  if (ref === undefined) return { type: "grid", options: {} };
  if (typeof ref === "string") return { type: ref, options: {} };
  const { type, ...options } = ref;
  return { type, options };
}

/** This function joins a type and options into a layout. A layout without options is only its type. */
export function joinLayout(type: string, options: Readonly<Record<string, unknown>>): LayoutRef {
  const kept = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  return Object.keys(kept).length === 0 ? type : { ...kept, type };
}

/** This function gives a copy of a node without the key `key`. */
export function without(node: NodeSpec, key: Exclude<keyof NodeSpec, "id">): NodeSpec {
  const copy: Record<string, unknown> = { ...node };
  delete copy[key];
  return copy as unknown as NodeSpec;
}
