# Changelog

This file records the changes to `ireko` in each version. The release workflow copies the section of a version into its GitHub release.

## Versions

`ireko` uses semantic versioning. Before version 1.0.0, these rules apply:

- A minor version (`0.2.0`) can change the API in a way that is not compatible. Its section here tells you what to change.
- A patch version (`0.1.3`) corrects errors, or adds a feature that is compatible, for example a new strategy or a new export. It does not remove or change an existing API.
- The layout of an input can change in a minor version, for example when a strategy gets better. A patch version keeps each existing layout the same, except to correct an overlap or another defect.

A prerelease version (`0.2.0-beta.1`) goes to the npm tag `next`. Each other version goes to `latest`.

## 0.2.0

This version is a minor version. It changes no API. The layout of a graph with crossed edges in the strategy `layers` can change.

- A long edge in the strategy `layers` gets a virtual node in each layer between its ends. Thus the barycenter ordering also counts the long edges.
- The ordering counts the crossings after each pass, and it keeps the order with the fewest crossings. Thus a pass does not make the order worse.
- Each example of the gallery keeps its layout: the golden files do not change.
- A dependency map of 250 boxes and 293 edges had 3710 crossings of its routed edges with 0.1.5. With 0.2.0, it has 2010.
- The crossing reduction adds approximately 0.4 kB gzip to each entry with the strategy `layers`. The gzip size of `layout` goes from 17.34 kB to 17.72 kB. The size limits of `layout`, the core, `ireko/shapes`, `ireko/react` and `ireko/xyflow` go up by 0.3 kB to 0.5 kB.

## 0.1.5

This version is a patch. It changes no API, and each layout stays the same.

- The five generated modules (`measure`, `place`, `shape`, `grid` and `radial`) come from one commit of Vex. The new CI job `bytes` holds each file equal to its print.
- Old and new files gave the same values on 128,508 calls, with 0 differences. The calls include each side of 256 children, up to 9,000 children.
- The `radial` strategy takes 11 % to 12 % less time for a layout of 1,111 or 11,111 nodes. One call takes 37 % less time at 12 children, 52 % less at 200 and 6 % less at 1,000.
- One call of `grid` takes 3 % to 5 % less time, but a full layout shows no change. The time of `measure`, `place` and `shape` stays inside the check that compares a file with a copy of itself.
- The gzip size of `layout` goes from 17,095 B to 17,337 B in `ireko`, and from 18,986 B to 19,229 B in `ireko/shapes`.
- The size limits do not change.

## 0.1.4

- The new subpath `ireko/shapes` exports `layout`. It gives the same layout as `ireko`, to the bit, and it gets the shapes of linked nodes from a module of the Vex compiler.
- The new option `linkedShape` of `createEngine` sets the code that gives the shape of a linked node. The default is the code of ireko, so a layout of `ireko` does not change. The option and the types `LinkedShape` and `ShapePart` are `@beta`.

## 0.1.3

- The new opt-in strategy `force`, from the new subpath `ireko/strategies/force`, arranges the children with a force-directed relaxation. Register it with `createEngine({ strategies: [forceStrategy] })`. `layout` and the built-in strategies do not change, so a caller that does not import the subpath does not pay for it. The children repel each other, and each edge between two children is a spring. The start is a grid in the order of the identifiers, so the result does not depend on the order of the children. The builder `force` makes a node with this strategy.
- The subpath also exports the builder `force` and the function `relaxForces`. `relaxForces` relaxes boxes that have positions. It is pure and deterministic. A fixed box does not move. After the relaxation, no two boxes are nearer than the margin.
- Each constant of the relaxation is an option with a default: `minDistance`, `centering`, `maxStep` and `separationPasses`. A strength above `MAX_SPRING_STRENGTH` (0.5), or a size or an option that is not a finite number of 0 or more, gives a `RangeError`. The strategy option `strength` has the same limit.
- The finding `UNKNOWN_LAYOUT` tells you to give the strategy to `createEngine`. For `force`, it names the subpath.
- The layouts of the other strategies do not change.

## 0.1.2

