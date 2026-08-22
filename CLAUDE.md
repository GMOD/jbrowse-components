# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU → WebGL →
Canvas2D). Worker output is **absolute genomic uint32**.

Background: `agent-docs/` — `ARCHITECTURE.md`, then `reference/` and the ADRs.
Skim the three generated `README.md` indexes (`reference/`, `ideas/`,
`handoffs/`) before proposing or re-reviewing: a parked proposal often kills the
obvious version already, and an open handoff often has the bug.

Rules live here only while nothing in the tree enforces them. Once a check
exists, this file points at the check.

## Git

Worktree workflow is in `~/.claude/CLAUDE.md`. What differs here:

- **Never `git stash`** — the stack is repo-global and takes other agents' work.
  Use `git diff main -- <path>`.
- **Never merge a `*.generated.ts` conflict** — regenerate it.
- **A branch lands as a fast-forward.** `git rebase main` in the worktree, then
  `git merge --ff-only`. `merge.ff = only` and `.githooks/pre-merge-commit`
  refuse the merge commit main did not need, `--no-ff` included.
- Worktree install, figures, base-ref drift: `reference/TOOLCHAIN.md`.

## MST

- `@jbrowse/mobx-state-tree` is our ESM fork; treat it like upstream.
- Keep the main model chain in one file.
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only via `resolveConf`.
- **A mixin casting to reach its host names a concrete schema** — see
  `HostChecksSlotNames`, which fails the build for the widened spellings and
  says why.
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

- **`addSessionTrackConf` is the default destination.** A track a feature stands
  up on the user's behalf — a search result, a computed consensus, a
  reconstruction's labels — is not a catalog entry. `publishTrackConf` is the
  Add-track workflows only, where an admin means to add it for the whole site.
  Gate on the matching `isSessionWithAddSessionTrack` /
  `isSessionWithPublishTrackConf`.
- `session.addTrackConf` and `isSessionWithAddTracks` survive only for prebuilt
  plugin bundles and mean the session now — `no-restricted-syntax` fails a call
  and says why.

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

- `pnpm test <directory>`, in your own worktree. Lint `--fix`.
- **A memoization sabotage that stays green under `pnpm test` proves nothing** —
  React Compiler stands in for the `memo` you deleted.
  `pnpm test-ci-no-react-compiler` is the run that sees it, and the only one
  covering what `build:esm` publishes. `reference/COMPILER_TERNARY_FINDING.md`.
- Bare `pnpm format` is fine; never name `agent-docs` (`.prettierignore`).
- `pnpm autogen` answers any "X is out of date". Shaders: `pnpm gen:shaders`,
  and **check its exit code** — a failed compile leaves the stale
  `.generated.ts` and tsc/jest pass off it.
- `typescript` 6.x lints, `typescript7` typechecks.
- Removals fail quietly on three plugin surfaces — `ReExports/modules.ts`, the
  session, and the accumulating extension points:
  `reference/PLUGIN_ABI_STABILITY.md`.
- Deploy demos with `scripts/deploy-demo.sh`, never `aws s3 cp` (no versioning).
