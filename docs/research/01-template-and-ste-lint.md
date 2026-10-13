<!-- ste-disable -->
> **Raw research report (2026-10-12).** Topic: the template, new-repo.ps1, ste-lint, lag and mark1russell7.github.io. A research agent of the 2026-10-12 review wrote it. It is kept as evidence, with local paths shortened. The synthesis and the decisions are in [../REVIEW.md](../REVIEW.md). This file is not STE text.

# Report: template, ste-lint, lag, mark1russell7.github.io (read-only research, nothing edited)

## 0. Key findings and gotchas

- **lag was not made from the template.** It is older (Feb 2026) and has its own structure:
  - a vendored `ts/config/*`
  - `tsc -b` project references with built `dist/` packages
  - its own generator, `pnpm new --name <n> --config <c>`
  - pnpm 10 and Node 24 in CI, with no `packageManager` or `engines`
  - TypeScript 5.9, vitest 4.1 and vite 7.3

  The real template-derived example of a Vite+React site is **mark1russell7.github.io**, created with `new-repo.ps1` at commit `9085392`. `~/git/page-lifecycle-tracker` is a newer one (see §6). The workspace file `~/git/CLAUDE.md` lists lag as a "template monorepo", which is wrong.
- **ste-lint is integrated the same way in the template, github.io and lag:**
  - root devDependency `"@mark1russell7/ste-lint": "github:mark1russell7/ste-lint"`, with no ref. The lockfile pins `codeload…/ste-lint/tar.gz/f597d6c1e09bcfcb487bb575825d6d5f29e9e0c7`.
  - root script `"lint:ste": "ste-lint"`
  - a root `ste.config.json`
  - a `.gitignore` block for `.ste/` and `*.ste-dictionary.json`
  - one CI step, `pnpm lint:ste`

  ste-lint commits its `dist/`, so it needs **no** `allowBuilds` entry. **No repo has pre-commit hooks**: no husky, lefthook or simple-git-hooks, only sample files in `.git/hooks`, and no `core.hooksPath`.
- **The template has no code linter (no ESLint or oxlint) and no build tool.** `typecheck` is `tsc` and `test` is vitest. oxlint, tsdown and changesets only appear in later repos (Vex, render, crawler; see §5 and §6).
- **`pnpm package add --preset=react` does not write** a `vite.config.ts`, an `index.html`, `dev`/`build`/`preview` scripts or a `tsconfig.node.json`. You add those by hand after the generator runs (github.io and page-lifecycle-tracker show how).
- **Jqy facts that matter for the migration:**
  - Remote is `https://github.com/mark1russell7/Jqy` (capital J), so the Pages project path is `/Jqy/`.
  - The current branch is **`master`**. Every Pages workflow triggers on `main`.
  - `new-repo.ps1` requires a lowercase name (`jqy`).
  - Jqy has **no tsconfig.json at all**. Its 56 `.ts` and 7 `.tsx` files plus `main.jsx` have never been checked against the strict cue presets.
  - It uses npm (`package-lock.json`), ESLint 9 (JS-only config), `reactflow ^11` (now `@xyflow/react` 12.12.0, which lag uses) and a submodule `external/concat-src`. CI `checkout@v7` does not fetch submodules by default.
  - `AUDIT.md` at the root is untracked. The template's `/*.md` ignore rule would hide it.
- **There is a prior research report on the same subject:** `~/git/Vex/docs/research/01-template-and-ste-lint.md` (2026-10-08). Since then, template commit `aac1840` fixed what it flagged as gaps 1, 3, 4 and 5 (see §1.6).

---

## 1. `~/git/template`

### 1.1 Files outside node_modules and .git
Tracked (18 files):
```
.gitattributes
.github/workflows/ci.yml          (only workflow; no dependabot, no renovate, no pages, no release)
.gitignore
CLAUDE.md
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
ste.config.json
packages/cli/package.json
packages/cli/tsconfig.json
packages/cli/vitest.config.ts
packages/cli/src/index.ts
packages/cli/src/paths.ts
packages/cli/src/commands/index.ts
packages/cli/src/commands/package/index.ts
packages/cli/src/commands/package/add.ts
packages/cli/src/commands/repo/index.ts
packages/cli/src/commands/repo/rename.ts
```
Present on disk but ignored: `.mcp.json`, `.claude/settings.local.json` and `packages/cli/dist/.tsbuildinfo`. The last one appears because `incremental` is on in the cli tsconfig.

There is no README, LICENSE, root tsconfig, `.editorconfig`, `.npmrc` or `.nvmrc`, and no `.claude/skills`.

Git history: `aac1840` (2026-10-08 19:57, HEAD) ← `d59e2aa` ("Add the STE writing rules: ste-lint, CLAUDE.md and CI") ← `e5dbf5d` ("Update every dependency…") ← `7d77a66` (initial).

### 1.2 `~/git/new-repo.ps1`
What it does:
1. Checks that the name matches `^[a-z0-9][a-z0-9-]*$`.
2. Runs `robocopy template → ~/git/<name>` with `/E` and `/XD .git node_modules _db .claude` and `/XF pnpm-lock.yaml`. `.mcp.json` is copied but git ignores it. **The lockfile is not copied**, so the first install resolves the newest caret versions and the HEADs of cue and ste-lint.
3. Rewrites the root `"name": "template-monorepo"` → `"<name>-monorepo"`.
4. Rewrites `packages/cli/package.json`: `"@template/cli"` → `"@<name>/cli"`, and the bin `"template": "./src/index.ts"` → `"<name>": "./src/index.ts"`. Files are written as UTF-8 without BOM.
5. Runs `git init -q`. It does not install, commit or add a remote.
6. Prints: `cd …`, `pnpm install`, `pnpm package add <pkg-name>`.

### 1.3 Root files (verbatim)

**package.json**
```json
{
  "$schema": "https://json.schemastore.org/package",
  "name": "template-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.10.1",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "package": "tsx packages/cli/src/index.ts package",
    "template": "tsx packages/cli/src/index.ts repo",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "lint:ste": "ste-lint"
  },
  "devDependencies": {
    "@mark1russell7/cue": "github:mark1russell7/cue",
    "@mark1russell7/ste-lint": "github:mark1russell7/ste-lint",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2"
  }
}
```
There is no root `build` or `dev` script. github.io added both.

**pnpm-workspace.yaml**
```yaml
packages:
  - "packages/*"

# Packages allowed to run install scripts. Since pnpm 11 every other package that has one fails the install.
# A git-hosted package is approved by its repository URL, so a new commit of cue needs no new approval.
allowBuilds:
  "@mark1russell7/cue@git+https://github.com/mark1russell7/cue.git": true
  esbuild: true
```

**ste.config.json**
```json
{
  "$schema": "./node_modules/@mark1russell7/ste-lint/ste.config.schema.json",
  "include": [
    "README.md",
    "CLAUDE.md",
    "packages/*/README.md",
    "packages/*/src/**/*.{ts,tsx}",
    "packages/*/*.config.{ts,mts}"
  ],
  "ignore": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.d.ts",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx"
  ],
  "technicalNouns": [],
  "technicalVerbs": [],
  "properNouns": [
    "ASD",
    "ASD-STE100",
    "Claude",
    "GitHub",
    "pnpm",
    "Simplified Technical English",
    "TSDoc",
    "TypeScript"
  ]
}
```

