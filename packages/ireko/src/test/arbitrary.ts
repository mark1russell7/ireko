/**
 * The generators of random inputs for the property tests. The site uses the same generators for its fuzz button.
 * Thus a defect that a reader finds on the site gives a seed for a test.
 */
import * as fc from "fast-check";
import type { Fit, LayoutInput, LayoutOptions, Mode, NodeSpec } from "../core/model.ts";

/** The shape of a random node, before the generator gives it an identifier. */
interface Shape {
  readonly layout: Record<string, unknown> & { readonly type: string };
  readonly mode: Mode;
  readonly fit: Fit | undefined;
  readonly size: { width: number; height: number } | undefined;
  readonly children: readonly Shape[];
}

/** The settings of the tree generator. */
export interface TreeSettings {
  readonly maxDepth?: number;
  readonly maxChildren?: number;
  /** The sizing policies that the generator can give to a nested node. */
  readonly fits?: readonly Fit[];
}

const gridLayout = fc.record(
  {
    type: fc.constant("grid"),
    columns: fc.integer({ min: 0, max: 4 }),
    justify: fc.constantFrom("start", "center", "end"),
    align: fc.constantFrom("auto", "start", "center", "end"),
    uniform: fc.boolean(),
    side: fc.constantFrom("bottom", "top", "left", "right"),
    gap: fc.integer({ min: 0, max: 40 }),
    padding: fc.integer({ min: 0, max: 40 }),
    header: fc.integer({ min: 0, max: 30 }),
  },
  { requiredKeys: ["type"] },
);

const radialLayout = fc.record(
  {
    type: fc.constant("radial"),
    startAngle: fc.integer({ min: -180, max: 180 }),
    sweep: fc.integer({ min: 30, max: 360 }),
    clockwise: fc.boolean(),
    distance: fc.integer({ min: 0, max: 40 }),
    gap: fc.integer({ min: 0, max: 40 }),
    padding: fc.integer({ min: 0, max: 40 }),
  },
  { requiredKeys: ["type"] },
);

const treeLayout = fc.record(
  {
    type: fc.constant("tree"),
    side: fc.constantFrom("bottom", "top", "left", "right"),
    distance: fc.integer({ min: 0, max: 40 }),
    align: fc.constantFrom("center", "start", "end"),
    gap: fc.integer({ min: 0, max: 40 }),
    padding: fc.integer({ min: 0, max: 40 }),
  },
  { requiredKeys: ["type"] },
);

const size = fc.record({ width: fc.integer({ min: 4, max: 300 }), height: fc.integer({ min: 4, max: 200 }) });

function shape(depth: number, settings: Required<TreeSettings>): fc.Arbitrary<Shape> {
  const children = depth <= 0 ? fc.constant([]) : fc.array(shape(depth - 1, settings), { maxLength: settings.maxChildren });
  return fc.record({
    layout: fc.oneof(gridLayout, radialLayout, treeLayout),
    mode: fc.constantFrom<Mode>("nested", "linked"),
    fit: fc.option(fc.constantFrom(...settings.fits), { nil: undefined }),
    size: fc.option(size, { nil: undefined }),
    children,
  });
}

/** This function gives a generator of random trees. Each node has a different identifier: `n0`, `n1`, and so on. */
export function treeArbitrary(settings: TreeSettings = {}): fc.Arbitrary<NodeSpec> {
  const full: Required<TreeSettings> = { maxDepth: 4, maxChildren: 4, fits: ["grow", "scale"], ...settings };
  return shape(full.maxDepth, full).map((s) => {
    let next = 0;
    const toSpec = (x: Shape): NodeSpec => ({
      id: `n${String(next++)}`,
      layout: x.layout,
      mode: x.mode,
      ...(x.fit === undefined ? {} : { fit: x.fit }),
      ...(x.size === undefined ? {} : { size: x.size }),
      children: x.children.map(toSpec),
    });
    return toSpec(s);
  });
}

/** This function gives a generator of random inputs, with extra edges between random nodes. */
export function inputArbitrary(settings: TreeSettings = {}): fc.Arbitrary<LayoutInput> {
  return treeArbitrary(settings).chain((root) => {
    const ids = idsOf(root);
    const edge = fc.record({ source: fc.constantFrom(...ids), target: fc.constantFrom(...ids) }).filter((e) => e.source !== e.target);
    return (ids.length < 2 ? fc.constant([]) : fc.array(edge, { maxLength: 4 })).map((edges) => ({ root, edges }));
  });
}

/** This function gives a generator of random layout options. */
export function optionsArbitrary(): fc.Arbitrary<LayoutOptions> {
  return fc.record({
    spacing: fc.integer({ min: 0, max: 48 }),
    nodeSize: fc.record({ width: fc.integer({ min: 8, max: 200 }), height: fc.integer({ min: 8, max: 120 }) }),
    router: fc.constantFrom("straight", "orthogonal"),
    treeEdges: fc.constantFrom("linked", "all", "none"),
  });
}

/** This function gives the identifiers of a tree, in pre-order. */
export function idsOf(root: NodeSpec): string[] {
  const out: string[] = [];
  const stack: NodeSpec[] = [root];
  for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
    out.push(n.id);
    const children = n.children ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i];
      if (c !== undefined) stack.push(c);
    }
  }
  return out;
}
