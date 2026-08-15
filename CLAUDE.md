# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU, with WebGL
and Canvas2D fallbacks). Worker output is **absolute genomic uint32** — no
regionStart-relative arithmetic crosses the worker boundary.

Background lives in `agent-docs/` (start at `ARCHITECTURE.md`, then `reference/`
and the ADRs).

## Git

The general worktree workflow is in `~/.claude/CLAUDE.md`. What differs here:

- **Never `git stash`, worktree or not — this overrides the general rule.** The
  stack is repo-global, so `git stash pop` routinely takes another agent's work.
  To test a tree without your changes, `git diff main -- <path>`.
- **Never merge a `*.generated.ts` conflict — regenerate it.** Take either side,
  re-run the generator (see Tooling), `git add`.
- Land with `git -C ~/src/jbrowse-components merge --ff-only <branch>`.
  `git push . HEAD:main` refuses here, and `update-ref` on a checked-out dirty
  `main` desynchronises its index from its worktree.

**A worktree from `EnterWorktree` arrives installed** — the `WorktreeCreate`
hook runs `pnpm install --frozen-lockfile`, which writes the gitignored
`products/jbrowse-web/src/buildInfo.ts` that `tsc` dies without. One made by
hand with `git worktree add` gets none of that; run the install yourself. Don't
symlink `node_modules` from the primary checkout — the per-package `@jbrowse/*`
links are relative, so cross-package imports would resolve to its sources.

Figures are the one thing the install does not bring — `pnpm figures:pull`, or
symlink the two gitignored corpora:

```
ln -s ~/src/jbrowse-components/website/static/img website/static/img
ln -s ~/src/jbrowse-components/products/jbrowse-img/img products/jbrowse-img/img
```

Miss the second and `pnpm autogen` **dies** on the jbrowse-img generator rather
than reporting it stale, so every later generator silently never runs. Every
`website/scripts/*.ts` needs `puppeteer`, which is not hoisted to the root —
resolve it from `packages/browser-test-utils/`
(`createRequire(<that>/package.json)`).

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream.
- Keep the main model chain in one file; don't split `.views()`/`.actions()`
  across files.
- A bare getter returns a resolved value, never `undefined`. Where a prop
  encodes a sentinel (`rowHeight === 0` = fit-to-height), expose the resolved
  value under a distinct getter every consumer reads (`effectiveRowHeight`). See
  `agent-docs/reference/ROW_HEIGHT_AND_FIT.md`.
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only through `resolveConf`, never `getConf`.
- In React, `autorun` inside `useEffect` to track observables (prefer over
  `reaction`).
- **Never `destroy` a node React may still be rendering — `detach` it, then
  destroy it on a later task** (`scheduleDetachedDestroy`). React reads outgoing
  props after effect cleanup, and MobX runs reactions at the action's
  `endBatch`, so a destroy in either place gets read: a liveliness warning on an
  already-read property, a hard throw on a child node never materialized.
  Register anything reaching outside the tree as a detach-time disposer.
  Deferring _instead of_ detaching does not work.

  **The destroy half is not optional and is the half that gets dropped.**
  `beforeDestroy`/`addDisposer` are a plugin-facing contract that fires on
  destroy and nothing else (jbrowse-plugin-apollo closes its websocket there),
  so a tree left detached and alive is a silent leak of everything under it.
  ADR-069.

- **An `autorun` must do its own reads. MST actions run untracked**, so
  factoring its body into an action — the obvious way to share it with a menu
  item — leaves the autorun with no dependencies: it fires once, then never
  again, silently. Same trap for `self.someAction(getSnapshot(self))`, which
  works only because the snapshot is taken before the action is entered.
  Duplicate the reads instead and say why.
- **Export a model's instance type as `interface X extends Instance<…> {}`**,
  not `type X = Instance<…>`. A view naming its displays and a display naming
  its view is a mutual reference only the interface form defers; as aliases the
  pair collapses into TS7023/TS2456 plus ~20 implicit-any errors in unrelated
  files, which is what you'll see first. Don't route around it by duck-typing
  the view. ADR-055.
- A duck-typed `interface XSelf` extends **`IStateTreeNode`**, never
  `IAnyStateTreeNode` — the latter resolves to `any`, silently turning off
  checking for every member you just declared.

## React Compiler × MobX

`babel-plugin-react-compiler` does not compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way. The
`function F(){}; observer(F)` form does get compiled and can stale a MobX read.

## Reference names: one normalization layer

**Any reading of user-supplied refName text resolves through
`getCanonicalRefName`, or it silently disagrees with the readings that do.** It
resolves aliases _and_ casing
(`refNameAliases[n] || lowerCaseRefNameAliases[n.toLowerCase()]`); testing
`region.refName` directly gets neither, and the failure is indistinguishable
from "this assembly has no such contigs". For anything matching refName text:

- **Match over `allRefNames`, not `regions`** — `buildRefNameMaps` identity-maps
  every region into `refNameAliases`, so it is a strict superset of the
  canonical names.
- **Resolve hits to canonical, then emit by walking `regions`**, which keeps
  assembly order and dedupes several names for one contig.
- **Case-insensitivity is the regex's `i` flag, not a wider list.**
  `allRefNames` deliberately excludes `lowerCaseRefNameAliases`.

