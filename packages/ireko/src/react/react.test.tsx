// @vitest-environment happy-dom
import { act, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEngine, layout, type LayoutInput } from "../core/index.ts";
import { createViewport } from "../render/viewport.ts";
import { LayoutSvg, LayoutView, useLayout, type RendererKind } from "./index.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const input: LayoutInput = { root: { id: "r", mode: "nested", children: [{ id: "a", label: "<A>" }, { id: "b" }] }, edges: [{ source: "a", target: "b" }] };
const clipped: LayoutInput = { root: { id: "v w", mode: "nested", fit: "clip", size: { width: 100, height: 60 }, children: [{ id: "x" }, { id: "y" }] } };

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function mountReact(element: ReactElement): { container: HTMLDivElement; rerender: (next: ReactElement) => void; unmount: () => void } {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 400 });
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => act(() => root.unmount()),
  };
}

describe("LayoutSvg", () => {
  it("draws each box and each edge, and escapes the labels", () => {
    const html = renderToStaticMarkup(<LayoutSvg layout={layout(input)} title="A title" />);
    expect(html.match(/<rect/g)).toHaveLength(3);
    expect(html.match(/<polyline/g)).toHaveLength(1);
    expect(html).toContain("<title>A title</title>");
    expect(html).toContain("&lt;A&gt;");
    expect(html).toContain('stroke-dasharray="4 3"');
  });

  it("draws the tree edges of a linked node", () => {
    const html = renderToStaticMarkup(<LayoutSvg layout={layout({ root: { id: "p", children: [{ id: "c" }] } })} />);
    expect(html.match(/<polyline/g)).toHaveLength(1);
    expect(html).not.toContain("stroke-dasharray");
  });

  it("cuts the content of a clipped container", () => {
    const html = renderToStaticMarkup(<LayoutSvg layout={layout(clipped)} theme={{ nodeFill: "#abcdef" }} padding={0} />);
    expect(html).toContain('<clipPath id="ireko-clip-v_20w">');
    expect(html).toContain('clip-path="url(#ireko-clip-v_20w)"');
    expect(html).toContain("#abcdef");
  });
});

describe("useLayout", () => {
  it("gives the layout, and keeps it while the input stays", () => {
    const seen: unknown[] = [];
    function Probe({ value, engineOn }: { value: LayoutInput; engineOn: boolean }): ReactElement {
      const out = useLayout(value, undefined, engineOn ? engine : undefined);
      seen.push(out);
      return <span>{out.nodes.length}</span>;
    }
    const engine = createEngine();
    const view = mountReact(<Probe value={input} engineOn={false} />);
    expect(view.container.textContent).toBe("3");
    view.rerender(<Probe value={input} engineOn={false} />);
    expect(seen[1]).toBe(seen[0]);
    view.rerender(<Probe value={clipped} engineOn />);
    expect(view.container.textContent).toBe("3");
    view.unmount();
  });
});

describe("LayoutView", () => {
  for (const renderer of ["svg", "dom", "canvas"] as const) {
    it(`mounts the ${renderer} renderer and updates it`, () => {
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
      const view = mountReact(<LayoutView layout={layout(input)} renderer={renderer} duration={0} selected={["a"]} />);
      expect(view.container.querySelector(".ireko")).not.toBeNull();
      view.rerender(<LayoutView layout={layout(clipped)} renderer={renderer} duration={0} />);
      view.unmount();
      expect(view.container.innerHTML).toBe("");
    });
  }

  it("uses the default time of the animation", () => {
    const view = mountReact(<LayoutView layout={layout(input)} />);
    view.rerender(<LayoutView layout={layout(clipped)} />);
    view.unmount();
    expect(view.container.innerHTML).toBe("");
  });

  it("changes the renderer, shares a viewport, and reports a click on a box", () => {
    const viewport = createViewport();
    const picked: (string | undefined)[] = [];
    function App(): ReactElement {
      const [kind, setKind] = useState<RendererKind>("svg");
      return (
        <div>
          <button type="button" onClick={() => setKind("dom")}>
            dom
          </button>
          <LayoutView layout={layout(input)} renderer={kind} viewport={viewport} duration={0} interactive={false} theme={{ accent: "red" }} onPick={(id) => picked.push(id)} />
        </div>
      );
    }
    const view = mountReact(<App />);
    act(() => view.container.querySelector("button")?.click());
    const host = view.container.querySelector<HTMLDivElement>(".ireko")?.parentElement;
    if (host === null || host === undefined) throw new Error("host");
    const a = layout(input).nodes.find((n) => n.id === "a");
    if (a === undefined) throw new Error("a");
    const v = viewport.get();
    const point = { clientX: (a.x + 3) * v.k + v.x, clientY: (a.y + 3) * v.k + v.y };
    act(() => {
      host.dispatchEvent(new PointerEvent("pointerdown", point));
      host.dispatchEvent(new PointerEvent("pointerup", point));
    });
    act(() => {
      host.dispatchEvent(new PointerEvent("pointerup", point));
      host.dispatchEvent(new PointerEvent("pointerdown", point));
      host.dispatchEvent(new PointerEvent("pointerup", { clientX: point.clientX + 50, clientY: point.clientY }));
    });
    expect(picked).toEqual(["a", "a"]);
    view.unmount();
  });
});
