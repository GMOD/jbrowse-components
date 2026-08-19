---
name: toolchain
description: Why we deliberately run TypeScript 6.x for lint and an aliased typescript7 for typecheck and build:esm, why unifying them breaks the eslint backstop, plus the project-reference, module-augmentation and clean-tree rules that follow. Read before changing a TypeScript version, a tsconfig references array, or a package entry point.
audience: internal
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
itself to 7 — and delete `scripts/check-typescript-pin.ts` in the same commit.

`pnpm check-typescript-pin` enforces both halves over all 68 workspace
manifests, not just the root's. Six of them declare `typescript`: the root,
`website`, and the four `examples-site` packages. A bump moved all six to
`^7.0.2` at once and the follow-up fix caught only the root, so the other five
kept failing `pnpm lint` — TypeScript 7's package entry is a stub whose
`require('typescript')` yields `{version, versionMajorMinor}` and nothing else,
which reads to tsgolint as `ts.Node` being an error type rather than as a
missing install.

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

## Check what your worktree branched from before trusting a gate in it

`EnterWorktree`'s base ref is **origin**'s default branch, which with several
agents landing all day can be a whole day behind local `main`. So a gate fails
on a fix your branch predates, and reads as "my edit broke it".

```sh
git merge-base --is-ancestor main HEAD && echo ok || git reset --hard main
```

**`reset --hard` is only right before you have commits of your own**; from then
on `git rebase main` is the same check's answer and is also what makes the
landing a fast-forward. Run it again before landing. The tell is a `git diff
main` naming files you never opened — that is main's commits missing from your
branch, which `git log main..HEAD -- <path>` distinguishes.

**Prefer the cheap decisive check over a browser probe** for "does release X
have symbol Y": `git ls-remote --tags origin`, then
`git cat-file -e <tag>:<path>`. Use `ls-remote`, not local tags, or a stale
checkout answers "no release yet" forever.

## A hand-made worktree is not an installed one

`EnterWorktree` installs; `git worktree add` does not, and `tsc` dies without the
gitignored `buildInfo.ts` the install writes. Don't symlink `node_modules` from
the primary checkout — the per-package `@jbrowse/*` links are relative, so
cross-package imports resolve back to its sources.

Figures are one of two things the install does not bring: `pnpm figures:pull`,
or symlink both gitignored corpora — the website's `static/img` and jbrowse-img's
own `img`. Miss the second and `pnpm autogen` **dies** on the jbrowse-img
generator rather than reporting it stale, so every later generator silently
never runs.

The other is `.cache/slangc`. `pnpm gen:shaders` re-downloads a 15MB binary into
each worktree rather than failing, so the cost is silent — point it at the
primary checkout's copy instead:

```sh
SLANGC=<primary-checkout>/.cache/slangc/bin/slangc pnpm gen:shaders
```

`build-shaders.ts` checks the version of whatever it is handed — the pin lives
there, and a mismatched slangc re-emits every shader rather than failing, so a
borrowed binary from a tree on a different pin is refused.

**Regenerating a figure needs no web build of your own** when the change is to a
spec rather than to app code. `pnpm screenshots:build` runs `@jbrowse/web`'s
build first, which is minutes; symlinking the primary checkout's
`products/jbrowse-web/build` beside `static/img` and running
`node website/scripts/generate-screenshots.ts --filter <spec>` is seconds, and
the generator serves that build's `test_data` the same way. Check its
`version.txt` date first — it is whatever the primary checkout last built, which
is the wrong app to shoot a plugin or display change against.

**A borrowed build can also be mid-rebuild.** `pnpm build` empties `build/`
before it writes, so a screenshot run or a browser probe pointed at another
agent's build while that build is running dies part-loaded, in whatever way that
run reports a missing chunk. Wait for the build rather than overlapping them.

`website/scripts/*.ts` needs `puppeteer`, which is not hoisted to the root —
resolve it from `packages/browser-test-utils/`.

## `TS2307` on a `@jbrowse/*` subpath is a missing link, never a missing build

A rebase that picks up a **new workspace package** leaves your worktree's install
behind: that package gets no `node_modules` of its own, so every `@jbrowse/*`
import *inside* it fails to resolve and so does every importer of it. One new
package reads as a hundred errors across three you never touched. `pnpm install`
fixes it in seconds.

Reach for `pnpm build` and you will also "fix" it, because pnpm verifies deps
before running a script — ten minutes to do what the install did on the way in,
and it teaches you the wrong cause.

**A plain dependency bump does the same thing more quietly**, with no `TS2307` to
name it. The worktree installed at creation time, so once a bump lands on `main`
a rebased worktree still holds the old package and typechecks against it,
reporting errors that the bump you just rebased onto had already fixed. That
reads as "main is red" and has been reported as such. `pnpm install
--frozen-lockfile` in the worktree.

It cannot be a stale `esm/`, and the exports map is how you know: in the
workspace `@jbrowse/core`'s exports point at `./src/**.ts`, and only
`publishConfig.exports` point at `esm/`. **tsc reads a sibling package's source**,
so it never needs one built.

The exception is running jbrowse-img's CLI from source, which genuinely does
need `pnpm build`: `products/jbrowse-img/src/resolve.ts` redirects workspace
`src` → `esm` on purpose, because `node --experimental-strip-types` erases types
but will not transform JSX. Build for `bin.ts`, install for `tsc`.

