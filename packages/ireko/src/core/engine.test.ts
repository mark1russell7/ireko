import { BUILTIN_STRATEGY_NAMES } from "./strategies/names.ts";
import { describe, expect, it } from "vitest";
import { defectsOf } from "../test/invariants.ts";
import { createEngine, layout, builtinStrategies } from "./engine.ts";
import { IrekoError, type Layout, type NodeSpec, type TraceEvent } from "./model.ts";
import { defineRouter } from "./router.ts";
import { defineStrategy } from "./strategy.ts";

const node = (out: Layout, id: string) => {
  const n = out.nodes.find((x) => x.id === id);
  if (n === undefined) throw new Error(`no node ${id}`);
  return n;
};
const codes = (out: Layout): string[] => out.issues.map((i) => i.code);

/** The default demo of Jqy 0.x. The old engine put 55 overlapping pairs in it. */
const DEMO: NodeSpec = {
  id: "root",
  children: [
    { id: "A", layout: "radial", mode: "nested", children: [{ id: "A1" }, { id: "A2" }, { id: "A3" }] },
    { id: "B", layout: "grid", children: [{ id: "B1" }, { id: "B2" }, { id: "B3" }, { id: "B4" }] },
    { id: "C", layout: "radial", mode: "nested", children: [{ id: "C1" }, { id: "C2" }, { id: "C3" }, { id: "C4" }] },
  ],
};

describe("layout", () => {
  it("lays out the default demo of Jqy 0.x without a defect", () => {
    const out = layout({ root: DEMO });
    expect(out.issues).toEqual([]);
    expect(defectsOf(out)).toEqual([]);
    expect(out.nodes.map((n) => n.id)).toEqual(["root", "A", "A1", "A2", "A3", "B", "B1", "B2", "B3", "B4", "C", "C1", "C2", "C3", "C4"]);
  });

  it("gives a single root its default size at the origin", () => {
    const out = layout({ root: { id: "only" } });
    expect(out.nodes).toEqual([
      { id: "only", label: "only", x: 0, y: 0, width: 120, height: 48, depth: 0, mode: "linked", layout: "grid", scale: 1, clip: false, childCount: 0 },
    ]);
    expect(out.bounds).toEqual({ x: 0, y: 0, width: 120, height: 48 });
    expect(out.edges).toEqual([]);
  });

  it("copies the label and the data of the user", () => {
    const out = layout({ root: { id: "a", label: "Alpha", data: { k: 1 } } });
    expect(node(out, "a").label).toBe("Alpha");
    expect(node(out, "a").data).toEqual({ k: 1 });
  });

  it("puts linked children below their parent, with an edge to each", () => {
    const out = layout({ root: { id: "p", children: [{ id: "a" }, { id: "b" }] } });
    expect(node(out, "a").y).toBeGreaterThan(node(out, "p").y + node(out, "p").height);
    expect(out.edges.map((e) => e.id)).toEqual(["p->a", "p->b"]);
  });

  it("puts nested children inside their container, without edges", () => {
    const out = layout({ root: { id: "p", mode: "nested", children: [{ id: "a" }, { id: "b" }] } });
    expect(node(out, "a").container).toBe("p");
    expect(out.edges).toEqual([]);
    expect(defectsOf(out)).toEqual([]);
  });

  it("gives the header space at the top of a container, and counts the padding as a part of it", () => {
    const out = layout({ root: { id: "p", mode: "nested", layout: { type: "grid", header: 30, padding: 10 }, children: [{ id: "a" }] } });
    expect(node(out, "a").y - node(out, "p").y).toBe(30);
    const big = layout({ root: { id: "p", mode: "nested", layout: { type: "grid", header: 30, padding: 40 }, children: [{ id: "a" }] } });
    expect(node(big, "a").y - node(big, "p").y).toBe(40);
  });

  it("gives a container with a size in its spec at least that size", () => {
    const out = layout({ root: { id: "p", mode: "nested", size: { width: 900, height: 700 }, children: [{ id: "a" }] } });
    expect(node(out, "p").width).toBe(900);
    expect(node(out, "p").height).toBe(700);
  });

  it("uses the measure function for the size of a leaf", () => {
    const out = layout({ root: { id: "p", children: [{ id: "short", label: "ab" }, { id: "long", label: "abcdefghij" }] } }, {
      measure: (n) => ({ width: (n.label ?? n.id).length * 10, height: 20 }),
    });
    expect(node(out, "short").width).toBe(20);
    expect(node(out, "long").width).toBe(100);
  });

  it("ignores a measure function that gives a bad size", () => {
    const out = layout({ root: { id: "a" } }, { measure: () => ({ width: Number.NaN, height: 5 }) });
    expect(node(out, "a").width).toBe(120);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(layout({ root: DEMO }))).toBe(JSON.stringify(layout({ root: DEMO })));
  });
});

