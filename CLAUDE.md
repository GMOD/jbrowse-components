# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU, with WebGL
and Canvas2D fallbacks). Worker output is **absolute genomic uint32** — no
regionStart-relative arithmetic crosses the worker boundary.

Background lives in `agent-docs/` (start at `ARCHITECTURE.md`, then `reference/`
and the ADRs).

## Git

General worktree workflow is in `~/.claude/CLAUDE.md`. What differs here:

- **Never `git stash`, worktree or not — this overrides the general rule.** The
  stack is repo-global, so `git stash pop` routinely takes another agent's work.
  To test a tree without your changes, `git diff main -- <path>`.
- **Never merge a `*.generated.ts` conflict — regenerate it.** Take either side,
  re-run the generator, `git add`.

**A worktree from `EnterWorktree` arrives installed**; one made by hand with
`git worktree add` does not, and `tsc` dies without the gitignored
`buildInfo.ts` the install writes. Don't symlink `node_modules` from the primary
checkout — the per-package `@jbrowse/*` links are relative, so cross-package
imports would resolve to its sources.

Figures are the one thing the install does not bring — `pnpm figures:pull`, or
symlink both gitignored corpora (`website/static/img`,
`products/jbrowse-img/img`). Miss the second and `pnpm autogen` **dies** on the
jbrowse-img generator rather than reporting it stale, so every later generator
silently never runs. `website/scripts/*.ts` needs `puppeteer`, not hoisted to
the root — resolve it from `packages/browser-test-utils/`.

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream.
- Keep the main model chain in one file; don't split `.views()`/`.actions()`
  across files.
- A bare getter returns a resolved value, never `undefined`. Where a prop
  encodes a sentinel (`rowHeight === 0` = fit-to-height), expose the resolved
  value under a distinct getter every consumer reads (`effectiveRowHeight`) —
  `agent-docs/reference/ROW_HEIGHT_AND_FIT.md`.
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only through `resolveConf`, never `getConf`.
- In React, `autorun` inside `useEffect` to track observables (prefer over
  `reaction`).
- **Never `destroy` a node React may still be rendering — `detach` it, then
  destroy it on a later task** (`scheduleDetachedDestroy`). React reads outgoing
  props after effect cleanup and MobX runs reactions at the action's `endBatch`,
  so a destroy in either place gets read: a liveliness warning on an
  already-read property, a hard throw on a child node never materialized.
  Register anything reaching outside the tree as a detach-time disposer.
  Deferring _instead of_ detaching does not work.

  **The destroy half is not optional and is the half that gets dropped.**
  `beforeDestroy`/`addDisposer` are a plugin-facing contract that fires on
  destroy and nothing else, so a tree left detached and alive is a silent leak
  of everything under it. ADR-069.

- **An `autorun` must do its own reads. MST actions run untracked**, so
  factoring its body into an action leaves the autorun with no dependencies: it
  fires once, then never again, silently. Same trap for
  `self.someAction(getSnapshot(self))`. Duplicate the reads instead and say why.
- **Export a model's instance type as `interface X extends Instance<…> {}`**,
  not `type X = Instance<…>`. A view naming its displays and a display naming
  its view is a mutual reference only the interface form defers; as aliases the
  pair collapses into TS7023/TS2456 plus ~20 implicit-any errors in unrelated
  files, which is what you'll see first. ADR-055.
- A duck-typed `interface XSelf` extends **`IStateTreeNode`**, never
  `IAnyStateTreeNode` — the latter resolves to `any`, silently turning off
  checking for every member you just declared.

## React Compiler × MobX

`babel-plugin-react-compiler` does not compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way. The
`function F(){}; observer(F)` form does get compiled and can stale a MobX read.

## Reference names: one normalization layer

**Any reading of user-supplied refName text resolves through
`getCanonicalRefName`**, which handles aliases _and_ casing; testing
`region.refName` directly gets neither, and the failure is indistinguishable
from "this assembly has no such contigs". For anything matching refName text:

- **Match over `allRefNames`, not `regions`** — it is a strict superset of the
  canonical names.