`selectNamedRegions.ts` holds the only two readings of `*` — the session-spec
resolver and `matchRefNames` (the search box's dropdown and enter key) — and
`globToRegExp` is module-private to keep it that way.

### A display reading a refName out of its own state calls `canonicalizeViewRefName`

Two of the three ways a refName reaches a display are safe by construction: a
right-click or center-line menu copies it off the region it hit, and a text
search goes through a producer that canonicalizes. The third — **session spec,
config slot or URL** — carries whatever a person typed, against regions, blocks
and loaded spans that are all canonical.

`canonicalizeViewRefName(node, refName)` (`@jbrowse/core/util`) resolves against
the containing view's assembly, falling back to the input before the aliases
load (`getCanonicalRefName` **throws** until then, and these getters run from
the first render). Normalize once where the state is read — a getter, or the
autorun's single choke point — not at each comparison.

It is assembly-dependent: `chr12` is right on an assembly canonicalized `chr12`
and matches nothing on one canonicalized `12`, so the same spec key works in the
config it was written against and quietly does nothing in the next.

**But only on the main thread.** `renameRegionsIfNeeded` rewrites `regions[]`
into the adapter's naming scheme inside `serializeArguments`, so canonicalizing
an operand that is compared worker-side breaks exactly the aliased tracks the
rule above is for. Check which side a comparison runs on first — alignments
layout looks worker-side and is not (ADR-053).
`agent-docs/reference/REFNAME_NAMESPACES.md` has the two namespaces and the four
shapes the worker layer already uses.

## Assembly names read off a track config: canonical, **and** screened

A track config's `assemblyNames` is free to name an alias, and free to name an
assembly the session has no configuration for. Any such name reaching an
**`AssemblySelector` value** or a **view init** must be:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector` blanks a value that is not one of the session's own
  `assemblyNames`, so an alias renders as an empty field with nothing said. The
  matching helpers (`getSyntenyTracks`, `getSharedTracks`) already canonicalize
  both sides, so an alias-named track is found and then hands over a name the
  form cannot show.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A missing name is not a blank
  row but a broken view: the init fails with "Assembly X not found", which sets
  the view's error, and `showImportForm` reads that error — so the user's stack
  is replaced by an import form. `SessionAssemblies` (core, next to
  `AssemblyNameResolver`) is the slice.

Keep one derivation per path: `connectedEndpoints` for "extend the stack from
this row", `syntenyTrackRows` for "the rows this track implies".

Nothing renames assembly names at the RPC boundary, so there is no worker-side
exception here.

## Tooling

- Tests are slow — run `pnpm test <directory>`, not the full suite. A full-suite
  run from the shared primary checkout also _lies_: other agents edit the tree
  mid-run, so an unrelated suite fails each time. Judge your change by a scoped
  run in your own worktree. Lint with `--fix`.
- **Your test runs get 2 jest workers, deliberately — don't raise it.**
  `jest.config.js` reads `CLAUDECODE`; the point is the machine-wide total,
  which no per-run config can see. `JEST_MAX_WORKERS=<n>` overrides it for one
  command, but a scoped `pnpm test <dir>` is nearly always the better answer.
- **`jest.config.js`'s `.claude/` ignore is load-bearing — don't re-diagnose
  it.** Without it a nested agent worktree gives jest-haste-map duplicate
  `plugins/*/package.json`, failing every cross-package suite.
- **Bare `pnpm format` is fine** — `oxfmt` and the `postformat` prettier pass
  leave already-formatted files alone, so a whole-tree run costs ~7s and touches
  exactly the mis-formatted set. Scoping risks missing a file a repo-wide
  `--fix` just rewrote.
- **`agent-docs` is on `.prettierignore`, and naming it explicitly overrides
  that** — formatting that path rewraps 9k lines of prose. Never do it.
- **`pnpm autogen` rewrites every generated-and-committed artifact** and is the
  answer to almost any "X is out of date" CI failure. It owns `package.json`
  `exports` maps, `tsconfig.build.esm.json` `references`, and the doc tables
  built from JSDoc tags — never hand-edit those.
- **Shaders are the exception: `pnpm gen:shaders`, not `autogen`.** Edit the
  `.slang`, never the generated module. It regenerates every shader in the repo,
  so commit sources promptly in a shared checkout.
- **Check `gen:shaders`' EXIT CODE, not its output and not `git status`.** A
  `.slang` that fails to compile leaves its `.generated.ts` **untouched**, which
  looks exactly like a file that needed no regen — and `tsc` and jest pass off
  the stale module. Verify a shader edit by grepping the emitted WGSL for what
  you changed.
- **A pass naming a packed colour uniform must `import colorPack;` itself.**
  Slang does not re-export through an import, so `import alignmentsUniforms` is
  not enough to call `unpackRGBA` — the likeliest cause of a stale-generated
  case.
- Two TypeScript versions on purpose: `typescript` 6.x for lint, aliased
  `typescript7` for `pnpm typecheck`. Don't unify them. Use `--checkers 1`;
  TypeScript 7 memory usage from many parallel checkers is high.
- The `@jbrowse/core/*` modules in `ReExports/modules.ts` are the ABI external
  plugins resolve against, guarded by `ReExports/abi.test.ts` against
  `abiBaseline.json`. Removals fail there; additions don't. To drop a name,
  delete it from the baseline in the same commit and say in the message which
  published plugins you checked.
- **The session is a second plugin-facing surface, and it fails quieter.**
  Plugins look members up at runtime, often behind `'x' in session`, so removing
  one throws nothing — the plugin just silently does less.
  `jbrowse-web/src/tests/pluginFacingSessionApi.test.ts` pins the members
  published bundles call.
- `demos/<name>/config.json` deploys via `scripts/deploy-demo.sh`. Never
  `aws s3 cp` a config from elsewhere — the bucket has no versioning, so an
  overwrite that drops a track is unrecoverable.