describe("fit policies", () => {
  const big: NodeSpec[] = Array.from({ length: 9 }, (_, i) => ({ id: `c${String(i)}` }));

  it("scale: the content becomes smaller and stays inside the container", () => {
    const out = layout({ root: { id: "p", mode: "nested", fit: "scale", size: { width: 200, height: 150 }, children: big } });
    expect(node(out, "p").width).toBe(200);
    expect(node(out, "c0").scale).toBeLessThan(1);
    expect(defectsOf(out)).toEqual([]);
  });

  it("scale: a content that fits keeps the scale 1", () => {
    const out = layout({ root: { id: "p", mode: "nested", fit: "scale", size: { width: 2000, height: 2000 }, children: big } });
    expect(node(out, "c0").scale).toBe(1);
  });

  it("clip: the content keeps its size, and the container asks the renderer to cut it", () => {
    const out = layout({ root: { id: "p", mode: "nested", fit: "clip", size: { width: 200, height: 150 }, children: big } });
    expect(node(out, "p").clip).toBe(true);
    expect(node(out, "c0").scale).toBe(1);
    expect(codes(out)).not.toContain("ESCAPE");
  });

  it("grows a fixed size that cannot hold its padding", () => {
    const out = layout({ root: { id: "p", mode: "nested", fit: "scale", size: { width: 10, height: 10 }, children: [{ id: "a" }] } });
    expect(codes(out)).toContain("INVALID_SIZE");
    expect(node(out, "p").width).toBeGreaterThan(10);
    expect(defectsOf(out)).toEqual([]);
  });
});

