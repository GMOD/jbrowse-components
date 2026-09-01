# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU → WebGL →
Canvas2D). Worker output is **absolute genomic uint32**.

Background: `agent-docs/` — `ARCHITECTURE.md`, then `reference/` and the ADRs.
Skim the three generated `README.md` indexes (`reference/`, `ideas/`,
`handoffs/`) before proposing or re-reviewing: a parked proposal often kills the
obvious version already, and an open handoff often has the bug.

Rules live here only while nothing in the tree enforces them. Once a check
exists, this file points at the check.

## Comments

**The density in this tree is not a licence to match it.** `~/.claude/CLAUDE.md`
says minimal-or-none, and it gets broken the same way every time: three dense
neighbours get read as the subsystem asking for more of the same but please
avoid this.

## Git

Worktree workflow is in `~/.claude/CLAUDE.md`. What differs here:

- **Never `git stash`** — the stack is repo-global and takes other agents' work.
  Use `git diff main -- <path>`.
- **Never merge a `*.generated.ts` conflict** — regenerate it.
- **A branch lands as a fast-forward**: `git rebase main` in the worktree, then
  `git merge --ff-only`. `.githooks/pre-merge-commit` refuses the merge commit
  main did not need, `--no-ff` included.
- Worktree install, figures, base-ref drift: `reference/TOOLCHAIN.md`.

## MST

- `@jbrowse/mobx-state-tree` is our ESM fork; treat it like upstream.
- Keep the main model chain in one file.
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only via `resolveConf`.
- **A mixin casting to reach its host names a concrete schema** —
  `HostChecksSlotNames` fails the build for the widened spellings and says why.
- A bare getter returns a resolved value, never `undefined` — a sentinel prop
  gets a distinct resolved getter (`effectiveRowHeight`).
- In React, `autorun` inside `useEffect`, not `reaction`.
- **`detach` before `destroy`, and still destroy** (`scheduleDetachedDestroy`) —
  a detached-and-alive tree leaks silently. ADR-069.
- **An `autorun` must do its own reads** — MST actions run untracked, and a
  direct observable write inside an autorun body silently fails.
- **A NEW MST model exports `interface X extends Instance<…> {}`**, not a type
  alias. ADR-055 kept the ~107 existing aliases, so one you are reading is not a
  finding.
- Duck-typed `interface XSelf` extends `IStateTreeNode`, never
  `IAnyStateTreeNode` (which is `any`) — **across a lazy boundary too**, where
  importing the model type is a circular-reference trap.
- Write observers inline — `observer(function(){})`. The `observer(F)` form gets
  compiled by React Compiler and can stale a MobX read.

## Tracks

**`addSessionTrackConf` is the default destination.** A track a feature stands
up on the user's behalf — a search result, a computed consensus, a
reconstruction's labels — is not a catalog entry. `publishTrackConf` is the
Add-track workflows only, where an admin means to add it for the whole site.
Gate on the matching `isSessionWithAddSessionTrack` /
`isSessionWithPublishTrackConf`.

`session.addTrackConf` and `isSessionWithAddTracks` mean the session now and
survive only for prebuilt plugin bundles; `no-restricted-syntax` fails a call.

## Names

- **Main thread**: user-supplied refName text goes through
  `getCanonicalRefName`; a display reading its own state uses
  `canonicalizeViewRefName`.
- **Worker side: don't** — `renameRegionsIfNeeded` already renamed `regions[]`.
  Alignments layout looks worker-side and is not (ADR-053).
- An assembly name off a track config must be canonical
  (`canonicalAssemblyNames`) **and** present (`assemblyManager.has`). Comparing
  two names is `isSameAssemblyName` — a view, a track config and a synteny mate
  spell one assembly three ways, and `===` says no.
- **Resolve an assembly name before the RPC, not after.** A worker has no
  assembly manager, so a name crossing that boundary has to already be in the
  namespace the far side compares against.
- `reference/REFNAME_NAMESPACES.md`, `reference/VIEW_INIT.md`.

## Tooling

- **`pnpm test-related`**, in your own worktree. Lint `--fix`. It walks the
  module graph rather than scoping by path, but it **leaves
  `products/jbrowse-web` out** unless the change is in it: those suites all
  import `corePlugins`, so the same 164 are "related" to any change anywhere and
  they are 77% of the run. Add `--with-web` before landing anything that moves a
  config slot, a menu, a label or a snapshot shape — `agent-docs/CLAUDE.md`
  §"Definition of done" has the three that went red on main that way in one
  week.
- **An agent's jest run prints nothing for a passing suite.** jest 30 swaps in
  `AgentReporter` once it detects an agent environment (`CLAUDECODE` is one),
  and it prints only files that fail — so every `console.log`/`warn`/`error` a
  green suite emits is invisible, and a run checked for console noise that way
  reads clean whatever it printed. `--reporters=default` is what shows them.
- **A memoization sabotage that stays green under `pnpm test` proves nothing** —
  React Compiler stands in for the `memo` you deleted.
  `pnpm test-ci-no-react-compiler` is the run that sees it, and the only one
  covering what `build:esm` publishes. `reference/COMPILER_TERNARY_FINDING.md`.
- Formatting is oxfmt (`pnpm format`/`check-format`); `npx prettier` fights it.
- `pnpm autogen` answers any "X is out of date". Shaders: `pnpm gen:shaders`,
  and **check its exit code** — a failed compile leaves the stale
  `.generated.ts` and tsc/jest pass off it.
- `typescript` 6.x lints, `typescript7` typechecks.
- Removals fail quietly on four plugin surfaces — `ReExports/modules.ts`, the
  session, the accumulating extension points, and core's published `exports`
  map, which is derived from in-repo import sites and so loses a subpath when
  its last importer goes: `reference/PLUGIN_ABI_STABILITY.md`.
- Deploy demos with `scripts/deploy-demo.sh`, never `aws s3 cp` (no versioning).
