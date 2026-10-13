# Changelog

This file records the changes to `ireko` in each version. The release workflow copies the section of a version into its GitHub release.

## Versions

`ireko` uses semantic versioning. Before version 1.0.0, these rules apply:

- A minor version (`0.2.0`) can change the API. Its section here tells you what to change.
- A patch version (`0.1.1`) only corrects errors. It does not change the API.
- The layout of an input can change in a minor version, for example when a strategy gets better. A patch version keeps each layout the same, except to correct an overlap or another defect.

A prerelease version (`0.2.0-beta.1`) goes to the npm tag `next`. Each other version goes to `latest`.

## Unreleased

- **The strategy `tree`.** It puts the children in one row and packs the subtrees by their shapes, so a small subtree fits under the edge of a large one (a tidy tree). The builder has `tree`, and the text language knows the word `tree`.
- **The strategy `layers`.** It puts the children in layers in the direction of the edges between them: a flowchart. Each strategy gets the extra edges between its children (`edges`), and an arrangement can give the direction of these edges (`flow`) to the router.
- **Shapes.** A strategy with `shapes: true` gets the shape of each child: bands on each axis that cover each box of its subtree.
- **The direction of tree edges.** An arrangement can give the direction of its tree edges. Grid and tree give it from their side. The orthogonal router then draws the edges of an organization chart. This changes the routes of the tree edges of the orthogonal router.
- **The router `avoid`.** It draws horizontal and vertical segments that go around the other boxes. A router with `obstacles: true` gets the boxes near each edge. On random trees with extra edges, it gives 95 % fewer crossings than the orthogonal router.
- **A faster audit.** The audit sweeps along the axis where the boxes overlap less. A deep linked chain no longer costs a time that grows with the square of its length.
- `BUILTIN_STRATEGY_NAMES` gives the names of the built-in strategies.

## 0.1.0

The first version. It needs Node.js 22.12 or later, or a current browser. It is ESM only, and it has no runtime dependencies.

<!-- This section tells what 0.1.0 contains. No earlier version is on npm. The project had the name Jqy before, and Jqy was never on npm. -->

- **The engine.** `layout(input, options)` and `createEngine(config)` give boxes with absolute positions, routed edges, the bounds and the findings of an audit. The output is plain data, and the same input gives the same output.
- **Two passes.** The measure pass goes from the leaves up, and the place pass goes from the root down. Thus a strategy knows the size of each child subtree, and no two subtrees overlap. The engine uses loops, not recursion, so a deep tree does not overflow the stack.
- **A strategy and a mode for each node.** The strategy `grid` puts the children in rows and columns, and `radial` puts them on a ring or an arc. The mode `linked` puts the children around the node, with edges. The mode `nested` puts them inside the box of the node.
- **Fit.** A nested container with a size grows (`grow`), makes its content smaller (`scale`), or cuts it at its edge (`clip`).
- **Routers.** `straight` and `orthogonal`. Each edge can have a label.
- **The audit.** Each layout examines itself, and gives findings for overlaps, boxes outside their container, bad options, unknown strategies, limits and failed strategies or routers. With `strict: true`, the engine throws an `IrekoError` for each error.
- **Extension points.** `defineStrategy`, `defineRouter` and `createEngine({ strategies, routers })`. An option schema for each strategy gives the defaults, the checks and the controls of the playground.
- **The builder.** `grid`, `radial`, `grid.nested` and `builder<O>(type)` make an input in TypeScript.
- **The text language** (`ireko/text`). `parse` gives an input or the place of the first syntax error. `print` writes the canonical text.
- **The renderers.** `toSVG` and `mountSvg` (`ireko/svg`), `mountDom` (`ireko/dom`) and `mountCanvas` (`ireko/canvas`). The live renderers have pan, zoom, selection, picking and an animation from one layout to the next. `ireko/render` has the themes and the viewport.
- **React** (`ireko/react`). `useLayout`, `LayoutSvg` (static, for server rendering) and `LayoutView` (a live renderer).
- **React Flow** (`ireko/xyflow`). `layoutFlow` gives positions to the nodes of a flow and sizes to its groups (sub-flows). `toXYFlow`, `PolylineEdge` and `GroupNode` draw a layout in React Flow 12.
- **Examples** (`ireko/examples`). Fourteen inputs, the same as the gallery of the site.