describe("findings of the input", () => {
  it("skips a duplicate identifier and its subtree", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }, { id: "a", children: [{ id: "x" }] }] } });
    expect(codes(out)).toEqual(["DUPLICATE_ID"]);
    expect(out.nodes.map((n) => n.id)).toEqual(["r", "a"]);
  });

  it("skips a node without an identifier", () => {
    const out = layout({ root: { id: "r", children: [{ id: "" }, { id: "b" }] } });
    expect(codes(out)).toEqual(["EMPTY_ID"]);
    expect(out.nodes.map((n) => n.id)).toEqual(["r", "b"]);
  });

  it("skips a child that is not a node", () => {
    const out = layout({ root: { id: "r", children: [null as unknown as NodeSpec, { id: "b" }] } });
    expect(codes(out)).toEqual(["EMPTY_ID"]);
  });

  it("uses grid for an unknown strategy", () => {
    const out = layout({ root: { id: "r", layout: "spiral", children: [{ id: "a" }] } });
    expect(codes(out)).toEqual(["UNKNOWN_LAYOUT"]);
    expect(node(out, "r").layout).toBe("grid");
  });

  it("uses grid for a layout object without a type", () => {
    const out = layout({ root: { id: "r", layout: { columns: 2 } as never, children: [{ id: "a" }] } });
    expect(codes(out)).toEqual(["INVALID_OPTION"]);
  });

  it("uses the default for a bad option, an unknown option, a bad mode and a bad fit", () => {
    const out = layout({
      root: {
        id: "r",
        mode: "inside" as never,
        fit: "squash" as never,
        layout: { type: "grid", columns: -2, colour: "red", gap: -1 },
        children: [{ id: "a" }],
      },
    });
    expect(codes(out).toSorted()).toEqual(["INVALID_OPTION", "INVALID_OPTION", "INVALID_OPTION", "INVALID_OPTION", "INVALID_OPTION"]);
    expect(node(out, "r").mode).toBe("linked");
  });

  it("checks the type of each option", () => {
    const out = layout({ root: { id: "r", layout: { type: "radial", clockwise: "yes", sweep: 1000, startAngle: Number.NaN }, children: [{ id: "a" }] } });
    expect(out.issues.map((i) => i.detail?.["option"])).toEqual(["clockwise", "sweep", "startAngle"]);
  });

  it("checks enum and integer options", () => {
    const out = layout({ root: { id: "r", layout: { type: "grid", side: "middle", columns: 1.5 }, children: [{ id: "a" }] } });
    expect(out.issues.map((i) => i.detail?.["option"])).toEqual(["side", "columns"]);
  });

  it("uses the default for a bad size", () => {
    const out = layout({ root: { id: "r", size: { width: -5, height: Number.POSITIVE_INFINITY } } });
    expect(codes(out)).toEqual(["INVALID_SIZE", "INVALID_SIZE"]);
    expect(node(out, "r").width).toBe(120);
  });

  it("uses the default for a null size, and does not throw", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a", size: null as never }, { id: "b" }] } });
    expect(codes(out)).toEqual(["INVALID_SIZE"]);
    expect(node(out, "a").width).toBe(120);
  });

  it("uses the defaults for bad layout options", () => {
    const out = layout({ root: { id: "r" } }, { spacing: -3, nodeSize: { width: 0, height: 5 }, header: Number.NaN, origin: { x: Number.NaN, y: 0 } });
    expect(codes(out)).toEqual(["INVALID_OPTION", "INVALID_SIZE", "INVALID_OPTION"]);
    expect(node(out, "r").x).toBe(0);
  });

  it("skips an edge to an unknown node, and a loop", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }] }, edges: [{ source: "a", target: "zzz" }, { source: "a", target: "a" }] });
    expect(codes(out)).toEqual(["UNKNOWN_EDGE_END", "SELF_LOOP"]);
    expect(out.edges.map((e) => e.kind)).toEqual(["tree"]);
  });

  it("skips a null or undefined edge, and does not throw", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }, { id: "b" }] }, edges: [null as never, undefined as never, { source: "a", target: "b" }] });
    expect(codes(out)).toEqual(["UNKNOWN_EDGE_END", "UNKNOWN_EDGE_END"]);
    expect(out.issues.map((i) => i.edge)).toEqual(["edge-0", "edge-1"]);
    expect(out.edges.filter((e) => e.kind === "extra")).toHaveLength(1);
  });

  it("renames a duplicate edge identifier", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }, { id: "b" }] }, edges: [{ id: "x", source: "a", target: "b" }, { id: "x", source: "b", target: "a", label: "back", data: 7 }] });
    expect(out.edges.filter((e) => e.kind === "extra").map((e) => e.id)).toEqual(["x", "x#2"]);
    expect(out.edges.at(-1)?.label).toBe("back");
    expect(out.edges.at(-1)?.data).toBe(7);
    expect(codes(out)).toEqual(["DUPLICATE_ID"]);
  });

  it("throws a TypeError for an input without a root", () => {
    expect(() => layout({} as never)).toThrow(TypeError);
    expect(() => layout(null as never)).toThrow(TypeError);
  });
});

/** This function gives a chain of nodes: each node has one child. */
function chain(length: number): NodeSpec {
  let n: NodeSpec = { id: `n${String(length - 1)}` };
  for (let i = length - 2; i >= 0; i--) n = { id: `n${String(i)}`, children: [n] };
  return n;
}