**.gitattributes**
```
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.ico binary
*.woff2 binary
*.pdf binary
```

**.gitignore** (full)
```
# Claude Code
.claude/
.mcp.json

# Local data
_db/

# Project-root MD files. Only intentional ones are allowlisted below; everything else
# (e.g. scratch dumps from Explore agents during research) is ignored so they don't
# accidentally get committed via `git add .`. If a future doc legitimately belongs at
# repo root, add an explicit allowlist line here.
/*.md
!/CLAUDE.md
!/README.md

# Local ste-lint dictionaries. The ASD-STE100 dictionary is copyrighted: do not commit it.
.ste/
*.ste-dictionary.json

# Tokens / API keys
*.token
*sensitive*

# OS
.DS_Store
Thumbs.db
desktop.ini
$RECYCLE.BIN/
ehthumbs.db

# Editors / IDEs
.vscode/
.idea/
*.swp
*.swo
*~
.project
.settings/
*.sublime-workspace
*.sublime-project

# Environment / secrets
.env
.env.*
!.env.example
*.pem
*.key
secrets.*
credentials.*

# Logs
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Python (only Python names: a bare "build/", "lib/", "var/" or "env/" pattern also hides TypeScript folders)
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Build output
dist/

# Node / JS
node_modules/
.npm
.yarn/
.pnp.*
.next/
.nuxt/
.parcel-cache/
.turbo/
.svelte-kit/
.cache/

# DuckDB / data
*.duckdb
*.duckdb.wal
*.duckdb.tmp/
*.db
*.sqlite
*.sqlite3

# Build / temp
tmp/
temp/
*.tmp
*.bak
*.orig
```
github.io still has the **old** Python block, which ignores any folder named `build/`, `lib/`, `env/`, `var/` and so on. Template commit `aac1840` fixed this.

**.github/workflows/ci.yml**
```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      # The pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      # The writing rules (ASD-STE100) of the README files and the doc comments
      - run: pnpm lint:ste
```

**CLAUDE.md**
```md
# Instructions for Claude

## Writing style

Write all prose of this repository in the style of ASD-STE100 Simplified Technical English (STE). This prose is the README files, this file, the TSDoc comments and the text that the site shows. The linter [`ste-lint`](https://github.com/mark1russell7/ste-lint) examines it.

- After a change to prose, start `pnpm lint:ste` and correct each finding. CI fails when there is an error.
- Keep each instruction to 20 words or fewer, and each description to 25 words or fewer.
- Do not use the modal verbs (`should`, `may`, `might`, `would`), semicolons or Latin abbreviations (`e.g.`, `i.e.`, `etc.`).
- Use the active voice. Start each sentence of a doc comment with its subject: "This function returns the value", not "Returns the value".
- Put code, file names and commands in code font. The linter counts each code span as one word.
- Add a word to the glossary in `ste.config.json` only if it is a real technical term of the project.

## Packages

- Make a new package with `pnpm package add <name> --preset=<preset>`. Do not write `package.json` or `tsconfig.json` by hand.
- A package is a source package. Its `main` is `src/index.ts`, so other packages import its source.
- Each package has a `tsconfig.test.json`. `pnpm typecheck` checks the source and the tests.
```

**.mcp.json** (ignored by git, but `new-repo.ps1` copies it)
```json
{
  "mcpServers": {
    "filesystem": { "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."], "env": {} },
    "memory": { "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"], "env": { "MEMORY_FILE_PATH": "./_db/knowledge_graph.json" } },
    "motherduck": { "type": "stdio", "command": "uvx", "args": ["mcp-server-motherduck", "--db-path", "./_db/knowledge.duckdb"], "env": {} }
  }
}
```
(Compacted here; the original is multi-line JSON with 2-space indentation.)

**.claude/settings.local.json** (ignored, and not copied by `new-repo.ps1`). There are no skills.
```json
{
  "enabledMcpjsonServers": [
    "filesystem",
    "memory",
    "motherduck"
  ]
}
```

**Lockfile** (`pnpm-lock.yaml`, lockfileVersion 9.0, multi-document; the first document pins `packageManagerDependencies: pnpm 12.10.1`) resolves:
- typescript 7.0.2, plus 6.0.3 pulled in by ste-lint
- tsx 4.23.15, vitest 5.0.3, vite 8.3.3 (through vitest), rolldown 1.2.13, esbuild 0.28.2
- cue `9c99ad65d51cefcba5a8b6dc89358d7a94758ca7`, ste-lint `f597d6c1e09bcfcb487bb575825d6d5f29e9e0c7`

### 1.4 `packages/cli` (verbatim)

**package.json**
```json
{
  "$schema": "https://json.schemastore.org/package",
  "name": "@template/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "bin": {
    "template": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clack/prompts": "^1.8.1"
  },
  "devDependencies": {
    "@mark1russell7/cue": "github:mark1russell7/cue",
    "@types/node": "^26.6.4",
    "typescript": "^7.0.2",
    "vitest": "^5.0.3"
  }
}
```

**tsconfig.json**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@mark1russell7/cue/ts/config/node.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*"]
}
```

**vitest.config.ts**
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    passWithNoTests: true,
  },
});
```

**How the CLI dispatches:**
- `src/index.ts` (shebang `#!/usr/bin/env -S npx tsx`) reads `[group, sub, ...rest]` from argv. It looks up `commands[group][sub]`; a missing or unknown group or subcommand gives an error plus help and exit 1.
- The groups are `package: { add }` and `repo: { rename }`.
- `src/paths.ts` sets `repoRoot = resolve(here,"..","..","..")` and `packagesDir = repoRoot/packages`.
- Root `pnpm package <sub>` runs `tsx packages/cli/src/index.ts package <sub>`.
- Root `pnpm template <sub>` runs `tsx packages/cli/src/index.ts repo <sub>`.

### 1.5 `pnpm package add <name> --preset=<node|node-cjs|ts|vite|react>` (`src/commands/package/add.ts`)

**Behavior:**
- **Scope** = root `package.json` name without `-monorepo` (`jqy-monorepo` gives `@jqy/…`).
- **Name:** must match `^[a-z0-9][a-z0-9-]*$`. If it is missing, a @clack text prompt asks for it.
- **Preset:** if `--preset=` is missing, a @clack select asks for it (default `node`). An unknown preset throws.
- **Arguments:** the first non-`--preset=` argument is the name. Later arguments are silently ignored.
- **Existing folder:** throws "Package already exists".
- **devDependency versions are copied from `packages/cli/package.json`:** `@mark1russell7/cue`, `@types/node`, `typescript`, `vitest`. It throws if one is missing. Thus `pnpm up -r --latest` keeps the generator current.

**Files written** (`packages/<name>/`, all `JSON.stringify(…, null, 2) + "\n"`):

