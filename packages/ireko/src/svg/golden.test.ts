import { describe, expect, it } from "vitest";
import { layout } from "../core/engine.ts";
import type { Layout } from "../core/model.ts";
import { examples } from "../examples/index.ts";
import { defectsOf } from "../test/invariants.ts";
import { esc } from "./escape.ts";
import { toSVG } from "./index.ts";

/** This function writes a layout as JSON, with numbers rounded to three decimals, so a golden file is short and stable. */
function goldenJson(out: Layout): string {
  return `${JSON.stringify(out, (_key, value: unknown) => (typeof value === "number" ? Math.round(value * 1000) / 1000 || 0 : value), 2)}\n`;
}

describe("golden files of the examples", () => {
  for (const example of examples) {
    it(`lays out the example ${example.name}`, async () => {
      const out = layout(example.input, example.options);
      expect(out.issues).toEqual([]);
      // A clipped container hides overlaps, so the check of an example with the fit clip skips overlaps.
      const hidden = JSON.stringify(example.input).includes('"clip"');
      expect(defectsOf(out).filter((d) => !(hidden && d.startsWith("overlap")))).toEqual([]);
      await expect(goldenJson(out)).toMatchFileSnapshot(`../__golden__/${example.name}.json`);
      await expect(toSVG(out, { title: example.title })).toMatchFileSnapshot(`../__golden__/${example.name}.svg`);
    });
  }
});

describe("toSVG", () => {
  it("escapes the text of the labels and identifiers", () => {
    const svg = toSVG(layout({ root: { id: `a"<&>'`, label: "<script>alert(1)</script>" } }));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain('data-id="a&quot;&lt;&amp;&gt;&#39;"');
    expect(esc("plain")).toBe("plain");
  });

  it("draws an arrowhead at the target of each edge with arrows: true, in the color of the edge", () => {
    const input = { root: { id: "r", children: [{ id: "a" }, { id: "b" }] }, edges: [{ source: "a", target: "b" }] };
    const plain = toSVG(layout(input));
    expect(plain).not.toContain("<marker");
    expect(plain).not.toContain("marker-end");
    const svg = toSVG(layout(input), { arrows: true, theme: { edge: "#111111", extraEdge: "#222222" } });
    expect(svg.match(/<marker /g)).toHaveLength(2);
    expect(svg).toContain('<marker id="ireko-arrow" ');
    expect(svg).toContain('fill="#111111"');
    expect(svg).toContain('fill="#222222"');
    // The root adds a tree edge to each linked child. The edge from a to b is an extra edge.
    expect(svg.match(/<polyline /g)).toHaveLength(3);
    expect(svg.match(/<polyline [^>]*marker-end="url\(#ireko-arrow\)"/g)).toHaveLength(2);
    expect(svg.match(/<polyline [^>]*marker-end="url\(#ireko-arrow-extra\)"/g)).toHaveLength(1);
    expect(toSVG(layout({ root: { id: "r" } }), { arrows: true })).not.toContain("<defs>");
  });

  it("draws a label with line breaks as one line for each part, at the center of the box", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a", label: "first\nsecond & third" }, { id: "b", label: "one line" }] } });
    const svg = toSVG(out);
    const box = out.nodes.find((n) => n.id === "a")!;
    const spans = [...svg.matchAll(/<tspan x="([\d.-]+)" y="([\d.-]+)">([^<]*)<\/tspan>/g)];
    expect(spans.map((span) => span[3])).toEqual(["first", "second &amp; third"]);
    const [first = Number.NaN, second = Number.NaN] = spans.map((span) => Number(span[2]));
    expect((first + second) / 2).toBeCloseTo(box.y + box.height / 2, 2);
    expect(second - first).toBeCloseTo(13 * 1.3, 2);
    expect(svg).toContain(">one line</text>");
  });

  it("draws the labels of the edges, and leaves them out with labels: false", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }, { id: "b" }] }, edges: [{ source: "a", target: "b", label: "a & b" }, { source: "b", target: "a", label: "" }] });
    const svg = toSVG(out, { theme: { background: "transparent", nodeFill: "#fafafa" } });
    expect(svg.match(/class="ireko-edge-label"/g)).toHaveLength(1);
    expect(svg).toContain(">a &amp; b</text>");
    expect(svg).toContain('stroke="#fafafa"');
    expect(toSVG(out, { labels: false })).not.toContain("ireko-edge-label");
    expect(toSVG(layout({ root: { id: "r" } }))).not.toContain("ireko-edge-labels");
  });

  it("has options for the theme, the labels and the background", () => {
    const out = layout({ root: { id: "r", mode: "nested", children: [{ id: "a" }] } });
    const svg = toSVG(out, { labels: false, background: false, padding: 0, theme: { nodeFill: "#123456" } });
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("ireko-background");
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain(`viewBox="0 0 ${String(out.bounds.width)} ${String(out.bounds.height)}"`);
  });

  it("draws a layout that a user changed, with an edge to a box that is not in it", () => {
    const out = layout({ root: { id: "r", children: [{ id: "a" }] } });
    const svg = toSVG({ ...out, nodes: out.nodes.filter((n) => n.id === "r") });
    expect(svg).toContain("<polyline");
  });

  it("cuts the content of a clipped container", () => {
    const svg = toSVG(layout({ root: { id: "v w", mode: "nested", fit: "clip", size: { width: 100, height: 60 }, children: [{ id: "a" }, { id: "b" }] } }));
    expect(svg).toContain('<clipPath id="ireko-clip-v_20w">');
    expect(svg).toContain('clip-path="url(#ireko-clip-v_20w)"');
  });
});
