<!-- ste-disable -->
> **Raw research report (2026-10-12).** Topic: comparable libraries, compositional layout, layout protocols, routing, testing, interactive documentation and positioning. A research agent of the 2026-10-12 review wrote it. It is kept as evidence, with local paths shortened. The synthesis and the decisions are in [../REVIEW.md](../REVIEW.md). This file is not STE text.

# Jqy strategic review: research report

**Scope.** Comparable libraries, compositional layout, layout protocols, routing, testing, docs-site design, and positioning.

**How the data was gathered (2026-10-12).**
- **Versions and dates:** the npm registry (`npm view <pkg> time`) and crates.io.
- **Weekly downloads:** api.npmjs.org, last week.
- **Bundle sizes:** fetched from unpkg and measured raw and with `gzip -9`.
- **Jqy context:** I read Jqy's README.md, AUDIT.md, `layout.ts`, `place.ts` and `ortho.router.ts`.
- No project files were changed.

---

## 0. Summary

1. **Jqy's core idea already exists in other tools; nobody has made it the primary, lightweight abstraction.** The idea is that each container picks its own layout algorithm and the results combine into one snapshot that any renderer can draw. Existing versions:
   - yFiles: `RecursiveGroupLayout` with a per-group `groupNodeLayouts` map.
   - GoJS: `Group.layout`.
   - ELK: a per-compound-node `elk.algorithm`, plus a "topdown" mode.
   - AntV G6 5.1: the `combo-combined` layout, configured by a function per combo.
   - Graphviz `osage`: a `pack` setting per cluster.
   - In 2026, dagre 3.1 added per-cluster `rankdir`/`ranksep`/`nodesep`/`align`, and Mermaid 12 added a per-subgraph ELK algorithm.

   No open-source library offers this as a small TypeScript core that can mix algorithms from different libraries in one tree and output to DOM, Canvas, SVG and React Flow. That is Jqy's niche.