1. `package.json` (every preset):
```json
{
  "$schema": "https://json.schemastore.org/package",
  "name": "@<scope>/<name>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.test.json"
  },
  "devDependencies": {
    "@mark1russell7/cue": "github:mark1russell7/cue",
    "@types/node": "^26.6.4",
    "typescript": "^7.0.2",
    "vitest": "^5.0.3"
  }
}
```
It never writes `exports`, `types`, a `build`, `dev` or `preview` script, a README or a LICENSE.

2. `tsconfig.json`

Library presets (`node`, `node-cjs`, `ts`):
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@mark1russell7/cue/ts/config/<preset>.json",
  "compilerOptions": {
    "noEmit": false,
    "emitDeclarationOnly": true,
    "allowImportingTsExtensions": true,
    "composite": false,
    "incremental": false
  }
}
```
These emit only `.d.ts` into `dist/` (the `outDir` from cue `lib.json`), so `isolatedDeclarations` is enforced.

`vite` / `react` presets (only `extends` differs: `vite.json` or `react.json`):
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@mark1russell7/cue/ts/config/react.json",
  "compilerOptions": {
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "composite": false,
    "incremental": false,
    "isolatedDeclarations": false,
    "declaration": false,
    "declarationMap": false,
    "types": [
      "vite/client"
    ]
  }
}
```
There is no `include`, so cue `lib.json` applies: `include ${configDir}/src/**/*`, `rootDir src`, and it excludes `*.test.ts` and `*.spec.ts`. A `vite.config.ts` is therefore **not** type-checked by the generated configs.

3. `tsconfig.test.json`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "emitDeclarationOnly": false,
    "declaration": false,
    "declarationMap": false,
    "isolatedDeclarations": false,
    "types": [
      "vite/client",
      "node"
    ]
  },
  "include": [
    "src/**/*"
  ],
  "exclude": []
}
```
For the library presets, `types` is `["node"]`.

4. `src/index.ts`: `export {};` (also for the react preset).

5. `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
});
```

**Extra installs** (`execSync` from the repo root; these resolve the newest versions and run the install):
- `vite`: `pnpm add -D --filter=@<scope>/<name> vite`
- `react`: `pnpm add --filter=@<scope>/<name> react react-dom`, then `pnpm add -D --filter=@<scope>/<name> vite @vitejs/plugin-react @types/react @types/react-dom`
- `node`, `node-cjs`, `ts`: it only prints "Run 'pnpm install' to wire up the new workspace package."

pnpm appends the `"dependencies"` key after `devDependencies`, as page-lifecycle-tracker's site shows.

**Test runner and tooling:**
- Tests run with vitest 5, one `vitest.config.ts` per package. There is no root vitest workspace and no coverage.
- Type checking is `tsc` (TypeScript 7 native).
- There is **no lint tool** (no ESLint, oxlint, Biome or Prettier) and **no build tool** (no tsdown or bundler; packages are consumed as source).

### 1.6 cue presets (`@mark1russell7/cue/ts/config/*`)
The installed version is `9c99ad6`, identical to cue HEAD `da04dd5`. cue 1.0.0 is now **on npm**, but every repo still uses `github:mark1russell7/cue`.

- `base.json` compilerOptions:
  - `target esnext`, `lib ["esnext"]`
  - `declaration`, `declarationMap`, `removeComments false`, `importHelpers`, `sourceMap`
  - `esModuleInterop`, `allowSyntheticDefaultImports`, `forceConsistentCasingInFileNames`, `isolatedModules`, `isolatedDeclarations`
  - `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUncheckedSideEffectImports`, `noUncheckedIndexedAccess`, `noImplicitOverride`
  - `allowUnusedLabels false`, `allowUnreachableCode false`
  - `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`
  - `moduleDetection force`, `newLine lf`, `stripInternal`
  - `skipDefaultLibCheck false`, `skipLibCheck true`
  - `composite true`, `incremental true`, `pretty`, `noEmitOnError`, `resolveJsonModule`
  - `diagnostics` is gone in `9c99ad6`.
- `esm.json` = base + `module nodenext`, `moduleResolution nodenext`, `verbatimModuleSyntax true`.
- `cjs.json` = base + `NodeNext`/`NodeNext`, `esModuleInterop`.
- `lib.json` = `outDir ${configDir}/dist`, `rootDir ${configDir}/src`, `tsBuildInfoFile ${configDir}/dist/.tsbuildinfo`, `include ["${configDir}/src/**/*"]`, `exclude [node_modules, dist, **/*.spec.ts, **/*.test.ts]`.
- `ts.json` extends `["./esm.json","./lib.json"]`.
- `node.json` extends `ts.json` and adds `types ["node"]` (added in `9c99ad6`).
- `node-cjs.json` extends `["./cjs.json","./lib.json"]`.
- `vite.json` extends `ts.json` and adds `lib ["esnext","dom","dom.iterable"]`, `module esnext`, `moduleResolution bundler`, `types ["vite/client"]`.
- `react.json` extends `vite.json` and adds `jsx react-jsx`.

Note: github.io's lockfile still pins the **older** cue `fb96d13`, which has `diagnostics: true` and `node.json` without `types`.

### 1.7 `pnpm template rename [<scope>] [--dry-run] [--reinit-git] [--force]` (`repo/rename.ts`)
- Derives the current scope from the root name `<x>-monorepo`. It refuses unless the scope is `template` or `--force` is passed.
- Prompts for the scope if it is missing. The scope must match `^[a-z0-9][a-z0-9-]*$`.
- Rewrites `"<old>-monorepo"` and `@<old>/` in the root and each `packages/*/package.json`.
- Rewrites `@<old>/` in `packages/*/src/**/*.{ts,tsx,js,jsx,mjs,cjs}`.
- `--dry-run` lists the files only.
- `--reinit-git` asks for confirmation, deletes `.git` and runs `git init`.
- Afterwards it tells you to run `pnpm install`.
- It does not rename the cli bin. `new-repo.ps1` does that.

---

## 2. `~/git/ste-lint` (`github.com/mark1russell7/ste-lint`)

**What it is:** a heuristic linter for the ASD-STE100 Issue 9 writing rules. Its README says it is "an automated approximation" that does not certify compliance. It is a single package, not a monorepo. HEAD is `f597d6c` ("Commit dist/…"). It started as `@lag/ste-lint` inside lag and was extracted with its history. It is **not on npm**, has no tags, and is installed only as `github:`.

**package.json** (verbatim)
```json
{
  "$schema": "https://json.schemastore.org/package",
  "name": "@mark1russell7/ste-lint",
  "version": "0.1.0",
  "description": "A linter for the writing rules of ASD-STE100 Simplified Technical English in Markdown, MDX and TypeScript doc comments",
  "type": "module",
  "packageManager": "pnpm@12.10.1",
  "engines": { "node": ">=22" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./ste.config.schema.json": "./ste.config.schema.json"
  },
  "bin": { "ste-lint": "./dist/cli.js" },
  "files": ["dist", "src", "ste.config.schema.json"],
  "repository": { "type": "git", "url": "https://github.com/mark1russell7/ste-lint.git" },
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -p tsconfig.test.json",
    "test": "vitest run",
    "lint:ste": "tsx src/cli.ts"
  },
  "dependencies": { "typescript": "^6.0.3" },
  "devDependencies": {
    "@mark1russell7/cue": "github:mark1russell7/cue",
    "@types/node": "^26.6.4",
    "tsx": "^4.23.15",
    "vitest": "^5.0.3"
  }
}
```
The runtime dependency is TypeScript **6**, because TS 7 has no JS compiler API. The compiler API parses doc comments and JSX.

