import { describe, expect, it } from "vitest";
import { layout } from "../core/engine.ts";
import type { Layout } from "../core/model.ts";
import { examples } from "../examples/index.ts";
import { defectsOf } from "../test/invariants.ts";
import { esc, toSVG } from "./index.ts";

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
