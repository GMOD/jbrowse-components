# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU, with WebGL
and Canvas2D fallbacks). Worker output is **absolute genomic uint32** — no
regionStart-relative arithmetic crosses the worker boundary.

Background lives in `agent-docs/` (start at `ARCHITECTURE.md`, then `reference/`
and the ADRs).

## Git

The general worktree workflow is in `~/.claude/CLAUDE.md`. What differs here:

- **Never `git stash`, worktree or not — this overrides the general rule.** The
  stack is repo-global, so every worktree shares one list and `git stash pop`
  takes whatever is on top, routinely another agent's work. Commit to your
  branch instead; to test a tree without your changes, compare against `main`
  (`git diff main -- <path>`).
- **Never merge a `*.generated.ts` conflict — regenerate it.** Take either side,
  re-run the generator (see Tooling), `git add`. Only the sources conflict for
  real.
- **Don't push to `origin` (GMOD/jbrowse-components) or open a PR unless
  asked.**
- Land with `git -C ~/src/jbrowse-components merge --ff-only <branch>`. The two
  things that look like shortcuts are worse: `git push . HEAD:main` refuses here
  (`receive.denyCurrentBranch` is unset), and `update-ref` on a checked-out
  dirty `main` desynchronises its index from its worktree.

**A worktree from `EnterWorktree` arrives installed** — the `WorktreeCreate`
hook runs `pnpm install --frozen-lockfile` first. That includes
`products/jbrowse-web/src/buildInfo.ts`, which is gitignored and which `tsc`
dies on when absent, taking ~5 suites with it. A worktree made by hand with
`git worktree add` gets none of this; run the install yourself. Don't symlink
`node_modules` from the primary checkout — the per-package `@jbrowse/*` links
are relative, so every cross-package import would resolve to the primary
checkout's sources instead of yours.

**Figures are the one thing the install does not bring.** Two gitignored
corpora:

```
ln -s ~/src/jbrowse-components/website/static/img website/static/img
ln -s ~/src/jbrowse-components/products/jbrowse-img/img products/jbrowse-img/img
```

Miss the second and `pnpm autogen` **dies** on the jbrowse-img doc generator
rather than reporting it stale, so every generator after it never runs and the
report is short by however many those are. `pnpm figures:pull` is the other way
to get both, and is what CI does. Every `website/scripts/*.ts` needs
`puppeteer`, which is not hoisted to the root — resolve it from
`packages/browser-test-utils/` (`createRequire(<that>/package.json)`).

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream.
- Keep the main model chain in one file; don't split `.views()`/`.actions()`
  across files.
- A bare getter returns a resolved value, never `undefined`. Where a slot or
  prop encodes a sentinel (`rowHeight === 0` = fit-to-height), expose the
  resolved value under a distinct getter every consumer reads
  (`effectiveRowHeight`). See `agent-docs/reference/ROW_HEIGHT_AND_FIT.md`.
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only through `resolveConf`, never `getConf`.
- In React, `autorun` inside `useEffect` to track observables (prefer over
  `reaction`).
- **Never `destroy` a node React may still be rendering — `detach` it, then
  destroy it on a later task** (`scheduleDetachedDestroy`). React reads the
  outgoing props after your effect cleanup runs, and MobX runs an action's
  reactions at the `endBatch` closing it, so a destroy in either place gets
  read. On an already-read property that is a liveliness warning; on a child
  node never materialized it is a hard throw that takes the page down. Register
  whatever reaches outside the tree as a detach-time disposer, so it stops at
  the detach rather than at the destroy. Deferring _instead of_ detaching does
  not work — no delay is long enough.

  **The destroy half is not optional and is the half that gets dropped.**
  `beforeDestroy` and `addDisposer` are a plugin-facing contract that fires on
  destroy and on nothing else: jbrowse-plugin-apollo closes its websocket there.
  A tree left detached and alive is silent, passes a dead-read count, and leaks
  everything under it. That is exactly what #5618 did to the superseded
  rootModel, and Apollo reported it. ADR-069.

- **An `autorun` must do its own reads. MST actions run untracked**, so
  factoring the body of one into an action — the obvious way to share it with a
  menu item or a flush-on-teardown path — leaves the autorun with no
  dependencies: it fires exactly once and then never again, silently. Same trap
  for the argument order `self.someAction(getSnapshot(self))`, which works only
  because the snapshot is taken before the action is entered. Duplicate the
  reads instead and say why.
- **Export a model's instance type as `interface X extends Instance<…> {}`**,
  not `type X = Instance<…>`. A view naming its displays and a display naming
  its view is a mutual type reference; only the interface form defers it. As
  aliases the pair collapses — TS7023 on the factory, TS2456 on the type, then
  ~20 implicit-any errors in unrelated files, which is what you'll see first.
  Don't route around it by duck-typing the view. ADR-055.
