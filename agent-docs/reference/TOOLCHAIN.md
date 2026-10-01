---
name: toolchain
description: How do the TypeScript 6/7 split, the oxlint/eslint split, project references, worktree installs and dependency pruning work, and what breaks silently? Read before changing a TypeScript version, a tsconfig references array, a lint rule or a disable comment.
audience: internal
kind: operations
---

# Toolchain

The dev loop runs two TypeScript versions and two linters on purpose. Don't "fix"
either by unifying them.

## Why two TypeScript versions

- **The eslint backstop needs 6.x.** `pnpm lint` is oxlint, type-aware through
  tsgolint, which uses its own TS7-based checker and ignores the ambient
  `typescript`. `pnpm lint:eslint` parses with `@typescript-eslint`, whose
  `ts-api-utils` peer range is `<6.1.0`, so bumping the ambient `typescript` breaks it.
- **Typecheck and `build:esm` want 7.x for speed.** Both call the aliased
  `typescript7` devDependency by path (`scripts/typecheck.ts`). Use `pnpm
  typecheck`, never a bare `tsc`. `products/jbrowse-cli` still builds with ambient 6.x.

The two versions write **incompatible** `.tsbuildinfo` and each discards the
other's, so don't share a `.tsbuildinfo` CI cache between them.

Keep `typescript` on 6.x and `typescript7` as the alias. Once typescript-eslint
ships TS7 support, drop the alias, bump `typescript` to 7, and delete
`scripts/check-typescript-pin.ts` in the same commit. `pnpm check-typescript-pin`
enforces the pin over **every workspace manifest**, not only the root's: TypeScript
7's package entry is a stub whose `require('typescript')` yields only
`{version, versionMajorMinor}`, which tsgolint reads as `ts.Node` being an error
type rather than as a missing install.

## Project references

Every `tsconfig.build.esm.json` is `extends` plus a `references` array mirroring its
package.json `workspace:` deps. **Don't hand-edit them**: `pnpm gen-tsconfig-refs`
writes each from package.json and CI runs it with `--check`. A per-package compiler
option belongs in `tsconfig.base.esm.json` or `tsconfig.base.esm.node.json`.
Without references, each package re-parses every dependency's source tree.

**Module augmentations must be reachable from the package entry.** A `declare
module` block (`ExtensionPointRegistry`, `RpcRegistry`) applies only in programs that
load the declaring file, and across packages a consumer sees only the `.d.ts` files
reachable from the dependency's entry. Put cross-package augmentations in a file the
entry re-exports a named binding from. `import type {} from './X.ts'` does **not**
work: TS elides binding-less imports from declaration emit. Symptoms: `TS2488 Type
'unknown' must have a '[Symbol.iterator]()' method` at an `addToExtensionPoint`
callback, or `contributeToExtensionPoint` rejecting the name outright.

## Linting: who owns what

`eslint.config.mjs` carries the reasoning for its own half. `oxlint` (`pnpm
lint:fast`, `pnpm lint` type-aware) runs pre-commit and CI; `eslint` (`pnpm
lint:eslint`) is CI only and owns react-compiler, @eslint-react, the
`no-restricted-syntax` guards and astro; `oxfmt` owns formatting and import order.

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
- **Array sort comparators are oxlint's.** `typescript/require-array-sort-compare` is
  on with tests exempt; `unicorn/require-array-sort-compare` is off because it flags
  every sort it cannot type, nearly all string sorts.
- **`@eslint-react` stays installed** for `no-nested-lazy-component-declarations`,
  `purity`, `error-boundaries`, `unsupported-syntax` and `no-unnecessary-use-prefix`;
  removing it would also delete every disable comment naming its rules.

### Rules measured and rejected

Each was read site by site. Don't re-propose without new evidence.

- **`unicorn/no-useless-spread`**: wrong on every site. `[...someUint32Array.slice(0,
  n)]` spreads to turn a TypedArray into a `number[]` for `toEqual`.
- **`unicorn/no-unsafe-string-replacement`**, **`prefer-combined-guards`**,
  **`no-immediate-mutation`** (its only rewrite is one unicorn will not apply in
  `.ts`), **`prefer-iterator-zip`** (no `Iterator.zip` in Node or TS lib).
- **`unicorn/require-post-message-target-origin`**: `Worker.postMessage`'s second
  parameter is the transfer list, so the fix throws.
- **`@eslint-react/naming-convention-ref-name`** (our refs hold latch values),
  **`use-state`** (`const [, forceRender] = useState(0)` is the force-render idiom),
  **`set-state-in-effect`** (every site is the reset half of fetch-into-state).
- **jest's default correctness set**: `expect-expect` cannot see
  `assertCanvasHasContent` / `expectCanvasMatch`; `no-conditional-expect`,
  `no-standalone-expect` and `no-export` fire on deliberate shapes.