**Invocation:** bin `ste-lint`, with the root script `"lint:ste": "ste-lint"`.
```
ste-lint [patterns...] [--format text|json] [--max-warnings <n>] [--config <path>] [--help]
```
- Exit code 0 means no errors and not more warnings than the maximum.
- Exit code 1 means errors, or too many warnings.
- Exit code 2 means a bad command line or config, or no file matches.
- Warnings never fail the run unless you pass `--max-warnings`.
- It finds `ste.config.json` in the working directory or a parent. Patterns are relative to the config file.

**What it lints** (file kind comes from the extension):
- **`.md`, `.markdown`, `.mdx`:** paragraphs, list items, block quotes, headings and table cells. It skips front matter, code, HTML blocks, JSX tags, MDX import/export lines, MDX expressions and link URLs.
- **`.ts`, `.mts`, `.cts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.jsx`** (not `.d.ts`): the TSDoc `/** */` comments. It ignores `@param` and `@typeParam` names and `@example` sections.
- **TSX and JSX: the displayed JSX text**, plus string values of `title`, `aria-label`, `alt` and similar attributes. So the UI strings of the Jqy playground would be linted.
- Each code span, `{@link}`, URL and quoted text counts as one word. Headings and table cells are fragments and get only the word rules.
- An `include` entry without glob characters is a literal file. If it does not exist it is silently skipped, and `ignore` does not apply to it.

**Defaults** (used when the config has no `include` or `ignore`):
- include: `README.md`, `docs/**/*.{md,mdx}`, `packages/*/README.md`, `packages/*/src/**/*.{ts,tsx}`, `packages/*/build/**/*.{ts,tsx}`, `packages/*/commands/**/*.{ts,tsx}`, `packages/*/*.config.{ts,mts}`
- ignore: the same 7 patterns as the template

**Config schema** (`ste.config.schema.json`, `additionalProperties: false`, every property optional):
- `$schema`
- `include` / `ignore` (string[])
- `technicalNouns`: string[]. Multi-word terms count as one noun.
- `technicalVerbs`: string[], in the base form. All inflections are accepted.
- `properNouns`: string[]. A multi-word name counts as one word.
- `allowedWords`: string[], for the `ing-verb` and `unknown-word` rules.
- `rules`: `{ <ruleId>: "error"|"warning"|"off" }`
- `wordList`: entries of `{ id? | match: string|string[], suggest?: string|null, note?: string|null, severity?, verbOnly?: boolean }`
- `limits`: `{ instructionWords: 20, descriptionWords: 25, paragraphSentences: 6, nounClusterNouns: 3 }`
- `dictionaryPath`: string|null. The environment variable `STE_DICTIONARY` has priority over it.

**Rules** (14, with default severity):

| Rule | Default |
|---|---|
| `sentence-length` | error (20 words per instruction, 25 per description) |
| `paragraph-length` | warn (more than 6 sentences) |
| `modal-verb` | error (should, may, might, would, shall, ought to, have to, need to) |
| `semicolon` | error |
| `latin-abbreviation` | error (e.g., i.e., etc., vs., viz., cf., et al.) |
| `about-quantity` | error |
| `word-list` | set per entry |
| `gendered-pronoun` | error |
| `first-person` | warn |
| `passive-instruction` | warn |
| `noun-cluster` | warn |
| `missing-subject` | error (doc comments only) |
| `ing-verb` | warn |
| `unknown-word` | warn, and only active with a local dictionary |

**Suppressions:**
- Markdown: `<!-- ste-disable-next <ids> -- reason -->`, or `<!-- ste-disable -->` … `<!-- ste-enable -->`.
- MDX: `{/* ste-disable */}`.
- TypeScript: `// ste-disable-next` on the line before a doc comment, or `// ste-disable` / `// ste-enable`.

**Dictionary:** the ASD-STE100 dictionary is copyrighted and must not be committed. Keep it in `.ste/` (git-ignored) or outside the repo.

**README installation steps:**
1. `pnpm add -D github:mark1russell7/ste-lint`. In a workspace root you need `-w`.
2. Add the script `"lint:ste": "ste-lint"`.
3. Add a root `ste.config.json` with `$schema` `./node_modules/@mark1russell7/ste-lint/ste.config.schema.json`.

Because `dist/` is committed, it needs **no** `allowBuilds` approval.

**ste-lint's own repo files** (for reference):
- `ste.config.json` includes `README.md` and `src/**/*.ts`. Its properNouns are ASD, ASD-STE100, Anthropic, Claude, CommonMark, GitHub, JSON, Markdown, MDX, pnpm, Simplified Technical English, STEMG, TSDoc and TypeScript.
- `tsconfig.json` extends cue `node.json` with `types ["node"]`.
- `tsconfig.test.json` sets `noEmit`, `composite false`, `incremental false`, `declaration(Map) false`, `isolatedDeclarations false`, `include src/**/*`, `exclude []`.
- `pnpm-workspace.yaml` has only the `allowBuilds` block (cue and esbuild).
- `ci.yml` is the same as the template's, plus `pnpm build`, a "dist/ agrees with src/" step (`git diff --exit-code --stat -- dist && test -z "$(git status --porcelain -- dist)"`) and `pnpm lint:ste`.

---

## 3. How lag and github.io integrate ste-lint, and their structure

### 3.1 `~/git/mark1russell7.github.io`
Made from the template on 2026-10-08 (`9085392`, scope `@portfolio`). This is **the reference for a Vite+React site in a template monorepo**. Branch `main`. No pre-commit hooks.

**Integration commits:**
- `ef65e96` added the devDependency, the script, `ste.config.json`, the CI step, the README "Writing style" and "Disclosure" sections, CLAUDE.md and the `.gitignore` block.
- `c618739` removed the `allowBuilds` entry for ste-lint once ste-lint shipped its `dist/`.

**Tracked files:**
- root: `.gitattributes`, `.github/workflows/{ci,pages}.yml`, `.gitignore`, `CLAUDE.md`, `README.md`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `ste.config.json`
- `packages/cli/**`, identical to the template **before `aac1840`**: its `add.ts` lacks the tsconfig overrides and `tsconfig.test.json`, and uses `typecheck: "tsc --noEmit"`
- `packages/site/{index.html, package.json, tsconfig.json, vite.config.ts, vitest.config.ts, public/*, src/*}`

**Root package.json**
```json
{
  "$schema": "https://json.schemastore.org/package",
  "name": "portfolio-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.10.1",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "pnpm --filter @portfolio/site dev",
    "build": "pnpm -r run build",
    "package": "tsx packages/cli/src/index.ts package",
    "template": "tsx packages/cli/src/index.ts repo",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "lint:ste": "ste-lint"
  },
  "devDependencies": {
    "@mark1russell7/cue": "github:mark1russell7/cue",
    "@mark1russell7/ste-lint": "github:mark1russell7/ste-lint",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2"
  }
}
```
`pnpm-workspace.yaml` is identical to the template's.

