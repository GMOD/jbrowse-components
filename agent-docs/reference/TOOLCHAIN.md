---
name: toolchain
description: How do the TypeScript 6/7 split, the oxlint/eslint split, project references, worktree installs and dependency pruning work, and what breaks silently? Read before changing a TypeScript version, a tsconfig references array, a lint rule or a disable comment.
audience: internal
kind: operations
---

# Toolchain

The dev loop runs two TypeScript versions and two linters on purpose, each split
for a reason below. Don't "fix" either by unifying them. The sections after them
cover the worktree install, generated files and dependency pruning, where gates
fail for a stale checkout rather than the code.

## Why two TypeScript versions

- **The eslint backstop needs 6.x.** `pnpm lint` is oxlint (type-aware via tsgolint, which
  uses its own TS7-based checker and does NOT read the ambient `typescript`). The CI backstop
  `pnpm lint:eslint` still parses with `@typescript-eslint`, whose `ts-api-utils` peer range is
  `<6.1.0`, so bumping the ambient `typescript` breaks it. (The backstop is type-info-free; it
  only needs the parser to install.)
- **Typecheck wants 7.x for speed.** `pnpm typecheck` runs `scripts/typecheck.ts`, which picks
  the checker count and calls the aliased `typescript7` devDependency (`npm:typescript@7`) by
  path. Use `pnpm typecheck`, never a bare `tsc`.
- **`build:esm` uses 7.x too**, invoking `node ../../node_modules/typescript7/bin/tsc --build
  tsconfig.build.esm.json` by path. Emit is byte-identical to 6.x and ~3x faster on a
  single-package rebuild.

The two versions write **incompatible** `.tsbuildinfo`; each discards the other's and does a full
rebuild. That is safe but makes an incremental cache worthless across a version switch, so don't
share a `.tsbuildinfo` CI cache between them. `products/jbrowse-cli` still runs ambient 6.x
(`tsc -p tsconfig.build.json`); it is not a `build:esm` package.

## The rule

Keep `typescript` on 6.x and `typescript7` as the aliased 7.x. Once typescript-eslint ships TS7
support, drop the alias, bump `typescript` itself to 7, and delete
`scripts/check-typescript-pin.ts` in the same commit. `pnpm check-typescript-pin` enforces both
halves over **every workspace manifest**, not only the root's: a bump that fixed only the root left
the other `typescript`-declaring manifests (`website`, the `examples-site` packages) failing `pnpm
lint`, because TypeScript 7's package entry is a stub whose `require('typescript')` yields only
`{version, versionMajorMinor}`, which tsgolint reads as `ts.Node` being an error type rather than
as a missing install.

## Project references

Every `tsconfig.build.esm.json` is `extends` plus a `references` array mirroring its package.json
`workspace:` deps, nothing else. Compiler options live in `tsconfig.base.esm.json` (using
`${configDir}` so `outDir`, `rootDir`, `include` and `exclude` resolve against the extending
package); node-importing packages extend `tsconfig.base.esm.node.json`, and the generator decides
which. `tsconfig.build.json` at the root is the solution file.

Without references each package resolves workspace deps to **source** (`main` is `src/index.ts`),
so `tsc` re-parses each dependency's whole tree once per dependent (a 14-file plugin loaded ~2,800
files; a cold whole-repo build fell from ~94s to ~14s). **Don't hand-edit these files**: `pnpm
gen-tsconfig-refs` writes each whole from package.json and CI runs it with `--check`. A per-package
compiler option belongs in one of the two base configs.

## Module augmentations must be reachable from the package entry

The one real constraint references impose: a `declare module` block (`ExtensionPointRegistry`,
`RpcRegistry`) only applies in programs that load the declaring file. Within a package that is
automatic; across packages a consumer sees only the `.d.ts` files reachable from its dependency's
entry. Put cross-package augmentations in a file the package entry re-exports a named binding from
(a feature-level `index.ts`, or the `model.ts` defining the referenced type). `import type {} from
'./X.ts'` does **not** work: TS elides binding-less imports from declaration emit.

Symptoms: `TS2488 Type 'unknown' must have a '[Symbol.iterator]()' method` at an
`addToExtensionPoint` callback (the overload fell back to the untyped signature), or on an
accumulating point `contributeToExtensionPoint` rejecting the name outright (an unseen registry
entry leaves it out of `AccumulatingPointName`).

## Linting: who owns what

Four tools, and the split is deliberate.

| tool | runs | owns |
| --- | --- | --- |
| `oxlint` (`pnpm lint:fast`) | pre-commit, CI | correctness, react, unicorn subset, jest, import |
| `oxlint --type-aware` (`pnpm lint`) | pre-commit, CI | the above plus tsgolint's type-aware set |
| `eslint` (`pnpm lint:eslint`) | CI only | react-compiler, @eslint-react, unicorn denylist, the `no-restricted-syntax` guards, astro |
| `oxfmt` | pre-commit, CI | all formatting and import order |

`eslint.config.mjs` carries the reasoning for its own half. This section holds
what does not fit in a config comment, plus the facts about `.oxlintrc.json`.

### `.oxlintrc.json` cannot carry comments

oxlint accepts JSONC, but `eslint.config.mjs` imports the file with
`with { type: 'json' }` to share `ignorePatterns`, and that is a strict
`JSON.parse`. A `//` comment breaks `pnpm lint:eslint` with a parse error that
does not name the comment. A `"//key"` string entry fails too: oxlint reads
every key under `rules` as a rule name. Rationale for an oxlint rule goes in its
commit message.

