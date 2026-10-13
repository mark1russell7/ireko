# Layout System — Architecture & Specification

> A composable, renderer-agnostic layout engine with **Grid** and **Radial** strategies, supporting both **Graph** (free) and **Nested** (container) modes, multiple render backends (DOM / Canvas / ReactFlow), tunable iteration limits, and pluggable edge routers.

---

## 1) Vision & Goals

**What we’re building**

* A small, testable **core** that computes positions and sizes for nodes and edges, independent of any UI framework.
* A **pipeline** architecture that’s easy to reason about (parse → validate → plan → place → route → post).
* **Deterministic** layouts with knobs for spacing, node size, and strategy-specific tuning.
* First-class support for **nested containers** (parent owns the visual frame; children are laid out inside it).
* Multiple **render targets** (DOM, Canvas, ReactFlow) from the same **LayoutSnapshot**.
* Extensible **strategy**, **router**, **iterator**, and **theme** registries.

**Design principles**

* **Separation of concerns**: compute vs. render vs. UI controls.
* **Predictable defaults** with simple “escape hatches” (tuning overrides & registries).
* **Safety rails**: iteration limits and (optional) audits/logging to catch invalid states.
* **No coupling** to a specific graph library; supports tree input today, general graphs incrementally.

---

## 2) High-Level Architecture

```
App.tsx
 └── UI (playground & configurator)
      ├─ ParentChildFlow.tsx   ← demo app wiring controls → API
      ├─ ui/Configurator.tsx   ← edit scope, mode, layout, router, sliders
      ├─ ui/controls.tsx, styles.ts
      └─ (optional) ui/playground/Testbed.tsx ← matrix of Renderer×Mode×Layout

Layout API
 └── layout/api/
     ├─ createLayoutAPI(ctx) → { compute, toReactFlow, toSVG }
     └─ contracts.ts         ← GraphInput, ComputeOptions

Pipeline Engine
 └── layout/engine/
     ├─ engine.ts        ← Orchestrates phases
     ├─ context.ts       ← Registries (layouts, routers) + tuning + limits + logger
     └─ phases/
         ├─ parse.ts     ← Tree/graph normalization
         ├─ validate.ts  ← Graph sanity (ids, self-loops, missing nodes)
         ├─ plan.ts      ← Per-node chosen layout + mode
         ├─ place.ts     ← Strategy placement (Graph/Nested)
         ├─ route.ts     ← Edge router (line/ortho) → polylines
         └─ post.ts      ← Finalize snapshot

Strategies & Iterators
 └── layout/strategies/
     ├─ grid/            ← GridLayout (preferredSize, nestedFrames, placeChildren)
     └─ radial/          ← RadialLayout (graph & nested variants)
 └── layout/iterator/    ← Unit/angle/anchor mappers (grid centers, radial angles)

Routers
 └── layout/routers/     ← line.router.ts, ortho.router.ts
 └── layout/registries/  ← registries for Layout & Router

Core & Types
 └── core/geometry/      ← Vector, Shapes.Rectangle/Box (+ brands)
 └── layout/types.ts     ← Box, Wire, LayoutSnapshot, LayoutStats
 └── graph/              ← NodeConfig → Graph, validation

Rendering & Export
 └── render/ports/       ← DOMPort (SVG edges + absolutely positioned nodes), CanvasPort
 └── tooling/exporters/  ← toReactFlow, snapshotToSVG

Diagnostics (optional)
 └── core/logging/       ← ConsoleLogger/Noop + levels
 └── tooling/diagnostics/← audit.ts (layout invariants)
```

---

## 3) Core Data Model

* **Vector**: immutable 2D math (add/sub/div, clamp, rotate, halve, etc.).
  Branded via `ids-branding/brand` for runtime/type clarity: `"Position" | "Size" | "Offset" | "Center"`.
* **Shapes.Rectangle**: `{ size: Vector<"Size">, position: Vector<"Position"> }`.
* **Box**: `{ id, position (top-left), size, parentId?, depth }` (layout output).
* **Wire**: `{ id, source, target, polyline? }` (center-to-center by default; routers may add polylines).
* **LayoutSnapshot**: `{ boxes, wires, stats, version, meta? }`.
* **Graph input**:

  * Tree: `{ kind: "tree"; root: NodeConfig }`
  * Graph: `{ kind: "graph"; nodes: Record<string, NodeAttrs>; edges: Edge[] }`
