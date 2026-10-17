# Instructions for Claude

## Writing style

Write all prose of this repository in the style of ASD-STE100 Simplified Technical English (STE). This prose is the README files, this file, the TSDoc comments, the docs and the text that the site shows. The linter [`ste-lint`](https://github.com/mark1russell7/ste-lint) examines it.

- After a change to prose, start `pnpm lint:ste` and correct each finding. CI fails when there is an error.
- Keep each instruction to 20 words or fewer, and each description to 25 words or fewer.
- Do not use the modal verbs (`should`, `may`, `might`, `would`), semicolons or Latin abbreviations (`e.g.`, `i.e.`, `etc.`).
- Use the active voice. Start each sentence of a doc comment with its subject: "This function gives the value", not "Gives the value".
- Put code, file names and commands in code font. The linter counts each code span as one word.
- Add a word to the glossary in `ste.config.json` only if it is a real technical term of the project.

## The plan

`docs/REVIEW.md` is the plan of record. Read it before a change to the architecture. Its §6 is the target design, and its §13 is the roadmap. Record each completed phase in its §16.

The project was named Jqy. The new name is ireko. The code of Jqy is in the git history (the package `packages/legacy`, removed after commit `e8ad381`).

## Packages

- Make a new package with `pnpm package add <name> --preset=<preset>`. Do not write `package.json` or `tsconfig.json` by hand.
- Each package has a `tsconfig.test.json`. `pnpm typecheck` checks the source and the tests.
- `packages/ireko` is the published package `ireko`. It has no runtime dependencies. `react` and `@xyflow/react` are optional peers.
- The core (`packages/ireko/src/core`) does not import the DOM, React or a renderer. A separate type check proves it.
- The other packages are private.

## Checks

- Start `pnpm check` before a commit. It does the type check, Oxlint, the tests and `ste-lint`.
- A golden file changes only with a change of the layout. To accept it, start `vitest run -u` and examine the SVG diff.
- The output of the engine is deterministic. Do not use `Date.now()`, `Math.random()` or the order of a `Set` of objects in the core.

## npm

- `packages/ireko` goes to npm when a change of its version merges to `main`. `RELEASING.md` tells the procedure.
- Do not publish to npm, and do not change npm settings. The owner and one named Claude session do all npm work.
- Do not edit `.github/workflows/release.yml` or `scripts/release/`.

## The site

- `packages/site` is Astro with Starlight. `pnpm dev` starts it. Build it with `SITE_BASE=ireko` (no slash: Git Bash changes `/ireko` into a Windows path).
- Write the links of a page from the root of the site (`/learn/tour/`). A rehype plugin adds the base path.
- Each figure starts from a text of the text language. `Figure.astro` draws it at build time, and `Try`, `Morph` and the other islands draw it live. A text with a syntax error stops the build.
- In MDX, a text in a JSX attribute loses the indentation of its lines. Put each text with more than one line in an `export const` at the top of the page. Then give its name to the component.
- After `astro build`, `pnpm --filter @ireko/site og` draws the share cards, and `pnpm --filter @ireko/site test:e2e` starts the Playwright tests. The tests read the page list from the sitemap.
- A title for search has 70 characters or fewer (`seoTitle` in the front matter), and a description has 50 to 200 characters. The e2e tests examine both.