- The live renderers `mountSvg` and `mountDom` keep the paint order of `mountCanvas`. Before, a node that became a container around other containers painted above them. The loop of the home page showed this.
- `LayoutView` keeps the selection when its renderer or its theme changes. Before, the new renderer had no selection until `selected` changed.
- A `size` of `null` gives the finding `INVALID_SIZE`, and a `null` or `undefined` item of `edges` gives `UNKNOWN_EDGE_END`. Before, the engine threw a `TypeError`.
- The layouts do not change.

## 0.1.1

- The strategy `radial` uses a module that the Vex compiler makes from a Vex program. The module gives the offset of each child. It also finds the radius of a full ring.
- The layouts do not change. The 213 tests and the golden SVG files pass.
- The source of the module is in `ireko`, so `ireko` still has no runtime dependencies.

## 0.1.0

The first version. It needs Node.js 22.12 or later, or a current browser. It is ESM only, and it has no runtime dependencies.

<!-- This section tells what 0.1.0 contains. No earlier version is on npm. The project had the name Jqy before, and Jqy was never on npm. -->

- **The engine.** `layout(input, options)` and `createEngine(config)` give boxes with absolute positions, routed edges, the bounds and the findings of an audit. The output is plain data, and the same input gives the same output.
- **Two passes.** The measure pass goes from the leaves up, and the place pass goes from the root down. Thus a strategy knows the size of each child subtree, and no two subtrees overlap. The engine uses loops, not recursion, so a deep tree does not overflow the stack.
- **A strategy and a mode for each node.** The strategy `grid` puts the children in rows and columns, and `radial` puts them on a ring or an arc. The mode `linked` puts the children around the node, with edges. The mode `nested` puts them inside the box of the node.
- **Two more strategies.** `tree` packs the subtrees of a row by their shapes, so a small subtree fits under the edge of a large one (a tidy tree). `layers` puts the children in layers in the direction of the edges between them (a flowchart).
- **Fit.** A nested container with a size grows (`grow`), makes its content smaller (`scale`), or cuts it at its edge (`clip`).
- **Routers.** `straight`, `orthogonal` and `avoid`. The router `avoid` goes around the other boxes. A tree edge goes in the direction of the strategy of its parent, so the orthogonal router draws the edges of an organization chart. Each edge can have a label.
- **The audit.** Each layout examines itself, and gives findings for overlaps, boxes outside their container, bad options, unknown strategies, limits and failed strategies or routers. With `strict: true`, the engine throws an `IrekoError` for each error.
- **Label sizes.** `fitText()` gives a `measure` function: each box fits its label. Its default width is an estimate that needs no font engine. `widthOfCanvas()` from `ireko/render` gives exact widths in a browser.
- **Extension points.** `defineStrategy`, `defineRouter` and `createEngine({ strategies, routers })`. A strategy can ask for the shapes of the subtrees (`shapes: true`), and it gets the edges between its children. A router can ask for the boxes near each edge (`obstacles: true`). An option schema for each strategy gives the defaults, the checks and the controls of the playground.
- **The builder.** `grid`, `radial`, `tree`, `layers`, `grid.nested` and `builder<O>(type)` make an input in TypeScript.
- **The text language** (`ireko/text`). `parse` gives an input or the place of the first syntax error. `print` writes the canonical text.
- **The renderers.** `toSVG` and `mountSvg` (`ireko/svg`), `mountDom` (`ireko/dom`) and `mountCanvas` (`ireko/canvas`). The live renderers have pan, zoom, selection, picking and an animation from one layout to the next. `ireko/render` has the themes and the viewport.
- **React** (`ireko/react`). `useLayout`, `LayoutSvg` (static, for server rendering) and `LayoutView` (a live renderer).
- **React Flow** (`ireko/xyflow`). `layoutFlow` gives positions to the nodes of a flow and sizes to its groups (sub-flows). `toXYFlow`, `PolylineEdge` and `GroupNode` draw a layout in React Flow 12.
- **Examples** (`ireko/examples`). Sixteen inputs, the same as the gallery of the site.