* **NodeAttrs / NodeConfig**:

  * `layout: "grid" | "radial"`
  * `mode: "graph" | "nested"` — **Graph**: free nodes; **Nested**: node acts as container for its children.

---

## 4) Execution Flow (end-to-end)

```
compute(input, options)
  ├─ parse(input): normalize (tree → graph + parents)
  ├─ validate(graph): ids/self-loops/missing nodes → issues (non-fatal by default)
  ├─ plan(parsed): per-node chosen layout + mode (with defaults)
  ├─ place(parsed, plan, ctx, { nodeSize, spacing, collectOverlaps })
  │    • Tree path → Strategy.placeChildren() per node
  │    • Graph path → simple vertical stack (placeholder)
  ├─ route(snapshot, ctx, routerName): add wire polylines (line/ortho)
  └─ post(snapshot): stamp version (+ optional audit/meta)
```

**Coordinates**
Top-left origin (`y` grows downward). Boxes use **top-left**; routing uses **centers**.

---

## 5) Modes: Graph vs Nested

* **Graph mode** (`LayoutChildrenMode.GRAPH`)

  * Node draws as a **unit box** (`nodeSize`).
  * Its children are placed **around** it (Grid: cells placed around a center anchor; Radial: on a ring).
  * `parentId` is **undefined** (not visually clipped by the parent).

* **Nested mode** (`LayoutChildrenMode.NESTED`)

  * Node becomes a **container** (preferred size depends on its layout & children).
  * Its children’s centers are computed **inside the parent’s content box**.
  * Children get `parentId = parent.id` (renderers may clip to parent).
  * **Size policies (intent):** in nested **Grid**, each child fits its computed cell; in nested **Radial**, children fit an inner ring area. We target **square child boxes** to avoid tall/glued visuals (see Tuning §7 and Constraints §11).

---

## 6) Layout Strategies

### 6.1 GridLayout

* **preferredSize**:
  `inner = rowCol(count) * (nodeSize + 2 * itemPad(spacing))` then `+ 2 * outerPad(spacing)`.
* **placeChildren**

  * **Graph**: tile children around parent center using `rowCol` and anchor offset; centers are per-cell centers.
  * **Nested**: compute the parent **content rect** (`outerPad`), then place child **centers** at grid **centersInRect**.
* **nestedFrames**: creates a **MappedGrid** with per-cell rectangles (evenly split with remainder distribution).

### 6.2 RadialLayout

* **preferredSize**

  * **Nested**: `nestedRadialPreferred(count, nodeSize, spacing)` from tuning (diameter heuristic).
  * **Graph**: returns `nodeSize` (parent box is the unit).
* **placeChildren**

  * **Graph**: radius = `radialBase(nodeSize, spacing) * (1 + level * radialLevelScale)`; equally spaced angles.
  * **Nested**: compute inner radius from parent content box; equally spaced angles; centers on the ring.

---

## 7) Tuning (Layout knobs)

Provided in `layout/layout.tuning.ts` via `LayoutTuningConfig` (`Config<T>`):

* **Paddings**

  * `outerPad(spacing)`: padding between container border and content (for nested).
  * `itemPad(spacing)`: padding inside each grid cell.
* **Grid heuristic**

  * `rowCol(n)`: returns `(cols, rows)` (default: approximately square grid).
* **Anchoring (graph mode only)**

  * `anchor({ mode, parentSize, spacing })`: default offsets children below their parent.
* **Radial**

  * `startAngle()`, `clockwise()`, `angleOf(i, n, start, cw)`
  * Radius: `radialBase(nodeSize, spacing)`, `radialLevelScale()`, `minRadius()`
* **Nested scaling**

  * `nestedRadialPreferred(count, nodeSize, spacing)`
  * `nestedNodeScale(level)`, `nestedContainerScale(level)`
  * `nestedChildMaxFraction()` (cap child vs parent inner, used in radial nesting)

**Override points**

* Per-compute call with `tuningOverride` (temporarily mutates and restores defaults).
* Swap out strategies/iterators by providing a custom system context (`createDefaultSystem({ ... })`).

---

## 8) Iteration & Limits

`layout/limits/index.ts` exposes a `Config<LayoutLimits>`:

* `maxDepth`, `maxNodes`, `maxChildrenPerNode`, `maxEdges`, `maxOpsPerPass`
* `onLimit`: `"throw" | "truncate" | "warn"` (default warn)
* Loop helpers in `iteration/iterate.ts` bound loops safely (`mapIndexBounded`, `sliceBound`, etc.).

**Policy**
All strategies respect `maxChildrenPerNode` via `sliceBound`, so pathological inputs won’t explode runtime.

---

## 9) Renderers & Exporters

### DOMPort

* Absolutely positioned `<div data-node>` for nodes.
* `<svg>` for edges (lines or polylines).
* Nodes are sorted by depth; parent boxes visually appear below children when nested.
* **Note**: set `viewBox` to snapshot bounds to ensure edges are visible even when coordinates are outside the container.

### CanvasPort

* A single `<canvas>` with devicePixelRatio scaling.
* Full draw using `adapters/targets/canvas.core.ts` (`drawLayoutToCanvas`).
* (Internal helper includes a **dirty-rect** `CanvasRenderer2D` that can be used for partial redraws.)

### ReactFlow

* `toReactFlow(snapshot)` builds nodes (with `parentNode`/`extent="parent"` for nested) and edges.

### SVG export

* `snapshotToSVG(snapshot)` returns a standalone SVG string with nodes and edges; preserves z-order.

---

## 10) Public API

```ts
type GraphInput =
  | { kind: "tree"; root: NodeConfig }
  | { kind: "graph"; nodes: Record<string, NodeAttrs>; edges: Edge[] };

type ComputeOptions = {
  nodeSize?: Vector;     // default 110×54
  spacing?: number;      // default 24
  collectOverlaps?: boolean;
  limitsOverride?: Partial<IterationLimits>;
  tuningOverride?: Partial<LayoutTuning>;
  routerName?: "line" | "ortho";
};

const api = createLayoutAPI(optionalSystemContext);

const snapshot = api.compute(input, options);
const { nodes, edges } = api.toReactFlow(snapshot);
const svg = api.toSVG(snapshot);
```

---

## 11) Constraints & Invariants (Visual Correctness)

* **Coordinate space** is continuous; renderers apply pixel rounding as needed.
* **Nested containers** must allocate children within their **content** (outerPad) and honor **itemPad** (Grid).
* **Preferred sizes** for **Nested** parents come **only** from the strategy; **Graph** parents are unit boxes.
* **Square child policy (intent)** for **Nested Grid**:

  * Each child’s **size** should be a **square** that **fits** the computed cell’s `(width, height)`.
  * Containers may down-scale their nested children (`nestedContainerScale`) to avoid visual “glue”.
* **Edges** connect **centers**; routers may replace with polylines (e.g., orthogonal elbows).

> A diagnostics audit (`tooling/diagnostics/audit.ts`) can flag:
>
> * `NESTED_GRID_CHILD_NOT_SQUARE`
> * `NESTED_GRID_CHILD_TOO_BIG`

---

## 12) Diagnostics & Logging

* **Logger**: `ConsoleLogger` (levels: Debug/Info/Warn/Error/Off).
* The engine accepts a logger via `createDefaultSystem({ log })`. UI can expose a log level control.
* **Where we log** (recommended):

  * `place.ts`: node placement start; child forced sizes in nested contexts.
  * `engine.ts`: summary + audit results.
* **Audit** (optional): attaches `meta.audit` to snapshots; counts/issues also logged at Warn.

---

## 13) Error Handling

* `errors.ts` defines `LayoutError` and `LimitError` (code: `INVALID_CONFIG`, `LIMIT_*`).
* The engine currently returns `{ ok: true; issues }` vs `{ ok: false; issues }` depending on validation—callers can decide whether to throw or surface issues in UI.

---

## 14) Performance Notes

* All strategy steps are **linear** in `nodeCount` with small constants.
* **Iteration limits** cap per-node loops (children) to avoid O(n²) blowups.
* DOM/Canvas renderers do **full redraw** today; Canvas includes an internal **dirty-rect** incremental renderer for future use.
* ReactFlow rendering is delegated to the library (fitView enabled in the demo).

---

## 15) Extensibility How-To

**Add a layout strategy**

1. Implement `Layout`:

   * `preferredSize`, `nestedFrames` (optional for advanced grid), `placeChildren`.
2. Register it in `createDefaultSystem()` via `layouts.register(LayoutTypes.YourKind, new YourLayout())`.
3. Expose a new `LayoutTypes` enum value and surface it in the UI.