### Neither linter can report unused disable directives

Both read the same `eslint-disable` comments, and each runs only part of the
rule set, so each sees the other's suppressions as unused. eslint sets
`reportUnusedDisableDirectives: 'off'`; `oxlint --report-unused-disable-directives`
mostly reports eslint-owned rules. Suppressions that suppress nothing therefore
accumulate. The fix is to migrate oxlint-owned suppressions to `oxlint-disable`
and then turn oxlint's check on. Until then, sweep by hand: run oxlint's check,
then filter by which config enables each rule.

**`eslint-disable-next-line` means the next line.** A directive followed by more
comment lines applies to the comment and fails silently. Put the prose first and
the directive last.

### Rules measured and rejected

Each was read site by site. Do not re-propose without new evidence.

- **`unicorn/no-useless-spread`**: autofixable and wrong on every site read.
  `[...someUint32Array.slice(0, n)]` spreads to turn a TypedArray into a
  `number[]` for `toEqual`; the rule reads `.slice()` as returning an Array.
- **`unicorn/no-unsafe-string-replacement`**: the sites that could meet a `$` in
  data take a replacer function; the rest replace with a constant or use `$1`
  on purpose.
- **`unicorn/prefer-combined-guards`**: the fixer declines guards that each carry
  a comment, and `||`-merging the rest fuses unrelated exits.
- **`unicorn/no-immediate-mutation`**: the only rewrite of
  `const xs = []; if (c) xs.push(y)` is `[...(c ? [y] : [])]`, which unicorn will
  not apply in `.ts`.
- **`unicorn/prefer-iterator-zip`**: neither Node nor TypeScript's lib has
  `Iterator.zip`.
- **`unicorn/require-post-message-target-origin`**: `Worker.postMessage`'s second
  parameter is the transfer list, so the fix throws; the one-argument
  `Window.postMessage` already defaults to same origin.
- **`@eslint-react/naming-convention-ref-name`**: wants every `useRef` named
  `*Ref`; ours hold latch values.
- **`@eslint-react/use-state`**: `const [, forceRender] = useState(0)` is the
  force-render idiom.
- **`@eslint-react/set-state-in-effect`**: every site is the reset half of
  fetch-into-state, which cannot be derived during render.
- **jest's default correctness set**: `expect-expect` cannot see
  `assertCanvasHasContent` / `expectCanvasMatch`; `no-conditional-expect` fires on
  branch-then-assert snapshot suites; `no-standalone-expect` flags `expect` in
  `beforeAll`, where suites fail fast on setup; `no-export` flags type-level
  assertions exported so tsc keeps checking them. Five rules are on.

### Array sort comparators are oxlint's

`typescript/require-array-sort-compare` is on with tests exempt;
`unicorn/require-array-sort-compare` is off. The type-aware rule skips
`string[]`; the untyped one flags every sort it cannot type, nearly all of them
string sorts. A test is exempt because a lexicographic sort of numbers fails its
`toEqual` visibly.

### oxlint's react-compiler port is off

oxlint's `react/react-compiler` reports the broader "Rules of React" set, where
`eslint-plugin-react-compiler` reports compilation bailouts, so the two barely
overlap. Every finding on this tree was read and none was a bug.

Most findings are one analysis bug: once a hook returns a ref inside an object,
oxlint treats every property of that object as a ref, so reading a `useState`
value off it is "Cannot access refs during render". Destructuring the same
return (`const { ref, value } = useThing()`) is clean.

The rule is unusable while `useNoteDraft`, `RenderCanvas`'s handle and
floating-ui's `refs` return that shape. Retry after an oxlint upgrade.

