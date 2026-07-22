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

# Project references

Every `tsconfig.build.esm.json` is `composite: true` and carries a `references`
array mirroring its package.json `workspace:` deps. `tsconfig.build.json` at the
root is the solution file listing all 52 projects.

Without references each package resolves its workspace deps to **source**
(package.json `main` is `src/index.ts`), so `tsc` re-parses and re-checks each
dependency's whole source tree once per dependent — `plugins/gccontent` has 14
source files of its own and used to load 2784. A cold whole-repo build went from
**93.7s wall / 813s CPU** to **14.2s / 96s**.

Don't hand-edit the `references` arrays — run `pnpm gen-tsconfig-refs`, which
derives them from package.json. CI runs it with `--check`.

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
overload fell back to the untyped signature.