- **Resolve hits to canonical, then emit by walking `regions`**, which keeps
  assembly order and dedupes several names for one contig.
- **Case-insensitivity is the regex's `i` flag, not a wider list.**

`selectNamedRegions.ts` holds the only two readings of `*`, and `globToRegExp`
is module-private to keep it that way.

**A display reading a refName out of its own state calls
`canonicalizeViewRefName`** (`@jbrowse/core/util`). A menu copy and a search
result are canonical by construction; a **session spec, config slot or URL** is
whatever a person typed. It falls back to the input before aliases load, since
`getCanonicalRefName` throws until then and these getters run from the first
render. Normalize once where the state is read, not at each comparison. It is
assembly-dependent: `chr12` matches nothing on an assembly canonicalized `12`,
so a spec key works in the config it was written against and quietly does
nothing in the next.

**But only on the main thread.** `renameRegionsIfNeeded` rewrites `regions[]`
into the adapter's naming scheme in `serializeArguments`, so canonicalizing an
operand compared worker-side breaks exactly the aliased tracks the rule is for.
Check which side a comparison runs on — alignments layout looks worker-side and
is not (ADR-053). `agent-docs/reference/REFNAME_NAMESPACES.md` has the rest.

## Assembly names read off a track config: canonical, **and** screened

A track config's `assemblyNames` may name an alias, and may name an assembly the
session has no configuration for. Any such name reaching an **`AssemblySelector`
value** or a **view init** must be:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector` blanks a value that is not one of the session's own
  `assemblyNames`, so an alias renders as an empty field with nothing said. The
  matching helpers already canonicalize both sides, so an alias-named track is
  found and then hands over a name the form cannot show.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A missing name is not a blank
  row but a broken view: the init error sets the view's error, `showImportForm`
  reads it, and the user's stack is replaced by an import form.

Keep one derivation per path (`connectedEndpoints`, `syntenyTrackRows`). Nothing
renames assembly names at the RPC boundary, so there is no worker-side
exception.

## Tooling

- Tests are slow — run `pnpm test <directory>`, not the full suite, and in your
  own worktree: a full-suite run from the shared primary checkout **lies**,
  since other agents edit the tree mid-run. Lint with `--fix`.
- **Bare `pnpm format` is fine** — it rewrites only mis-formatted files, ~7s
  whole-tree. Scoping risks missing a file a repo-wide `--fix` just rewrote.
- **`agent-docs` is on `.prettierignore`, and naming it explicitly overrides
  that** — formatting that path rewraps 9k lines of prose.
- **`pnpm autogen` rewrites every generated-and-committed artifact** and is the
  answer to almost any "X is out of date" CI failure. It owns `package.json`
  `exports` maps, `tsconfig.build.esm.json` `references`, and the JSDoc doc
  tables — never hand-edit those.
- **Shaders are the exception: `pnpm gen:shaders`.** Edit the `.slang`, never
  the generated module; it regenerates every shader, so commit sources promptly
  in a shared checkout.
- **Check `gen:shaders`' EXIT CODE, not its output and not `git status`.** A
  `.slang` that fails to compile leaves its `.generated.ts` **untouched**, and
  `tsc` and jest pass off the stale module. Verify by grepping the emitted WGSL.
- **A pass naming a packed colour uniform must `import colorPack;` itself** —
  Slang does not re-export through an import, and this is the likeliest cause of
  a stale-generated case.
- Two TypeScript versions on purpose: `typescript` 6.x for lint, aliased
  `typescript7` for `pnpm typecheck`.
- The `@jbrowse/core/*` modules in `ReExports/modules.ts` are the ABI external
  plugins resolve against (`abi.test.ts` vs `abiBaseline.json`). Removals fail
  there; to drop a name, delete it from the baseline in the same commit and say
  which published plugins you checked.
- **The session is a second plugin-facing surface, and it fails quieter.**
  Plugins look members up behind `'x' in session`, so removing one throws
  nothing. `pluginFacingSessionApi.test.ts` pins what published bundles call.
- `demos/<name>/config.json` deploys via `scripts/deploy-demo.sh`. Never
  `aws s3 cp` a config from elsewhere — the bucket has no versioning.