describe("limits", () => {
  it("lays out a chain of 9000 nodes without a stack overflow", () => {
    const out = layout({ root: chain(9000) }, { audit: false });
    expect(out.nodes).toHaveLength(9000);
    expect(out.issues).toEqual([]);
  });

  it("stops at the depth limit", () => {
    const out = createEngine({ limits: { maxDepth: 10 } }).layout({ root: chain(50) });
    expect(out.nodes).toHaveLength(11);
    expect(codes(out)).toEqual(["LIMIT_DEPTH"]);
  });

  it("stops at the node limit", () => {
    const out = createEngine({ limits: { maxNodes: 5 } }).layout({ root: { id: "r", children: Array.from({ length: 10 }, (_, i) => ({ id: `c${String(i)}` })) } });
    expect(out.nodes).toHaveLength(5);
    expect(codes(out)).toEqual(["LIMIT_NODES"]);
  });

  it("keeps the first children at the child limit", () => {
    const out = createEngine({ limits: { maxChildren: 3 } }).layout({ root: { id: "r", children: Array.from({ length: 10 }, (_, i) => ({ id: `c${String(i)}` })) } });
    expect(out.nodes.map((n) => n.id)).toEqual(["r", "c0", "c1", "c2"]);
    expect(codes(out)).toEqual(["LIMIT_CHILDREN"]);
  });
});

