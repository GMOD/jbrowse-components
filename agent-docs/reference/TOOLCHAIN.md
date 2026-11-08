---
name: toolchain
description: How do the TypeScript 6/7 split, the oxlint/eslint split, incremental builds, the pre-push fixers, pnpm autogen and dependency pruning work, and what breaks silently? Read before changing a TypeScript version, a lint rule, or a docstring autogen reads.
audience: internal
kind: operations
---

# Toolchain

The dev loop runs three TypeScript versions and two linters on purpose. Don't
"fix" either by unifying them.

## Why three TypeScript versions

- **The eslint backstop needs 6.x.** `pnpm lint` is oxlint, type-aware through
  tsgolint, which uses its own TS7-based checker and ignores the ambient
  `typescript`. `pnpm lint:eslint` parses with `@typescript-eslint`, whose
  `ts-api-utils` peer range is `<6.1.0`, so bumping the ambient `typescript` breaks it.
- **Typecheck and `build:esm` want 7.x for speed.** `pnpm typecheck` runs tsrs,
  the Rust port of tsc at TypeScript 7.1, by path (`scripts/typecheck.ts`);
  `build:esm` emits with the aliased `typescript7` (7.0) devDependency. Use `pnpm
  typecheck`, never a bare `tsc`. `products/jbrowse-cli` still builds with ambient 6.x.
  The two 7.x versions differ in `lib.dom`, so DOM API typing has to compile
  under both (`SanitizedHTML.tsx`'s `canSetHTML`).

The versions write **incompatible** `.tsbuildinfo` and each discards the
other's, so don't share a `.tsbuildinfo` CI cache between them.

Measured on ada (24 cores, idle) on 2026-11-07, cold medians of 3: typecheck of
`.` takes tsgo 7.0.2 9.2 s and 6.0 GB, tsgo 7.1-beta 5.5 s and 3.8 GB, tsrs
1.9 s and 1.6 GB (`--fast` 1.2 s); `oxlint --type-aware` 9.0 s and 6.8 GB with
tsgolint, 3.8 s and 3.4 GB with tsrs-lint; oxlint alone 0.5 s; eslint about
31 s and 360 CPU-s. **`oxlint --type-check` cannot stand in for `pnpm
typecheck`**: it also checks loose files outside the root tsconfig (website,
examples-site).

## Incremental builds trust `.tsbuildinfo`

Incremental tsc's up-to-date check reads `.tsbuildinfo`, never the output tree
or `package.json`, and an error it replays names the stale type, not the cache.

- **Is the build current?** `pnpm build:esm --dry` answers it. A rebuild that
  says up to date while a run still fails on a deleted or truncated emitted
  `.js` needs `pnpm build:esm --force` (~25 s for the workspace).
- **An `exports`-map edit or a new dependency**, anything module resolution
  reads rather than compiles, leaves the build replaying the old resolution.
  Delete the tsbuildinfos before believing the result
  (`find packages plugins products example-plugins -maxdepth 2 -name
  "tsconfig.build.esm.tsbuildinfo" -delete`), and confirm the dependency did
  the work by hiding its `node_modules` symlink and watching the error return.
- **A typecheck that overlapped an edit** can keep printing the old type on
  reruns, and a changed exported signature can pass `pnpm verify` with its
  callers unchecked. Launch `pnpm typecheck` after the edits it reads; when it
  contradicts the file on disk, or after changing an exported signature, `rm
  tsconfig.tsbuildinfo` and rerun it before landing.

## What `pnpm typecheck` does not check

- **A removed workspace dependency.** Typecheck is one program over the root
  and jest resolves through root `node_modules`, so both stay green; only `pnpm
  build:esm` compiles each package against its own deps, and only with the
  dependent's `tsconfig.build.esm.tsbuildinfo` deleted.
- **`website/`.** The docs generators check under `pnpm typecheck
  website/scripts/api-docs` (its own stricter tsconfig, which pulls in what it
  imports), and `.oxlintrc.json` ignores that directory too. Run it after
  editing anything under `website/scripts`.

## TS7056 names the factory, not the cause

`build:esm` failing with TS7056 ("the inferred type of this node exceeds the
maximum length the compiler will serialize") names the exported model factory
where declaration emit gave up. The usual cause is an `export type X =
Instance<…>` alias a factory member mentions: an alias has no referenceable
name, so the emitter inlines the whole model. Make it `interface X extends
Instance<…> {}` (ADR-055).

- **Locate it in one run**: beside the factory put `declare const x:
  TheStateModel; export const y: number = x`, run `pnpm typecheck
  <package>/tsconfig.build.esm.json --noErrorTruncation` (a bare `tsc` is
  refused), and find each member name's offset in the error. The gap between consecutive names is that member's
  serialized cost, and the largest names the alias.
- **`pnpm typecheck` cannot see it**: `--noEmit` serializes no declaration, so
  the error exists only in `build:esm` and only for an exported factory.
- **A typed `session.addView(self.type, …)` inside a view's own factory** makes
  the model circular: typecheck explodes across packages, and one TS7023 on the
  new action is the real error. Put the helper outside the factory
  (`openSpanInNewView` in `LinearGenomeView/menuItems.ts`).

## Project references

**Module augmentations must be reachable from the package entry.** A `declare
module` block (`ExtensionPointRegistry`, `RpcRegistry`) applies only in programs that
load the declaring file, and across packages a consumer sees only the `.d.ts` files
reachable from the dependency's entry. Put cross-package augmentations in a file the
entry re-exports a named binding from. `import type {} from './X.ts'` does **not**
work: TS elides binding-less imports from declaration emit. Symptoms: `TS2488 Type
'unknown' must have a '[Symbol.iterator]()' method` at an `addToExtensionPoint`
callback, or `contributeToExtensionPoint` rejecting the name outright.

## Linting: who owns what

- **Type-aware oxlint runs tsgolint by name.** Given no `OXLINT_TSGOLINT_PATH`,
  oxlint prefers `tsrs-lint` to `tsgolint`, and the `tsrs` package that `pnpm
  typecheck` uses installs it. On 2026-11-08 the two disagreed on 23 sites and an
  `any`: generic calls cast with `as` where tsrs-lint wants the type argument
  (`getSnapshot<T>(x)`, `querySelector<HTMLElement>(s)!`), and a DataGrid cell
  value tsgolint missed (its type-argument check, tsgolint#1333, is merged but
  not in 7.0.2006). typescript-eslint agreed with tsrs-lint on each, the
  sites are fixed, and both report nothing. The pin keeps lint on the released
  tool while tsrs is a beta; switching is deleting the variable from `pnpm
  lint`, the pre-commit hook, `verify.ts` and `check-unsafe-any.ts`.
- **`non-nullable-type-assertion-style`'s `!` fix breaks
  `querySelector(...) as HTMLElement`** (TS2339). tsgolint leaves that cast
  alone only while `no-unnecessary-type-assertion` is also on; with the rule
  alone both backends flag it (oxc-project/tsrs#943).
- **`.oxlintrc.json` cannot carry comments.** `eslint.config.mjs` imports it with
  `with { type: 'json' }`, a strict `JSON.parse`, so a `//` comment breaks `pnpm
  lint:eslint` with an error that does not name the comment. A `"//key"` entry fails
  too, since oxlint reads every key under `rules` as a rule name. Rationale for an
  oxlint rule goes in its commit message.
- **Neither linter reports unused disable directives.** Both read the same
  `eslint-disable` comments and each runs only part of the rule set, so suppressions
  that suppress nothing accumulate.
- **`eslint-disable-next-line` means the next line.** A directive followed by more
  comment lines applies to the comment and fails silently. Put the prose first and the
  directive last.
- **`gate(s) failed: lint` in `pnpm verify` names the type-aware oxlint gate**;
  eslint's is `lint (eslint)`. Read the failed gate's own `=== <name>` section,
  and the exit code rather than a piped tail.
- **A rebase or `merge --ff-only` runs no pre-commit hook**, so lint green on
  every original commit can be red on the result (an unused import left by a
  conflict). Run `pnpm verify` after the last rebase, and `pnpm verify --all`
  after changing a widely read type: type-aware oxlint then flags redundant
  casts in files you never opened.
- **Whole-tree type-aware typescript-eslint dies near 17 GB** on the default
  `vm.max_map_count` (65530), whatever `--max-old-space-size` says, and
  `--concurrency` workers share that one process. Shard the file list into
  separate processes (`xargs -P`).

## The pre-push hook's fixes are checked by `build:esm` only

`.githooks/pre-push` commits what its linters, formatter and `autogen
--fix-stale` rewrote, and only `build:esm` runs after them, so a fix that
breaks website types (`.dataset` on a `querySelector` `Element`) or a jsdom
test (`CSS.escape`) lands unread. After a push whose hook reported fixes,
re-run the touched suites and `pnpm --filter @jbrowse/website-astro
typecheck`, then repair so the rule has nothing left to fix
(`querySelector<HTMLElement>`), since a revert is re-fixed on the next push.

**It commits by pathspec, so it cannot add a new generated file.** A schema
change that creates a `website/docs/config` page blocks the push with
"pathspec … did not match any file(s) known to git". Regenerate first
(`scripts/generateConfigManifest.ts`, then `website/scripts/api-docs/generate.ts`,
then `scripts/check-docs.ts`, each under `node --experimental-strip-types`) and
commit `website/docs/config`, `website/docs/models`, `typeDocs.generated.json`
and `coverage-gaps.txt` before pushing.

## Formatting

A worktree's install, its base and `TS2307`: [WORKTREES.md](WORKTREES.md) §"A
fresh worktree".

`pnpm format` is safe bare. But `agent-docs` is on `.prettierignore` and **naming it
explicitly overrides that**, rewrapping thousands of lines of prose.

**oxfmt strips the `<T,>` comma from a generic arrow in a `.ts` file**, and
babel parses `.ts` with JSX on, so the suite then fails to parse. Write generic
helpers as `function f<T>(x: T)` declarations, and run tests after `pnpm
format`, not before.

## `pnpm autogen`

**It needs a clean tree.** `pnpm gendocs` resolves sources through the
`@jbrowse/*` workspace links, so a dirty shared tree leaks into the output and then
fails the CI check. A temp worktree with symlinked `node_modules` does not escape it.
Run it clean and commit the output by itself. Stage after it finishes, since
the standalone generators write as they go; during a rebase, `git add` every
resolution before starting it.

**What stales it**, which typecheck, jest, lint and `build:esm` all pass over:

- An `#api` docstring (`packages/core/README.md`, `website/docs/api/core.md`),
  a config slot (the config manifest and the config pages together), doc
  frontmatter or a `todo/` entry.
- A change to what a documented `#getter`, `#method` or `#action` returns or
  accepts, with no docstring touched: the model pages and
  `typeDocs.generated.json` print each inferred type.
- Re-indenting a model body: the tables embed initializers as literal source.
- Moving or editing a `// #region` that `sync-doc-snippets` quotes: the
  pre-commit oxfmt reformats the snippet at the doc's shallower indent, so a
  line wrapped only because it sat deep re-stales it on every commit. Keep its
  lines short enough to fit at both indents.

**Shapes the generator misreads:**

- An untagged MST member still gets a row with an empty description.
- A `/** … */` block between a `#stateModel` docstring and its factory is
  absorbed into the page, and the generator stops following the mixin, so the
  mixin's members drop off every page composing it. Use `//` there.
- A shared slot builder spread into an inline sub-schema drops its slots from
  the parent page, since only slots with a `#slot` tag at the call site are
  inlined. It is free inside a schema with its own `#config` page; elsewhere
  keep the slots hand-written or split the sub-schema into its own file.
- A sub-schema built by a factory fails with "N config slot(s) in a #config
  schema have no #slot tag", naming the property, not the factory, because only
  a literal `ConfigurationSchema(` initializer is skipped. Follow
  `FormatAbout`: `#config` and `#category` on the factory, `/** #slot */` at
  each call site.

**Reading a red one:** a generated diff that deletes far more than it adds
means your tree, not main's staleness, so revert it; a stack-trace path with no
worktree segment means the generator ran against the primary checkout.
`scripts/chromeBundleSizes.json` moves raw `gzipBytes` on every run and its
checker gates only the rounded `*Kb` fields, so revert it unless one moved.

**The CLI README is regenerated at pack time.** A local `generate_readme.sh`
run adds whitespace churn around the `--help` block, and `autogen` mirrors the
README into `website/docs/cli.md`. Fix CLI prose in `commands/*`, not the
README.

## A `dependencies` entry can be load-bearing without being imported

When one goes:

- Re-run `scripts/generate-tsconfig-references.ts`: a workspace dependency has a
  derived project reference.
- Grep the importers and confirm each declares it; removing a dep another package
  imports without declaring turns a working install into a hoisting accident.
- Use `pnpm install --lockfile-only` in a shared worktree.
- **Confirm the prune before believing a green typecheck.** Typecheck fails on a
  removed dep only once its per-package `node_modules` symlink is gone. `ls -d` the
  removed link and a kept dep as a control; an empty first result means nothing unless
  the control is still linked.

A dep with no textual mention in its package is still needed in four cases:

- **`@mui/system` in `packages/core`**: `ReExports/MuiStylesReExports.ts`'s
  inferred type reaches into it, and with `declaration: true` the name must
  resolve off a direct dependency or tsc raises TS2883. Any `ReExports/*` file
  can do this, and only declaration emit shows it.
- **`mobx` in about 14 plugins**, supplied to the bundle as an external.
- **`@emotion/react`, `@emotion/cache` and `@emotion/styled` in the embedded
  products**: MUI's peers, supplied by the app.
- **`.astro` consumers** (`astro`, `@astrojs/react`, `react-dom` in the
  examples-sites), invisible to a `.ts`/`.tsx` scanner; likewise `react` under
  `jsx: react-jsx`, imported through `react/jsx-runtime`.
