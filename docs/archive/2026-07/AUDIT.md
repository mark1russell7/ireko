# Jqy Codebase Audit — Architecture, Bugs, and Roadmap

*Audit date: 2026-07-11. Every claim below was verified by reading all ~65 source files (~4,100 LOC), building the project, typechecking it with `tsc` 5.6 (strict), running the app under Playwright, and executing targeted runtime tests. File references are `path:line`.*

---

## 1. Executive summary

Jqy is a renderer-agnostic **layout engine playground**: a compute core that turns a node tree/graph into positioned boxes + routed edges (`LayoutSnapshot`), rendered through three interchangeable backends (DOM, Canvas, ReactFlow) with an interactive configurator UI. The core pipeline design (parse → validate → plan → place → route → post) is sound and the nested-container mode genuinely works across all three renderers.

**Headline findings:**

1. **The committed repo does not build.** Commit `0192ac4` ("migrate", 2025-08-30) deleted `src/components/core/geometry/index.ts` while splitting it into `vectors.ts`/`shapes.ts`/`types.ts`, but 19 files still import from the `core/geometry` directory. `npm run build` fails with `Could not resolve "./core/geometry"`. An **untracked** local barrel file evidently masked this on the dev machine — the working tree worked, the repository didn't. (A barrel `index.ts` has been restored as part of this audit; it should be committed.)
2. **Nothing could have caught this.** There is no `tsconfig.json`, no `typescript` devDependency, ESLint is configured for `**/*.{js,jsx}` only (`eslint.config.js:10`) so it lints *zero* TypeScript files, there is no test runner, and no CI. The only "test" (`geometry.sanity.test.ts`) is three `console.log`s behind an unused export.
3. Under `tsc --strict` the codebase has **only 20 errors** (2 hard errors — a phantom `Box` type imported from a module that doesn't export it — plus 18 implicit-any/unused). Strictness is cheap to adopt; do it first.
4. Several **real runtime bugs** exist, the worst being `overlapsOfFast` (spatial-hash insertion uses `subtract` instead of `add`, empirically shown to miss overlaps), the engine **silently discarding custom layout-strategy registrations**, and the tree placer having **no depth/node-count guard** (stack overflow on deep trees).
5. The default demo **visibly overlaps** sibling containers (graph-mode grid placement sizes cells from the unit `nodeSize`, ignoring that nested children are far larger), and the engine's own audit reports **33 invariant violations** per compute on the default demo — logged to console, surfaced nowhere.

The codebase is at a healthy "working prototype with strong bones" stage. The bones (pipeline, registries, snapshot contract, ports) deserve the cleanup in Phase 0–2 below before any new layout features are added.

---

## 2. System documentation (as actually built)

### 2.1 Module map

```
src/main.jsx → src/App.tsx                    tab switch: Playground | Testbed
└─ components/
   ├─ ParentChildFlow.tsx                     demo app: state → compute → two LayoutViews
   ├─ ui/controls/{Configurator,controls}.tsx scope/mode/layout/router controls
   ├─ ui/playground/Testbed.tsx               3 renderers × 2 layouts × 2 modes matrix
   ├─ ui/styles/styles.ts                     absolute-positioned shell styles
   │
   ├─ layout/api/index.ts                     createLayoutAPI → {compute, toReactFlow, toSVG}
   ├─ layout/api/contracts.ts                 GraphInput, ComputeOptions, NodeAttrs, Edge
   ├─ layout/engine/engine.ts                 PipelineEngine.run — orchestrates phases
   ├─ layout/engine/context.ts                SystemContext {log, tunings, limits, layouts, routers, input}
   ├─ layout/engine/phases/                   parse, validate, plan, place (TreePlacer), route, post
   ├─ layout/strategies/grid/                 GridLayout (+ Grid/MappedGrid cell containers)
   ├─ layout/strategies/radial/               RadialLayout
   ├─ layout/iterator/                        Iterator abstraction (only Grid uses it)
   ├─ layout/registries/                      layout / router / input-adapter registries
   ├─ layout/routers/                         LineRouter, OrthoRouter (center/perimeter anchoring)
   ├─ layout/layout.tuning.ts                 LayoutTuning knobs + global Config singleton
   ├─ layout/limits/                          LayoutLimits + global Config singleton
   ├─ layout/metrics/metrics.ts               boundsOf, overlapsOf, overlapsOfFast, stats
   ├─ layout/types.ts                         Wire, LayoutStats, LayoutSnapshot
   │
   ├─ graph/                                  NodeConfig tree → Graph normalization + validation
   ├─ core/geometry/                          Vector (immutable 2D), Shapes.Rectangle/Box
   ├─ core/ids-branding/brand.ts              runtime+type branding
   ├─ core/logging/logger.ts                  ConsoleLogger/NoopLogger
   ├─ config.ts                               Config<T> (mutable settings + frozen defaults + derive)
   ├─ iteration/iterate.ts                    enforceBound / sliceBound / mapIndexBounded
   │
   ├─ render/ports/{dom,canvas}.port.ts       RenderPort → RenderSession {draw, destroy}
   ├─ render/ports/viewport.ts                ViewportController (pan/zoom/fitTo, wheel+drag)
   ├─ render/ports/anchoring.ts               center/perimeter edge endpoints (used by routers!)
   ├─ render/views/LayoutView.tsx             port mounting + ReactFlow branch + zoom bar
   ├─ adapters/targets/canvas.core.ts         canvas drawing + unused dirty-rect renderer
   └─ tooling/{exporters,diagnostics}         toReactFlow, snapshotToSVG, runAudit
```

### 2.2 Execution flow (verified against code)

`api.compute(input, opts)` → `PipelineEngine.run` (`engine.ts:26`):

1. **parse** — input-adapter registry: Tree input → `fromTree` (keeps the original tree in `Parsed.tree`); Graph input → parents heuristic (first inbound edge).
2. **validate** — duplicate/missing/self-loop checks; **non-fatal by default** (`onValidateIssues` defaults to `"ok"`, i.e. issues are silently ignored).
3. Per-call configs: `tunings.derive(override)` / `limits.derive(override)` — engine **rebuilds the layout registry from scratch** with only Grid + Radial (`engine.ts:43-52`).
4. **plan** — per node: `layout` (default Grid), `mode` (default GRAPH).
5. **place** — if a tree exists: `TreePlacer` recursion; each parent's strategy returns child centers (+ forced square sizes in NESTED mode) via `placeChildrenEx`. NESTED parents get `preferredSize` from the strategy; NESTED children carry `parentId` and local→absolute offset = parent top-left. Graph-only inputs get a Kahn-style layered fallback (`topoLayers`).
6. **route** — chosen router maps each wire to a polyline (LineRouter always returns one).
7. **post** — pass-through. **audit** actually runs inside `engine.run` (not post): generic nested checks + strategy `auditParent`, attached to `snapshot.meta.audit` and logged at Warn.

Coordinates: top-left origin; boxes store top-left + size; routing and placement work in centers. NESTED strategies return **parent-local** centers, GRAPH strategies return **absolute** centers — this dual convention is implicit contract (`layout.ts:51-56`, `place.ts:209`).

### 2.3 Renderers

- **DomPort** — absolutely positioned divs + SVG lines, incremental element reuse keyed by id, all coordinates shifted by `-bounds.position`; viewport applies CSS transform.
- **CanvasPort** — full redraw per change; viewport + bounds baked into `setTransform` with DPR; wraps snapshot boxes in `getPosition/getSize` shims to satisfy the legacy drawer (`canvas.port.ts:34-39`). Contains a complete but **unused** dirty-rect incremental renderer (`canvas.core.ts:56-78`).
- **ReactFlow** — `toReactFlow` emits parent-relative positions + `extent:"parent"` for nested; all edges with polylines use a custom `poly` edge that draws raw world-coordinate paths (so RF's bezier routing is effectively always bypassed, since LineRouter always emits polylines).

### 2.4 README drift (README.md is a spec, not a description)

| README claim | Reality |
|---|---|
| §7 "tuningOverride temporarily mutates and restores defaults" | Engine uses non-mutating `derive()` (`engine.ts:39`) — README stale (code is better) |
| §8 "All strategies respect maxChildrenPerNode… iteration limits cap loops" | Only children (strategies) and edges (route) are capped. `maxDepth`, `maxNodes`, `maxOpsPerPass` are **never enforced** |
| §12/§20 audit "optional / ship by default" | Audit always runs, is attached to `meta`, surfaced nowhere in UI |
| §15 "Add a layout strategy… register it" | Impossible: engine rebuilds the registry each run with only Grid+Radial, and `LayoutTypes` is a closed enum |
| §3 snapshot boxes are `Shapes.Box` | Runtime boxes are plain object literals; the class type is a fiction (see Flaw D) |
| §9 CanvasPort "dirty-rect for future use" | Accurate — but it's ~100 LOC of dead weight meanwhile |
| §17 "unified zoom" implication | Each `LayoutView` owns a private `ViewportController`; panes never share zoom |

---

## 3. Bug catalog

Severity: **P0** = broken build/tooling, **P1** = incorrect runtime behavior, **P2** = UX/visual defects. ✅ = verified by execution; 🔍 = verified by code trace.

### P0 — build & guardrails

| # | Bug | Location | Evidence |
|---|---|---|---|
| 1 | ✅ **Repo doesn't build**: `core/geometry/index.ts` deleted by `0192ac4` "migrate"; 19 files import the directory | `git show --stat 0192ac4` | `vite build`: `Could not resolve "./core/geometry"`. Fixed by restored barrel (uncommitted) |
| 2 | ✅ **No typechecking exists**: no `tsconfig.json`, no `typescript` dep. Two imports reference a **nonexistent export** `Box` | `place.ts:6`, `anchoring.ts:2` | `tsc` (lax): TS2305 ×2. Strict: 20 errors total |
| 3 | ✅ **ESLint never lints TypeScript** — config matches `**/*.{js,jsx}` only; `npm run lint` checks ~2 files | `eslint.config.js:10` | 63 of 65 source files unlinted |
| 4 | ✅ **`npm run dump:src` broken**: `scripts/concat-src.js` deleted by `543c398` "clean"; replacement submodule `external/concat-src` is uninitialized | `package.json:11`, `.gitmodules` | `ls scripts/` → not found; `git submodule status` → `-4a6fecd` |
| 5 | 🔍 **No tests / no runner**: the only test file is unexecuted `console.log`s | `geometry.sanity.test.ts` | vitest absent from devDependencies |

### P1 — runtime correctness

| # | Bug | Location | Detail |
|---|---|---|---|
| 6 | ✅ **`overlapsOfFast` misses overlaps**: grid insertion computes the box's second corner as `position.subtract(size)` instead of `.add(size)`, so `traverseGridTo` (which only iterates ascending) usually inserts nothing | `metrics.ts:92` | Test: boxes a=(0,0,110×54), b=(10,10) overlap → exact finds `[a,b],[c,d]`; fast returns only `[d,c]`. Results depend on where a box sits inside a 128px cell. Also `boxes.find(...)` per candidate (`metrics.ts:79`) makes "fast" O(n²) anyway |
| 7 | 🔍 **Custom layout strategies are silently discarded**: `engine.run` unconditionally replaces `ctx.layouts` with a fresh registry containing only Grid + Radial | `engine.ts:43-59` | `createDefaultSystem({ layouts })` and `layouts.register(...)` are dead extension points; contradicts README §15 |
| 8 | 🔍 **No recursion guard in TreePlacer**: `maxDepth`/`maxNodes` are configured but never read; deep trees blow the call stack | `place.ts:150-239` | Only `maxChildrenPerNode` (strategies) and `maxEdges` (route) are enforced |
| 9 | 🔍 **Truncated children are misplaced, not dropped**: when a strategy caps children, `TreePlacer` still places every child; missing centers fall back to `centerAbs` and then add the nested offset again — parent-center + parent-top-left = far off-canvas | `place.ts:219-220` | Any node with > `maxChildrenPerNode` children puts the overflow at garbage coordinates instead of omitting them |
| 10 | 🔍 **Wrong error code for every limit**: `enforceBound` throws `LIMIT_MAX_NODES` regardless of which limit tripped | `iterate.ts:18` | Children/edge/depth violations all report as node-count |
| 11 | 🔍 **`Grid.empty` factory receives `undefined` coordinates**: `Array.from({length}, (y: number) => …)` — the first callback arg is the *element* (undefined), not the index | `grid.ts:26-53` | Currently dead code (only `MappedGrid.emptyMapped` is used), but a landmine; also a strict-TS error |
| 12 | 🔍 **CanvasPort leaks a `matchMedia` listener**: DPR listener added on mount, never removed in `destroy()`; also one-shot (query string is built from the DPR at mount) | `canvas.port.ts:81-83` | Leaks one listener per mount; Testbed mounts 4 canvas cells per visit |
| 13 | 🔍 **Duplicate-id validation is dead code**: iterating `Object.keys(g.nodes)` can never see duplicates — `fromTree` already silently merged them (last write wins) | `validate.ts:13-15`, `tree.ts:13` | Duplicate tree ids produce merged nodes + bogus extra edges with no diagnostic; TreePlacer walks the raw tree so both nodes get placed into one box slot |
| 14 | 🔍 **Graph-input parent heuristic can create parent cycles** (`A→B→A` ⇒ `parents[A]=B, parents[B]=A`) | `input.registry.ts:41-51` | Harmless today only because the graph path ignores `parents`; a trap for the planned "high-fidelity" graph placement |
| 15 | 🔍 **Negative content rects for small parents**: `parentSize − 2·outerPad` is not clamped in `nestedFrames` (grid) nor in `placeChildrenEx`'s rect | `grid.layout.ts:47,94` | `splitEven` on a negative total yields negative cell sizes; small nested parents produce inverted geometry |
| 16 | 🔍 **SVG export doesn't escape XML** — node ids are interpolated raw into `<text>` | `svg.ts:35` | An id containing `<`, `&`, `"` produces invalid/injectable SVG |
| 17 | 🔍 **Snapshots are stamped `version: Date.now()`** — layout output is non-reproducible for identical input; `post()`'s `s.version ?? Date.now()` is a no-op since version is always set | `place.ts:28,145`, `post.ts:6` | Contradicts the "deterministic layouts" design goal; breaks memoization/golden-testing |

### P2 — visual & UX defects (all reproduced in a live session)

| # | Bug | Location | Evidence |
|---|---|---|---|
| 18 | ✅ **Default demo overlaps**: GRAPH-mode grid placement uses a fixed cell of `nodeSize + 2·itemPad`, ignoring each child's actual size — but NESTED children get large `preferredSize` boxes. Containers A and C overlap and hide `root`, `B`, `B1`, `B3` | `grid.layout.ts:77-88` | Screenshot; engine's own audit logs **33 issues** per compute on the default demo |
| 19 | ✅ **Audit results are invisible**: attached to `snapshot.meta.audit` and `console.warn`ed, never rendered | `engine.ts:74-79` | 33 violations produce zero UI signal |
| 20 | ✅ **Toolbar overflow/overlap**: fixed 72px bar; Configurator wraps over the panes, zoom bar overlaps toolbar rows, App's Playground/Testbed buttons float over content — **misclicks land on the wrong control** (observed: clicking "Canvas" also mutated sliders/modes) | `styles.ts:19-30`, `App.tsx:10` | Screenshots; observed click-through during session |
| 21 | ✅ **Zoom bar covers content in every Testbed cell** (12 opaque Fit/+/−/100% bars) | `Testbed.tsx:63`, `LayoutView.tsx:64-80` | Screenshot |
| 22 | ✅ **Nested children "pile up" at default sizes** — nested-radial with small parents collapses children to near-center; the "Apply Slider Recommendations" button is a manual workaround for what placement should guarantee | `radial.layout.ts:71-102` | Testbed screenshot (dom•grid•nested etc.) |
| 23 | 🔍 **`unifiedZoom` doesn't unify**: each `LayoutView` constructs its own `ViewportController`; also `new ViewportController()` is constructed and thrown away on **every render** (`useRef(new …)` anti-pattern), and every viewport event forces a React re-render via a dummy counter | `LayoutView.tsx:26,57-62` | Left/right panes zoom independently |
| 24 | ✅ **ReactFlow warning 002** (new `edgeTypes` identity) fires twice per mount | console log | Cosmetic; hoist `edgeTypes` to module scope |
| 25 | 🔍 **Radial n=1 off-center**: a single nested child is placed on the ring at `startAngle` instead of centered; radial square children can also poke past the inscribed circle near rect edges (audit checks ring distance, not containment) | `layout.tuning.ts:81`, `radial.layout.ts:88-101` | Geometry trace |

---

## 4. Architecture flaws

**A. Zero-enforcement development loop (root cause of P0).** A TypeScript codebase with no compiler, no TS linting, no tests, and no CI rots invisibly — the broken `migrate` refactor being Exhibit A. Every other fix is unstable until this exists.

**B. The type system describes a different program.** `LayoutSnapshot.boxes` is typed `Record<string, Shapes.Box>` (class with methods), but every producer emits plain `{id, position, size, parentId, depth}` literals (`place.ts:22,80,170`). Consequences: the phantom `Box` import (bug #2), and `CanvasPort` hand-building `getPosition()/getSize()` shims to satisfy the drawer (`canvas.port.ts:34-39`). Pick one: a plain `Box` interface in `layout/types.ts` (recommended — snapshot is a data contract) and keep `Shapes` for internal math.

**C. Layering inversion.** The compute core depends on the render layer: `layout/routers/*.router.ts` import `resolveEndpoints` from `render/ports/anchoring.ts`. Anchoring is pure geometry; it belongs beside the routers or in `core/geometry`. Today you cannot use the layout core headless without dragging render code along.

**D. Extension points that don't extend.** Three registries exist (layouts, routers, iterators) but: the engine clobbers the layout registry per run (bug #7); registry keys are the closed `LayoutTypes` enum, so `plan()` can never emit a custom kind; and `RadialLayout` bypasses the iterator registry entirely (angle logic lives twice: `layout.iterators.ts:36-40` — unused — and `radial.layout.ts:60-65` — used). Grid resolves anchors through iterators, Radial through tuning directly. Either make the registries load-bearing or delete them.

**E. Duplicated/dead abstraction mass** (~15–20% of the codebase):
- `placeChildren` (legacy) fully duplicates `placeChildrenEx` in both strategies and is unreachable (TreePlacer always finds `placeChildrenEx`); pure drift risk.
- `Phase`/`makePhase` wrappers (`phases/contracts.ts`) are exported but the engine calls functions directly; `route.ts:25` even notes the wrapper is "intentionally not exported."
- `stackFallback` (`place.ts:12-30`) superseded by `topoLayers`, plus a 12-line commented copy of it (`place.ts:90-101`).
- `CanvasRenderer2D.update` dirty-rect machinery (~100 LOC) never invoked.
- `statsOfSnapshot`, `edgeLengthStats`, `maxDepthOf`, `overlapsOf` (exact) — computed nowhere in the app path.
- `env.ts` is entirely placeholder enums; `nestedFrames` is an abstract *requirement* on `Layout` that Radial stubs out with a 0×0 grid (LSP violation — should be optional or Grid-only).
- Runtime branding (`brand.ts`) silently keeps the **first** brand on re-brand (non-configurable `defineProperty` swallowed by `catch`), making `asPosition()`-style assertions unreliable at runtime; effectively decorative.

**F. Mutable global singletons for config.** `LayoutTuningConfig` and `LayoutLimitsConfig` are module-level mutable singletons shared by every system/API instance (`layout.tuning.ts:110`, `limits/index.ts:23`); `Config.set()` mutates them process-wide. `derive()` (good) already covers per-call overrides — globals should become instance state of `SystemContext`. Related: `GridLayout`'s constructor defaults its iterator registry to the **global** tuning even when constructed with custom tuning (`grid.layout.ts:32`), a desync footgun the engine only avoids by always passing all three args.

**G. Per-instance closure methods on `Vector`.** ~50 arrow-function properties are allocated for **every** `new Vector` (`vectors.ts`), and vectors are created in every placement/render inner loop. This multiplies allocation cost ~50× per vector and defeats prototype optimization. Move methods to the prototype (mechanical change, zero call-site impact).

**H. Graph-mode placement ignores subtree extent (root cause of the demo's overlaps).** Placement is single-pass top-down: a parent positions children before knowing how big their subtrees are. Fix requires a bottom-up measure pass (compute each subtree's bounding extent) before the top-down place pass — this is the single highest-impact layout-quality change.

**I. Error/result ergonomics.** `ComputeResult` with `ok:false` carries no snapshot; `api.compute` throws `new Error(JSON.stringify(issues))` (`api/index.ts:22`); wire ids embed array length (`place.ts:214`); `route` casts wires to `any[]` (`route.ts:18`). Small things that make the API feel unfinished.

**J. UI shell built on absolute positioning.** Fixed 72px toolbar with no flow layout is the direct cause of P2 #20's overlap/misclick cluster; the zoom bar and tab buttons are all absolutely positioned patches on top of each other.

---

## 5. Roadmap

### Phase 0 — Repair the foundation (≈ half a day)
1. **Commit the geometry barrel** (restored in this audit) — or better, rewrite the 19 imports to point at `core/geometry/vectors` / `shapes` directly and keep the barrel as convenience.
2. Fix the two phantom `Box` imports: add `export type Box = Shapes.Box` (interim) to `layout/types.ts`, or jump straight to the plain-interface fix (Flaw B).
3. Add `tsconfig.json` (strict, `moduleResolution: "bundler"`, `jsx: "react-jsx"`), `typescript` + `typescript-eslint` devDeps, extend ESLint to `**/*.{ts,tsx}`, add `"typecheck": "tsc --noEmit"`. Burn down the 20 strict errors (~1–2 hours).
4. Add **vitest**; port `geometry.sanity.test.ts` to real assertions; add `overlapsOf`/`splitEven`/`gridUnit` unit tests.
5. Fix or delete `dump:src` (point it at the submodule, add `git submodule update --init` to setup docs).
6. Add CI (GitHub Actions): `typecheck` + `lint` + `test` + `build` on push. *This is the step that prevents the next "migrate" from breaking master.*

### Phase 1 — Correctness (≈ 2–3 days)
7. Fix `overlapsOfFast` (`add`, not `subtract`; O(1) id→box map; property-test against `overlapsOf` with random boxes).
8. Enforce `maxDepth`/`maxNodes` in `TreePlacer.placeNode`; on truncation **skip** children without centers instead of misplacing them (bug #9); correct `enforceBound` error codes.
9. Stop clobbering the layout registry: build the default Grid/Radial registrations *into* `ctx.layouts` creation, and have `engine.run` **re-register only the two defaults** with derived tuning while preserving user registrations — or better, remove the capture-at-construction pattern by passing tuning/limits as `placeChildren` arguments (kills the rebuild entirely).
10. Clamp nested content rects to ≥ 0; escape XML in `snapshotToSVG`; monotonic snapshot version counter instead of `Date.now()`; remove the `matchMedia` leak; delete or fix `Grid.empty`.
11. Detect duplicate ids where they can actually be detected — in `fromTree` (bug #13).

### Phase 2 — Architecture cleanup (≈ 3–5 days)
12. **Make the snapshot honest**: `Box` becomes a plain interface in `layout/types.ts`; delete the `CanvasPort` legacy shim and `canvas.core`'s `LegacyBox`.
13. Move `anchoring.ts` out of `render/` into the routing layer; verify the core imports nothing from `render/` (add an ESLint boundary rule).
14. Delete dead mass: legacy `placeChildren`, `stackFallback` + commented block, `Phase` wrappers (or actually compose the engine from them — pick one), unused metrics or wire them into the UI stats panel, `env.ts` placeholders, dirty-rect renderer (revive it only when perf demands).
15. Unify the iterator story: either both strategies consume `IteratorRegistry` or delete it and keep grid/radial helpers as tuning functions.
16. `Vector` methods → prototype; keep the API identical; add micro-benchmarks if curious (expect measurable GC relief on large trees).
17. Replace global config singletons with per-`SystemContext` instances; fix `GridLayout`'s global-tuning default parameter.
18. Open the registry keys to `string` (branded `LayoutKind`) so custom strategies are plannable end-to-end; make `nestedFrames`/`auditParent` optional interface members.

### Phase 3 — Layout quality (the actual product, ≈ 1–2 weeks)
19. **Two-pass placement**: bottom-up subtree extent measurement, then top-down placement using real extents. This fixes the default demo's A/C overlap — the most visible defect in the product.
20. Add an optional **separation/non-overlap post-pass** (simple push-apart or shelf packing per level) and surface `stats.overlaps` in the UI.
21. Nested sizing guarantees: propagate minimum readable child size upward (parent grows) instead of relying on "Apply Slider Recommendations"; center the n=1 radial child; contain radial squares fully (corner check, not ring check).
22. Real graph-mode layouts for non-tree input (layered/Sugiyama first — `topoLayers` is already halfway there — force-directed later), replacing the parents-from-first-inbound-edge heuristic.
23. Router upgrades: ortho with obstacle avoidance around sibling boxes; optional splines.

### Phase 4 — Product polish & packaging
24. Rebuild the shell with flow layout (flex-wrap toolbar, real rows, z-index discipline) — eliminates the misclick cluster; make `unifiedZoom` actually share one `ViewportController` between panes; compact/toggleable zoom overlay in Testbed cells.
25. **Audit panel in the UI**: render `snapshot.meta.audit` + `stats` (counts, bounds, overlaps) instead of console-only.
26. Snapshot persistence: JSON import/export of `GraphInput` + `ComputeOptions`; shareable URLs.
27. Golden-image regression for the Testbed matrix via Playwright (the matrix page exists precisely for this — automate it).
28. Extract the compute core (`layout/`, `graph/`, `core/`) into a standalone, React-free package with its own entry point — it is already 90% decoupled; Flaw C is the main blocker. This aligns with the broader `@mark1russell7` ecosystem packaging conventions (CLI-scaffolded package, `client-*`/bundle structure).
29. Update README.md to describe what exists (or move it to `docs/SPEC.md` and keep a truthful README) — several sections actively mislead contributors today (see §2.4).

---

## 6. What's genuinely good (keep it)

- The **phase pipeline** and `SystemContext` dependency bundle are the right shape; phases are pure-ish and independently testable once the config globals go.
- The **snapshot contract** (boxes + wires + stats + meta) cleanly decouples compute from three very different renderers — proven by DOM/Canvas/ReactFlow parity in the Testbed.
- **NESTED mode works**: containment, per-child forced square sizing, parent-relative ReactFlow export, and depth-sorted z-order are all correct in the all-nested configuration (verified visually).
- The **audit system** (generic + per-strategy invariant checks) is an unusually good idea at this stage — it already catches the demo's 33 violations; it just needs a UI.
- The **derive()-based per-call overrides** are the correct non-mutating design (the README undersells the code here).
- The math in `radialChildSquareSide` checks out (chord-gap derivation is correct), and `splitEven`'s remainder distribution is exact.
