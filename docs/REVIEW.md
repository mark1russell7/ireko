# ireko (formerly Jqy): review and plan

*Date: 2026-10-12. Baseline: `master` at `8848753`. The July audit ([archive/2026-07/AUDIT.md](./archive/2026-07/AUDIT.md)) stays valid as evidence. This document replaces its roadmap.*

This review answers these requests of the owner:

1. Move Jqy to the standard monorepo that `new-repo.ps1` makes from `~/git/template`.
2. Update all dependencies.
3. Add `ste-lint` the same way `lag` and `mark1russell7.github.io` do.
4. Review the architecture, the original intent, the current state and the key ideas. Then give a full plan for the code, the tests, CI and the documentation.
5. Make a creative and interactive GitHub Pages site. The site is a portfolio piece, so it must look good.
6. Publish the library to npm, and make it easy to find.

The document follows the family writing rules (ASD-STE100, checked with `ste-lint`).

---

## 0. Summary

**What Jqy is.** Jqy is a layout engine for trees of boxes. Each node selects a strategy (grid or radial) for its children. Each node also selects a mode. 

In the nested mode, the children are inside the box of the node. In the linked mode, the children are outside the box, and edges connect them. One computation gives a snapshot of boxes and edges. Three renderers (DOM, Canvas and React Flow) draw the same snapshot.

In one phrase: **a small layout language. You compose a diagram from containers, and each container selects its own layout.**

**The verdict.**