**Add a router**

1. Implement `EdgeRouter.route(e, snapshot) → { polyline?: Vector[] }`.
2. Register with `routers.register("name", router)`.
3. Pass `routerName` in `ComputeOptions`.

**Add a renderer port**

1. Implement `RenderPort` (`mount`, `draw`, `destroy`).
2. Wire into `LayoutView.tsx` switch and the UI segmented control.

**Custom tuning**

* Provide a custom `SystemContext` with your own `LayoutTuningConfig` or use `tuningOverride` per compute call.

---

## 16) Theming

`adapters/theme.ts`:

```ts
type Theme = {
  node: { bg; border; radius; fontSize; text };
  wire: { stroke; width };
  canvas: { bg };
};
```

Applied consistently across renderers (DOM/Canvas/SVG). ReactFlow uses a minimal inline style for parity.

---

## 17) UI / Playground

**ParentChildFlow\.tsx** wires:

* Controls: Renderer (DOM/Canvas/ReactFlow), Layout (Grid/Radial), Mode (Graph/Nested), Router (Line/Ortho), Spacing, Node W/H.
* Scope selector (“All nodes” or a subtree) + “Apply to subtree”.
* “All Graph” / “All Nested” quick toggles.
* Left pane shows **edges** only (ReactFlow), right pane switches renderer.

**Configurator semantics**

* `layout` is applied to the selected scope (and optionally its subtree).
* `modes` map controls per-node **Graph/Nested** with subtree application when chosen.

**(Optional) Testbed**

* A matrix page that renders the same sample tree across **Renderer × Mode × Layout** to visually regress combinations.

---

## 18) Metrics

`layout/metrics/metrics.ts` exposes:

* `boundsOf(boxes)`, `overlapsOf(boxes)`, `maxDepthOf(boxes)`.
* `edgeLengthStats(wires, boxes)`.
* `statsOfSnapshot(snapshot)` populates `LayoutStats` (used in `post`/engine).

---

## 19) File & Module Layout (current)

See the **Source Catalog** you shared; the important leaf modules:

* Strategies: `layout/strategies/grid/*`, `layout/strategies/radial/*`
* Iterators: `layout/iterator/*`
* Engine: `layout/engine/*`
* Render: `render/ports/*`, `render/views/LayoutView.tsx`
* Export: `tooling/exporters/*`
* Diagnostics (optional): `tooling/diagnostics/audit.ts`
* UI: `ui/*`, `ParentChildFlow.tsx`

---

## 20) Roadmap

* **Diagnostics hardening**: ship `audit.ts` by default; surface issues in UI.
* **Nested child sizing**: enforce square fit for **Nested Grid/Radial** at `place.ts` (policy toggles via tuning).
* **Graph mode generalization**: replace vertical stack fallback with force-directed / layered options.
* **Partial redraw** in CanvasPort using `CanvasRenderer2D.update()` (dirty-rect).
* **Constraints system** (non-overlap, min distance, route around obstacles).
* **More routers** (orthogonal with obstacle avoidance; splines; bundled edges).
* **Theming**: light/dark themes; node decorators (icons, ports).
* **Persistence**: snapshot import/export convenience functions.
* **Automated tests**: golden images for key matrices; iterator property checks.

---

## 21) FAQs & Gotchas

* **Why do edges sometimes not show in DOM?**
  Ensure the SVG has a **`viewBox`** that includes the snapshot bounds; otherwise lines can render out of visible area.

* **Why do nested children look tall/stretched?**
  If the renderer uses each child’s own size, enforce **square child sizing** inside the placement phase (see §11 and tuning §7).

* **Do renderers clip nested children to the parent?**
  ReactFlow uses `extent="parent"`. DOM/Canvas can add clip-paths if needed; currently we rely on simple z-order and box extents.

* **Can I mix layouts per node?**
  Yes. Each node has its own `layout` and `mode`. The **plan** phase resolves these per node.

---

## 22) Contribution Guidelines

* Keep computation **side-effect free**; pass all settings via context/overrides.
* Add new tuning knobs in `LayoutTuning`, document defaults and ranges.
* Respect **iteration limits** in any per-node loops.
* Prefer **Vector** operations & rounding at the end of a calculation step.
* Log at **Debug** in noisy loops; Warn/Error only for audit failures or limits.

---