describe("strict mode", () => {
  it("throws an IrekoError with each error", () => {
    let caught: unknown;
    try {
      layout({ root: { id: "r", layout: "spiral", children: [{ id: "a" }, { id: "a" }] } }, { strict: true });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(IrekoError);
    expect((caught as IrekoError).issues.map((i) => i.code)).toEqual(["UNKNOWN_LAYOUT", "DUPLICATE_ID"]);
    expect((caught as IrekoError).message).toContain("(and 1 more)");
  });

  it("does not throw for warnings", () => {
    expect(() => layout({ root: { id: "r", mode: "x" as never } }, { strict: true })).not.toThrow();
  });

  it("gives a message for an empty list", () => {
    expect(new IrekoError([]).message).toBe("The layout failed.");
  });
});

describe("extension points", () => {
  const column = defineStrategy<{ step: number }>({
    type: "column",
    description: "The column strategy puts the children in one column.",
    options: { step: { type: "number", default: 10, min: 0, description: "The distance between two children." } },
    arrange: ({ children, options, self }) => {
      let y = self.height + options.step;
      return {
        offsets: children.map((c) => {
          const at = { x: 0, y: y - c.extent.y };
          y += c.extent.height + options.step;
          return at;
        }),
      };
    },
  });

  it("registers a new strategy", () => {
    const engine = createEngine({ strategies: [column] });
    const out = engine.layout({ root: { id: "r", layout: { type: "column", step: 5 }, children: [{ id: "a" }, { id: "b" }] } });
    expect(out.issues).toEqual([]);
    expect(node(out, "a").y).toBe(48 + 5);
    expect(node(out, "b").y).toBe(48 + 5 + 48 + 5);
    expect(engine.strategies.has("column")).toBe(true);
  });

  it("extends an engine without a change to the old engine", () => {
    const base = createEngine();
    const more = base.extend({ strategies: [column], defaults: { spacing: 8 }, limits: { maxNodes: 3 } });
    expect(base.strategies.has("column")).toBe(false);
    expect(more.strategies.has("column")).toBe(true);
    expect(more.limits.maxNodes).toBe(3);
    expect(Object.isFrozen(base)).toBe(true);
  });

  it("uses grid when a strategy throws, or gives bad offsets", () => {
    const thrower = defineStrategy({ type: "boom", description: "It throws.", options: {}, arrange: () => { throw new Error("no"); } });
    const short = defineStrategy({ type: "short", description: "It gives too few offsets.", options: {}, arrange: () => ({ offsets: [] }) });
    const nan = defineStrategy({ type: "nan", description: "It gives a bad content.", options: {}, arrange: ({ children }) => ({ offsets: children.map(() => ({ x: 0, y: 0 })), content: { x: Number.NaN, y: 0, width: 1, height: 1 } }) });
    const bad = defineStrategy({ type: "bad", description: "It gives a bad offset.", options: {}, arrange: ({ children }) => ({ offsets: children.map(() => ({ x: Number.NaN, y: 0 })) }) });
    const thrown = defineStrategy({ type: "str", description: "It throws a string.", options: {}, arrange: () => { throw "plain"; } });
    const engine = createEngine({ strategies: [thrower, short, nan, bad, thrown] });
    for (const type of ["boom", "short", "nan", "bad", "str"]) {
      const out = engine.layout({ root: { id: "r", layout: type, mode: "nested", children: [{ id: "a" }] } });
      expect(codes(out)).toEqual(["STRATEGY_FAILED"]);
      expect(node(out, "r").layout).toBe("grid");
      expect(defectsOf(out)).toEqual([]);
    }
  });

  it("starts the audit of a strategy, and reports an audit that throws", () => {
    const audited = defineStrategy({ ...column, type: "audited", audit: ({ node: n, children }) => [{ code: "CUSTOM", severity: "warning", message: `${n.id} has ${String(children.length)}` }] });
    const broken = defineStrategy({ ...column, type: "broken", audit: () => { throw new Error("audit"); } });
    const engine = createEngine({ strategies: [audited, broken] });
    expect(engine.layout({ root: { id: "r", layout: "audited", children: [{ id: "a" }] } }).issues.map((i) => i.message)).toEqual(["r has 1"]);
    expect(codes(engine.layout({ root: { id: "r", layout: "broken", children: [{ id: "a" }] } }))).toEqual(["STRATEGY_FAILED"]);
  });

  it("registers a router, and uses straight for an unknown router or a failed route", () => {
    const fixed = defineRouter({ type: "fixed", description: "It gives two points.", route: () => [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
    const short = defineRouter({ type: "short", description: "It gives one point.", route: () => [{ x: 1, y: 2 }] });
    const boom = defineRouter({ type: "boom", description: "It throws.", route: () => { throw new Error("x"); } });
    const engine = createEngine({ routers: [fixed, short, boom] });
    const input = { root: { id: "r", children: [{ id: "a" }] } };
    expect(engine.layout(input, { router: "fixed" }).edges[0]?.points).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(codes(engine.layout(input, { router: "short" }))).toEqual(["ROUTER_FAILED"]);
    expect(codes(engine.layout(input, { router: "boom" }))).toEqual(["ROUTER_FAILED"]);
    expect(codes(engine.layout(input, { router: "nope" }))).toEqual(["UNKNOWN_ROUTER"]);
  });
});

describe("audit", () => {
  const pile = defineStrategy({
    type: "pile",
    description: "It puts each child at the same place, so the audit finds overlaps.",
    options: {},
    arrange: ({ children }) => ({ offsets: children.map(() => ({ x: 0, y: 100 })) }),
  });
  const engine = createEngine({ strategies: [pile] });

  it("finds overlapping boxes", () => {
    const out = engine.layout({ root: { id: "r", layout: "pile", children: [{ id: "a" }, { id: "b" }, { id: "c" }] } });
    expect(codes(out)).toEqual(["OVERLAP", "OVERLAP", "OVERLAP"]);
  });

  it("limits the number of overlap findings", () => {
    const children = Array.from({ length: 20 }, (_, i) => ({ id: `c${String(i)}` }));
    const out = engine.layout({ root: { id: "r", layout: "pile", children } });
    expect(codes(out)).toHaveLength(101);
    expect(out.issues.at(-1)?.detail?.["count"]).toBe(190);
  });

  it("never finds an escape, because the measure pass sizes each container to its content", () => {
    const far = defineStrategy({ type: "far", description: "It puts the child far from the content area.", options: {}, arrange: ({ children }) => ({ offsets: children.map(() => ({ x: 900, y: 900 })), content: { x: 0, y: 0, width: 10, height: 10 } }) });
    const out = createEngine({ strategies: [far] }).layout({ root: { id: "r", layout: "far", mode: "nested", children: [{ id: "a", size: { width: 500, height: 500 } }] } });
    expect(codes(out)).toEqual([]);
    expect(defectsOf(out)).toEqual([]);
  });

  it("does not run when the option audit is false", () => {
    const out = engine.layout({ root: { id: "r", layout: "pile", children: [{ id: "a" }, { id: "b" }] } }, { audit: false });
    expect(out.issues).toEqual([]);
  });
});

describe("edges", () => {
  const input = { root: { id: "r", children: [{ id: "a", mode: "nested" as const, children: [{ id: "x" }] }] }, edges: [{ source: "x", target: "r" }] };

  it("gives tree edges to the linked children only, by default", () => {
    expect(layout(input).edges.map((e) => e.id)).toEqual(["r->a", "edge-0"]);
  });

  it("gives tree edges to all children", () => {
    expect(layout(input, { treeEdges: "all" }).edges.map((e) => e.id)).toEqual(["r->a", "a->x", "edge-0"]);
  });

  it("gives no tree edges", () => {
    expect(layout(input, { treeEdges: "none" }).edges.map((e) => e.kind)).toEqual(["extra"]);
  });
});

describe("trace", () => {
  it("receives the output of each phase", () => {
    const events: TraceEvent[] = [];
    layout({ root: DEMO }, { trace: (e) => events.push(e) });
    expect(events.map((e) => e.phase)).toEqual(["normalize", "measure", "place", "route", "audit"]);
  });
});

describe("edge cases", () => {
  it("reports a root without an identifier, with no node in the finding", () => {
    const out = layout({ root: { id: "" } });
    expect(out.nodes).toEqual([]);
    expect(out.issues[0]?.code).toBe("EMPTY_ID");
    expect(out.issues[0]?.node).toBeUndefined();
    expect(out.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("keeps one valid dimension of a size", () => {
    const out = layout({ root: { id: "a", size: { width: 300 } } });
    expect(out.nodes[0]?.width).toBe(300);
    expect(out.nodes[0]?.height).toBe(48);
  });

  it("reports an edge from an unknown node", () => {
    const out = layout({ root: { id: "r" }, edges: [{ source: "ghost", target: "r" }] });
    expect(out.issues[0]?.message).toContain('"ghost"');
  });

  it("gives a message without a count for one error", () => {
    expect(new IrekoError([{ code: "X", severity: "error", message: "m" }]).message).toBe("X: m");
  });

  it("extends an engine with an empty configuration", () => {
    const more = createEngine().extend({});
    expect([...more.strategies.keys()]).toEqual(["grid", "radial", "tree", "layers"]);
    expect(BUILTIN_STRATEGY_NAMES).toEqual(builtinStrategies.map((s) => s.type));
  });

  it("reports a strategy without offsets, and things that throw values that are not errors", () => {
    const none = defineStrategy({ type: "none", description: "It gives no offsets.", options: {}, arrange: () => ({}) as never });
    const throwsAudit = defineStrategy({ type: "ta", description: "Its audit throws a string.", options: {}, arrange: ({ children }) => ({ offsets: children.map((_, i) => ({ x: i * 200, y: 100 })) }), audit: () => { throw "text"; } });
    const throwsRoute = defineRouter({ type: "tr", description: "It throws a string.", route: () => { throw "text"; } });
    const engine = createEngine({ strategies: [none, throwsAudit], routers: [throwsRoute] });
    expect(engine.layout({ root: { id: "r", layout: "none", children: [{ id: "a" }] } }).issues[0]?.message).toContain("It gave no offsets");
    expect(engine.layout({ root: { id: "r", layout: "ta", children: [{ id: "a" }] } }).issues.map((i) => i.message)).toEqual(['The audit of the strategy "ta" threw for the node "r": text']);
    expect(engine.layout({ root: { id: "r", children: [{ id: "a" }] } }, { router: "tr" }).issues[0]?.message).toContain("threw for the edge");
  });
});