- A duck-typed `interface XSelf` extends **`IStateTreeNode`**, never
  `IAnyStateTreeNode` — the latter resolves through `STNValue<any, …>` to `any`,
  silently turning off checking for every member you just declared.

## React Compiler × MobX

`babel-plugin-react-compiler` does not compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way. The
`function F(){}; observer(F)` form does get compiled and can stale a MobX read.

## Reference names: one normalization layer, and everything goes through it

**Any reading of user-supplied refName text resolves through
`getCanonicalRefName`, or it silently disagrees with the readings that do.**
That method does two jobs at once —
`refNameAliases[n] || lowerCaseRefNameAliases[n.toLowerCase()]` — so it resolves
aliases _and_ casing. Code that tests `region.refName` directly gets neither.

The failure is always silent and always the same: an exact name works, a pattern
over the same names returns nothing, and **nothing distinguishes that from "this
assembly has no such contigs"**. So, for anything matching refName text:

- **Match over `allRefNames`, not `regions`.** `buildRefNameMaps` identity-maps
  every region into `refNameAliases`, so `allRefNames` is a strict superset of
  the canonical names and matching over it loses nothing.
- **Resolve hits to canonical, then emit by walking `regions`.** That two-pass
  shape keeps assembly order instead of alias-file order, and dedupes the
  ordinary case of several names for one contig.
- **Case-insensitivity is the regex's `i` flag, not a wider list.**
  `allRefNames` deliberately excludes `lowerCaseRefNameAliases` so it stays
  normal-cased.

`selectNamedRegions.ts` holds the only two readings of `*` — the resolver a
session spec goes through and `matchRefNames`, which the search box's dropdown
and its enter key share — and `globToRegExp` is module-private to keep it that
way.

### A display reading a refName out of its own state calls `canonicalizeViewRefName`

The rule above is usually met about _matching_. The other half is **storage**,
and it keeps being missed because two of the three ways a refName reaches a
display are safe by construction: a right-click or center-line menu copies the
refName off the region it just hit, and a text search goes through a producer
that canonicalizes. The third — a **session spec, config slot or URL** — carries
whatever a person typed, and every region, block and loaded span it is about to
be compared against is canonical.

`canonicalizeViewRefName(node, refName)` (`@jbrowse/core/util`) is that
normalization, resolved against the containing view's assembly and falling back
to the input before the aliases load — `getCanonicalRefName` **throws** until
then, and these getters run from the first render.

What makes this a rule rather than a fix is that it is **assembly-dependent**:
`chr12` is right on an assembly canonicalized `chr12` and matches nothing on one
canonicalized `12`. So the same spec key works in the demo config it was written
against and quietly does nothing in the next one, and the figure that catches it
is the one nobody re-ran.

Normalize once, where the state is read (a getter, or the autorun's single choke
point), not at each comparison — the comparisons are the part that multiplies.

**But only on the main thread.** `renameRegionsIfNeeded` rewrites `regions[]`
into the _adapter's_ naming scheme inside `serializeArguments`, so `refName`
means the assembly's canonical name before the RPC boundary and the file's name
after it, in the same field of the same type (`util/renameRegions.ts` is the
statement of this). Canonicalizing a refName that is about to be compared
worker-side breaks it on exactly the aliased tracks the rule above is meant to
fix. Check which side a comparison runs on before normalizing either operand —
alignments layout looks worker-side and is not (ADR-053).