## What `pnpm autogen` owns

It rewrites every generated-and-committed artifact and is the answer to almost
any "X is out of date" CI failure. It owns `package.json` `exports` maps,
`tsconfig.build.esm.json` `references`, and the JSDoc doc tables — never
hand-edit those. Shaders are the exception and belong to `pnpm gen:shaders`
(SHADER_JS_CODEGEN.md).

`pnpm format` is safe bare — it rewrites only mis-formatted files, ~7s
whole-tree, and scoping it risks missing a file a repo-wide `--fix` just
rewrote. But `agent-docs` is on `.prettierignore` and **naming it explicitly
overrides that**, rewrapping 9k lines of prose.

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
  package — and note the sharper version of that check ("is the base package
  declared anywhere in the workspace?") has its own false positives, because the
  base is sometimes not an installable package at all. `@types/aws-lambda` types
  the AWS *runtime*, and `@types/hast` / `@types/mdast` type syntax-tree *specs*
  that remark/rehype code imports as `import type { Root } from 'mdast'`. All
  four are real; only the types package ever exists.
- **Resolved by name at build time.** `@iconify-json/mdi` is never imported —
  `astro-icon` loads it because an `.astro` file wrote `<Icon name="mdi:github"/>`.
  A scanner sees the icon name, not the package.
- **Invoked as a CLI.** `@astrojs/check` exists so `astro check` runs, and only
  the script says so.

What is left after those is small and worth removing, since a published
`dependencies` entry is an install every consumer pays for. The four found in
the 2026-08-06 sweep were `@gmod/vcf` in breakpoint-split-view (surviving only
in a test *comment* describing breakend syntax), `@jbrowse/product-core` in
jbrowse-img and `@mui/icons-material` in jbrowse-react-app (each appearing
nowhere but its own `package.json`), and `@babel/runtime` in
jbrowse-react-linear-genome-view. Two prior removals in jbrowse-web are in
`ccdcf301cb`.

**`@babel/runtime` is only ever needed with `@babel/plugin-transform-runtime`,**
and `babel.config.cjs` has never configured it — the preset list is
react/env/typescript plus `babel-plugin-react-compiler`. So nothing in this repo
can emit a `@babel/runtime` import, which is why the two sibling products
(react-app, react-circular-genome-view) build the same `config/webpack/umdConfig.mjs`
UMD bundle without declaring it. It is now absent from the whole workspace; if
one reappears, the question is whether someone added transform-runtime, not
whether the package is used.

Two things to do when one goes:

- **Re-run `scripts/generate-tsconfig-references.ts`.** A workspace dependency
  has a project reference derived from it, so the reference is stale the moment
  the dep leaves — see § Project references.
- **Check nothing was leaning on it.** Removing a dep another package imports
  without declaring turns a working install into a hoisting accident that breaks
  on someone else's package manager. Grep for the importers and confirm each
  declares it.

`pnpm install --lockfile-only` is the gentle way to update the lockfile in a
shared worktree, since a full install re-links every package under whatever else
is mid-build. It produces a clean diff — the 2026-08-06 sweep's was exactly the
three removed entries, with no re-resolution churn.

**Then confirm the prune actually happened before believing a green typecheck.**
pnpm keeps a per-package `node_modules` of symlinks, and typecheck can only fail
on a removed dep once that symlink is gone; while it is there, tsc resolves the
import and the check proves nothing. `--lockfile-only` says it updates only the
lockfile, and yet on pnpm 11.18 the three symlinks were gone afterwards, with a
following full install reporting "Already up to date" in 237ms — so which step
pruned them is not worth reasoning about. Just look:

```sh
ls -d plugins/breakpoint-split-view/node_modules/@gmod/vcf   # gone?
ls -d plugins/breakpoint-split-view/node_modules/@jbrowse/alignments-core  # control: still there?
```

The control matters: an empty result means nothing unless a dep you kept is
still linked. With both confirmed, typecheck is a real check. Without it, the
greps are carrying the whole claim.

## What a release shipped is in its lockfile, not its version range

To answer "does version X have this fix?", read the tag's lockfile:

```sh
git show v4.3.0:pnpm-lock.yaml | grep -A2 'gff-nostream:'
```

A `package.json` range says what *would* resolve on a fresh install today. pnpm
builds from the lockfile, so the range and what actually shipped can be several
versions apart, and the gap is widest exactly when it matters — during a run of
fast patch releases, which is when a bug is most likely to have landed and been
fixed inside one.

This is not hypothetical. `gff-nostream` 3.0.6–3.0.9 silently dropped shared-ID
CDS continuation lines, so a GENCODE transcript parsed to one CDS of its four
while every exon survived, and consumers translating from the full CDS set got a
short protein with no error. `@jbrowse/plugin-gff3@4.3.0` declares `^3.0.5`,
which resolved to 3.0.9 on the day it was published — from which it follows, and
is wrong, that the release shipped the bug. Its lockfile pinned **3.0.5**, two
versions below the window. No release ever carried it; `main` did, for thirteen
days. Reasoning from the range produced a confident wrong answer twice before
anyone opened the lockfile.

The prior worth keeping alongside the command: a common data shape breaking in a
release is *loud*. Shared-ID CDS is most of GENCODE and RefSeq. If a claim
implies a release silently mangled that and nobody noticed, the claim is far more
likely wrong than the silence is.