- The idea is good and rare. Few tools let each container select its layout algorithm, and none of them is small or easy (§7).
- The structure is sound in parts. The pipeline, the snapshot contract and the strategy audits are good ideas.
- The placement algorithm is not correct. It makes one pass from the root down, so a parent places its children before it knows their size. **The engine puts overlapping boxes in 1084 of 2000 random trees** (§3.2). The default demo has 55 overlapping pairs, and the built-in audit finds none of them.
- **A two-pass algorithm removes the defect.** The first pass measures each subtree from the leaves up. The second pass places the boxes from the root down. A prototype of this review gives 0 defects on the same 2000 trees (§6.2).
- Nothing examines the code. The repository has no `tsconfig.json`, no lint for TypeScript, no tests and no CI. A broken build was on `master` for six weeks (July audit, P0 #1).

**The plan, in one paragraph.** Rename the project to **ireko** (入れ子, the Japanese word for a set of nested boxes). Move it into the template monorepo. Write a new core with the two-pass protocol, an open strategy registry and a plain JSON output. Add a typed builder and a small text language.

Test the core with properties, golden files and renderer parity. Publish one package, `ireko`, with subpath exports for SVG, DOM, Canvas, React and React Flow. Build an Astro site whose signature piece is a live editor: you type a layout, and the page draws it.

---

## 1. Scope and method

The review used these sources:

- Each of the 65 source files (4085 lines), the README and the July audit.
- The full git history (31 commits, 2025-08-21 to 2026-10-08).
- Two measurements and one prototype, with the code in the scratch area of the session (§3.2, §6.2).
- Four research reports. They are in [`research/`](./research/):
  - [01 Template and ste-lint](./research/01-template-and-ste-lint.md): the template, `new-repo.ps1`, `ste-lint`, lag and github.io.
  - [02 Family sites](./research/02-family-sites.md): the sites of Vex, client, AsyncBrowserContext, render, lag and crawler.
  - [03 npm and discovery](./research/03-npm-and-discovery.md): the package name, publishing in 2026, search, and the site framework.
  - [04 Prior art](./research/04-prior-art.md): other layout engines, layout protocols, routing, tests, and interactive documentation.

---

## 2. Origin and intent

### 2.1 Where Jqy comes from

The history shows the intent clearly:

| Date | Commit | What happened |
|---|---|---|
| 2025-08-21 | `269a887` | A React Flow page with two nodes (the Vite template). |
| 2025-08-21 | `34ef754` | `ParentChildFlow.jsx`. A node of the config had a `layout` **function** `(children, parentPos) => positions`. The page drew one tree in two ways: as a graph with edges, and as nested boxes. |
| 2025-08-22 | `1f8aad2`, `5b59fa4` | TypeScript, the `Vector` class, and pure helper functions for padding and grids. |
| 2025-08-24 | `be135f5` to `675b853` | A migration to registries, strategies and iterators. |
| 2025-08-25 | `eb7c98d` | The pipeline engine, the render ports, the exporters, the audit and the test bed. The commit removed adapters for React, vanilla JS and Three.js. |
| 2025-08-30 | `0192ac4` | "migrate". The commit split the geometry module and removed its barrel file. The build broke. |
| 2026-10-08 | `8848753` | A fix of the `dump:src` script. |

**The original intent:** one tree of nodes, and two projections of it. The containment projection draws children inside their parent. The link projection draws children around their parent, with edges. Each node selects how it arranges its children. The engine must operate without a framework, and many renderers must draw its output. The adapters that the commit `eb7c98d` removed show that the owner also planned a headless mode and a 3D renderer.

### 2.2 The family

Jqy is one part of a longer line of work by the owner:

- **Vex** came out of Jqy. Its `brand.ts` is byte-identical, and its vector class differs only in import paths. The Vex site has a live page that checks the output of the Jqy audit with Vex formulas.
- **render** is a reactive expression engine with a viewer. It has a package for rectangle packing.
- **MetroGraph** and **Graph2** are design studies for JSON-driven user interfaces with node graphs.

Thus Jqy is the layout part of one theme: **declarative, composable interfaces made from data**.

### 2.3 What only Jqy has

- Each node selects its strategy **and** its mode, and these two choices are independent. A radial container can have a grid child that has linked children.
- The engine output is a plain snapshot. The renderers know nothing about strategies.
- The strategies can add their own audits. A layout can examine itself.
- The tuning knobs are functions, not only numbers. A host can change a policy, for example the padding as a function of the spacing.

---

## 3. Where Jqy is at this time

### 3.1 State in numbers

| Item | Value |
|---|---|
| Source files | 65 (56 `.ts`, 7 `.tsx`, 1 `.jsx`, 1 `.css`) |
| Lines of code | 4085 |
| Tests | 0. The one test file contains three `console.log` calls. |
| Type check | None. There is no `tsconfig.json` and no `typescript` dependency. Strict `tsc` gives 20 errors. |
| Lint | ESLint examines only `*.js` and `*.jsx`, so 63 of 65 files have no lint. |
| CI | None |
| Package manager | npm, with `package-lock.json` |
| Main dependencies | React 19.1, Vite 7.1, `reactflow` 11.11 (the old package name) |
| Dead code | Approximately 15 to 20 % (July audit, flaw E) |

### 3.2 New measurements of this review

The review measured the current engine with a check that the July audit did not have. Two boxes must not overlap, except when one box contains the other through the nested mode. A child in the nested mode must stay inside its container.

| Input | Overlapping pairs | Children outside their container | Findings of the built-in audit |
|---|---|---|---|
| The default demo | 55 | 0 | 0 |
| 2000 random trees (depth 4, up to 5 children, mixed strategies and modes) | 184376 in 1084 trees | 5073 | not measured |

The built-in audit misses every overlap. It examines only nested children against their parent. It does not compare siblings, and it does not examine the linked mode.

**The cause.** A strategy places the children of a node before the engine knows the size of each child subtree. In the linked grid, each cell has the size of one leaf node. A child with a large subtree then covers its neighbors. The July audit gives the same cause (flaw H). This review adds the measurement and the proof of the fix (§6.2).

### 3.3 Defects

The July audit lists 25 defects with evidence. They are all still present. The most important are:

| July # | Defect | Effect |
|---|---|---|
| 1 | The barrel file `core/geometry/index.ts` is missing from git | The committed code does not build. The audit restored the file, but nobody committed it. |
| 6 | `overlapsOfFast` uses `subtract` where it must use `add` | The fast overlap check misses overlaps. |
| 7 | The engine replaces the layout registry at each run | A custom strategy has no effect. The extension point of the README does not work. |
| 8 | No depth guard in the recursive placement | A deep tree overflows the call stack. |
| 9 | The engine misplaces the children over the limit | The extra children go to positions far outside the view. |
| 17 | Each snapshot has `version: Date.now()` | The output is not deterministic. Golden tests are not possible. |
| 18 | The default demo overlaps | This review measures 55 pairs (§3.2). |

This review adds three findings:

- **R1.** In the linked radial mode, the ring is centered below the parent, not on the parent (`radial.layout.ts:57`). The ring then crosses the box of the parent for small spacings.
- **R2.** The graph input gives each node the source of its first inbound edge as its parent, and then ignores this tree. The graph input always uses the basic layered fallback.
- **R3.** The renderers draw the label at the center of a container. The label is then under the children of the container.

---

## 4. The key ideas

These ideas are the reason to continue the project. The new design keeps each of them.

1. **Strategy and mode are two independent choices for each node.** The strategy tells how to arrange the children. The mode tells where the children are: inside the node or around it. This gives a small algebra of layouts.
2. **One tree, two projections.** The same data gives a diagram of containers and a diagram of links. The user can change the projection of one subtree and keep the rest.
3. **The output is data.** A snapshot of boxes and edges goes to any renderer. It can also go to a test, a file or a worker.
4. **A layout examines itself.** Each strategy states its invariants as an audit. The audit starts after each layout.
5. **Policies are functions.** The padding, the gap and the angle of a child are functions that a host can replace.
6. **Safety limits.** The engine has limits for the depth, the number of nodes and the number of children.

---

## 5. Diagnosis

### 5.1 Structural causes

| # | Cause | Evidence | Consequence |
|---|---|---|---|
| C1 | One pass from the root down | `place.ts:150-239` | Overlaps (§3.2). The "Apply Slider Recommendations" button is a manual work-around. |
| C2 | Nothing examines the code | §3.1 | A broken build stayed on `master` for six weeks. |
| C3 | Closed types for open concepts | `LayoutTypes` is an `enum`. The engine builds its registry again at each run. | A user cannot add a strategy. |
| C4 | Global mutable configuration | `LayoutTuningConfig` and `LayoutLimitsConfig` are module singletons. | Two engines share their settings. A test can change another test. |
| C5 | The types describe a different program | `LayoutSnapshot.boxes` has the class type `Shapes.Box`, but the engine makes plain objects. | The phantom `Box` import. The Canvas port makes a shim with `getPosition()`. |
| C6 | The compute layer imports the render layer | The routers import `render/ports/anchoring.ts`. | The core cannot operate without the render code. |
| C7 | Two coordinate conventions without a type | A nested strategy gives local centers, and a linked strategy gives absolute centers (`layout.ts:51-56`). | A strategy author can mix them, and no check finds it. |
| C8 | An expensive vector type | Each `Vector` object has approximately 50 closure properties (`vectors.ts`). | Each vector costs 50 allocations, in the inner loops of the engine. |

### 5.2 SOLID check

| Principle | At this time | In the new design |
|---|---|---|
| Single responsibility | `TreePlacer` recurses, sizes, logs, makes edges and applies offsets. `LayoutView` mounts ports, owns a viewport and draws a zoom bar. | The engine does the recursion. A strategy arranges one level. A router routes one edge. A renderer draws one layout. |
| Open and closed | The `enum` and the rebuilt registry close the strategy set. | Strategies, routers and renderers register by a string type. Typed options come from module augmentation (§6.9). |
| Liskov substitution | `Layout.nestedFrames` is abstract, and `RadialLayout` gives an empty stub. The legacy `placeChildren` repeats `placeChildrenEx`. | One small contract (§6.3). Optional parts are optional members. |
| Interface segregation | A strategy must implement four methods, and the engine uses two of them. | A strategy has one necessary function, `arrange`, and an optional `audit`. |
| Dependency inversion | Strategies read global singletons. Routers depend on the render layer. | The engine gives each strategy its options and a context. The core imports nothing from the renderers. A lint rule enforces the direction. |

---

## 6. Target architecture: ireko 1.0

### 6.1 The model

The input is plain data. It can come from JSON, a builder (§6.8) or the text language.

```ts
interface Size { readonly width: number; readonly height: number }

interface NodeSpec {
  readonly id: string;
  readonly label?: string;
  /** The size of a leaf, or the smallest size of a container. */
  readonly size?: Size;
  /** The strategy for the children: a type, or a type with options. */
  readonly layout?: string | { readonly type: string; readonly [option: string]: unknown };
  /** "nested": the children are inside this box. "linked": the children are around it. */
  readonly mode?: "nested" | "linked";
  /** The sizing policy of a nested container with a fixed size: "grow" (the default), "scale" or "clip". */
  readonly fit?: "grow" | "scale" | "clip";
  readonly children?: readonly NodeSpec[];
  readonly data?: unknown;
}

interface LayoutInput {
  readonly root: NodeSpec;
  /** Edges that are not parent-child edges. The engine routes them, but they do not change the tree. */
  readonly edges?: readonly { id?: string; source: string; target: string }[];
}
```

The mode `"linked"` replaces the old name `GRAPH`. The old name had two meanings: an input kind and a mode.

### 6.2 The two-pass protocol (verified)

The engine makes two passes:

1. **Measure, from the leaves up.** The engine visits each node after its children. It gives the measured children to the strategy of the node. The strategy gives the offset of each child and, in the nested mode, the size of the container. The engine then calculates the **extent** of the node: the rectangle that contains the node and all of its subtree.
2. **Place, from the root down.** The engine adds the offsets along each path from the root. Each box gets its absolute position.

The strategy uses the extent of each child, not the size of its box. Thus a child with a large subtree gets a large cell.

The review tested this protocol with a prototype of 180 lines, on the same corpus as §3.2:

| Input | Overlapping pairs | Children outside their container |
|---|---|---|
| The default demo | 0 | 0 |
| 2000 random trees | 0 | 0 |

A mutation check confirmed the test itself. With cells of leaf size (the old rule), the same check found the overlaps of the demo again.

The geometry of the two built-in strategies:

- **Grid.** The width of a column is the largest extent width in the column. The height of a row is the largest extent height in the row. Each extent is centered in its cell.
- **Radial.** Each child extent fits in a circle of radius `ρ`, around the center of the child box. The ring radius is `r = (2·ρmax + gap) / (2·sin(π/n))`, so neighbor circles do not touch. In the linked mode, `r` is also at least `ρparent + ρmax + gap`, so no child touches the parent. One child goes to the center of a nested container.

### 6.3 The strategy contract

```ts
interface Strategy<Options extends object = object> {
  readonly type: string;
  /** The type, default, range and description of each option. It gives validation, the configurator and the docs. */
  readonly options: OptionSchema<Options>;
  /** Arranges the measured children of one node. The engine calls it once per node, from the leaves up. */
  arrange(input: ArrangeInput<Options>): Arrangement;
  /** Gives the findings of the strategy for one arranged node. */
  audit?(input: AuditInput<Options>): readonly Issue[];
}

interface ArrangeInput<Options> {
  readonly mode: "nested" | "linked";
  readonly self: Size;                         // the size of the node box before the arrangement
  readonly children: readonly MeasuredChild[]; // { id, box: Size, extent: Rect }
  readonly options: Options;                   // the defaults, merged with the options of the node
  readonly depth: number;
}

interface Arrangement {
  /** The container size, for the nested mode. The engine keeps the old size when this is absent. */
  readonly size?: Size;
  /** The top-left corner of each child box, relative to the top-left corner of the node box. */
  readonly offsets: readonly Point[];
}
```

The engine owns everything else: the recursion, the extents, the limits, the absolute positions, the edges and the generic audit. A strategy is a pure function of one level. It is easy to write and easy to test.

The engine does the recursion with an explicit stack, not with the call stack. Thus a deep tree cannot overflow the stack. The limits for depth and node count give a finding, not a crash.

### 6.4 The engine and its phases

```ts
const engine = createEngine({ strategies, routers, limits, logger });
const layout = engine.layout(input, { spacing: 24, nodeSize: { width: 110, height: 54 } });
```

| Phase | Input | Output |
|---|---|---|
| `normalize` | `LayoutInput` | An index of the nodes, with the defaults applied |
| `validate` | the index | Findings: duplicate ids, unknown strategies, unknown edge ends, cycles in the edges |
| `measure` | the index | The offsets, sizes and extents of each node |
| `place` | the measurements | The absolute boxes |
| `route` | the boxes and edges | A polyline for each edge |
| `audit` | the layout | The generic findings and the findings of each strategy |

Each phase is a pure function. The option `trace` gives a callback that receives the output of each phase. The site uses this callback for its pipeline view (§11.3).

Each engine owns its configuration. There are no global singletons. Per-call options merge with the engine defaults and do not change them.

### 6.5 Routers and anchors

```ts
interface Router {
  readonly type: string;
  route(edge: EdgeSpec, context: RouteContext): readonly Point[];
}
```

The anchors (center, or the point where the line crosses the box edge) move into the core, next to the routers. The built-in routers are `straight`, `orthogonal` and `curved`. Later versions add these routers (§13, P3):

- `avoid`: an orthogonal router that goes around boxes. It uses A* on a sparse grid, with a cost for each bend. The obstacles of an edge are the siblings along its path through the tree, not its own ancestors.
- `bundle`: hierarchical edge bundling. The control points of an edge follow the tree path through the lowest common ancestor.

By default, the engine draws an edge from a parent to each linked child. A nested child has no edge, because its container already shows the relation. The option `edges: "linked" | "all" | "none"` changes this.

### 6.6 The output

The output is plain JSON, with no classes and no time stamps. The same input always gives the same output, byte for byte.

```ts
interface Layout {
  readonly nodes: readonly PlacedNode[]; // in paint order: containers before their children
  readonly edges: readonly PlacedEdge[]; // { id, source, target, points, kind: "tree" | "extra" }
  readonly bounds: Rect;
  readonly issues: readonly Issue[];     // validation, limits and audit
}

interface PlacedNode extends Rect {
  readonly id: string;
  readonly parent?: string;              // the container, for a nested node
  readonly depth: number;
  readonly mode: "nested" | "linked";
  readonly layout: string;
  readonly label?: string;
}
```

A layout with errors still gives all the nodes that it can place. The option `strict: true` makes `layout()` throw on the first error.

### 6.7 Renderers and adapters

| Subpath | Content | Dependency |
|---|---|---|
| `ireko` | The engine, the built-in strategies and routers, the builder | none |
| `ireko/svg` | `toSVG(layout, theme)`: an SVG string. It escapes the text. It operates in Node. | none |
| `ireko/dom` | `mountDom(element)`: draws a layout with elements, and animates from one layout to the next | none |
| `ireko/canvas` | `mountCanvas(element)`: the same interface, on a canvas, with hit tests | none |
| `ireko/react` | `useLayout(input, options)` and `<LayoutView renderer="svg" />` | `react` (optional peer) |
| `ireko/xyflow` | `toXYFlow(layout)`: nodes with `parentId` and `extent: "parent"`, and an edge type for polylines | `@xyflow/react` 12 (optional peer) |

The DOM and Canvas renderers share one viewport controller. Two panes can then share one zoom. The renderers animate a change from one layout to the next, because the node ids are stable.

### 6.8 The builder and the text language

The owner describes Jqy as "a builder language framework". The plan gives it two surfaces over the same data:

**A typed builder:**

```ts
import { grid, radial, node } from "ireko";

const spec = grid("root", { columns: 3 },
  radial.nested("api", node("auth"), node("users"), node("billing")),
  grid("web", "home", "search", "cart", "checkout"),
);
```

**A text language** for the site and for quick sketches:

```text
root grid(columns: 3) {
  api radial nested { auth users billing }
  web grid { home search cart checkout }
}
```

The parser gives positions for errors, so the editor of the site can underline them. The JSON schema of `NodeSpec` is on the site, so an AI model can write layouts as data.

### 6.9 Extension points

- **A new strategy:** `engine.register(defineStrategy({ type: "fan", defaults, arrange }))`.
- **Typed options:** a module augmentation of `interface StrategyOptions { fan: FanOptions }` gives the builder and the input the types of the new options.
- **A new router:** the same pattern, with `defineRouter`.
- **Text sizes:** the option `measure(node)` lets a host measure a label with the DOM or a canvas. The core does not measure text.
- **Adapters for other engines** (later): a strategy can use ELK or d3-hierarchy for the children of one container. Thus ireko composes these algorithms, container by container.

### 6.10 Old API to new API

| Old | New |
|---|---|
| `createLayoutAPI(createDefaultSystem())` | `createEngine()` |
| `api.compute({ kind: InputKind.Tree, root }, options)` | `engine.layout({ root }, options)` |
| `LayoutTypes.Grid`, `LayoutTypes.Radial` | `"grid"`, `"radial"`, or any registered type |
| `LayoutChildrenMode.GRAPH`, `.NESTED` | `"linked"`, `"nested"` |
| `snapshot.boxes[id].position`, `.size` (`Vector`) | `layout.nodes[i].x`, `.y`, `.width`, `.height` |
| `snapshot.wires[i].polyline` | `layout.edges[i].points` |
| `snapshot.meta.audit` | `layout.issues` |
| `tuningOverride` (functions) | per-node options, and the options of the engine |
| `api.toSVG(snapshot)` | `toSVG(layout)` from `ireko/svg` |
| `toReactFlow(snapshot)` (React Flow 11) | `toXYFlow(layout)` from `ireko/xyflow` (React Flow 12) |

The project has no published version and no users. Thus the new API does not keep the old names.

### 6.11 Packages

| Folder | Name | Published | Content |
|---|---|---|---|
| `packages/ireko` | `ireko` | yes | The library, with the subpaths of §6.7 |
| `packages/site` | `@ireko/site` | no | The Astro site, the playground and the gallery |
| `packages/legacy` | `@ireko/legacy` | no | The old code and the old app, until the new core reaches parity. The plan removes it in P2. |
| `packages/cli` | `@ireko/cli` | no | The template command for new packages |

One published package with subpaths is simpler for the users and for the release. Split `ireko/react` into its own package only when it gets its own dependencies.

---

## 7. Prior art and position

*This section summarizes [research/04-prior-art.md](./research/04-prior-art.md).*

### 7.1 Who else lets a container select its layout

| System | How a container selects its layout | Order | Limit for ireko users |
|---|---|---|---|
| ELK (`elkjs` 0.12) | `elk.algorithm` in the options of a compound node | From the leaves up. A "topdown" mode scales the children to a fixed parent. | 467 kB gzip. The options are hard to find. The React Flow guide says that it is "the most complicated" option. |
| yFiles `RecursiveGroupLayout` | A map from each group to its algorithm | From the leaves up | Commercial |
| GoJS | `Group.layout` | The group is a plain node for the outer layout | Commercial |
| AntV G6 5.1 | A function that gives the layout of each combo | Inner, then outer | Users report overlaps after a new layout |
| Graphviz `osage` | `pack` for each cluster | From the leaves up | Edges are not part of the packing |
| dagre 3.1 (2026) | `rankdir` and spacing for each cluster | Recursive | One algorithm (layered) only |
| Mermaid 12 (2026) | `@{ algorithm: … }` for each subgraph | ELK | Text diagrams only |
| D2 | `grid-rows` and `grid-columns` for each container | – | Edges in a grid are straight lines |

**The conclusion.** The idea of Jqy is real and in demand. In 2026, both dagre and Mermaid added a layout setting for each group. But each system ties the idea to its own algorithms or to a commercial license. **No open library gives a small TypeScript core that composes the strategies of different engines in one tree and draws to any renderer.** That is the position of ireko.

### 7.2 Lessons that the plan takes

1. **Each mature system measures a container before it places it.** Flutter ("constraints go down, sizes go up"), WPF (measure and arrange), SwiftUI and Jetpack Compose use the same protocol. The two-pass protocol of §6.2 follows them.
2. **A container is a plain node for its parent.** After the measure pass, the parent strategy sees only a size and an extent. Thus any algorithm can arrange one container: ELK, dagre, a tidy tree or a treemap. This makes adapter strategies possible (§6.9).
3. **Sizing is a separate choice.** ELK and the research of Kasperowski and von Hanxleden (2023) separate the algorithm from the sizing policy. ireko adds the option `fit` with three values. With `"grow"` (the default), the container grows to fit. With `"scale"`, a fixed container scales its content. With `"clip"`, it cuts the content. The `"scale"` policy replaces the "Apply Slider Recommendations" button.
4. **Option schemas.** ELK can list its options with their types and defaults. Each ireko strategy declares an option schema. The schema gives validation, the configurator of the playground and the reference pages.
5. **Relational assertions.** The dagre tests assert relations ("left of", "inside") and not exact pixels. ELK runs checks between the phases of its pipeline. The ireko tests do both (§9).
6. **Routing.** The next step after the L-shaped elbow is an A* search on a sparse grid with a cost for each bend. Excalidraw described this method for its elbow arrows in 2025. A tree also makes hierarchical edge bundling cheap (Holten 2006).
7. **Research ideas for later:**
   - the dimension ownership of Bluefish: each value records which strategy set it
   - style rules that assign layouts by selector (SetCoLa, Penrose)
   - radial layouts as a polar transform of other layouts (GoTree)

### 7.3 Size budget

| Library | gzip |
|---|---|
| `elkjs` 0.12 | 467 kB |
| `libavoid-js` (WASM) | 180 kB |
| `@dagrejs/dagre` 3.1 | 16.9 kB |
| `d3-hierarchy` | 5.8 kB |
| `d3-flextree` | 3.3 kB |

The budget for the core of ireko is **12 kB gzip**. `size-limit` enforces it in CI. (P3 changed it to 15 kB, §16.2.)

### 7.4 Positioning

- The words "nested layout" belong to the Next.js router in search results. "Compositional layout" belongs to Apple, and "auto layout" belongs to Apple and Figma. Do not lead with these words.
- Lead with "graph layout", "tree layout", "compound graph layout" and "React Flow auto layout". The GitHub topic `graph-layout` has fewer than 100 repositories, so a new project can rank in it.
- **The hero line:** "Mix layout algorithms per group."

---

## 8. Migration to the template monorepo

### 8.1 Facts that set the approach

- `new-repo.ps1` cannot make `~/git/jqy`, because the file system does not see case, and `~/git/Jqy` exists. The script also starts a new history. Keep the history: it is the evidence for §2.
- `lag` does not come from the template. The real template children are `mark1russell7.github.io`, `Vex` and `page-lifecycle-tracker`. Vex did the same migration on 2026-10-08, and its procedure worked.
- The template has a rename command: `pnpm template rename <scope>`.
- The default branch is `master`. The workflows of the family start on `main`.

**Approach: convert in place**, the same as Vex. Copy the template files into the repository. Rename the scope with the template command. Make packages with `pnpm package add`, and move the code with `git mv`. Git keeps the history of each file.

### 8.2 Procedure

```powershell
# On the branch chore/monorepo
# 1. The template files, with the exclusions of new-repo.ps1
robocopy "$HOME\git\template" . /E /XD .git node_modules _db .claude /XF pnpm-lock.yaml
git rm package-lock.json eslint.config.js vite.config.js index.html

# 2. The scope "template" becomes "ireko"
pnpm install
pnpm template rename ireko

# 3. One package for the old code, moved without logic changes
pnpm package add legacy --preset=react
git mv src public index.html packages/legacy/

# 4. Keep the concat-src submodule. The root script dump:src reads the src folder of each package.

# 5. The gates: the old app builds and starts
pnpm typecheck
pnpm --filter @ireko/legacy build
```

The July audit moves to `docs/archive/2026-07/AUDIT.md`.

### 8.3 TypeScript settings

| Package | Preset | Overrides |
|---|---|---|
| `legacy` | `react` | For a short time only: `strict` without `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature`. The package exists only until the new core reaches parity. Do not spend time on code that the plan removes. |
| `ireko` | `react` | None. The full strict preset applies from the first commit. A second project, `tsconfig.core.json`, uses the `ts` preset (no DOM) for `src/core/**`. Thus the type check proves that the core does not use the DOM. |
| `site` | `react` | `composite: false`, `incremental: false`, the same as the Vex site |

### 8.4 Dependency update

Versions were checked live on 2026-10-12. Use the versions that `pnpm install` resolves on the day of the migration.

| Item | At this time | After P0 |
|---|---|---|
| Package manager | npm, `package-lock.json` | pnpm 12.10.1 |
| Node | not set | `engines >=22.12`. CI on 22, 24 and 26. |
| TypeScript | not declared | 7.0.2. TypeDoc uses TypeScript 6.0.3 in the site package. |
| React | 19.1.1 | 19.3.0 |
| Vite | 7.1.2 | 8.3.4 |
| `@vitejs/plugin-react` | 5.0.0 | 6.1.2 |
| React Flow | `reactflow` 11.11.4 | `@xyflow/react` 12.12.0. Version 13 is in prerelease (13.0.0-next.0). Add it to the peer range after a test. |
| Lint | ESLint 9 for JS only | Oxlint 1.87 with type-aware rules, the same as Vex. `typescript-eslint` does not support TypeScript 7. |
| Tests | none | Vitest 5.0, `fast-check` 4.10, `@vitest/coverage-v8` 5.0, Playwright 1.64, `@axe-core/playwright` |
| Build | Vite | `tsdown` 0.23 for the library. Astro 7.3 for the site. |
| Package checks | none | `publint` 0.3, `@arethetypeswrong/cli` 0.18, `size-limit` 14 |

### 8.5 ste-lint integration

The template already has the parts of the lag and github.io recipe:

- the root dependency `github:mark1russell7/ste-lint` and the `lint:ste` script
- `ste.config.json`
- the `.gitignore` block for the copyrighted dictionary
- the CI step

ireko adds these items:

1. **Scope.** Add `docs/**/*.{md,mdx}` and `packages/site/src/content/**/*.{md,mdx}` to `include`, the same as lag. Add `docs/archive/**` and `docs/research/**` to `ignore`. These files are evidence, not STE text.
2. **Glossary.** Add the real terms of the project: strategy, extent, container, router, polyline, viewport, renderer.
3. **The legacy package.** Add `packages/legacy/**` to `ignore`. The plan removes it.
4. **`CLAUDE.md`.** Merge the template version with the rules of ireko: this review, the gates and the test commands.
5. **README.** Add the github.io sections "Writing style" and "Disclosure".

---

## 9. Testing strategy

### 9.1 The principle

The July audit has one root cause: **no check operated**. The new tests check properties of all layouts, not only examples. A property test makes thousands of random trees. Thus it finds the defects that a person does not think of.

### 9.2 The layers

| Layer | Tool | What it checks |
|---|---|---|
| L1 Unit | Vitest | Geometry, each strategy on hand-calculated cases, the parser of the text language |
| L2 Properties | `fast-check` | The invariants of §9.3 on random trees, strategies, modes and sizes |
| L3 Golden files | Vitest file snapshots | A corpus of 30 inputs. Each one has a JSON file and an SVG file. A change shows as a picture in the pull request. |
| L4 Types | `expectTypeOf`, `tsconfig.test.json` | The types of the builder and of the strategy options |
| L5 Doc tests | The Vex doc-test runner | Each code block with the meta word `doctest` in the README and the site |
| L6 Renderer parity | Vitest with happy-dom, and a recorder canvas | SVG, DOM and Canvas draw the same rectangles for the same layout |
| L7 Package | `publint`, `attw`, `size-limit`, a smoke test | The tarball installs and operates in Node and in a Vite app. The core stays under its size budget. |
| L8 Site | Playwright, axe-core | Each page loads with no error. Each page passes WCAG 2.1 AA in two themes. The SEO tags are present. Each page stays in its size budget. |
| L9 Speed | Vitest bench | 100, 1000 and 10000 nodes. CI reports the result and does not fail on it. |
| L10 Mutations | Stryker, each night | The score of the core. The gate is 90 %. |

Coverage gate for the core: 98 % of the statements, 96 % of the branches, 98 % of the functions and 98 % of the lines. These are the gates of Vex.

### 9.3 Properties

| # | Property |
|---|---|
| P1 | No overlap. Two boxes do not overlap, except when one contains the other through the nested mode. |
| P2 | Containment. A nested child is inside the content area of its container (the box minus the padding). |
| P3 | Determinism. Two runs give equal output, and the JSON round trip does not change it. |
| P4 | Finite output. Each number is finite, and each size is positive. |
| P5 | Translation. A move of the root moves each box by the same vector. |
| P6 | Monotone spacing. A larger spacing does not make an overlap. |
| P7 | Limits. A tree over a limit gives a finding and not more nodes than the limit. A chain of 100000 nodes does not overflow the stack. |
| P8 | Edges. Each end of an edge is on the anchor of its box: the center, or the edge of the box. |
| P9 | Renderer parity (L6). |
| P10 | Text language round trip. Print a spec as text, read it again, and the spec is equal. |
| P11 | Locality. A new leaf in one subtree does not change the relative positions in a sibling subtree. |
| P12 | Laws. A grid with one column equals a vertical stack. A grid or a ring with one child centers it. |

The properties run at the end of the pipeline and also between its phases, the same as the white-box tests of ELK. A test of the audit gives it known overlaps and asserts that the audit finds them.

---

## 10. CI and release

### 10.1 Workflows

| File | Trigger | Jobs |
|---|---|---|
| `ci.yml` | push, pull request, `workflow_call` | `check` on Node 22, 24 and 26: type check, Oxlint, tests with coverage, `lint:ste`. `packages`: build, `publint`, `attw`, size, smoke test. `site`: build, then Playwright in Chromium, Firefox and WebKit. `ci-ok`: the one necessary check. |
| `pages.yml` | CI passes on `main` | Build the commit that CI tested, deploy to GitHub Pages, then notify IndexNow. |
| `release.yml` | a tag `v*` | The crawler pattern: preflight, CI again, build and pack, smoke test of the tarball, publish with provenance from a job with no checkout, then a GitHub release. |
| `nightly.yml` | each night | Mutation tests and benchmarks |

Each workflow starts with `permissions: {}` and gives each job only what it needs. Each action is pinned to a commit SHA, with the version in a comment. Renovate keeps the pins current.

### 10.2 npm in 2026 (from the research)

- The first version goes to npm by hand. npm accepts a trusted publisher only for a package that exists.
- **Since 2026-10-02, a trusted-publisher configuration expires** if no publish uses it within 48 hours. The crawler release workflow skips a version that npm already has. Thus, after the first version by hand, publish a new patch version from CI within 48 hours.
- Configurations made after 2026-09-03 permit only staged publishing by default. Select "npm publish" as a permitted action.
- After the first publish from CI, set "Require 2FA and disallow tokens" on the package.
- Do not put a `github:` reference in the runtime dependencies. npm 12 does not install them.

### 10.3 Repository settings (the owner does these)

- Rename the repository `Jqy` to `ireko`. The site base becomes `/ireko/`. GitHub keeps a redirect from the old name.
- Rename the default branch `master` to `main`.
- Set the Pages source to "GitHub Actions".
- Set the description, the homepage, the topics and the social preview image (§12).
- Install the Renovate app.

Status on 2026-10-13: the repository is `mark1russell7/ireko`, the default branch is `main`, and the Pages source is "GitHub Actions". The site is at https://mark1russell7.github.io/ireko/. The description, the homepage and the topics are set. The social preview image and the Renovate app are not done.

Pages deploys a commit only one time. A second deployment of the same commit keeps the first build. After a change of the base path, deploy a new commit.

---

## 11. The site

### 11.1 The idea: "a layout language you can see"

The site is a running example of its subject. Its signature piece is a live editor: you type a layout in the text language, and the page draws it at once. The page animates each change, so the reader sees the effect of a strategy or a mode. The family style applies: ink on graph paper, hairlines, blue ink for focus, and red pencil for a defect.

### 11.2 Site map

| Section | Pages |
|---|---|
| Home | The live hero, the install box, the showcase, a sample for your code |
| Learn | Tour, nodes and modes, strategies, edges and routers, renderers, the text language, write a strategy |
| Playground | The full-window editor at `/playground/` |
| Gallery | One page for each example, with its own URL: org chart, microservices, file tree, mind map, network rack, sports bracket, and more |
| Guides | Auto-layout nested sub-flows in React Flow, server-side SVG, use with Canvas, migrate from dagre |
| Compare | ireko, dagre, elkjs and d3-hierarchy on the same data |
| Reference | The API (TypeDoc), the JSON schema, the text grammar, the issue codes |
| Design | The architecture, this review, the decisions |

### 11.3 The signature pieces

1. **The live hero.** The engine lays out the cards of the home page. The layout changes from grid to radial to nested while the reader scrolls. The boxes move to their new places with spring animations.
2. **The playground.** The text editor is on the left, with highlights and error marks. The layout is on the right. Select a node to change its strategy or its mode. The text then changes too.

   The panel shows the findings of the audit. A link shares the state, and buttons export SVG and JSON.
3. **The pipeline view.** A slider steps through the phases. In the measure phase, the extents grow from the leaves to the root as dashed rectangles. In the place phase, the positions flow down. The view uses the `trace` option of the engine.
4. **"Why two passes".** An honest story of the defect. The page shows the output of Jqy 0.x with its 55 overlaps in red pencil. A slider then changes to the two-pass engine.
5. **Renderer parity.** One layout in SVG, Canvas, DOM and React Flow, side by side, with one shared zoom.
6. **The strategy lab.** The reader writes the `arrange` function of a new strategy in the page. A worker operates it, and the layout uses it next to the built-in strategies.
7. **Dogfood images.** The engine draws the Open Graph image of each page with `ireko/svg`. The build converts each SVG to a PNG.
8. **The audit overlay.** Hatches show overlaps, and red pencil shows a child outside its container. Select a finding to zoom to it.
9. **The fuzz button.** It makes a random tree with the same generator as the property tests. The seed is in the URL, so a defect that a reader finds becomes a test.
10. **The router lab.** Move the boxes and the ends of an edge, and watch the A* search. A slider sets the cost of a bend.
11. **Small multiples.** One option changes across a row of small layouts, so the reader sees its effect at once.

### 11.4 Technology

The stack is Astro 7, Starlight and React islands. The family uses this stack for the sites of Vex, render and crawler:

- The pages are static HTML. Search engines and AI crawlers read them without JavaScript.
- Starlight gives search (Pagefind), the sidebar, a sitemap and code highlights.
- Heavy demos load as islands with `client:visible`. The playground is one island with `client:only="react"`.
- The family files apply:
  - `tokens.css`, the Starlight theme map and the hero override
  - `CopyInstall` and `routeData.ts` (JSON-LD, and `noindex` for the 404 page)
  - `llms.txt`, the OG script and `check-site.mjs`
  - the Playwright specs for smoke, SEO, accessibility and size

---

## 12. npm and discovery

The research ranks these actions by effect:

1. **Static HTML for each page**, with a unique title, description and canonical URL. Astro does this.
2. **Put ireko where React Flow users look.** The React Flow layout guide lists dagre, d3-hierarchy, d3-force and elkjs. It says that dagre has an open issue with sub-flows, and that ELK is the most complex option. **Automatic layout of nested sub-flows, without the complexity of ELK, is the gap that ireko can fill.** Open a pull request on `xyflow/awesome-node-based-uis`.
3. **Search Console and Bing.** Add the sitemap of the project to `mark1russell7.github.io/robots.txt`, the same as for the other projects.
4. **npm metadata.** Write a one-sentence description with the key phrases, 15 to 20 keywords and the homepage. The README starts with one sentence, a picture, the install command and a 10-line sample.
5. **GitHub settings.** The same tagline, the homepage, 20 topics (`graph-layout`, `layout-engine`, `graph-drawing`, `react-flow`, `nested-graph` and more), and a social preview image.
6. **Pages that match searches:** "ireko vs dagre vs elkjs", "auto-layout nested sub-flows in React Flow", "radial tree layout in JavaScript". Each gallery example has its own URL.
7. **Launch:** Show HN, r/reactjs, This Week in React, the React Flow Discord, and answers on Stack Overflow about sub-flow layout.
8. **AI discovery:** `llms.txt`, `llms-full.txt`, the JSON schema, and a submission to Context7.

**The npm description:** "Composable graph and tree layout for TypeScript. Select a layout for each container, and get boxes and routed edges for any renderer."

**The keywords:** `graph-layout`, `tree-layout`, `compound-graph`, `hierarchical-layout`, `nested-graph`, `group-layout`, `diagram-layout`, `auto-layout`, `react-flow`, `xyflow`, `subflows`, `radial-tree`, `edge-routing`, `svg`, `canvas`, `typescript`, `dagre-alternative`, `elkjs-alternative`.

---

## 13. Roadmap

| Phase | Content | Exit criteria |
|---|---|---|
| **P0 Migrate** | §8: the template, pnpm, TypeScript 7, Oxlint, ste-lint, CI, the legacy package, this review | CI is green. The old app builds. |
| **P1 Core** | §6.1 to §6.6: the model, the engine with two passes, grid and radial in both modes, routers, the audit, the SVG export | P1 to P8 pass. The demo has 0 overlaps. Coverage gates pass. |
| **P2 Surface** | §6.7 to §6.9: the builder, the text language, DOM, Canvas, React and React Flow. The playground moves to the new core. The legacy package goes. | P9 and P10 pass. The golden corpus is in place. |
| **P3 Depth** | New strategies (`stack`, `tree` with tidy contours, `layers` for graphs), the fit modes of containers, the orthogonal router around boxes, label sizes, benchmarks, mutation tests | Each new strategy passes P1 to P8. |
| **P4 Site** | §11: the site with each signature piece, SEO, the Pages workflow | The site is live. The Playwright gates pass. |
| **P5 Release** | §10 and §12: the `tsdown` build, the package checks, the release workflow, the README, `CHANGELOG.md`, the owner steps | `ireko` 0.1.0 is on npm. |

---

## 14. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | **The name.** `jqy` is taken on npm, and another account owns the scope `@jqy`. | **ireko**, unscoped. It is free on npm, with its scope and its variants. The name `@mark1russell7/layout` is also free, but nobody can search for a name like "layout". |
| D2 | The repository name | Rename `Jqy` to `ireko` before the first deploy of the site. Pages paths are case-sensitive. |
| D3 | The default branch | Rename `master` to `main`, the same as the family |
| D4 | The names of the modes | `nested` and `linked`. The old name `GRAPH` had two meanings. |
| D5 | One package or several | One package, `ireko`, with subpath exports |
| D6 | The site stack | Astro 7 with Starlight and React islands, the same as Vex, render and crawler |
| D7 | The text language | Yes, in P2. It is the surface that makes the "builder language" visible. |
| D8 | The old code | Remove it after parity. Git keeps it. No compatibility layer, because there are no users. |
| D9 | The first publish | The owner publishes 0.1.0 by hand with two-factor authentication. CI publishes 0.1.1 within 48 hours (§10.2). |

---

## 15. Other observations

- The workspace `CLAUDE.md` lists `lag` as a template monorepo. `lag` does not come from the template (research 01).
- `polite-crawler` is not on npm yet. Its release workflow also needs the npm changes of §10.2.
- The template has no code linter and no build tool. Vex added Oxlint and `tsdown`. ireko does the same, and the template can take both later.
- The Vex site page "Layout audits" shows the output of Jqy at `8848753`. After the rename, update its link.

---

## 16. Execution record

*This section records what the work did, and where the work is different from the plan. Updated: 2026-10-13, after P4.*

### 16.1 Status of the phases

| Phase | Status | Evidence |
|---|---|---|
| P0 Migrate | Done | The template monorepo, the legacy package and the CI workflow. `pnpm check` passes. |
| P1 Core | Done | `packages/ireko/src/core` and `packages/ireko/src/svg`. 110 tests. The coverage gates pass. |
| P2 Surface | Done, with one change (§16.2) | The builder, the text language, the renderers for SVG, DOM and Canvas, the React bindings and the React Flow adapter. 169 tests. |
| P3 Depth | In progress | The strategy `tree` (a tidy tree), the shapes of subtrees for strategies, the direction of tree edges and the organization-chart elbow of the orthogonal router, a faster audit. The router `avoid`. The strategy `layers`. Not done: `stack`, `bundle`, label sizes, benchmarks, mutation tests. |
| P4 Site | Done, with changes (§16.2) | `packages/site`: Astro 7 and Starlight. 18 pages of the guide, a gallery page for each example, the playground, 10 live figures, a share card for each page, `llms.txt`, 22 Playwright tests (smoke, head and SEO, axe in both themes, budgets), the site job of CI and `pages.yml`. The legacy package is gone. |
| P5 Release | Ready. The owner publishes 0.1.0 (§10.2, §10.3). | The `tsdown` build, `publint`, `attw`, `size-limit`, a smoke test of the tarball, the `package` job of CI, `release.yml`, the npm README and `CHANGELOG.md`. The public API of the core is an explicit list. |

### 16.2 Changes to the plan

| Plan | What the work did | Reason |
|---|---|---|
| D1: the name | The name is ireko, unscoped. The owner also considered `@mark1russell7/layout`. | ireko is free on npm, short and easy to remember. The words in the description carry the search terms. |
| §6.2: equal angles on a ring | On a full ring, each pair of neighbors gets the angle that it needs. A bisection finds the smallest radius. A second search makes the ring larger when two large children touch across a small child. | Equal angles left large empty areas when the children had different sizes. A test found the case of two large children. |
| §6.2: a part of a ring puts the first child at the start angle | Each child is at the middle of an equal part of the arc. | The property test P1 found an overlap: with a sweep of 289 degrees, the last child was near the first child. |
| §6.1: the header is extra space | The header is the smallest space above the content, and the padding counts as a part of it. The default is 24. | The labels of containers touched their children when the spacing was small. |
| §6.6: rounded output | The engine does not round. Exporters and golden files round. | Rounding made very small boxes inside scaled containers into empty boxes. |
| §6.1: a grid of linked children is approximately square | In the linked mode, the default grid is one row. | With two or more rows, the edges to the second row crossed the boxes of the first row. |
| §6.3: `arrange` gives a content area | The radial strategy gives no content area. The engine uses the extents of the children. | A nested ring is as small as its children permit. |
| §13 P2: the playground moves to the new core, and the legacy package goes | The legacy package stays until the playground of the site exists (P4). | The new playground is a page of the site. A second playground in P2 is work that the plan then removes. |
| §6.7: one live renderer for each target | One loop for all live renderers. A surface only draws a frame. The loop owns the animation, the viewport, the size and the hit test. | The three renderers share their behavior. The parity test (P9) compares them box by box. |
| §6.8: a text language with separators | Commas are optional. A word after an identifier is a part of the node only if it is a keyword or the name of a strategy. | `{ auth users billing }` reads as three leaves. This is the form that people write. |
| §11: the site | Each figure of the guide is a text of the text language. The build lays it out, and a syntax error stops the build. A link opens each figure in the playground. | The guide cannot show a stale example, and the reader can change each example. |
| §11: a "before and after" figure | The page "Why two passes" shows the output of the old engine from `src/data/legacy-demo.json`. A script of the session recorded it from the legacy package (55 overlapping pairs, as in §3.2). | The legacy package is gone, so the site keeps the data, not the old code. |
| §11: Playwright in Chromium, Firefox and WebKit | Chromium only, at this time. | The tests examine the site, not the browsers. Add the other browsers when a defect needs them. |
| §11: IndexNow | Not done. | IndexNow needs a key file and a request after each deployment. Do it after the first deployment. |
| (new) Edge labels | Each renderer draws the label of an edge at the middle of its route, with a halo. `toXYFlow` gives the label to React Flow. | The model and the text language had labels, but no renderer drew them. The guide found the gap. |
| §13 P3: `tree` with tidy contours | The engine gives a shape to the children of a strategy with `shapes: true`: bands on each axis, at most 64. The strategy packs the row forward and backward and takes the mean. | The contract of §6.3 sees only extents, and a tidy tree needs more. The bands are a contour with a fixed cost for each node. |
| §13 P3: `layers` for graphs | Each strategy gets the extra edges between the subtrees of its children. `layers` turns the back edges of a depth-first search around, uses the longest path for the layers, and orders each layer with 8 barycenter passes. Its `flow` gives the direction to the router. | A flowchart inside one container is the common case. A large graph needs the crossing reduction of dagre or ELK. |
| §4: a budget of 12 kB for the core | 15 kB. The built-in router `avoid` and the strategies `tree` and `layers` made the core 12.7 kB for `layout`. | Each built-in strategy and router is in each bundle, so `router: "avoid"` works by name in the text language and the playground. An opt-in router object keeps the core near 10 kB, but it makes the API less uniform. ireko stays smaller than dagre (17 kB). |
| §5 `avoid`: A* on a sparse grid | The engine gives a router with `obstacles: true` the 32 nearest boxes of each edge, without the ends and their containers. The grid lines are the edges of the obstacles, grown by a margin. The search costs one bend as 40 pixels. | The obstacles of an edge are the boxes that it can cross. A limit of 32 keeps the cost of an edge fixed. |
| (new) The direction of tree edges | An arrangement can give a direction. Grid and tree give it from their side. The orthogonal router uses it for tree edges. | The router chose its axis from the distance between the boxes. In a compact tree, edges then left the side of a box, or became diagonal. |
| (new) Erasable syntax | `erasableSyntaxOnly` in `packages/ireko/tsconfig.json`. | Node.js strips types, but it does not transform parameter properties. The share-card script imports the source of the library in plain Node.js. |

### 16.3 Measurements

- The two-pass engine gives 0 overlaps and 0 escapes on 20000 random inputs (depth 5, up to 5 children, all fit policies, random options and routers).
- The old engine gives overlaps in 1084 of 2000 random trees (§3.2).
- Speed, on one machine, with the audit on:

| Tree | Jqy 0.x | ireko |
|---|---|---|
| 1111 nodes, grid | 469 ms | 6.6 ms |
| 1111 nodes, mixed | 896 ms | 8.6 ms |
| 11111 nodes, grid | 8.1 s | 58 ms |
| 11111 nodes, mixed | 9.1 s | 48 ms |

- Coverage of `src/core` and `src/svg`: 99.7 % of the statements, 99.1 % of the branches, 100 % of the functions and lines.
- The property tests found three defects of the new core before the first commit. The test of the audit found one defect of the test itself.
- P2 found two more defects with its tests. Trigonometry gave positions, for example `2e-14`, and some CSS parsers reject an exponent. The engine writes 0 for these values, but only for positions. A size can be very small, and it stays positive.
- The parity test (P9) shows that SVG, DOM and Canvas draw the same boxes, to 0.001 pixels, for each example.
- Coverage of the library: 99.2 % of the statements, 98.5 % of the branches, 99.6 % of the functions and 99.7 % of the lines.
- P4 (2026-10-13): 176 tests of the library. Coverage 99.3 % of the statements, 97.9 % of the branches, 99.6 % of the functions and 99.7 % of the lines.
- The core is 24 kB minified and 8.9 kB after gzip (esbuild, all exports). `toSVG` adds 1.5 kB, and the text language 2.8 kB.
- In the browser, the fuzz meter of the site lays out 2000 random trees (26315 boxes) in 175 ms, with no overlap.
- The home page of the site loads 117 kB of script after gzip. The playground lays out its first text in approximately 5 ms.
- P3 (2026-10-13): the example tidy-tree is 712 px wide with the strategy `tree`, and 1128 px with linked grids. 20000 random inputs with grid, radial and tree give no defect.
- P3: the audit of a linked chain of 10000 nodes takes 11 ms (658 ms before). A nested chain is still quadratic: each box overlaps all its containers. The core with `tree` is 9.8 kB after gzip. The router `avoid`: 1164 random extra edges on 300 random trees cross boxes 36 times, against 662 times with `orthogonal`. It takes approximately 2.6 ms for each edge.
- P5: the core is 8.1 kB after gzip for `layout`, and 8.7 kB for all of the core. The budget is 12 kB. The tarball has 43 files and no runtime dependencies.
- The work on the site found three defects of the library. The first frame of an animation gave a negative size, because the time of a frame can come before its start. No renderer drew edge labels. The parser had parameter properties.