The worker layer already handles its half four ways, each worth recognizing
rather than reinventing: bundle a stray refName into `regions` so it rides the
same rename pass (gwas `indexSnp`); carry the view's names in a parallel array
(hic `viewBlocks[].refName`); return no refName at all (`GetConsensusSequence`);
or canonicalize on receipt (breakpoint-split's overlays).

## Assembly names read off a track config: canonical, **and** screened

A track config's `assemblyNames` is free to name an alias _and_ free to name an
assembly the session has no configuration for. Any such name that ends up as an
**`AssemblySelector` value** or in a **view init** must be:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector`'s options are the session's own `assemblyNames` and it
  blanks a value that is not one of them, so an alias renders as an empty field
  with nothing said. This is the half that keeps being missed, because the
  _matching_ helpers (`getSyntenyTracks`, `getSharedTracks`) already
  canonicalize both sides — so an alias-named track is found, and then hands
  over a name the form it was found for cannot show.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A name the session lacks is not
  a blank row but a broken view: the row's init fails with "Assembly X not
  found", which sets the view's error, and `showImportForm` reads that error, so
  the user's working stack is replaced by an import form. `SessionAssemblies`
  (core, next to `AssemblyNameResolver`) is the slice and says why it is `has`.

Both live in one derivation per path, and it is worth keeping it that way:
`connectedEndpoints` for "extend the stack from this row", `syntenyTrackRows`
for "the rows this track implies". A fourth screen growing elsewhere is how the
five that landed in one week started.

Unlike refNames, nothing renames assembly names at the RPC boundary, so there is
no worker-side exception here.

## Tooling

- Avoid running tests frequently, they are slow. Use `pnpm test <directory>`,
  not the full suite. Lint with `--fix`.
- **A full-suite run from the shared primary checkout also _lies_** — other
  agents edit the tree mid-run, so a different unrelated suite fails each time
  and none of it is about your change. Judge your own change by a scoped run, in
  your own worktree.
- **Your test runs get 2 jest workers, deliberately — don't raise it.**
  `jest.config.js` reads `CLAUDECODE` and hands agent sessions 2 where an
  interactive run gets 4. The point is the machine-wide total, which no per-run
  config can see: each concurrent agent worktree sizes itself independently.
  `JEST_MAX_WORKERS=<n>` outranks the tier for one command, but a scoped
  `pnpm test <dir>` is nearly always the better answer.
- **`jest.config.js`'s `.claude/` ignore is load-bearing — don't re-diagnose
  it.** Without it a nested agent worktree gives jest-haste-map duplicate
  `plugins/*/package.json`, a hard throw that fails every cross-package suite.
- **Bare `pnpm format` is fine — it writes only what it would change.** Measured
  2026-08-14: `oxfmt` leaves an already-formatted file's mtime alone, and so
  does the `postformat` prettier pass over the `.astro` files, so a whole-tree
  run touches exactly the mis-formatted set and costs ~7s over 6309 files. This
  used to say to pass paths, from when the script was `prettier --write`;
  scoping now only risks missing a file a repo-wide `--fix` just rewrote, which
  is how two bench files went out unformatted. The pre-push hook formats the
  whole tree for that reason.
- **`agent-docs` is on `.prettierignore`, and naming it explicitly overrides
  that.** Passing the directory as an argument formats all ~118 of them anyway —
  9k lines of rewrapped prose around whatever you actually changed. Never format
  that path; the ignore is doing real work.
- **`pnpm autogen` rewrites every generated-and-committed artifact** and is the
  answer to almost any "X is out of date" CI failure. It owns `package.json`
  `exports` maps, `tsconfig.build.esm.json` `references`, and the doc tables
  built from JSDoc tags — never hand-edit those.
- **Shaders are the one exception: `pnpm gen:shaders`, not `autogen`.**
  `*.generated.ts` is compiled from `.slang` by its own script and checked by
  its own CI job, so `pnpm autogen` on a stale-shader failure rewrites nothing
  and looks like the check is wrong. Edit the `.slang`, never the generated
  module. It regenerates every shader in the repo, so commit sources promptly in
  a shared checkout.
- **Check `gen:shaders`' EXIT CODE, not its output and not `git status`.** A
  `.slang` that fails to compile leaves its `.generated.ts` **untouched**, so
  the failure looks exactly like a file that needed no regen — and `tsc` and
  jest pass, because they import the stale generated module. The run says
  `gen:shaders failed: 1 of 51 .slang file(s) failed` and exits 1; piping to
  `grep -c 'ok:'` hides it. Verify a shader edit by grepping the emitted WGSL
  for the thing you changed.
- **A pass naming a packed colour uniform must `import colorPack;` itself.**
  Slang does not re-export through an import, so `import alignmentsUniforms` is
  not enough to call `unpackRGBA`. This is the most likely thing behind a silent
  stale-generated case, since it is a compile error in the file you just edited.
- Two TypeScript versions on purpose: `typescript` 6.x for lint, aliased
  `typescript7` for `pnpm typecheck`. Don't unify them. Use `--checkers 1`;
  TypeScript 7 memory usage from many parallel checkers is high.
- The `@jbrowse/core/*` modules in `ReExports/modules.ts` are the ABI external
  plugins resolve against, guarded by `ReExports/abi.test.ts` against
  `abiBaseline.json`. Removals fail there; additions don't. To drop a name,
  delete it from the baseline in the same commit and say in the message which
  published plugins you checked.
- **The session is a second plugin-facing surface, and it fails quieter.** A
  plugin looks its members up at runtime, often behind `'x' in session`, so
  removing one throws nothing — the plugin just stops asking and silently does
  less. `jbrowse-web/src/tests/pluginFacingSessionApi.test.ts` pins the members
  published bundles actually call.
- `demos/<name>/config.json` deploys via `scripts/deploy-demo.sh`. Never
  `aws s3 cp` a config from elsewhere — the bucket has no versioning, so an
  overwrite that drops a track is unrecoverable.