2. **Every mature system lays out containers bottom-up.** It lays out the inside first, then treats the container as one sized node. Jqy uses a single top-down pass. This is the root cause of the overlap in the default demo (AUDIT flaw H, bug #18). The fix is a two-pass measure/arrange protocol, as in Flutter, WPF, SwiftUI and Jetpack Compose. For graph mode, measure must return an "extent" (an envelope around the node and its subtree). A second, top-down "fixed size + scale" policy for nested mode, as in ELK's topdown layout, would replace the "Apply Slider Recommendations" workaround.
3. **Routing.** The practical step up from Jqy's L-shaped elbows is A* search on a sparse, non-uniform grid with a penalty per bend. Excalidraw described exactly this for its elbow arrows (Dec 2025). The heavier options are libavoid (WASM, LGPL) and ELK's edge-only libavoid mode. Because Jqy has a tree, hierarchical edge bundling is cheap to add later.
4. **Testing.** Combine:
   - property tests with fast-check 4.10, generating random NodeConfig trees with `fc.letrec`;
   - checks between pipeline phases, modelled on ELK's black-box and white-box tests;
   - relational assertions, which is how dagre 3.1 tests per-cluster direction;
   - golden JSON snapshots plus a few Playwright 1.64 screenshots;
   - Vitest 5 benchmarks, whose `bench` API was rewritten as a test fixture with `bench.compare` and `toBeFasterThan`.
5. **Docs site.** The best sites combine instant editing, shareable URL state, and figures you can drag right next to the prose. A layout engine with no heavy dependencies can afford a live editor on every page. React Flow gave this up because Sandpack was slow.
6. **Positioning.** Avoid "nested layout" (search results are dominated by Next.js), "compositional layout" (Apple's UICollectionViewCompositionalLayout), "auto layout" (Apple and Figma), and "layout engine" on its own (UI and flexbox engines). Aim for "graph layout", "tree layout", "compound graph layout", "diagram layout" and "React Flow auto layout / subflows". The unscoped npm name `jqy` is taken by an abandoned 2022 package (description "测试", meaning "test"), so publish under a scope.

---

## 1. Landscape of comparable libraries

### 1.1 Snapshot table

| Library | Latest (date) | npm/week | What it does well | API shape |
|---|---|---|---|---|
| **ELK / elkjs** | elkjs 0.12.0 (2026-07-17) | 11.7M (largely transitive via Mermaid, which depends on `elkjs ^0.9.3`) | Layered (Sugiyama) layout with ports, hierarchy, routed edges; huge option set; algorithms include layered, stress, mrtree, radial, force, disco, rectpacking, box, topdownpacking, libavoid, VertiFlex (0.11) | Async `new ELK().layout(jsonGraph, {layoutOptions})`; JSON tree of `children`, `ports`, `labels`, `edges{sources,targets,sections}`; `layoutOptions` on any element; `knownLayoutOptions()` / `knownLayoutAlgorithms()` |
| **dagre** (`@dagrejs/dagre`) | 3.1.1 (2026-08-08); 3.0.0 TS rewrite (2026-03-22) | 5.4M (+3.05M for the unmaintained `dagre` 0.8.5) | Fast, simple layered DAG layout; 3.1 adds per-cluster settings and a "dynamic layout" mode (`useDynamic`, `corePath`) for stable ordering | Synchronous graphlib: `g.setNode(id,{width,height,rankdir?})`, `g.setParent`, `g.setEdge`, `layout(g)` |
| **d3-hierarchy** | 3.1.2 (2022) | 21.9M | tree (Reingold–Tilford with Buchheim's linear-time fix), cluster, treemap (squarify etc.), partition, pack | `d3.tree().nodeSize([w,h]).separation(fn)(root)` writes x/y onto nodes |
| **d3-flextree** | 2.1.2 | 217K | Variable-size tidy trees (van der Ploeg), O(n), 3.3 KB gz | `flextree({nodeSize: n => [w,h], spacing})` |
| **d3-force** | 3.0.0 | 25.6M | Velocity-Verlet force simulation; composable forces | `forceSimulation(nodes).force('link',…)` |
| **WebCola / cola.js** | 3.4.0 (2022, dormant) | 127K | Constraint layout: separations, alignments, groups, `avoidOverlaps`, flow layout; "converges to a local optimum… less jitter than D3 force" | `cola.d3adaptor().constraints([...]).avoidOverlaps(true).start(a,b,c)` |
| **Cytoscape.js** | 3.34.3 (2026-09-07) | 18.5M | Graph model plus renderer plus layouts; compound parents sized from their children; extension layouts fcose 2.2.0, cola, cise, elk, klay, dagre | `cy.layout({name, …}).run()` or `eles.layout(…)` to lay out a subset |
| **Graphviz in WASM** (`@hpcc-js/wasm-graphviz`, `@viz-js/viz`) | 1.29.2 / 3.31.0 (Sept 2026) | 432K / 200K | dot, neato, fdp, sfdp, circo, twopi, osage (clustered), patchwork (treemap); clusters; HTML-like table labels with ports | DOT string in, SVG or JSON out |
| **Mermaid** | 12.1.0 (2026-10-02); 12.0.0 (2026-09-10) | 18.5M | Text-to-diagram. In 12.0, ELK is bundled and is the default; dagre is opt-in | `layout: elk \| dagre \| elk.stress …` in front matter; per-subgraph `@{ algorithm: … }` (see below) |
| **yFiles for HTML** (commercial) | 3.1 (May 2026, per a third-party post) | n/a | Most complete commercial suite: hierarchical, tree, organic, orthogonal, recursive group layout, incremental layout, edge bundling, WebGL | Algorithm plus `LayoutData` objects with per-item mappers |
| **GoJS** (commercial) | 4.0.5 (2026-10-02; 4.0.0 on 2026-06-16) | 309K | Diagram toolkit; `Group.layout` per group; layout invalidation model; 4.0 has a faster ForceDirectedLayout and generic typed models | `diagram.layout = new TreeLayout(...)`; `group.layout = new GridLayout(...)` |
| **MSAGL-js** | `@msagl/core` 1.1.24 (2026-04-24) | 37K | Sugiyama, MDS and IPSepCola layouts; spline, rectilinear and bundled routing; SVG and WebGL renderers; now ships an AI-agent skill | `@msagl/core` geometry API |
| **Yoga** | 3.2.1 (2024-12) | 16.3M | Flexbox engine (React Native). Tagline: "A portable layout engine targeting web standards." | Node tree, style setters, `calculateLayout()` |
| **Taffy** (Rust) | 0.15.0 (crate, 2026-10-12) | n/a | Block, Flexbox and CSS Grid; used by Servo, Bevy, Zed | Tree with measure functions |
| **Penrose / Bloom** | `@penrose/core` 3.3.1 (2026-08-30) | 1.6K | Diagrams from math notation (Domain / Substance / Style), laid out by optimizing constraints and objectives; Bloom adds interactivity | Three small DSLs; Bloom's `DiagramBuilder` with weighted objectives |
| **Bluefish** | `bluefish-js` 0.0.39 (2026-05-21) | 28 (research-grade) | Relations instead of components (`Align`, `Distribute`, `StackH`/`StackV`, `Background`, `Arrow`, `Ref`); UIST 2024 | Solid JSX or vanilla JS |
| **React Flow (xyflow)** | `@xyflow/react` 12.12.0 (2026-09-24) | 14.0M; the legacy `reactflow` 11.11.4 still gets 2.27M | Node-based editor UI; sub-flows via `parentId` / `extent:'parent'`; measured sizes in `node.measured`; no layout of its own | Recommends dagre, d3-hierarchy, d3-force or ELK |
| **Sprotty / KIELER** | sprotty 1.4.0 (2024-12) | n/a | SVG diagram framework with ELK integration (`sprotty-elk`); Langium/LSP | Client-server model |
| **AntV G6 / layout** | `@antv/g6` 5.1.1; `@antv/layout` 2.0.0 (2026-02) | 269K (layout) | Many layouts, WASM and GPU variants, `combo-combined` | `layout: {type, …}`; in 5.1 a function per combo |
| **d3-dag** | 1.2.2 (2026-07-05) | 59K | Sugiyama, zherebko and grid layouts for DAGs | Builder API |
| **Constraint solvers** (`@lume/kiwi`, `kiwi.js`) | 0.4.4 / 1.1.3 | 79K / 5.6K | Cassowary (the Apple Auto Layout family) | Variables, constraints, `updateVariables()` |

**Measured bundle sizes:**

| File | Raw | gzip |
|---|---|---|
| `elkjs@0.12.0/lib/elk.bundled.js` | 1.61 MB | 467 KB |
| `@dagrejs/dagre@3.1.1` ESM | 48.6 KB | 16.9 KB |
| `libavoid-js` WASM | 492 KB | 180 KB |
| `d3-hierarchy` (min) | 14.8 KB | 5.8 KB |
| `d3-flextree` (min) | 9.0 KB | 3.3 KB |

**Licences:**
- ELK is EPL-2.0. Since 0.12.0 it can also be used under GPL-3.0 as a secondary licence ([ELK 0.12 review](https://projects.eclipse.org/projects/modeling.elk/releases/0.12.0/review)).
- ELK's libavoid module and libavoid-js are LGPL.

### 1.2 What each one teaches (key notes and sources)

**ELK / elkjs** ([repo](https://github.com/kieler/elkjs), [ELK paper arXiv 2311.00533](https://arxiv.org/abs/2311.00533), [JSON format](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html))
- **Graph model.** Nodes, ports, labels and edges. Edges have `sources`/`targets` arrays and routing `sections` (start point, bend points, end point). `layoutOptions` can go on any element.
- **Where edges live.** An edge may be declared under any node; the usual choice is the lowest common ancestor of its endpoints, which handles hierarchy-crossing edges.
- **Hierarchy.** Compound graphs are laid out bottom-up by default (see the paper). [`hierarchyHandling`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html) chooses between `SEPARATE_CHILDREN` (a separate layout run per compound node; the default) and `INCLUDE_CHILDREN` (one run covering the whole subtree, so cross-hierarchy edges route properly).
- **Top-down mode.** [`topdownLayout`](https://eclipse.dev/elk/reference/options/org-eclipse-elk-topdownLayout.html) (since 0.9) fixes parent sizes first and scales child layouts to fit. Nodes are marked `ROOT_NODE` or `HIERARCHICAL_NODE`, and the renderer receives `topdown.scaleFactor` ([blog](https://eclipse.dev/elk/blog/posts/2023/23-04-11-topdown-layout.html)).
- **Recent releases.** 0.11 added VertiFlex and new top-down size approximators ([0.11 notes](https://eclipse.dev/elk/downloads/releasenotes/release-0.11.0.html)). 0.12 is mostly fixes plus the GPL-3.0 option ([0.12 notes](https://eclipse.dev/elk/downloads/releasenotes/release-0.12.0.html)).
- **Lesson for Jqy.** Options attached to elements, plus an option registry you can query (`knownLayoutOptions`), is what makes per-node configuration and auto-generated docs and UI possible.
- **Main complaint.** Options are hard to discover. React Flow says ELK is "the most configurable… but also the most complicated" and that it is hard for their team to support ([React Flow layouting guide](https://reactflow.dev/learn/layouting/layouting)).

**dagre** ([changelog](https://github.com/dagrejs/dagre/blob/master/changelog.md), [repo](https://github.com/dagrejs/dagre))
- 3.0 is a full TypeScript rewrite with native types and ESM/CJS exports.
- 3.1.0 adds "Per-Cluster Direction Support (PR #511): each cluster/subgraph can now specify its own `rankdir`, `ranksep`, `nodesep`, and `align`… applied recursively."
- Its test suite has `per-cluster-direction-test.ts`, which asserts relations such as "x1 left of x2, same y; the inner cluster is above x3" rather than exact coordinates. That is a good pattern to copy.
- React Flow notes that sub-flow layout breaks when nodes inside a sub-flow connect to nodes outside it.

**d3-hierarchy and d3-flextree** ([d3.tree docs](https://d3js.org/d3-hierarchy/tree), [d3-flextree](https://github.com/Klortho/d3-flextree))
- `d3.tree` is Reingold–Tilford with Buchheim et al.'s linear-time fix. It assumes all nodes are the same size; `separation` returns relative units (1 for siblings, 2 for cousins).
- d3-flextree implements van der Ploeg's non-layered tidy trees, which support variable-sized nodes, in O(n). It reads `nodeSize` per node and a `spacing(a,b)` function.
- Either one could be a ready-made Jqy "tree" strategy at a few KB.

**WebCola** ([site](https://ialab.it.monash.edu/webcola/))
- Constraint stress majorization: separation and alignment constraints, groups with padding, `avoidOverlaps`, flow layout.
- `.start(a,b,c)` runs in three phases: unconstrained, then structural constraints, then all constraints including non-overlap.
- Works well below about 100 nodes. Unmaintained since 2022.
- Teaches: layout as staged constraint satisfaction, with non-overlap as the last stage.

**Cytoscape.js** ([docs](https://js.cytoscape.org/#layouts), [fCoSE README](https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/README.md))
- Compound parents "do not have independent dimensions": their size is inferred from their children (bottom-up).
- `eles.layout()` can lay out any subset, which is how people get different layouts per compound by hand.
- fCoSE (Balci and Dogrusoz, IEEE TVCG 2022) combines a spectral starting layout with CoSE force refinement. It supports compound graphs fully and accepts fixed, alignment and relative placement constraints, but only on simple nodes.
- The other compound-aware layouts are cise (circular clusters), klay (KIELER layered) and elk.

**Graphviz** ([layouts](https://graphviz.org/docs/layouts/), [osage](https://graphviz.org/docs/layouts/osage/), [HTML-like labels](https://graphviz.org/doc/info/shapes.html))
- `osage` "lays out the internals of each cluster subgraph first", then packs that level's nodes and clusters as blocks. Each cluster can set its own `pack` and `packmode`, inherited from the parent. Edges are ignored while packing and routed afterwards with `splines`.
- That is bottom-up compositional layout with a per-container setting: very close to Jqy's nested-grid case.
- `patchwork` draws a squarified treemap of the cluster hierarchy.
- HTML-like labels (nested `TABLE`/`TR`/`TD` with `PORT`, `COLSPAN`, `ROWSPAN`, `CELLPADDING`, `FIXEDSIZE`) are a grid layout inside a node, with named ports for edges.
- WASM builds: [`@hpcc-js/wasm-graphviz`](https://www.npmjs.com/package/@hpcc-js/wasm-graphviz) and [`@viz-js/viz`](https://www.npmjs.com/package/@viz-js/viz).

**Mermaid 12** ([12.0.0 release notes mirror](https://newreleases.io/project/github/mermaid-js/mermaid/release/mermaid@12.0.0), [layouts doc](https://mermaid.js.org/config/layouts.html))
- ELK is bundled and is the default for flowchart, state, class, ER, requirement and use-case diagrams. Mindmaps keep cose-bilkent.
- Variants `elk.stress`, `elk.force`, `elk.mrtree`, `elk.sporeOverlap`, `elk.box` and `elk.rectpacking` work without extra setup.
- The release notes say a subgraph can choose its own algorithm with `@{ algorithm: … }`. I could only confirm this from the release-notes mirror, not the official docs page.
- The tiny build falls back to dagre.
- 12.0 requires ES2024, Safari 17.4+ and Node 22.12+.

**yFiles** ([RecursiveGroupLayout API](https://docs.yworks.com/yfiles-html/api/RecursiveGroupLayout.html), [demo](https://live.yworks.com/demos/layout/recursivegroup/), [mixed layouts tutorial](https://docs.yworks.com/yfiles/doc/demo/layout/mixed/README.html), [v3](https://yfiles.com/v3))
- This is the closest commercial equivalent of Jqy:
  - each group node maps to its own algorithm through `RecursiveGroupLayoutData.groupNodeLayouts`;
  - processing "starts by arranging the leaves in the hierarchy tree, then works its way up to the root";
  - a `NULL_LAYOUT` keeps the children fixed and only sizes the group;
  - edges between groups are routed by a separate router you can customise.
- 3.0 replaced data providers with `LayoutData` and `IMapper`, attached per item.
- The 3.1 notes, from a third-party post ([apievangelist](https://blogs.apievangelist.com/blogs/flowcharts-2026-05-13-yfiles-for-html-3-1-released/)), mention more stable hierarchical layout, faster edge bundling and WebGL ports.

**GoJS** ([groups](https://gojs.net/latest/intro/groups.html), [layouts](https://gojs.net/latest/intro/layouts.html), [changelog](https://gojs.net/changelog))
- "A Group has its own Group.layout"; the diagram layout "will treat those groups as if they were simple nodes". A Placeholder sizes the group to the union of its members.
- It also has an invalidation model (`isOngoing`, `isInitial`, `layoutConditions`, `isLayoutPositioned`).
- Its interactive samples expose every layout property as a live control, which is a good docs pattern.

**AntV G6 5.1** ([combo-combined](https://g6.antv.antgroup.com/en/manual/layout/combo-combined-layout), [5.1 upgrade](https://g6.antv.antgroup.com/en/manual/whats-new/upgrade-to-5-1))
- In 5.1 a single `layout` function receives `comboId` and returns the configuration for that level. In 5.0 you passed separate `innerLayout` and `outerLayout` instances.
- Known issues reported by users include combos overlapping after expand with relayout, and grid cols/rows only applying on the first pass. These are the same bug classes Jqy has; treat them as a warning.

**React Flow v12** ([sub flows](https://reactflow.dev/learn/layouting/sub-flows), [what's new](https://reactflow.dev/whats-new))
- `parentNode` was renamed `parentId` (deprecated in 11.11, removed in 12).
- Parents must come before children in the array; child positions are relative to the parent.
- Measured sizes live in `node.measured`.
- Its Pro examples include "Auto Layout" (dagre, d3-hierarchy and ELK, switchable at runtime), "Dynamic Layouting" (d3-hierarchy plus animated transitions) and "Edge Routing" (libavoid).
- Stately's pipeline ([docs](https://prod.stately.ai/docs/packages/graph/react-flow-elk-pipeline)) shows the standard two-pass integration: render hidden, wait for `useNodesInitialized`, read `measured` sizes into ELK, convert back. Jqy needs the same "measure callback" hook.
- **Jqy still depends on `reactflow@11.11.4`.**

**MSAGL-js** ([repo](https://github.com/microsoft/msagljs), [JointJS wrapper docs](https://docs.jointjs.com/learn/features/automatic-layouts/msagl)): Sugiyama layout with rectilinear or bundled spline routing (`edgeRoutingMode`). The old `msagl-js` package is deprecated in favour of `@msagl/*`.

**Yoga and Taffy** ([yogalayout.dev](https://www.yogalayout.dev/), [Taffy](https://github.com/DioxusLabs/taffy)): flexbox and grid engines whose nodes take measure functions. Useful as models for "leaf measure functions" (text and custom content) and for track sizing in CSS Grid.

**Penrose and Bloom** ([penrose.cs.cmu.edu](https://penrose.cs.cmu.edu/), [Bloom blog](https://penrose.cs.cmu.edu/blog/bloom), [constraints reference](https://penrose.cs.cmu.edu/docs/ref/constraints))
- Constraints and objectives are energy functions minimised by an optimiser.
- Bloom adds a "lasso term" so shapes you are not dragging don't jump during interaction. That idea maps directly onto stability in incremental re-layout.

**Bluefish** ([paper](https://arxiv.org/html/2307.00146v4), [site](https://bluefishjs.org/)): covered in section 2.

**tldraw and Excalidraw**
- Neither has general graph auto-layout.
- tldraw's [Frame layout modes example](https://tldraw.dev/examples/frame-layouts) is a board shape with a per-frame `layout` prop (free, row, column, grid, spotlight). It calls a pure `arrangeBoard(mode, boxes) -> {boxes, w, h}`, re-runs on `onChildrenChange`, and animates over 220 ms. This is a miniature Jqy and a useful UI reference. tldraw also has [layout constraint bindings](https://tldraw.dev/examples/layout-bindings).
- Excalidraw's elbow arrows are covered in section 4.

**D2** ([layouts](https://d2lang.com/tour/layouts/), [grid diagrams](https://d2lang.com/tour/grid-diagrams/))
- One engine per diagram (dagre, ELK or TALA).
- `grid-rows` / `grid-columns` / `grid-gap` act as a per-container grid layout, nested inside cells.
- With dagre and ELK, edges between grid cells are straight center-to-center lines; only TALA routes them.
- Per-container `direction` works only in TALA.
- Lesson: an explicit grid container is a popular feature, and routing inside nested grids is the weak spot.

**Sprotty / KIELER** ([sprotty.org](https://sprotty.org/)): an SVG framework that plugs into ELK on a server or language server (Langium). It shows the split between "layout engine" and "view framework" that Jqy already has.

### 1.3 Algorithm families Jqy should know

- **Layered (Sugiyama 1981).** Cycle removal, then layering, then crossing minimisation, then coordinate assignment (Brandes–Köpf), then edge routing. Implemented by dagre, ELK Layered, d3-dag and MSAGL. Jqy's graph-input fallback (`topoLayers`) is the layering step; the rest is missing. Wrap dagre or ELK rather than re-implementing it.
- **Tidy trees.**
  - Reingold–Tilford (1981): contours, threads, parent centred over children.
  - Walker (1990): n-ary trees, with "apportion" to spread small subtrees between big ones.
  - Buchheim, Jünger and Leipert (GD 2002, [doi](https://link.springer.com/doi/10.1007/3-540-36151-0_32)): Walker's algorithm was actually quadratic; their version produces the same layouts in linear time.
  - van der Ploeg, "Drawing non-layered tidy trees in linear time" (SPE 2014; CWI 2013, [record](https://ir.cwi.nl/pub/21856)): variable node heights, children at a fixed distance below their parent. Implementations: d3-flextree, `non-layered-tidy-tree-layout`, and the Rust crate `tidy-tree` (zxch3n/tidy).
- **Radial trees** (Eades, "Drawing free trees", 1992). Each subtree gets an annulus wedge sized by its leaf count. ELK Radial ([ref](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-radial.html)) instead defaults to `NODE_SIZE`: the wedge is sized by the summed node diagonals. It adds radial or per-wedge compaction, overlap removal and rotation.
- **Space-filling layouts.**
  - Treemap: squarified tiling (Bruls, Huizing and van Wijk 2000), available as `d3.treemap` and Graphviz `patchwork`.
  - Circle packing: `d3.pack`, front-chain packing plus Welzl's smallest enclosing circle.
  - Partition / icicle: `d3.partition`.
  - Rectangle packing: ELK `rectpacking` keeps the box order, approximates a width for a target aspect ratio (default 1.3), then compacts ([ref](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-rectpacking.html)).
- **Force, stress and constraint layouts.** d3-force, ELK stress, WebCola (stress majorization with separation constraints), and fCoSE for compound graphs.

---

## 2. Compositional, per-node strategy layout

### 2.1 How existing systems choose a layout per container

| System | How a container chooses its layout | Order | Edges between containers |
|---|---|---|---|
| ELK | `elk.algorithm` in a compound node's `layoutOptions` | Bottom-up by default (`SEPARATE_CHILDREN`); `INCLUDE_CHILDREN` merges a subtree into one run; `topdownLayout` = parent first, children scaled | Declared on the lowest common ancestor; best handled with `INCLUDE_CHILDREN` or ports |
| yFiles `RecursiveGroupLayout` | `groupNodeLayouts` map from group to algorithm; core layout otherwise; `NULL_LAYOUT` sizes only | Bottom-up, leaves first | Separate router for edges between groups, customisable |
| GoJS | `Group.layout`; `null` means the diagram lays out the members | Group as a "simple node" in the outer layout | Routed by links |
| AntV G6 5.1 `combo-combined` | `layout(comboId) => config` | Inner layouts, then outer | Known overlap issues on relayout |
| Graphviz `osage` | `pack` / `packmode` per cluster (inherited) | Bottom-up: cluster internals, then pack | Ignored while packing; `splines` afterwards |
| dagre 3.1 | Per-cluster `rankdir`, `ranksep`, `nodesep`, `align` | Recursive | Cross-cluster routing improved in 3.1 |
| Mermaid 12 | Per-subgraph `@{ algorithm: … }` (ELK) | Built on ELK's recursive runs | ELK |
| D2 | `grid-rows` / `grid-columns` per container; per-container direction only in TALA | n/a | Straight lines in grids except with TALA |
| Cytoscape.js | Manual: `parent.children().layout({...})`; compound sizes inferred | Whatever order you run them in | Engine dependent |
| tldraw example | `layout` prop on a frame: `arrangeBoard(mode, boxes)` | Child change triggers parent re-arrange | n/a |
| Bluefish | Relations (`StackV`, `Align`, `Distribute`, `Background`) that may *share* children via `Ref` | One local pass, with dimension ownership | Arrows are relations |

### 2.2 Grammars, research systems and constraint approaches

- **Bluefish** (Pollock et al., UIST 2024; [paper](https://arxiv.org/html/2307.00146v4), [MIT page](https://vis.mit.edu/pubs/bluefish)).
  - Relations relax UI components: a relation need not own its children outright and may leave some of their dimensions unspecified.
  - The scenegraph is a compound graph: a tree plus "adjacency" edges created by `Ref`.
  - Layout is single-pass local propagation, "the same basic approach used by CSS, SwiftUI, and Jetpack Compose".
  - **Dimension ownership:** each bounding-box dimension records who set it, and a second writer raises an error naming the owner. Transforms are fixed lazily when a `Ref` needs them.
  - Stated limits: no size alignment (it would need minimum sizes before layout), axis-aligned bounding boxes only, local solving only, about 2–6x slower than hand-written D3, incremental layout is future work.
  - For Jqy: dimension ownership is a cheap, high-value audit ("who set this x?"), and `Ref` shows how to add cross-tree relations (align these two nodes) without leaving a tree-structured spec.
- **Haskell `diagrams`** ([Combinators](https://hackage-content-origin.haskell.org/package/diagrams-lib-1.4/docs/Diagrams-Combinators.html)).
  - Composition through **envelopes**: `|||`, `===`, `hcat`, `vcat`, `beside`, `alignT`/`alignB`, `withEnvelope`, `strut`, `pad`, `phantom`.
  - `===` is associative with `mempty` as identity. These are real algebraic laws, which a "layout algebra" for Jqy could state and property-test.
  - The envelope (what composition sees) is separate from the visual bounds. That is exactly Jqy's graph mode: the node's box is small, but its envelope includes its children.
- **Apple UICollectionViewCompositionalLayout** ([WWDC19](https://developer.apple.com/videos/play/wwdc2019/215/)): items inside groups inside groups, nested arbitrarily, sized fractionally, absolutely or by estimate. It owns the phrase "compositional layout" in search (see section 7).
- **Constraint-based UI.** Cassowary (Badros, Borning and Stuckey, TOCHI 2001) behind Apple Auto Layout; kiwi.js and the maintained fork [`@lume/kiwi`](https://github.com/lume/kiwi); [autolayout.js](https://github.com/IjzerenHein/autolayout.js) implements Apple's Visual Format Language. Useful later as an optional `constraints` strategy for "align these", not as the core.
- **SetCoLa** (Hoffswell, Borning and Heer, EuroVis 2018; [IDL page](https://idl.uw.edu/papers/setcola)): define *sets* of nodes by data or graph properties and apply constraints to sets, compiled to WebCola. The lesson is a selector-based way to assign layouts, like CSS selectors, so the specification can be reused across graphs.
- **Penrose** (Ye et al., SIGGRAPH 2020): separates *what* (Substance) from *how it looks* (Style), with Domain as the type system. Jqy could likewise split the content tree from a stylesheet that assigns `layout`/`mode` by selector.
- **Charticulator** (Ren, Lee and Brehmer, TVCG 2019; [MSR](https://www.microsoft.com/en-us/research/?p=500444)): glyphs and plot-segment layouts compiled to constraints and solved by a linear solver; reusable templates.
- **GoTree** (Li et al., CHI 2020; [project](https://vis.pku.edu.cn/gotree/index.html)): a tree visualisation is defined by visual elements, layout and coordinate system. It covers "unit-decomposable" and "axis-decomposable" trees; Tree Illustrator builds more than 100 tree forms plus hybrids. The lesson is separating the coordinate system (Cartesian or polar) from the layout, so grid and radial become the same algorithm under a polar transform. Jqy's grid/radial split could be rethought along this axis.
- **Atlas** (Liu et al., VIS 2021; [paper](https://mail.hdi.cs.umd.edu/papers/Atlas_VIS21.pdf)): a chain of production rules where every intermediate state can be inspected. Matches Jqy's phase pipeline and a "scrub through the phases" docs view. Related: ATOM (unit visualisations through recursive divide operators) and Manipulable Semantic Components (repeat, divide, densify).
- **NetPanorama** (Scott-Brown and Bach, arXiv 2310.18902; [paper](https://arxiv.org/html/2310.18902v2)): a declarative pipeline of parameterised steps for building, transforming, laying out and encoding networks, with an online editor. This is the nearest "grammar of graphics for networks".
- **Gosling** (VIS 2021; [paper page](https://content.ieeevis.org/year/2021/paper_v-full-1274.html)): a genomics grammar in which views nest and each can be linear or circular. I could not reach the docs to confirm the exact arrangement keywords. It is a precedent for "per-view layout, composed by arrangement".
- **Vega** (6.4.0) hierarchy transforms (`stratify`, `tree` (tidy or cluster), `treemap`, `partition`, `pack`, `treelinks`; [tree transform](https://vega.github.io/vega/docs/transforms/tree/)): layout as a dataflow transform that writes x/y fields. Vega-Lite has no tree transforms.
- **GraphScape** (Kim et al., CHI 2017) is about how similar visualisations are and how to sequence them. It is not a network-layout grammar; the request misfiled it.
- **"Diagrammar"**: I found no paper or library by that name. The nearest match is the ECOOP 2026 paper ["Automatic layout of railroad diagrams"](https://arxiv.org/abs/2509.15834) (Chiplunkar and Pit-Claudel). It separates a *diagram language* (components and connections) from a *layout language* (shapes and positions) with a compiler in between. That separation is worth copying in Jqy: NodeConfig as the diagram language, LayoutSnapshot as the layout language.
- **Compound-graph research.**
  - Kasperowski and von Hanxleden, "Top-down drawings of compound graphs" ([arXiv 2312.07319](https://arxiv.org/html/2312.07319v2)), covered in section 3.5.
  - Han et al. 2024, ["An Overview+Detail Layout for Visualizing Compound Graphs"](https://arxiv.org/html/2408.04045v1): expanded groups are drawn next to their collapsed parent, boundary ports make interiors independent, and a modified non-layered Reingold–Tilford resolves overlaps along two axes.

### 2.3 Ideas Jqy could adopt (ranked)

1. **Bottom-up measure, top-down arrange.** Every system in 2.1 measures a container's content before placing the container. Details in section 3.
2. **A container is "just a node" to its parent.** After measure, the parent strategy sees each child as an opaque box with a size and, in graph mode, an envelope. This is what lets *any* algorithm (ELK, dagre, d3-flextree, treemap) be dropped in for one subtree.
3. **Open the layout spec from enum to data.** Replace `layout: "grid" | "radial"` with `layout: { type: string, ...options }`, and also allow a function `(node, ctx) => LayoutSpec` (the G6 5.1 approach) or selector rules (SetCoLa, CSS-like). Registry keys become strings (fixes AUDIT D and bug #7). Options inherit from ancestors, as in ELK.
4. **Option schemas on every strategy.** Each strategy declares its options with type, default, range and description (ELK's `knownLayoutOptions`). This gives generated docs pages, an automatic configurator UI, validation and editor autocomplete.
5. **Make the sizing policy its own per-node axis,** separate from the algorithm: `fit-content` (bottom-up), `fixed` with `scale` (ELK topdown), `fixed` with `clip`, `min/max` clamps. Today "graph vs nested" mixes two separate questions: are children inside the parent's box, and who decides sizes.
6. **Adapter strategies.** Wrap `@dagrejs/dagre` (17 KB gz), d3-flextree (3 KB), `d3.treemap`/`d3.pack` (6 KB), and ELK (467 KB gz, worker, optional peer dependency) as Jqy strategies for one subtree each. Jqy becomes the composition layer, a role no open-source library holds.
7. **Edges between containers as a separate phase.** yFiles, osage and the top-down paper all route edges between groups after layout. Jqy's `route` phase already sits there. Add boundary ports on containers.
8. **Audits that record provenance.** Record which strategy, phase and dimension set each value (Bluefish's dimension ownership). Surface overconstraint and overlap in the UI.
9. **State algebraic laws and test them.** For example: `grid(cols=1)` equals `stack-v`; a grid with one child centres it; radial with one child centres it (AUDIT bug #25); compose is associative.
10. **Reconsider grid vs radial as the coordinate-system axis** (GoTree). "Radial" can be "grid in polar coordinates", "tree in polar coordinates" and so on.

---

## 3. Two-pass measure/arrange protocols

### 3.1 Protocols compared

| Framework | Protocol | Notes |
|---|---|---|
| Flutter ([docs](https://docs.flutter.dev/ui/layout/constraints)) | "Constraints go down. Sizes go up. Parent sets position." | Constraints are {min,max}×{w,h}; single pass; a child cannot know or choose its own position |
| WPF ([docs](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/layout)) | `Measure(available) -> DesiredSize`, then `Arrange(finalRect)`; panels override `MeasureOverride` / `ArrangeOverride` | Arrange is never called before Measure; a child may be smaller than its slot (alignment) |
| SwiftUI `Layout` ([deep dive](https://swiftui-lab.com/layout-protocol-part-1/)) | `sizeThatFits(proposal, subviews, cache)` and `placeSubviews(in:bounds, proposal, subviews, cache)` | A `ProposedViewSize` of nil means "ideal size", 0 means minimum, ∞ means maximum; a cache is shared between the two calls |
| Jetpack Compose ([intrinsics](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements)) | `MeasurePolicy`: measure each child once, then `layout(w,h){ place }`; intrinsic min/max queries before measuring | "Measure each child once" keeps layout linear-time |
| CSS / Yoga / Taffy | Box tree with measure functions on leaves; grid track sizing resolves column and row sizes from content (min/max-content) | CSS Grid "auto" tracks are exactly Jqy's graph-mode grid problem |

### 3.2 Why this fixes Jqy

`TreePlacer.placeNode` (`place.ts`) does everything in one top-down pass:
1. decides the node's size (`forceSize ?? sizeForNode`);
2. asks the strategy for child *centers* given only `nodeSize`, `spacing` and `parentSize`;
3. recurses into the children.

In graph mode the grid uses a fixed cell of `nodeSize + 2·itemPad`, but a child that is a nested container (or has a large graph-mode subtree) is far bigger than that, so siblings overlap (AUDIT H, #18). Radial graph mode has the same problem: its ring radius ignores how much angle each child's subtree needs.

### 3.3 A proposed Jqy strategy contract (sketch)

```ts
type Proposal = { minW: number; maxW: number; minH: number; maxH: number }; // Flutter-style
interface Measured {
  size: Size;            // the node's own box (unit box in graph mode, container in nested mode)
  extent: Rect;          // envelope of node + everything it draws, relative to the node's center
  contour?: Contour;     // optional: precise left/right (or angular) profile for tidy packing
}
interface LayoutStrategy<O = unknown, C = unknown> {
  kind: string;                                   // open registry key
  options: OptionSchema<O>;                       // docs, UI and validation
  measure(n: NodeView<O>, kids: MeasuredChild[], p: Proposal, cache: C): Measured;      // post-order
  arrange(n: NodeView<O>, kids: MeasuredChild[], frame: Rect, cache: C): ChildPlacement[]; // pre-order, parent-local
  audit?(...): Issue[];
}
```

- Always return **parent-local** coordinates, as ELK JSON and React Flow do, and convert to absolute once at the end. This removes the implicit "local in NESTED, absolute in GRAPH" rule (`layout.ts:51-56`, `place.ts:209`).
- Graph mode and nested mode then differ only in what `measure` returns:
  - **Nested:** `size = content + padding` and `extent = size`.
  - **Graph:** `size = nodeSize` and `extent = union(own box, children's extents placed around it)`.
- Memoise `measure` by (node id, proposal, subtree hash). That cache is the basis for later incremental re-layout, much like SwiftUI's cache and GoJS's layout invalidation.

### 3.4 Measure rules for Jqy's two strategies

- **Grid** (graph or nested). Use CSS-Grid-style auto tracks. Column width `w_j = max(extent.width)` over the children in column j; row height `h_k` likewise. Cell origins are cumulative sums plus gaps, and each child is centred in its cell, or aligned by `justify`/`align` options. Graph mode places the grid around or below an anchor (`anchor()` tuning) using these real track sizes. Nested mode does the same inside the content box. `splitEven` (equal cells) stays available as an option.
- **Radial, graph mode.** Child i needs angle `θ_i = 2·asin((r_i + gap/2)/R)`, where `r_i` is the child envelope's circumradius (or half-diagonal). Find the smallest R with `Σθ_i ≤ 2π` and `R ≥ r_parent + max r_i + gap` by bisection. Alternatively, allocate wedges in proportion to `r_i` (ELK's NODE_SIZE criterion) or to leaf counts (Eades). The parent's extent is a circle of radius `R + max r_i`. A single child goes at the centre or straight below, which fixes bug #25.
- **Radial, nested mode.** The same chord inequality, solved for the largest child square that fits the inner ring and the content box, checking corners rather than ring distance (#25).
- **Tidy tree** (new strategy, or wrap d3-flextree). Measure returns contours: one interval per depth (Reingold–Tilford) or per y-interval (van der Ploeg). Arrange shifts subtrees apart by the minimum separation between contours. Bounding-box extents are the simple first step, essentially what Graphviz osage packs; contours are the precise upgrade.

### 3.5 Nested sizing policies: bottom-up vs top-down

Kasperowski and von Hanxleden ([arXiv 2312.07319](https://arxiv.org/html/2312.07319v2); implemented in ELK):

- **Bottom-up layout.** Children are laid out first and parents grow to fit. Everything shares one scale, so deep hierarchies become huge and labels illegible when zoomed to fit.
- **Top-down layout.** Parents are sized first and child layouts are scaled to fit. The top level stays readable, detail appears on zoom, and unexpanded subtrees can be deferred. The cost is that scale compounds exponentially with depth.
- **How to guess a parent's size before its children are laid out:**
  - a fixed base size;
  - base size × √(child count), which is the default;
  - a one-level look-ahead;
  - for "Fixed" nodes, "topdownpacking" into a near-square grid of predictable size.
- **Their evaluation** on 1,250 SCCharts diagrams: look-ahead gives the most consistent readability for small and medium graphs.
- **Algorithms per level** in their application: layered for states within regions, rectpacking for regions within superstates. This is evidence that mixing algorithms per level works in practice.

**Recommendation.** Jqy's nested mode today is effectively top-down without explicit scaling: the parent's preferred size comes from a count heuristic, then children are fitted and squared. Make the policy explicit per node: `sizing: "fit" | "fixed-scale" | "fixed-clip"`.
- Under `fixed-scale`, record `scale` on the Box, like ELK's `topdown.scaleFactor`, so renderers can scale label fonts.
- Use the √n approximator or a one-level look-ahead in place of the "Apply Slider Recommendations" button.

### 3.6 Tidy-tree mechanics, for implementation or for docs explainers

1. **Post-order.** Lay out each child subtree, then sweep siblings left to right. Shift each new subtree right by the largest overlap between the accumulated right contour of its left siblings and its own left contour (plus separation), comparing depth by depth.
2. **Threads.** Walk contours in O(height of the shorter subtree) by following "thread" pointers from the bottom of the shorter contour into the taller subtree.
3. **Apportion** (Walker). Spread the shift evenly over the small subtrees in between, so they don't bunch up.
4. **Buchheim et al.** Keep the ancestor and shift bookkeeping in O(1) amortised, which makes the whole algorithm linear.
5. **Non-layered** (van der Ploeg). A child's y is the parent's bottom plus a gap. Contours are kept per y-interval rather than per depth, and linear time is restored with a modified proof.

d3-flextree is a 3 KB reference implementation of all of this.

---

## 4. Orthogonal edge routing and edge bundling

### 4.1 Approaches, cheapest first

1. **Heuristic elbows** (Jqy today): an L-shape choosing the shorter elbow. No obstacle awareness.
2. **A* on a sparse, non-uniform grid with a bend penalty** (Excalidraw elbow arrows; [Part 1](https://plus.excalidraw.com/blog/building-elbow-arrows-part-one), [Part 2](https://plus.excalidraw.com/blog/building-elbow-arrows-part-two), Dec 2025).
   - Grid lines only at shape corners, at the endpoints' "headings" (exit directions), and halfway between shapes, with padding around shapes. This is essentially a Hanan grid.
   - Cost `g` = path length plus bend count; heuristic `h` = Manhattan distance plus exclusion zones.
   - Obstacles are cells you cannot visit; segments may not turn back on themselves (no U-turns or spikes); longer straight runs are preferred.
   - Very close endpoints get a hard-coded simple route; avoidance is relaxed when endpoints lie inside shapes.
   - tldraw has its own elbow-arrow route types ([ElbowArrowRoute](https://tldraw.dev/reference/tldraw/ElbowArrowRoute)).
   - Feasible in about 300–600 lines of TypeScript. **This is the recommended first step for Jqy.**
3. **Orthogonal visibility graph plus A* plus nudging** (libavoid / Adaptagrams; Wybrow, Marriott and Stuckey, "Orthogonal Connector Routing", GD 2009, LNCS 5849).
   - Build the visibility graph from horizontal and vertical lines projected from obstacle corners.
   - Run A* minimising a monotonic function of length and bend count.
   - "Nudge" shared segments apart afterwards. Fast enough to re-route during interaction.
   - Later work (DIAGRAMS 2014) adds obstacle-hugging routes and a 1-bend visibility graph for speed.
   - JavaScript options:
     - [libavoid-js](https://github.com/Aksem/libavoid-js) 0.5.0-beta.5: Emscripten build, LGPL-2.1, 180 KB gz WASM, 19K downloads/week.
     - JointJS's [`@joint/router-avoid`](https://docs.jointjs.com/learn/features/automatic-layouts/standalone-link-routing): one incremental router per graph.
     - React Flow's Pro "Edge Routing" example ([page](https://reactflow.dev/examples/edges/edge-routing)).
     - [sprotty-routing-libavoid](https://github.com/aksem/sprotty-routing-libavoid).
4. **ELK.**
   - Layered's `edgeRouting` = ORTHOGONAL, POLYLINE or SPLINES, routed together with node placement, with hyperedge junction points.
   - [ELK libavoid](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-alg-libavoid.html) is an edge-only router that leaves nodes alone. It runs libavoid in a separate process ([blog](https://eclipse.dev/elk/blog/posts/2022/22-11-17-libavoid.html), [libavoid-server](https://github.com/TypeFox/libavoid-server)) and is LGPL.
5. **MSAGL.** Rectilinear and spline routing with `EdgeSeparation` and padding; parallel segments overlap unless the separation is tuned ([JointJS MSAGL docs](https://docs.jointjs.com/api/layout/MSAGL)).

### 4.2 Hierarchy-specific rules for Jqy

- Route in absolute coordinates *after* placement (Jqy's `route` phase already does this).
- **Obstacles for an edge (u, v):**
  - siblings, and the siblings of ancestors, along the path from u through their lowest common ancestor to v;
  - **not** the ancestors of u or v themselves, which the edge has to pass through.
- Add **ports**: points on container boundaries where cross-hierarchy edges enter and leave, as in ELK's hierarchical ports and the overview+detail paper. This lets a container's interior be routed independently.
- Use `anchoring.ts` (perimeter/center) to set endpoint headings, and move it out of `render/` (AUDIT C).

### 4.3 Edge bundling

- **Hierarchical edge bundling** (Holten, InfoVis 2006): route each edge along control points on the tree path from u up to the lowest common ancestor and down to v, drawn as a B-spline with tension β. Available as `d3.curveBundle`; the β default is usually given as 0.85 ([d3 gallery](https://d3-graph-gallery.com/graph/hierarchical_edge_bundling_basic.html)).
  - **This is the natural bundling for Jqy**, because every input already has a tree. It is a few dozen lines and can be a router (`"bundle"`) that emits polylines or curves.
- **Force-directed edge bundling** (Holten and van Wijk, EuroVis 2009; [paper](https://diglib.eg.org/handle/10.1111/v28i3pp0983-0990)): edges act as springs that attract each other; needs no hierarchy, but can bundle unrelated edges.
- yFiles 3.1 shipped a faster bundling variant for dense graphs; MSAGL has bundled splines.

---

## 5. Testing strategies for layout engines

### 5.1 What established projects do

- **ELK** ([Unit Tests](https://eclipse.dev/elk/documentation/algorithmdevelopers/unittesting.html)):
  - JUnit with `@RunWith(LayoutTestRunner.class)`; tests run over the **cross product** of graphs, configurations and algorithms.
  - Graphs come from code (`@GraphProvider`), files (`@GraphResourceProvider`, from the `elk-models` repo's tests, realworld and tickets folders) or random generators (`@RandomGeneratorOptions`).
  - Configurations come from `@ConfiguratorProvider` and `@DefaultConfiguration`; algorithms from `@Algorithm` or `@AllAlgorithms`.
  - **Black-box** tests check the final result. **White-box** tests run before or after named internal processors (`@TestBeforeProcessor`, `@TestAfterProcessor`, `@FailIfNotExecuted`).
  - Jqy's equivalent: run invariants *between pipeline phases* (after plan, measure, arrange, route).
- **dagre 3.x** ([repo tests](https://github.com/dagrejs/dagre/tree/master/test)):
  - Jest, TypeScript, one test file per pipeline phase (`acyclic`, `rank/`, `order/`, `position/`, `normalize`, `nesting-graph`, `add-border-segments`, `parent-dummy-chains`, `per-cluster-direction`, `coordinate-system`) plus `layout-test.ts`.
  - A `bench` script (benchmark.js) and a `prepublishOnly` chain of typecheck, lint, test, build.
  - Assertions are relational ("left of", "same y", "inside"), not exact pixels.
- **Cytoscape.js** (repo):
  - mocha unit tests in `test/`;
  - a `benchmark/` suite per algorithm;
  - a `debug/` page for manual visual checks;
  - `playwright-tests/renderer.spec.js`, which loads a fixture page and uses `page.evaluate` to assert geometry (bounding boxes, unique points, distances) in a real browser instead of comparing screenshots;
  - a `.size-snapshot.json` that tracks bundle size.

### 5.2 Property-based tests with fast-check (4.10.2, 2026-09-19)

Generate random NodeConfig trees with [`fc.letrec`](https://fast-check.dev/docs/core-blocks/arbitraries/combiners/recursive-structure/) (use `depthSize`/`maxDepth`), assigning a random layout, mode, sizing policy and child count to each node, plus random `spacing`, `nodeSize` and tuning overrides. On failure fast-check shrinks the input to a minimal tree, which gives instant bug reports.

**Invariants (each also runs as a phase-boundary white-box check):**
1. Every coordinate is finite; every size is ≥ 0; there are no negative content rectangles (#15).
2. Every input node has exactly one box, or a reported truncation issue; truncated children are never placed at nonsense coordinates (#9).
3. **Containment:** a nested child lies inside its parent's content box, with ε tolerance.
4. **No overlap:** siblings are disjoint, including spacing; graph-mode subtree envelopes are disjoint. Run this against both `overlapsOf` and `overlapsOfFast` and assert they agree; that would have caught #6.
5. **Determinism:** `compute(x)` deep-equals `compute(x)` (drop `Date.now()` from `version`, #17), with stable iteration order.
6. **Routing:**
   - polyline endpoints lie on the source and target anchors;
   - orthogonal routes alternate horizontal and vertical segments;
   - with the avoiding router, no segment passes through a non-endpoint obstacle.
7. **The audit checks itself:** generate boxes that are known to overlap and assert the audit reports them; generate valid layouts and assert it reports zero issues.

**Metamorphic relations (no oracle needed):**
- Translating the origin translates all boxes by the same vector.
- Scaling `nodeSize` and `spacing` by k scales all coordinates by k, for strategies that are linear.
- Relabelling node ids gives the same geometry under the id mapping.
- Reversing child order mirrors a radial layout (when clockwise and start angle are symmetric).
- **Locality:** adding a leaf under subtree A doesn't change relative positions *inside* sibling subtree B. This is the stability property Bloom's lasso term and dagre's dynamic mode aim for.
- Rendering through DOM, Canvas or SVG never changes the snapshot.
- Snapshot JSON round-trips losslessly.

**Laws, if the layout algebra is adopted:** a grid with one column equals stack-v; associativity of composition; identity element.

### 5.3 Golden and visual regression

- **Golden JSON.** Round snapshots to 0.01 px and store them with Vitest `toMatchFileSnapshot`, for about 20 curated trees covering every layout, mode and renderer combination (the Testbed matrix). Store SVG exports (`snapshotToSVG`) as goldens too: text diffs are reviewable and stable across platforms.
- **Screenshots, used sparingly** for the renderer ports. Use Playwright 1.64 `toHaveScreenshot` with `maxDiffPixelRatio` around 0.01 and a `threshold` around 0.2, and generate baselines **inside the official Playwright Docker image**, because fonts and anti-aliasing differ across operating systems ([Argos guide](https://argos-ci.com/blog/playwright-visual-regression-testing-ci)). Alternatively, Vitest Browser Mode `toMatchScreenshot`. Use geometry assertions in the browser (the Cytoscape style) for DOM and React Flow parity.

### 5.4 Benchmarks

- **Vitest 5** (released 2026-09-03; [blog](https://vitest.dev/blog/vitest-5)): `bench` is no longer a top-level import. It is a test-context fixture with `bench.compare()` and `expect(...).toBeFasterThan`, `writeResult` and `bench.from()` for baselines, and a Tinybench provider you can swap out (tinybench 6.2.2).
- **mitata** 1.0.34 for micro-benchmarks, such as the cost of per-instance closures on `Vector` (AUDIT G).
- **[CodSpeed](https://codspeed.io/blog/vitest-bench-performance-regressions)** gives CI-stable measurement (CPU simulation, under 1% variance) and is free for open-source projects.
- Benchmark random trees of 10 to 100,000 nodes and track allocations.

### 5.5 Layout quality metrics as regression signals

Track overlaps, area, aspect ratio, total and variance of edge length, edge crossings, bends per edge, and angular resolution for each strategy across commits. References: Gove's [greadability.js](https://github.com/rpgove) and [glam](https://github.com/kwonoh/glam) (Graph Layout Aesthetic Metrics). Jqy's `metrics.ts` already has the hooks; surface the values in `stats` and in CI output.

---

## 6. Interactive docs site

### 6.1 What the best sites do

- **ELK, elklive** (`rtsys.informatik.uni-kiel.de/elklive`; returned HTTP 502 during this research): a live editor for ELK's text and JSON graphs with an example library. The reference has one page per option, generated from metadata ([example](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-radial.html)), with defaults and descriptions. Jqy should copy generating the reference from strategy option schemas.
- **React Flow** ([examples](https://reactflow.dev/examples)): a large gallery of focused examples, each with source and "open in StackBlitz/CodeSandbox".
  - They dropped Sandpack in-page editing in Oct 2024 because it loaded slowly, didn't handle Svelte well and was slow to author. Examples now build to one static Vite app.
  - They added `llms.txt` endpoints for AI-assisted users.
  - Pro examples (Auto Layout, Dynamic Layouting with animated re-layout, Edge Routing) are the most-visited layout topics.
- **d3 and Observable:** notebooks where every cell is live; Observable Notebooks 2.0 / Notebook Kit (2025) is an open file format that builds to static sites ([preview](https://observablehq.com/notebook-kit/)).
- **Cytoscape.js** ([demos](https://js.cytoscape.org/#demos)): one page per layout with the same data, so you can compare layouts directly.
- **Bluefish** ([bluefishjs.org](https://bluefishjs.org/)): "The missing diagramming framework"; Get Started, Learn, Examples, and a Playground on the Solid playground; feature cards for composition, reactive diagrams and custom layouts.
- **Penrose** ([site](https://penrose.cs.cmu.edu/)): "Create beautiful diagrams just by typing notation in plain text"; a gallery of examples, a three-pane online editor (Domain, Substance, Style), tutorials, and Bloom docs for interactivity.
- **tldraw** ([examples](https://tldraw.dev/examples)): hundreds of tiny examples, each one idea with its source; `llms-examples.txt`.
- **Mermaid Live Editor:** the entire state lives in the URL fragment (`#pako:` + deflate + base64url), so links are shareable with no server.
- **GoJS samples:** each layout has a page exposing every property as a form control next to the live diagram.
- **Explorable explanations.**
  - Bret Victor coined the term; his "Up and Down the Ladder of Abstraction" shows a parameter swept across small multiples.
  - Nicky Case's [explorabl.es](https://explorabl.es/).
  - Red Blob Games splits a diagram into controls → input → algorithm → output → visualisation ([diagram structure](https://www.redblobgames.com/making-of/diagram-structure/)), animates algorithm internals such as the A* frontier, and publishes "making-of" pages.
  - Bartosz Ciechanowski ([ciechanow.ski](https://ciechanow.ski/)) puts every figure inline with the prose and makes each one directly manipulable.
- **Motion docs** (layout animations, [docs](https://motion.dev/docs/react-layout-animations)): FLIP-based "layout" transitions are the standard way to morph between positions.

### 6.2 Creative ideas for Jqy's site

1. **Live playground.** A JSON or TypeScript-DSL editor (CodeMirror 6 or Monaco) with autocompletion and hover docs generated from the strategy option schemas, and a canvas that re-lays out on every keystroke. Compute runs in a Web Worker with debouncing; errors and audit issues appear inline. Unlike React Flow, Jqy needs no bundler in the page, so live editing costs little.
2. **Edit by clicking.** Click a node on the canvas to get a popover with layout, mode, sizing and options. "Apply to subtree" (already in the Configurator) becomes a breadcrumb.
3. **Morphing transitions.** Switching a node's layout tweens boxes from the old snapshot to the new one, matched by id. Resample polylines to equal point counts so wires morph too. Keys 1–5 switch the selected container between grid, radial, tree, treemap and pack.
4. **Pipeline phase scrubber.** A timeline across parse, validate, plan, measure, arrange, route and post.
   - In the measure phase, extents grow bottom-up as translucent envelopes; in arrange, children drop into place top-down.
   - It is driven by the same phase hooks as the white-box tests (ELK-style). This is the signature visual: it shows *why* the layout looks as it does.
5. **Invariant overlay.** Hatching for overlaps, red outlines for containment violations, badges for non-square children. Clicking an issue zooms to it. A "Why is this here?" tooltip shows provenance (strategy, phase and owner of each dimension, the Bluefish idea).
6. **Small multiples for a parameter.** Sweep one tuning knob (spacing, `radialLevelScale`, the grid `rowCol` heuristic) across a row of thumbnails, or two knobs as a matrix. The Testbed matrix becomes a public "layout × mode × renderer" gallery.
7. **Layout algebra playground.** Snap blocks together (grid of radial of tree), show the equivalent expression and JSON, and list the algebraic laws the result obeys, each with a "verify" button that runs the fast-check property in the browser.
8. **Router lab.** Drag obstacles and endpoints and watch A* explore the sparse grid with a bend penalty slider. Compare line, L-shaped, A* and libavoid routers side by side, with metrics (length, bends, crossings).
9. **Renderer parity view.** DOM, Canvas, SVG and React Flow panes with one shared viewport (fixes `unifiedZoom`, AUDIT #23) and an optional pixel-diff overlay.
10. **Shareable everything.** Compressed URL state (input, options, seed, selected phase); "Copy as SVG / React Flow JSON / snapshot JSON"; "Open in StackBlitz". "Report a bug" pre-fills a GitHub issue with the URL.
11. **Fuzz button.** Generate a random tree with the same fast-check arbitrary used in CI, with the seed in the URL, so bugs found on the site reproduce in tests.
12. **Explainer articles** in the explorable style:
    - "Constraints down, sizes up: measuring a nested diagram";
    - "Tidy trees in linear time" (animated contours and threads);
    - "Radial wedges" (drag a subtree and watch its wedge grow);
    - "Bottom-up vs top-down nesting" (scale factors and readability while zooming);
    - "Routing around boxes".
13. **Benchmark and quality dashboard.** In-browser Tinybench runs over random trees of growing size, plus charts of quality metrics per strategy; numbers from CI published per release.
14. **Recipe gallery.** Org chart, mind map, architecture diagram (nested containers with grids, like D2), file-tree treemap, clustered network, React Flow sub-flows. Each recipe is a URL preset with "use in your app" code.
15. **For AI coding assistants.** `llms.txt`, plus a small option catalogue in JSON. React Flow and tldraw publish `llms.txt` endpoints, and MSAGL-js now ships an agent skill.

---

## 7. Naming, positioning and SEO

### 7.1 How comparable libraries describe themselves (npm `description` or site tagline)

- elkjs: "Automatic graph layout based on Sugiyama's algorithm. Specialized for data flow diagrams and ports."
- dagre: "Graph layout for JavaScript"
- d3-hierarchy: "Layout algorithms for visualizing hierarchical data."
- d3-force: "Force-directed graph layout using velocity Verlet integration."
- d3-flextree: "Flexible tree layout algorithm that allows for variable node sizes."
- d3-dag: "Layout algorithms for visualizing directed acyclic graphs."
- cola.js: "Constraint-Based Layout in the Browser"
- cytoscape-fcose: "The fCoSE layout for Cytoscape.js by Bilkent with fast compound node placement"
- @viz-js/viz: "WebAssembly build of Graphviz with a simple wrapper for using it on the web"
- @xyflow/react: "A highly customizable React library for building node-based editors and interactive flow charts."
- Yoga: "A portable layout engine targeting web standards" / "An embeddable and performant flexbox layout engine…"
- msagljs: "A JavaScript graph layout engine: port of MSAGL"
- Penrose: "Create beautiful diagrams just by typing notation in plain text."
- Bluefish: "The missing diagramming framework"
- Sprotty: "A next-gen framework for graphical views"
- @lume/kiwi: "High speed Cassowary constraint solver in JavaScript."

The pattern is a category noun ("graph layout", "tree layout", "diagramming") plus "for JavaScript/TypeScript/the web" plus *one* differentiator ("specialized for ports", "variable node sizes", "constraint-based", "compound node placement").

### 7.2 Keyword evidence

- **"graph layout"** is a narrow, winnable topic. The GitHub topic `graph-layout` has only 78 repositories, led by elkjs (2.8k stars), d3-graphviz and d3-dag ([topic](https://github.com/topics/graph-layout)). Searching "graph layout javascript library" returns dagre and its forks first.
- **"layout engine"** is dominated by UI layout. Of 268 repositories under `layout-engine`, the leaders are LayoutKit, PinLayout, FlexLayout (Yoga) and autolayout.js ([topic](https://github.com/topics/layout-engine)).
- **"nested layout"** returns Next.js App Router nested layouts and CFML layouts. Avoid it as a primary term.
- **"compositional layout"** is Apple's UICollectionViewCompositionalLayout. **"auto layout"** is Apple Auto Layout and Figma Auto Layout; it is only usable inside "React Flow auto layout".
- **"React Flow auto layout"**, **"react flow subflows / group nodes layout"** and **"elkjs react flow"** are high-intent queries that React Flow's own docs answer with "use dagre/ELK; ELK is complex". A Jqy React Flow adapter page targets exactly that frustration.
- **"tree layout typescript variable node sizes"** returns d3-flextree and cytoscape-tidytree, a gap Jqy's tree strategy can fill.
- **"diagram layout engine typescript"** returns ELK, Sprotty, Syncfusion and TSDiagram: no lightweight TypeScript-native leader.

### 7.3 Suggested positioning

- **One-liner (npm description, about 120 characters):** "Composable graph & tree layout for TypeScript: pick a layout per container (grid, radial, tree, layered), get boxes + routed edges for any renderer."
- **Hero line:** "Mix layout algorithms per group." Sub-line: "A tiny, deterministic layout core for nested diagrams, with adapters for React Flow, SVG and Canvas, and for ELK, dagre and d3."
- **npm keywords:** `graph-layout`, `tree-layout`, `compound-graph`, `hierarchical-layout`, `nested-graph`, `group-layout`, `diagram-layout`, `auto-layout`, `react-flow`, `xyflow`, `subflows`, `elkjs`, `dagre`, `d3-hierarchy`, `radial-tree`, `treemap`, `orthogonal-routing`, `edge-routing`, `typescript`.
- **Name.** The unscoped `jqy` exists on npm (v0.0.7, 2022, description "测试", meaning "test"). Publish scoped, e.g. `@mark1russell7/jqy` per the workspace's convention for general packages, or choose a pronounceable name. These were unclaimed on npm on 2026-10-12:
  - `nestlay`, `layoutweave`, `boxweave`, `matryoshka-layout`, `compose-layout`, `composable-layout`, `layout-algebra`, `plait-layout`, `strata-layout`.
  - `graphnest` and `nestgraph` are taken.
- **Comparison page.** "Jqy vs ELK vs dagre vs d3-hierarchy" using the matrix in 2.1, including bundle sizes (ELK 467 KB gz vs dagre 17 KB gz vs d3-hierarchy 6 KB gz). This is what wins comparison searches.

---

## 8. Key takeaways for Jqy

1. **The niche is real, and the job is composition.** Per-container layout choice exists in yFiles, GoJS, ELK, G6, osage, and as of 2026 in dagre 3.1 and Mermaid 12, but always tied to one engine's own algorithms or a commercial licence. Position Jqy as the small TypeScript core that *composes* strategies, including ELK, dagre and d3 strategies as optional adapters, into one deterministic, renderer-agnostic snapshot. Don't try to out-Sugiyama ELK.
2. **Replace the single top-down pass with measure (post-order) and arrange (pre-order).** Strategies return a size *and* an extent; graph-mode grid uses real track sizes; graph-mode radial solves the chord or wedge inequality. Coordinates are always parent-local. This removes the default demo's overlap (AUDIT H, #18) and makes nested sizing principled (#22, #25).
3. **Treat sizing as a per-node policy:** `fit` (bottom-up), `fixed-scale` (ELK topdown, with a scale factor on the Box) or `fixed-clip`, using the √n or one-level look-ahead estimate in place of "Apply Slider Recommendations".
4. **Make the spec data, not enums.** `layout: {type: string, ...opts}`, optionally a function or selector rules; string registry keys; options inherited from ancestors; each strategy publishes an option schema that drives validation, the configurator UI and generated reference docs. This also fixes the dead extension points (AUDIT D, #7).
5. **Routing roadmap:**
   - (a) move anchoring into the core;
   - (b) a sparse-grid A* orthogonal router with a bend penalty, as Excalidraw does;
   - (c) container ports and hierarchy-aware obstacle sets;
   - (d) hierarchical edge bundling along the lowest-common-ancestor path;
   - (e) libavoid-js (LGPL WASM) as an optional plugin for interactive-grade orthogonal routing with nudging.
6. **Testing:**
   - fast-check tree generators plus the invariant list in 5.2, run between phases (ELK-style white-box tests);
   - metamorphic relations for scale, translation, relabelling and locality;
   - relational assertions, as dagre does;
   - rounded golden JSON and SVG;
   - a handful of Playwright screenshots inside Docker;
   - Vitest 5 `bench` fixtures with baselines, plus quality metrics in CI.
   - First, remove `Date.now()` from snapshots and add a test that `overlapsOfFast` agrees with `overlapsOf`.
7. **Move to `@xyflow/react` 12.** `reactflow` 11 is legacy: `parentNode` became `parentId`, sizes are in `measured`, and parents must precede children. Offer the "measure callback" integration (render, then `useNodesInitialized`, then measured sizes, then Jqy, as Stately does with ELK). That integration is the strongest adoption path, since "React Flow auto layout for subflows" is a known pain point.
8. **Docs site centrepieces:**
   - the live playground with compressed URL state;
   - the phase scrubber showing measure (sizes going up) and arrange (positions going down);
   - the invariant and provenance overlay;
   - morph-on-switch;
   - the router lab;
   - generated option reference;
   - recipe gallery;
   - `llms.txt`.
9. **Steal four ideas from research systems:**
   - Bluefish's dimension ownership, for audits and over-constraint errors;
   - SetCoLa and Penrose selector or stylesheet assignment of layouts;
   - GoTree's coordinate-system axis, so radial becomes a polar transform of other layouts;
   - Bloom's "lasso" stability term, or dagre's dynamic mode, when incremental re-layout arrives.
10. **Watch licences when adding adapters.** ELK is EPL-2.0 (GPL-3.0 secondary since 0.12) and about 467 KB gz; libavoid is LGPL. Keep both as optional peer-dependency plugins so the core stays MIT-friendly and small, comparable to dagre at 17 KB gz.
11. **Naming and SEO:** lead with "graph layout / tree layout / compound graph layout / React Flow auto layout"; avoid "nested layout", "compositional layout" and bare "layout engine". Publish under a scope; unscoped `jqy` is taken.
