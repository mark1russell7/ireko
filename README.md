# ireko

**Composable graph and tree layout for TypeScript. Select a layout for each container, and get boxes and routed edges for any renderer.**

ireko (入れ子) is the Japanese word for a set of boxes that fit inside each other. The project had the name Jqy before.

## Status

The project is in a rebuild. The plan is in [`docs/REVIEW.md`](./docs/REVIEW.md).

| Phase | Content | Status |
|---|---|---|
| P0 | The template monorepo, pnpm, TypeScript 7, Oxlint, `ste-lint`, CI | in progress |
| P1 | The new core: two passes, an open strategy registry, plain JSON output | planned |
| P2 | The builder, the text language, and the SVG, DOM, Canvas, React and React Flow renderers | planned |
| P3 | More strategies, sizing policies and routers | planned |
| P4 | The site, with a live playground | planned |
| P5 | The first release on npm | planned |

The code of Jqy is in [`packages/legacy`](./packages/legacy). It stays there until the new core does all that it does. Start its playground with `pnpm dev`.

## The idea

A diagram is a tree of nodes. Each node selects two things for its children:

- **The strategy:** how to arrange the children. The built-in strategies are `grid` and `radial`.
- **The mode:** where the children go. In the `nested` mode, the children are inside the box of the node. In the `linked` mode, the children are around the box, and edges connect them.

One layout gives plain data: boxes, edges and findings. Any renderer can draw it.

## Packages

| Package | Contents |
|---|---|
| [`@ireko/legacy`](./packages/legacy) | The engine and the playground of Jqy, until the new core reaches parity |
| [`@ireko/cli`](./packages/cli) | The workspace commands of the template |

## Commands

```sh
pnpm install
pnpm dev             # the playground of Jqy
pnpm typecheck       # the source and the tests of each package
pnpm lint            # Oxlint, with the type-aware rules
pnpm test            # the tests of each package
pnpm lint:ste        # the writing rules
pnpm check           # all of the above, in the order of CI
pnpm package add <name> --preset=<node|node-cjs|ts|vite|react>
```

## Writing style

The text of this repository uses the writing rules of ASD-STE100 Simplified Technical English (STE) as a style target. This text is the README files, the docs, the TSDoc comments and the text that the site shows. ASD does not certify the repository. The linter [`ste-lint`](https://github.com/mark1russell7/ste-lint) is an automated approximation of the rules, and CI starts it for each push.

- Use `pnpm lint:ste` to examine the text, and correct each finding.
- The glossary of the project is in `ste.config.json`. Add a word to the glossary only if it is a real technical term of the project.
- The ASD-STE100 dictionary is copyrighted. Do not commit it. Keep a local copy in the folder `.ste/`, which git ignores. The README of `ste-lint` gives the file format.

## Disclosure

An AI model (Claude, from Anthropic) wrote most of the text and the code of this repository, under the direction of the author. The STE linter examines the text. The STEMG of ASD-STE100 asks for this disclosure in its white paper on STE and artificial intelligence (June 2026).

## License

[MIT](./LICENSE)