- **oxlint's `react/react-compiler` port**: it reports the broader "Rules of React"
  set, not compilation bailouts. Once a hook returns a ref inside an object, it treats
  every property of that object as a ref, so `useNoteDraft`, `RenderCanvas`'s handle
  and floating-ui's `refs` all trip it. The rest are deliberate: the latest-ref mirror
  `ref.current = value` during render (`useFetch`, `useDockviewController`;
  `useEffectEvent` is banned because it stales inside `observer()`), lazy ref init,
  and `TrackControl`'s registry lookup. Retry after an oxlint upgrade.

## Worktrees

- **Check what the worktree branched from before trusting a gate.** `EnterWorktree`
  branches from **origin**'s default branch, which can lag local `main`, so a gate
  fails on a fix the branch predates. `git merge-base --is-ancestor main HEAD` tells
  you; `git rebase main` fixes it. A `git diff main` naming files you never opened is
  the tell.
- **A hand-made worktree is not an installed one.** `git worktree add` installs
  nothing, and typecheck dies without the gitignored `buildInfo.ts`. Don't symlink
  `node_modules` from the primary checkout: the per-package `@jbrowse/*` links are
  relative and resolve back to its sources.
- **Figures are not installed.** `pnpm figures:pull`, or symlink both gitignored
  corpora (the website's `static/img` and jbrowse-img's `img`). Without them `pnpm
  autogen` **skips** the two generators that read a corpus, so `pnpm verify --full`
  goes green without checking the jbrowse-img doc or the social card.
- **`.cache/slangc` is not installed.** `pnpm gen:shaders` silently re-downloads a
  binary per worktree; set `SLANGC=<primary>/.cache/slangc/bin/slangc`. A mismatched
  slangc re-emits every shader rather than failing, so `build-shaders.ts` checks the
  version against its pin.
- **Regenerating a figure for a spec change needs no web build of your own**: symlink
  the primary's `products/jbrowse-web/build` and run `node
  website/scripts/generate-screenshots.ts --filter <spec>`. Check its `version.txt`
  date first, and note `pnpm build` empties `build/` before writing, so a borrowed
  build can be mid-rebuild. `website/scripts/*.ts` resolves `puppeteer` from
  `packages/browser-test-utils/`.
- **`TS2307` on a `@jbrowse/*` subpath is a missing link, never a missing build.** A
  rebase that picks up a new workspace package leaves the install behind. `pnpm
  install` fixes it in seconds. A plain dependency bump does the same without
  `TS2307`: the rebased worktree typechecks against the old package and reports errors
  the bump fixed. Run `pnpm install --frozen-lockfile`. It cannot be a stale `esm/`:
  workspace exports point at `src`. The exception is jbrowse-img's CLI from source,
  which needs `pnpm build` (`products/jbrowse-img/src/resolve.ts`).

## What `pnpm autogen` owns

It rewrites every generated-and-committed artifact (`package.json` `exports` maps,
`tsconfig.build.esm.json` `references`, JSDoc doc tables) and answers almost any "X is
out of date" CI failure. Shaders belong to `pnpm gen:shaders`
([SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md)).

`pnpm format` is safe bare. But `agent-docs` is on `.prettierignore` and **naming it
explicitly overrides that**, rewrapping thousands of lines of prose.

**`pnpm autogen` needs a clean tree.** `pnpm gendocs` resolves sources through the
`@jbrowse/*` workspace links, so a dirty shared tree leaks into the output and then
fails the CI check. A temp worktree with symlinked `node_modules` does not escape it.
Run it clean and commit the output by itself.

## A `dependencies` entry can be load-bearing without being imported

"No package in this repo imports it" does not prove a dead dependency. Four classes
record no import:

- **Peer satisfaction.** `@jbrowse/core` declares `react` and `react-dom` as peers
  and `@mui/material` declares `@emotion/*`; `jbrowse-img` has no `.tsx` and still
  needs both React packages.
- **Implicit `@types`.** `@types/jsdom` rides on `jsdom`; `@types/aws-lambda`,
  `@types/hast` and `@types/mdast` type specs, not installable bases.
- **Resolved by name at build time.** `@iconify-json/mdi` via `astro-icon`.
- **Invoked as a CLI.** `@astrojs/check`.

`@babel/runtime` is needed only with `@babel/plugin-transform-runtime`, which
`babel.config.cjs` has never configured; if it reappears, ask who added
transform-runtime.

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

## What a release shipped is in its lockfile, not its version range

`git show v4.3.0:pnpm-lock.yaml | grep -A2 'gff-nostream:'`. A `package.json` range
says what would resolve today; pnpm builds from the lockfile, and the two can be
several versions apart during a run of fast patch releases. `gff-nostream`
3.0.6-3.0.9 dropped shared-ID CDS continuation lines, but `@jbrowse/plugin-gff3@4.3.0`
pinned 3.0.5 in its lockfile, so no release carried the bug. A common data shape
breaking in a release is *loud*, so a claim that a release silently mangled it is far
more likely wrong than the silence is.