The remaining findings are deliberate:

- **`ref.current = value` during render** (`useFetch`, `useDockviewController`)
  is the latest-ref mirror, so the fetch effect depends on the serialized key
  alone. An effect write reorders after the effect that reads it, and
  `useEffectEvent` is banned because it stales inside `observer()`.
- **Lazy ref init** (`storeRef.current ??= …`) is the form React's docs give.
- **A module `let` assigned by a test harness component** is how a hook gets
  exercised; test files only.
- **`MemoDependencies`** is react-compiler's own bookkeeping; `exhaustive-deps`
  reports nothing on the same callbacks.
- **A ref written from an event handler** (`useAlignmentsBase`) is what refs are
  for.
- **`StaticComponents` in `TrackControl`** is a registry lookup, which is also why
  `@eslint-react/static-components` is off.

### Why `@eslint-react` is still installed

oxlint covers `no-array-index-key`, `jsx-key`, `rules-of-hooks`,
`exhaustive-deps`, `no-danger` and `no-unstable-nested-components`. The plugin
still uniquely provides `no-nested-lazy-component-declarations`, `purity`,
`error-boundaries`, `unsupported-syntax` and `no-unnecessary-use-prefix`.
Removing it would also delete every disable comment that names its rules.

## Check what your worktree branched from before trusting a gate in it

`EnterWorktree`'s base ref is **origin**'s default branch, which can be a day behind local `main`,
so a gate fails on a fix your branch predates and reads as "my edit broke it".

```sh
git merge-base --is-ancestor main HEAD && echo ok || git reset --hard main
```

`reset --hard` is right only before you have commits of your own; after that `git rebase main` is
the same check and makes the landing a fast-forward. The tell is a `git diff main` naming files you
never opened (`git log main..HEAD -- <path>` distinguishes). For "does release X have symbol Y",
`git ls-remote --tags origin` then `git cat-file -e <tag>:<path>` beats a browser probe; use
`ls-remote`, not local tags.

## A hand-made worktree is not an installed one

`EnterWorktree` installs; `git worktree add` does not, and typecheck dies without the gitignored
`buildInfo.ts` the install writes. Don't symlink `node_modules` from the primary checkout: the
per-package `@jbrowse/*` links are relative, so cross-package imports resolve back to its sources.

The install also does not bring:

- **Figures.** `pnpm figures:pull`, or symlink both gitignored corpora (the website's `static/img`
  and jbrowse-img's `img`). Without them `pnpm autogen` **skips** the two generators that read a
  corpus and names them in its summary, so `pnpm verify --full` goes green without checking the
  jbrowse-img doc or the social card. The skip is per corpus and all-or-nothing.
- **`.cache/slangc`.** `pnpm gen:shaders` silently re-downloads a 15MB binary per worktree; point
  it at the primary's copy: `SLANGC=<primary-checkout>/.cache/slangc/bin/slangc pnpm gen:shaders`.
  `build-shaders.ts` checks the handed binary's version against its pin, since a mismatched slangc
  re-emits every shader rather than failing.

**Regenerating a figure needs no web build of your own** when the change is to a spec, not app
code: symlink the primary's `products/jbrowse-web/build` beside `static/img` and run `node
website/scripts/generate-screenshots.ts --filter <spec>` (the generator serves that build's
`test_data`). Check its `version.txt` date first (the wrong app to shoot a plugin or display
change against). **A borrowed build can be mid-rebuild**: `pnpm build` empties `build/` before it
writes, so a run pointed at another agent's build dies part-loaded. `website/scripts/*.ts` needs
`puppeteer`, which is not hoisted to the root; resolve it from `packages/browser-test-utils/`.

## `TS2307` on a `@jbrowse/*` subpath is a missing link, never a missing build

A rebase that picks up a **new workspace package** leaves the worktree's install behind: that
package gets no `node_modules`, so every `@jbrowse/*` import inside it and every importer of it
fails to resolve (one new package reads as a hundred errors across three you never touched). `pnpm
install` fixes it in seconds; `pnpm build` also "fixes" it, because pnpm verifies deps first, but
takes ten minutes and teaches the wrong cause.

**A plain dependency bump does the same more quietly**, with no `TS2307`: a rebased worktree still
holds the old package and typechecks against it, reporting errors the bump already fixed ("main is
red"). Run `pnpm install --frozen-lockfile` in the worktree.

It cannot be a stale `esm/`: in the workspace `@jbrowse/core`'s exports point at `./src/**.ts` and
only `publishConfig.exports` point at `esm/`, so **tsc reads a sibling package's source**. The
exception is running jbrowse-img's CLI from source, which needs `pnpm build`:
`products/jbrowse-img/src/resolve.ts` redirects workspace `src` → `esm` because
`node --experimental-strip-types` erases types but will not transform JSX.

## What `pnpm autogen` owns

It rewrites every generated-and-committed artifact and answers almost any "X is out of date" CI
failure: `package.json` `exports` maps, `tsconfig.build.esm.json` `references`, and the JSDoc doc
tables. Never hand-edit those. Shaders belong to `pnpm gen:shaders` (SHADER_JS_CODEGEN.md).

`pnpm format` is safe bare (it rewrites only mis-formatted files; scoping it risks missing a file
a repo-wide `--fix` just rewrote). But `agent-docs` is on `.prettierignore` and **naming it
explicitly overrides that**, rewrapping thousands of lines of prose.

**`pnpm autogen` needs a clean tree.** `pnpm gendocs` resolves sources through the `@jbrowse/*`
workspace links, so in a shared worktree it emits `f(everyone's dirty tree)` and then fails the CI
check, which regenerates from committed source. A temp worktree does not escape it: symlinking the
real `node_modules` makes pnpm's workspace entries resolve back to the dirty main checkout. Run it
on a clean tree and commit the output by itself.

## A `dependencies` entry can be load-bearing without being imported

"No package in this repo imports it" starts the argument about a dead dependency and does not end
it. Four classes are real requirements no import statement records:

- **Peer satisfaction.** `@jbrowse/core` declares `react` and `react-dom` as peers and
  `@mui/material` declares `@emotion/*`; a consumer must install them. `jbrowse-img` is a pure CLI
  with no `.tsx` and still needs both React packages because the plugins it renders through do.
- **Implicit `@types`.** `tsc` picks up `@types/jsdom` because something imports `jsdom`. Check the
  *base* package, but note the base is sometimes not installable at all: `@types/aws-lambda` types
  the AWS *runtime*, and `@types/hast` / `@types/mdast` type syntax-tree specs imported as `import
  type { Root } from 'mdast'`.
- **Resolved by name at build time.** `@iconify-json/mdi` is loaded by `astro-icon` because an
  `.astro` file wrote `<Icon name="mdi:github"/>`.
- **Invoked as a CLI.** `@astrojs/check` exists so `astro check` runs.

What remains after those is worth removing, since a published `dependencies` entry is an install
every consumer pays for. **`@babel/runtime` is only needed with
`@babel/plugin-transform-runtime`**, which `babel.config.cjs` has never configured, so nothing here
can emit a `@babel/runtime` import and it is absent from the workspace; if it reappears, ask whether
someone added transform-runtime, not whether the package is used.

When one goes:

- **Re-run `scripts/generate-tsconfig-references.ts`**: a workspace dependency has a derived project
  reference that is stale the moment the dep leaves.
- **Check nothing was leaning on it.** Removing a dep another package imports without declaring turns
  a working install into a hoisting accident. Grep the importers and confirm each declares it.
- Use `pnpm install --lockfile-only` in a shared worktree (a full install re-links every package
  under whatever else is mid-build).
- **Confirm the prune before believing a green typecheck.** pnpm keeps a per-package `node_modules`
  of symlinks, and typecheck fails on a removed dep only once its symlink is gone. Which step pruned
  it is not worth reasoning about; look, with a control:

  ```sh
  ls -d plugins/breakpoint-split-view/node_modules/@gmod/vcf   # gone?
  ls -d plugins/breakpoint-split-view/node_modules/@jbrowse/alignments-core  # control: still there?
  ```

  An empty first result means nothing unless a dep you kept is still linked.

## What a release shipped is in its lockfile, not its version range

```sh
git show v4.3.0:pnpm-lock.yaml | grep -A2 'gff-nostream:'
```

A `package.json` range says what *would* resolve on a fresh install today; pnpm builds from the
lockfile, and the two can be several versions apart, widest during a run of fast patch releases
(when a bug is most likely to have landed and been fixed inside one). `gff-nostream` 3.0.6-3.0.9
silently dropped shared-ID CDS continuation lines; `@jbrowse/plugin-gff3@4.3.0` declared `^3.0.5`,
which resolved to 3.0.9 on publish day, yet its lockfile pinned 3.0.5, so no release carried the bug
(`main` did). The prior worth keeping: a common data shape breaking in a release is *loud* (shared-ID
CDS is most of GENCODE and RefSeq), so a claim that a release silently mangled it is far more likely
wrong than the silence is.