**ste.config.json**: same as the template, with two changes:
- `include` adds `"packages/site/**/*.{md,mdx}"`, so the list is `README.md`, `CLAUDE.md`, `packages/*/README.md`, `packages/site/**/*.{md,mdx}`, `packages/*/src/**/*.{ts,tsx}`, `packages/*/*.config.{ts,mts}`.
- `properNouns` is `["Anthropic","ASD","ASD-STE100","Claude","GitHub","GitHub Pages","pnpm","React","Simplified Technical English","STEMG","TSDoc","TypeScript","Vite"]`.
- `technicalNouns` and `technicalVerbs` are empty.

**CLAUDE.md**: only the "Writing style" section, word for word the same as the template's. It has no "Packages" section.

**README "Writing style" and "Disclosure" sections** (verbatim; this is the pattern to copy):
```md
## Writing style

The text of this repository uses the writing rules of ASD-STE100 Simplified Technical English (STE) as a style target. This text is the README files, the TSDoc comments and the text that the site shows. ASD does not certify the repository. The linter [`ste-lint`](https://github.com/mark1russell7/ste-lint) is an automated approximation of the rules, and CI starts it for each push.

- Use `pnpm lint:ste` to examine the text, and correct each finding.
- The glossary of the project is in `ste.config.json`. Add a word to the glossary only if it is a real technical term of the project.
- The ASD-STE100 dictionary is copyrighted. Do not commit it. Keep a local copy in the folder `.ste/`, which git ignores. The README of `ste-lint` gives the file format.

## Disclosure

An AI model (Claude, from Anthropic) wrote most of the text and the code of this repository, under the direction of the author. The STE linter examines the text. The STEMG of ASD-STE100 asks for this disclosure in its white paper on STE and artificial intelligence (June 2026).
```
The README also has "Layout" (a package table) and "Commands" sections. Commands: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint:ste    # the writing rules`, `pnpm package add <name> --preset=<node|node-cjs|ts|vite|react>`.

**ci.yml**: the template's, plus `pnpm build`, with a changed comment on the ste step:
```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      # The writing rules (ASD-STE100) of the README files, the doc comments and the text of the site
      - run: pnpm lint:ste
```
The job header, triggers, permissions, concurrency, `checkout@v7`, `pnpm/action-setup@v6` and `setup-node@v7` (node 26, cache pnpm) are identical to the template.

**pages.yml** (verbatim)
```yaml
# Builds packages/site and publishes it to GitHub Pages at https://mark1russell7.github.io/.
# To use this workflow, set the Pages source of the repository to "GitHub Actions"
# (Settings > Pages).
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# One deployment at a time. A newer push cancels a deployment that waits.
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @portfolio/site build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: packages/site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```
This is a user site, so the base is `/`. A project site like Jqy needs `base: "/Jqy/"`; see the page-lifecycle-tracker `SITE_BASE` pattern in §6. There is no release workflow.

**packages/site package.json**
```json
{
  "$schema": "https://json.schemastore.org/package",
  "name": "@portfolio/site",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@mark1russell7/cue": "github:mark1russell7/cue",
    "@types/node": "^26.6.4",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "typescript": "^7.0.2",
    "vite": "^8.3.3",
    "vitest": "^5.0.3"
  }
}
```

**packages/site tsconfig.json**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@mark1russell7/cue/ts/config/react.json",
  "compilerOptions": {
    "noEmit": true,
    "composite": false,
    "incremental": false,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*"]
}
```

**packages/site vitest.config.ts**
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
});
```

**Scaffold-time minimal site** (`git show 9085392:…`), useful as the starting skeleton.

`vite.config.ts`:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A user site (<user>.github.io) is served from the domain root, so the default base "/" is right.
export default defineConfig({
  plugins: [react()],
});
```

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mark Russell</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
The current `vite.config.ts` adds an SEO plugin (JSON-LD, sitemap) and a dev proxy.

**Lockfile:** react 19.3.0, vite 8.3.3, vitest 5.0.3, typescript 7.0.2 (plus 6.0.3), tsx 4.23.15, cue `fb96d13` (older), ste-lint `f597d6c`.

### 3.2 `~/git/lag` (branch `main`, HEAD `63a8105`)

**ste-lint integration:**
- Root devDependency `"@mark1russell7/ste-lint": "github:mark1russell7/ste-lint"`, pinned to `f597d6c` in the lockfile.
- Script `"lint:ste": "ste-lint"`.
- `pnpm-workspace.yaml` has no approval entry. Commit `751a9c1` added `onlyBuiltDependencies` and `3b5dc54` removed it.
- `.gitignore` block (same as the template):
  ```
  # Local ste-lint dictionaries. The ASD-STE100 dictionary is copyrighted: do not commit it.
  .ste/
  *.ste-dictionary.json
  ```
- CI step in the `build` job, after the coverage upload:
  ```yaml
      # The writing rules (ASD-STE100) of the README, the site and the comments
      - name: STE lint
        run: pnpm lint:ste
  ```
- **No CLAUDE.md.** There is none at the root or below. The writing rules are documented in:
  - the README "Development" section: `pnpm lint:ste           # the writing rules of the README, the site and the TSDoc comments`, followed by a sentence that links to ste-lint
  - the README "AI-assisted text" section, which carries the same disclosure text
  - the site page `packages/site/content/docs/contributing/writing-style.mdx`. It has a main-rules list, a linter section, a terminology table, add-a-page steps and frontmatter docs.
- No hooks.

**ste.config.json:**
- `$schema` `./node_modules/@mark1russell7/ste-lint/ste.config.schema.json`
- `include`:
  ```
  "README.md", "docs/**/*.{md,mdx}", "packages/*/README.md", "packages/site/**/*.{md,mdx}",
  "packages/*/src/**/*.{ts,tsx}", "packages/*/build/**/*.{ts,tsx}", "packages/*/commands/**/*.{ts,tsx}",
  "packages/*/*.config.{ts,mts}", "packages/site/content/**/*.{ts,tsx}"
  ```
- `ignore`: the same 7 patterns as the template.
- A large glossary:
  - 66 `technicalNouns`, for example "main thread", "page view", "back/forward cache", "heartbeat", "histogram", "span", "worker"
  - 29 `technicalVerbs`, for example block, click, configure, flush, measure, render, scroll, validate
  - 45 `properNouns`, for example Chrome, Grafana, OpenTelemetry, Playwright, React is absent, Vitest, V8, WebKit, Windows
- Tail: `"allowedWords": [], "rules": {}, "wordList": [], "dictionaryPath": null`.

