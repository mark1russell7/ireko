import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LayoutInput, NodeSpec } from "../core/index.ts";
import { grid, layout, node, radial } from "../core/index.ts";
import { treeArbitrary } from "../test/arbitrary.ts";
import { parse, print } from "./index.ts";

const ok = (text: string, strategies?: readonly string[]): LayoutInput => {
  const r = parse(text, strategies === undefined ? {} : { strategies });
  if (!r.ok) throw new Error(`${String(r.error.line)}:${String(r.error.column)} ${r.error.message}`);
  return r.input;
};
const error = (text: string) => {
  const r = parse(text);
  if (r.ok) throw new Error("The text parsed.");
  return r.error;
};

/** This function gives the canonical form of a spec: the form that the printer and the parser keep. */
function canonical(n: NodeSpec): NodeSpec {
  const out: Record<string, unknown> = { id: n.id };
  if (n.label !== undefined && n.label !== n.id) out["label"] = n.label;
  if (n.layout !== undefined) {
    if (typeof n.layout === "string") out["layout"] = n.layout;
    else {
      const entries = Object.entries(n.layout).filter(([k, v]) => k !== "type" && v !== undefined);
      out["layout"] = entries.length === 0 ? n.layout.type : { type: n.layout.type, ...Object.fromEntries(entries) };
    }
  }
  if (n.mode === "nested") out["mode"] = "nested";
  if (n.fit !== undefined && n.fit !== "grow") out["fit"] = n.fit;
  if (n.size !== undefined && (n.size.width !== undefined || n.size.height !== undefined)) out["size"] = n.size;
  if ((n.children ?? []).length > 0) out["children"] = (n.children ?? []).map(canonical);
  return out as unknown as NodeSpec;
}

describe("parse", () => {
  it("reads a tree, the labels, the strategies with options, the modes, the fits, the sizes and the edges", () => {
    const input = ok(`# A comment
root grid(columns: 3, uniform: true, side: right) {
  api "The API" radial nested { auth users billing }
  web nested 300x_ { home, search; cart }  // another comment
  'grid' scale _x100 { x y }
}
api -> web "calls"
auth -> home`);
    expect(input.root.layout).toEqual({ type: "grid", columns: 3, uniform: true, side: "right" });
    const [api, web, quoted] = input.root.children ?? [];
    expect(api).toEqual({ id: "api", label: "The API", layout: "radial", mode: "nested", children: [{ id: "auth" }, { id: "users" }, { id: "billing" }] });
    expect(web?.size).toEqual({ width: 300 });
    expect(web?.children?.map((c) => c.id)).toEqual(["home", "search", "cart"]);
    expect(quoted).toMatchObject({ id: "grid", fit: "scale", size: { height: 100 } });
    expect(input.edges).toEqual([{ source: "api", target: "web", label: "calls" }, { source: "auth", target: "home" }]);
  });

  it("reads options over several lines, string values and escapes", () => {
    const input = ok(`r "a \\"quoted\\" label\\n" grid(
      columns: 2,
      justify: "end"
    ) { a }`);
    expect(input.root.label).toBe('a "quoted" label\n');
    expect(input.root.layout).toEqual({ type: "grid", columns: 2, justify: "end" });
  });

  it("knows the strategies that a user registers", () => {
    expect(ok("r fan { a b }", ["grid", "radial", "fan"]).root.layout).toBe("fan");
    expect(ok("r tree(side: left) { a b }").root.layout).toEqual({ type: "tree", side: "left" });
    expect(print({ root: { id: "tree", children: [{ id: "a" }] } })).toContain("'tree'");
    expect(ok("r { fan }").root.children?.map((c) => c.id)).toEqual(["fan"]);
  });

  it("gives the place of each syntax error", () => {
    expect(error("")).toMatchObject({ line: 1, column: 1 });
    expect(error("").message).toContain("no node");
    expect(error("a\nb")).toMatchObject({ line: 2, column: 1 });
    expect(error("a b {").message).toBe("The block has no closing brace.");
    expect(error("a grid(columns 3)").message).toContain("needs a colon");
    expect(error("a grid(columns: )").message).toContain("has no value");
    expect(error("a grid(: 3)").message).toContain("where an option name must be");
    expect(error("a grid(columns: 3 b)").message).toContain('where a comma or ")" must be');
    expect(error("a grid(columns: 3").message).toContain("no closing parenthesis");
    expect(error("a -> ").message).toContain("has no target");
    expect(error('a "x').message).toContain("without its closing quote");
    expect(error("a 'x").message).toContain("quoted identifier");
    expect(error("a ! b")).toMatchObject({ column: 3, length: 1 });
    expect(error("a grid grid").message).toContain("two strategies");
    expect(error('a "x" "y"').message).toContain("two labels");
    expect(error("a nested linked").message).toContain("two modes");
    expect(error("a scale clip").message).toContain("two fit policies");
    expect(error("a 1x2 3x4").message).toContain("two sizes");
    expect(error("a -> b c").message).toContain("after the end of a statement");
    expect(error("{ a }").message).toContain("where a node identifier must be");
  });

  it("describes each kind of token in an error", () => {
    expect(error('r { "label" }').message).toContain('the label "label"');
    expect(error("r { : }").message).toContain('":"');
    expect(error("r grid(\n: 1)").message).toContain('":"');
    expect(error("a -> b\n)").message).toContain('")"');
    expect(error("a -> b \n").message).toContain("no node");
  });
});

describe("print", () => {
  it("writes the canonical form", () => {
    const text = print({
      root: grid("root", { columns: 3, label: "Root" }, radial.nested("api", "auth", "users"), node("web", { label: "web", size: { width: 300 } }), node("w h", { fit: "clip" })),
      edges: [{ source: "api", target: "web", label: 'a "b"' }],
    });
    expect(text).toBe(`root "Root" grid(columns: 3) {
  api radial nested { auth users }
  web 300x_
  'w h' clip
}
api -> web "a \\"b\\""
`);
  });

  it("puts long lines of leaves on separate lines, and quotes values that need quotes", () => {
    const many = grid("r", ...Array.from({ length: 30 }, (_, i) => `leaf-${String(i)}`));
    expect(print({ root: many }).split("\n").length).toBeGreaterThan(30);
    expect(print({ root: { id: "r", layout: { type: "grid", note: "two words", flag: "true", n: "12", obj: { a: 1 } } } })).toBe(`r grid(note: "two words", flag: "true", n: "12", obj: "{\\"a\\":1}")\n`);
    expect(print({ root: { id: "r", layout: { type: "grid" } } })).toBe("r grid\n");
  });

  it("P10: print and parse give the input again", () => {
    fc.assert(
      fc.property(treeArbitrary({ fits: ["grow", "scale", "clip"] }), (root) => {
        const input = { root, edges: [{ source: root.id, target: root.id, label: "loop" }] };
        const back = parse(print(input));
        if (!back.ok) throw new Error(back.error.message);
        expect(canonical(back.input.root)).toEqual(canonical(root));
        expect(back.input.edges).toEqual([{ source: root.id, target: root.id, label: "loop" }]);
      }),
      { numRuns: 300 },
    );
  });

  it("gives text that lays out the same as the builder", () => {
    const spec = grid("root", { columns: 2 }, radial.nested("a", "a1", "a2"), grid("b", { side: "right" }, "b1"));
    const back = parse(print({ root: spec }));
    if (!back.ok) throw new Error(back.error.message);
    expect(layout(back.input)).toEqual(layout({ root: spec }));
  });
});
