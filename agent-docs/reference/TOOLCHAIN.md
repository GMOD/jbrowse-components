---
name: toolchain
description: Why we deliberately run TypeScript 6.x for lint and an aliased typescript7 for typecheck and build:esm, why unifying them breaks the eslint backstop, plus the project-reference, module-augmentation and clean-tree rules that follow. Read before changing a TypeScript version, a tsconfig references array, or a package entry point.
---

# Toolchain: TypeScript 6 vs 7 split

We run two TypeScript versions on purpose. Don't "fix" this by unifying them.

## Why two versions

- **The eslint backstop needs 6.x.** `pnpm lint` is now oxlint (type-aware via
  tsgolint, which uses its own TS7-based checker — it does NOT read the ambient
  `typescript`). But the CI backstop `pnpm lint:eslint` still parses with
  `@typescript-eslint`, whose `ts-api-utils` peer range is `<6.1.0`; bumping the
  ambient `typescript` breaks it. (The backstop is type-info-free, so it doesn't
  type-check with 6.x — it just needs the parser to install.)
- **Typecheck wants 7.x for speed.** `pnpm typecheck` runs an aliased
  `typescript7` devDependency (`npm:typescript@7`) by path
  (`node node_modules/typescript7/bin/tsc --noEmit`).
- **`build:esm` uses 7.x too.** Package `build:esm` scripts invoke
  `node ../../node_modules/typescript7/bin/tsc --build tsconfig.build.esm.json`
  by path, same as `typecheck`. Emit is byte-identical to 6.x (verified across
  all 4862 emitted files); 7.x is ~3x faster on a single-package rebuild.

The two versions write **incompatible** `.tsbuildinfo`. Neither reads the
other's — each discards it and does a full rebuild. That's safe (no stale or
corrupt output) but means an incremental cache is worthless across a version
switch, so don't share a `.tsbuildinfo` CI cache between the two.

`products/jbrowse-cli` still runs ambient 6.x via `"build": "tsc && webpack"` —
it's not a `build:esm` package.

## The rule

Keep `typescript` on 6.x; keep `typescript7` as the aliased 7.x. Once
typescript-eslint ships TS7 support, drop the alias and bump `typescript`
itself to 7.

## Project references

Every `tsconfig.build.esm.json` is `extends` plus a `references` array mirroring
its package.json `workspace:` deps — nothing else. The compiler options live in
`tsconfig.base.esm.json` at the root, which uses `${configDir}` so `outDir`,
`rootDir`, `include`, and `exclude` resolve against the extending package rather
than the root. The two packages that run in node and import `node:*` extend
`tsconfig.base.esm.node.json` instead; the generator decides which.
`tsconfig.build.json` at the root is the solution file listing all 53 projects.

Without references each package resolves its workspace deps to **source**
(package.json `main` is `src/index.ts`), so `tsc` re-parses and re-checks each
dependency's whole source tree once per dependent — `plugins/gccontent` has 14
source files of its own and used to load 2784. A cold whole-repo build went from
**93.7s wall / 813s CPU** to **14.2s / 96s**.

Don't hand-edit those files at all — `pnpm gen-tsconfig-refs` writes each one
whole from package.json, so anything added by hand is dropped on the next run.
CI runs it with `--check`. A per-package compiler option belongs in one of the
two base configs.

## Module augmentations must be reachable from the package entry

This is the one real constraint references impose. A `declare module` block —
`ExtensionPointRegistry`, `RpcRegistry` — only applies in programs that actually
load the declaring file.

Inside its own package that's automatic (`include` is `src/**/*`). Across
packages it is not: a consumer sees only the `.d.ts` files reachable from its
dependency's entry. Source resolution used to hide this by pulling in the whole
dependency source tree, so an augmentation buried in a deep component worked by
accident.

So put cross-package augmentations in a file the package entry re-exports a
named binding from — a feature-level `index.ts` or the `model.ts` that defines
the referenced type. `import type {} from './X.ts'` does **not** work: TS elides
binding-less imports from declaration emit, so it never reaches the entry
`.d.ts`.

Symptom when you get it wrong: `TS2488 Type 'unknown' must have a
'[Symbol.iterator]()' method` at an `addToExtensionPoint` callback, because the
overload fell back to the untyped signature. On an accumulating point the same
cause reads differently — `contributeToExtensionPoint` rejects the name outright,
since an unseen registry entry leaves it out of `AccumulatingPointName`.

## `pnpm autogen` needs a clean tree

`pnpm gendocs` resolves sources through the `@jbrowse/*` workspace links, so in
a shared worktree it emits `f(everyone's dirty tree)` and then fails the CI
check, which regenerates from committed source. A temp worktree does not escape
it either: symlinking the real `node_modules` in makes pnpm's workspace entries
resolve back to the dirty main checkout. Run `pnpm autogen` on a clean tree and
commit the output by itself.

## A `dependencies` entry can be load-bearing without being imported

Sweeping for dead dependencies is worth doing, and a scanner alone will get it
wrong in both directions. "No package in this repo imports it" is the *start* of
the argument, not the end — four whole classes are real requirements that no
import statement records:

- **Peer satisfaction.** `@jbrowse/core` declares `react` and `react-dom` as
  peers, and `@mui/material` declares the `@emotion/*` packages. A consumer must
  install them even if its own source never mentions them. `jbrowse-img` is the
  case that looks most deletable and is not: it is a pure CLI with no `.tsx`
  file anywhere, and it still needs both React packages because the plugins it
  renders through do.
- **Implicit `@types`.** Nothing imports `@types/jsdom`; `tsc` picks it up
  because something imports `jsdom`. Check the *base* package, not the types
  package.
- **Resolved by name at build time.** `@iconify-json/mdi` is never imported —
  `astro-icon` loads it because an `.astro` file wrote `<Icon name="mdi:github"/>`.
  A scanner sees the icon name, not the package.
- **Invoked as a CLI.** `@astrojs/check` exists so `astro check` runs, and only
  the script says so.

What is left after those is small and worth removing, since a published
`dependencies` entry is an install every consumer pays for. The three found in
the 2026-08-06 sweep were `@gmod/vcf` in breakpoint-split-view (surviving only
in a test *comment* describing breakend syntax), `@jbrowse/product-core` in
jbrowse-img and `@mui/icons-material` in jbrowse-react-app (each appearing
nowhere but its own `package.json`). Two prior removals in jbrowse-web are in
`ccdcf301cb`.

Two things to do when one goes:

- **Re-run `scripts/generate-tsconfig-references.ts`.** A workspace dependency
  has a project reference derived from it, so the reference is stale the moment
  the dep leaves — see § Project references.
- **Check nothing was leaning on it.** Removing a dep another package imports
  without declaring turns a working install into a hoisting accident that breaks
  on someone else's package manager. Grep for the importers and confirm each
  declares it.

`pnpm install --lockfile-only` is enough to update the lockfile and leaves
`node_modules` alone, which matters in a shared worktree — a full install
re-links every package under whatever else is mid-build. The tradeoff is that
typecheck then proves less than it looks: the symlinks are still there, so it
cannot fail on a dep you removed. The greps are the evidence; typecheck only
catches the unrelated damage.