**Root package.json** (verbatim; there is no `$schema`, `packageManager` or `engines`):
```json
{
  "name": "lag",
  "private": true,
  "type": "module",
  "scripts": {
    "new": "tsx packages/scripts/src/new-package.ts",
    "build": "tsc -b",
    "typecheck": "tsc -b && pnpm -r --if-present typecheck",
    "test": "pnpm --filter @mark1russell7/lag --filter @lag/load --filter @lag/report --filter @lag/scripts --filter @lag/experiments test",
    "test:browser": "pnpm --filter @lag/integration-tests test:browser",
    "test:chromium": "pnpm --filter @lag/integration-tests test:chromium",
    "test:integration": "pnpm --filter @lag/integration-tests test",
    "test:overhead": "pnpm --filter @lag/integration-tests test:overhead",
    "test:soak": "pnpm --filter @lag/integration-tests test:soak",
    "test:e2e": "pnpm --filter @lag/integration-tests test:e2e",
    "coverage": "pnpm --filter @mark1russell7/lag coverage",
    "mutation": "pnpm --filter @mark1russell7/lag mutation",
    "results": "tsc -b && tsx packages/scripts/src/results/collect.ts",
    "experiment:e8": "tsc -b && pnpm --filter @lag/experiments e8",
    "lint:ste": "ste-lint",
    "readme:metrics": "tsx packages/scripts/src/readme-metrics.ts",
    "readme:metrics:check": "tsx packages/scripts/src/readme-metrics.ts --check"
  },
  "devDependencies": {
    "@mark1russell7/ste-lint": "github:mark1russell7/ste-lint",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

**Other root files:**
- `pnpm-workspace.yaml` is only `packages: ["packages/*"]`. It has no `allowBuilds`. The lockfile is v9.0 with a `settings:` block (pnpm 10).
- Root `tsconfig.json` has `"files": []` plus references to `packages/{experiments, lag, lag/tsconfig.worker.json, lag-integration-tests, load, report, scripts, site}`.
- `ts/config/*.json` is a vendored copy of the cue presets, identical to the current cue. Packages extend `../../ts/config/<preset>.json`. There is no cue dependency.
- `.gitignore` is short: `**/node_modules/`, `**/dist/`, `**/*.tsbuildinfo`, `.claude/worktrees/`, `.claude/settings.local.json`, `.playwright-mcp/`, `**/__screenshots__/`, `**/.vitest-attachments/`, the ste block, `**/coverage/` and the Stryker paths.
- `.gitattributes` is the template's without `jpeg` and `pdf`.
- Also present: `LICENSE` (MIT), `lag.code-workspace` (sets `typescript.tsdk`), `.github/social-preview.png`, and `.github/scripts/{boot-ios-simulator.sh,test-ios.sh}`.

**Packages:**

| Folder | Name | Notes |
|---|---|---|
| `packages/lag` | `@mark1russell7/lag` 0.2.0 | Published. dist build with `tsc -b tsconfig.json tsconfig.worker.json`. `exports` `.`, `./worker`, `./async-context`, `./event-line.js`. `prepack` clean build. vitest coverage thresholds 98/96/98/98. Stryker. `CHANGELOG.md`, LICENSE, README. |
| `packages/site` | `@lag/site` | Vite 7 + React 19 + MDX docs site. react-router 7, @xyflow/react 12, mermaid, Observable Plot. `build/` holds Vite plugins (prerender in Chromium, OG images, sitemap). `vitest.config.ts` has a node project and a browser (Playwright Chromium) project. `tsconfig.json` extends react with overrides; `tsconfig.node.json` covers `vite.config.ts`, `vitest.config.ts` and `build/**`. `resolve.alias` points `@mark1russell7/lag` and others at `../<pkg>/src`. `base: normalizeBase(process.env["SITE_BASE"])`. |
| `packages/lag-integration-tests` | `@lag/integration-tests` | Vitest browser mode with Playwright and webdriverio (Safari, iOS), plus grafana-infra and otel-ts from `github:`. |
| `packages/load` | `@lag/load` | vite preset, dist. |
| `packages/report` | `@lag/report` | ts preset, dist. |
| `packages/scripts` | `@lag/scripts` | The `pnpm new` generator, results and readme-metrics. Uses `@clack/prompts ^0.9.1`. |
| `packages/experiments` | `@lag/experiments` | vite preset. |

**Generator (`pnpm new --name <n> --config <ts|node|node-cjs|vite|react>`)**, from `packages/scripts/src/{new-package,package-template}.ts`:
- `package.json` gets `@lag/<n>`, `0.0.0`, `private`, `type: module` (omitted for cjs), `main: dist/index.js`, `types: dist/index.d.ts`, `exports {".":{types,import|require}}` and `scripts.build: "tsc -b"`.
- devDependencies per config: `node`/`node-cjs` get `@types/node`, `vite` gets `vite`, `react` gets `vite` + `@types/react`. Versions are the highest range used in the workspace.
- `tsconfig.json` is `{"$schema":…, "extends":"../../ts/config/<c>.json"}`.
- `src/index.ts` is empty.
- It inserts a sorted reference into the root tsconfig.
- It writes no vitest config, no test script and no tsconfig.test.json.
- `--force` rewrites the files of an existing folder.

**ci.yml** (verbatim `build` job; the other jobs are summarized after it)
```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Build, typecheck, unit tests, coverage
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm coverage
      - name: Upload the coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-core
          path: packages/lag/coverage/
          if-no-files-found: ignore
      # The writing rules (ASD-STE100) of the README, the site and the comments
      - name: STE lint
        run: pnpm lint:ste
      # The metric table of the README must agree with the metric catalog
      - name: README metric table
        run: pnpm readme:metrics:check
```
The other jobs in the same file:
- `browser`: a matrix over chromium, firefox and webkit. It runs `playwright install --with-deps` and then one vitest project at a time through a bash `mapfile` loop.
- `safari` (macos-latest, `continue-on-error`): `safaridriver --enable`, turn off App Nap, `caffeinate`, `pnpm run test:safari`.
- `ios` (macos, `continue-on-error`): boots a simulator and runs `test-ios.sh`.
- `site`: `pnpm build`, Playwright Chromium, `pnpm --filter @lag/site typecheck`/`test`/`build` with `SITE_BASE: lag` and `SITE_URL: https://mark1russell7.github.io/lag/`, then greps the prerendered HTML.

All jobs use `checkout@v4`, `pnpm/action-setup@v4` with `version: 10`, and `setup-node@v4` with node 24.

**pages.yml** (verbatim)
```yaml
# Builds the website (packages/site) with the newest test results and
# publishes it to GitHub Pages. To use this workflow, set the Pages source of
# the repository to "GitHub Actions" (Settings > Pages).
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write
  # To download the newest report of the mutation workflow
  actions: read

# One deployment at a time. A newer push cancels a deployment that waits.
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  # The browser tests in the real Safari. Only macOS has Safari. The job
  # exports its reports, and the build job adds them to the run of the site.
  safari:
    runs-on: macos-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Enable safaridriver
        run: sudo safaridriver --enable
      # App Nap of macOS slows the timers of a window that is not in front: a CI runner
      # slowed the timers of Safari by 9 s one time
      - name: Turn off App Nap
        run: |
          defaults write com.apple.Safari NSAppSleepDisabled -bool YES
          defaults write NSGlobalDomain NSAppSleepDisabled -bool YES
      # Without a simulator, the iOS tests fail, but the Safari tests still give their reports
      - name: Boot an iPhone simulator
        continue-on-error: true
        run: .github/scripts/boot-ios-simulator.sh
      - name: Test in Safari and in Safari on iOS
        continue-on-error: true
        # caffeinate keeps the display awake: WebKit slows the timers of a window that it does not show
        run: |
          caffeinate -dimsu -t 3600 &
          pnpm results --skip-unit --skip-browser --skip-overhead --skip-site --no-mutation --safari --ios --export-reports=safari-reports
      - uses: actions/upload-artifact@v4
        with:
          name: safari-reports
          path: safari-reports/
          if-no-files-found: ignore

  build:
    # The site also builds when the Safari job fails
    needs: safari
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - name: Install the Playwright browsers
        run: pnpm --filter @lag/integration-tests exec playwright install --with-deps chromium firefox webkit

      # (mutation-report download step via `gh run list/download` — omitted here; see file)

      - name: Download the Safari reports
        continue-on-error: true
        uses: actions/download-artifact@v4
        with:
          name: safari-reports
          path: safari-reports

      - name: Make the test results
        run: pnpm results --import-reports=safari-reports
        continue-on-error: true

      # (index.json existence check step — omitted)

      - name: Install Chromium for the site build
        run: pnpm --filter @lag/site exec playwright install chromium

      - name: Build the site
        run: pnpm --filter @lag/site build
        env:
          SITE_BASE: ${{ github.event.repository.name }}
          # The absolute URL of the site, for the canonical links, Open Graph and the sitemap
          SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/

      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
Two lag-specific steps are marked "omitted" above; they are in `~/git/lag/.github/workflows/pages.yml`.

**release.yml** (verbatim)
```yaml
name: Release

# Publishes @mark1russell7/lag (packages/lag) to npm when a version tag (for example v0.2.0) is pushed.
# npm trusted publishing uses the OIDC token of GitHub Actions: the workflow needs no npm token,
# and the package gets a provenance statement. The trusted publisher is set one time, after the
# first version is on npm: npm trust github @mark1russell7/lag --file release.yml
# --repo mark1russell7/lag --allow-publish

on:
  push:
    tags: ["v*"]

permissions:
  contents: read
  id-token: write

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  publish:
    name: Test and publish to npm
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          registry-url: "https://registry.npmjs.org"
      - name: The tag agrees with the version of the package
        run: test "v$(node -p 'require("./packages/lag/package.json").version')" = "$GITHUB_REF_NAME"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
      # pnpm pack runs prepack (a clean build of dist) and packs the files of "files" in package.json
      - name: Pack
        working-directory: packages/lag
        run: pnpm pack --pack-destination "$RUNNER_TEMP"
      # npm publishes the tarball. Trusted publishing (OIDC) needs npm 11.5.1 or later.
      - run: npm install --global npm@latest
      - name: Publish
        run: npm publish "$RUNNER_TEMP"/mark1russell7-lag-*.tgz --access public --provenance
```
lag also has `e2e.yml` (weekly Monday 04:17 plus dispatch: grafana-infra docker compose, `vitest --project e2e`) and `mutation.yml` (weekly Sunday 03:41 plus dispatch with a `force` input: Stryker with an incremental cache and an uploaded report).

---

## 4. lag compared with the pristine template

lag is a different lineage, not template plus additions. What lag has that the template does not:

| Area | template | lag |
|---|---|---|
| Package manager pin | `packageManager pnpm@12.10.1`, `engines node>=22` | none (pnpm 10 in CI) |
| TS presets | `github:mark1russell7/cue` | vendored `ts/config/*` |
| Package model | source packages (`main ./src/index.ts`), no build, `composite:false` | dist packages built with `tsc -b`, root tsconfig with references, `exports` maps, `0.0.0` versions |
| Generator | `pnpm package add <n> --preset=` (cli package) | `pnpm new --name --config` (in `@lag/scripts`) |
| Root scripts | package, template, test, typecheck, lint:ste | build, many test:* scripts, coverage, mutation, results, readme:metrics(:check), experiment:e8, new |
| Testing | vitest per package | vitest plus coverage-v8 thresholds, Stryker mutation, Vitest browser mode (Playwright, webdriverio, Safari, iOS), fast-check, fake-indexeddb |
| Site | none | `packages/site`: Vite + React + MDX + react-router, with prerender, OG images, sitemap and `SITE_BASE`/`SITE_URL`; content in `packages/site/content/{docs,research,thesis}` |
| Docs | none | README (large) plus site MDX docs, including `contributing/writing-style.mdx` |
| Publishing | none | `@mark1russell7/lag` published via `release.yml` (tag `v*`, OIDC trusted publishing, `pnpm pack` then `npm publish --provenance`); `CHANGELOG.md` kept by hand; **no changesets** |
| CI | 1 job (node 26, actions v6/v7) | ci (build, 3-engine browser matrix, safari, ios, site), pages, release, e2e, mutation (node 24, actions v4) |
| CLAUDE.md | yes | **no** |
| `.gitignore` | 113-line template | short custom file |
| Extras | `.mcp.json` (ignored) | `LICENSE`, `lag.code-workspace`, social preview image, `.github/scripts/*` |

---

## 5. Versions in use

| Tool | template | github.io | lag | ste-lint | Vex / render / crawler / page-lifecycle-tracker | Jqy today | npm latest (queried 2026-10-12) |
|---|---|---|---|---|---|---|---|
| pnpm | `packageManager pnpm@12.10.1` | 12.10.1 | none; CI `version: 10`; lockfile v9 | 12.10.1 | 12.10.1 (AsyncBrowserContext: 10.26.0) | npm | 12.11.2 |
| node (engines) | >=22 | >=22 | none | >=22 | >=22 (Vex >=22.12); cue HEAD >=22 | none | local node v24.21.0 |
| node (CI) | 26 | 26 | 24 | 26 | 26 (Vex matrix 22/24/26) | – | – |
| typescript | ^7.0.2 (7.0.2) | ^7.0.2 | ^5.9.3 (5.9.3) | dependency ^6.0.3 (needs the JS API) | ^7.0.2 | none | 7.0.2 |
| tsx | ^4.23.15 | ^4.23.15 | ^4.21.0 | ^4.23.15 | ^4.23.15 | – | 4.23.15 |
| vitest | ^5.0.3 | ^5.0.3 | ^4.1.2 | ^5.0.3 | ^5.0.3 | none | 5.0.4 |
| vite | 8.3.3 (via vitest) | ^8.3.3 | ^7.3.1 | – | ^8.3.3 / ^8.3.4 | ^7.1.2 | 8.3.4 |
| react, react-dom | – | ^19.3.0 | ^19.3.0 | – | ^19.3.0 | ^19.1.1 | 19.3.0 |
| @vitejs/plugin-react | – | ^6.1.2 | ^5.2.0 | – | ^6.1.2 (page-lifecycle-tracker) | ^5.0.0 | 6.1.2 |
| @types/react, @types/react-dom | – | ^19.3.0 | ^19.3.0 | – | ^19.3.0 | ^19.1.10 / ^19.1.7 | 19.3.0 / 19.3.0 |
| @types/node | ^26.6.4 | ^26.6.4 | ^25.x | ^26.6.4 | ^26.6.4 | – | 26.6.5 |
| @clack/prompts | ^1.8.1 | ^1.8.1 | ^0.9.1 | – | – | – | 1.8.1 |
| oxlint | – | – | – | – | ^1.87.0 (Vex, render, crawler); Vex also oxlint-tsgolint ^7.0.2003 | – | 1.87.0 / tsgolint 7.0.2004 |
| eslint | – | – | – | – | – | ^9.33.0 (+ @eslint/js, react-hooks ^5.2.0, react-refresh ^0.4.20, globals ^16.3.0) | – |
| tsdown | – | – | – | – | Vex ^0.23.0; render, crawler ^0.23.1 | – | 0.23.1 |
| @changesets/cli | – | – | – | – | ^3.0.3 (Vex, client) | – | – |
| reactflow / @xyflow/react | – | – | @xyflow/react ^12.12.0 | – | – | reactflow ^11.11.4 | 11.11.4 (legacy) / 12.12.0 |
| cue (lock) | 9c99ad6 | fb96d13 (old) | not used | fb96d13 | – | – | npm 1.0.0 exists; repos use `github:` |
| ste-lint (lock) | f597d6c | f597d6c | f597d6c | – | – | – | git only |

GitHub Actions versions:
- **Template family:** `actions/checkout@v7`, `pnpm/action-setup@v6` (version taken from `packageManager`), `actions/setup-node@v7`.
  - github.io uses `upload-pages-artifact@v5` and `deploy-pages@v5`.
  - page-lifecycle-tracker uses `upload-pages-artifact@v3` and `deploy-pages@v4`.
  - Vex pins the same actions to SHAs: checkout v7.0.1, action-setup v6.1.0, setup-node v7.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1.
- **lag:** `@v4` everywhere, `upload-pages-artifact@v3`, `deploy-pages@v4`.

---

## 6. Other template-family references you will probably want

**`~/git/page-lifecycle-tracker`** is the closest model for a react-preset site, made with the **current** generator (it has `tsconfig.test.json`) and deployed as a project site with `SITE_BASE`. Branch `main`.

- `packages/site/tsconfig.json` is the generator's react output plus `"noPropertyAccessFromIndexSignature": false`.
- `packages/site/package.json` keeps `"main": "./src/index.ts"`. It adds the scripts `dev: vite`, `build: vite build`, `preview: vite preview`, and sets `typecheck: "tsc -p tsconfig.json && tsc -p tsconfig.test.json && tsc -p tsconfig.node.json"`.
- `tsconfig.node.json`, which type-checks `vite.config.ts`, `vitest.config.ts` and `build/**`:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["esnext", "dom"],
    "types": ["node"],
    "noEmit": true,
    "rootDir": "${configDir}"
  },
  "include": ["vite.config.ts", "vitest.config.ts", "build/**/*"],
  "exclude": ["node_modules", "dist"]
}
```
- `build/base.ts` normalizes the base:
```ts
export function normalizeBase(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (trimmed === "" || trimmed === "/") return "/";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  const leading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return leading.endsWith("/") ? leading : `${leading}/`;
}
```
  `vite.config.ts` uses it as `base: normalizeBase(process.env["SITE_BASE"])`.
- `pages.yml` build step:
  ```yaml
  - name: Build the site
    run: pnpm --filter ./packages/site build
    env:
      SITE_BASE: ${{ github.event.repository.name }}
      SITE_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/
  ```
  The `deploy` job has `if: ${{ github.event.repository.has_pages }}`.
- `ci.yml` is the template's plus a Playwright Chromium install, the package build and `pack --dry-run`, then `pnpm lint:ste`.
- Its `CLAUDE.md` "Writing style" section is identical to the template's, and `ste.config.json` include/ignore are identical to the template's.

**`~/git/Vex`** is the newest and most elaborate template-derived repo. Only relevant if you want code linting or releases:
- root `"lint": "oxlint"` with `.oxlintrc.json` (plugins typescript, unicorn, oxc, import, vitest; `typeAware: true`; correctness and suspicious set to error)
- `"check"` script that chains typecheck, lint, coverage, test, docs and ste
- changesets (`.changeset/config.json`) and a `release.yml` that uses `changesets/action@v2.1.2` with OIDC trusted publishing on a manual dispatch with an `npm` environment
- `.github/renovate.json`
- CI `permissions: {}`, SHA-pinned actions and a `ci-ok` aggregate job
- `docs/research/01-template-and-ste-lint.md` (2026-10-08), a raw inventory of these same repos. It is partly outdated: its "surprises" 1, 3, 4 and 5 were fixed by template `aac1840` and cue `9c99ad6`.

**Other repos with a root `ste.config.json`:** AsyncBrowserContext, client, crawler, optional, page-lifecycle-tracker, render, systems and Vex.

---

## 7. Key paths

- Template: `~/git/template/package.json`, `pnpm-workspace.yaml`, `ste.config.json`, `.gitignore`, `.gitattributes`, `.github\workflows\ci.yml`, `CLAUDE.md`, `.mcp.json`, `.claude\settings.local.json`, `packages\cli\{package.json,tsconfig.json,vitest.config.ts}`, `packages\cli\src\{index.ts,paths.ts,commands\index.ts,commands\package\{index,add}.ts,commands\repo\{index,rename}.ts}`
- cue presets: `~/git/template/node_modules/@mark1russell7/cue/ts/config/*.json` (same as `~/git/cue/ts/config/`)
- Script: `~/git/new-repo.ps1`
- ste-lint: `~/git/ste-lint/{package.json,README.md,ste.config.json,ste.config.schema.json,src\config.ts,src\files.ts,src\lint.ts,src\run-cli.ts,.github\workflows\ci.yml}`
- github.io: `~/git/mark1russell7.github.io/{package.json,pnpm-workspace.yaml,ste.config.json,CLAUDE.md,README.md,.github\workflows\ci.yml,.github\workflows\pages.yml,packages\site\*}`
- lag: `~/git/lag/{package.json,pnpm-workspace.yaml,tsconfig.json,ste.config.json,README.md,.gitignore,.github\workflows\{ci,pages,release,e2e,mutation}.yml,packages\site\content\docs\contributing\writing-style.mdx,packages\scripts\src\{new-package,package-template}.ts,packages\site\{vite.config.ts,vitest.config.ts,tsconfig.json,tsconfig.node.json}}`
- Site examples: `~/git/page-lifecycle-tracker/packages/site/{package.json,tsconfig.json,tsconfig.test.json,tsconfig.node.json,vite.config.ts,vitest.config.ts,build\base.ts}` and `~/git/page-lifecycle-tracker/.github/workflows/{ci,pages,release}.yml`
- Workspace rules: `~/git/CLAUDE.md` (the "Which scaffolding rule applies where" table)
- Prior research: `~/git/Vex/docs/research/01-template-and-ste-lint.md`
