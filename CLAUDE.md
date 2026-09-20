# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU → WebGL →
Canvas2D). Worker output is **absolute genomic uint32**.

Background: `agent-docs/` — `ARCHITECTURE.md`, then `reference/` and the ADRs.
Skim the generated `README.md` indexes (`reference/`, `ideas/`, `handoffs/`, and
the ADRs, whose Rejected rows are the declined ideas) before proposing or
re-reviewing: a parked proposal often kills the obvious version already, and an
open handoff often has the bug.

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
- Write config with `setConf`, not `configuration.setSlot`.
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

## The agent surface

`jb` (`packages/app-core/src/JbApi/jbApi.ts`) is one library with two clients:
Desktop's MCP server — `run_javascript`, `docs`, `open`, `screenshot` — and
`window.jb` on JBrowse Web. The briefing differs, and that is what gets missed.

- **A browser agent has no `docs` tool.** `jb.help` is its entire contract, so a
  route missing from that string is a route it never takes. Trim inside it, not
  the routes. `docsRoster.test.ts` pins the load-bearing members in the copies
  read before any doc, and every `jb.X` any copy names.
- **The client cuts the server instructions and each tool description at 2048
  characters**, so an addition displaces a sentence someone chose.
  `pnpm check-mcp-text-caps` gates it, `--probe` re-measures the installed
  client.
- **Before cutting a helper, drive the route you would name instead.**
  `view.launchTrack` drops settings written in its second slot and checks no
  assembly; `jb.setSession` is `applySnapshot`, so it runs no view launcher;
  `getConf` is not `readConfObject` with extra steps, because readConfObject
  handed a model reads the MODEL's member (`getConf.test.ts`). Three reviews
  proposed cuts onto these without driving any. `jb.rootModel` is a fourth: only
  Desktop passes rootModel as a call argument, so on Web that getter is the
  browser agent's handle.

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

- **`pnpm verify` and `pnpm test-related`**, in your own worktree. verify
  formats, spell-checks and lints the files changed against main (`--all` for
  the tree). test-related runs the suites whose footprint — the files they
  executed on their last run — holds a changed file; a comment- or type-only
  edit runs nothing. `reference/TEST_INFRASTRUCTURE.md` §"Which suites a change
  runs".
- **The `jbrowse-web` jest project runs on remote CI, not here.** Its app-level
  suites are half the suite clock; `pnpm test` and `test-related` leave them
  out, and `pnpm test-ci` on push runs them. Don't run them before landing, not
  even for a config slot, menu, label or snapshot change — a red there after
  push gets fixed forward. Name one web suite only to chase a failure CI
  reported or to back a claim that nothing covers a mechanism.
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
- Removals fail quietly on three plugin surfaces — the session, the accumulating
  extension points, and the `exports` maps, which the runtime registry is
  generated from (ADR-128). Core's is derived from in-repo import sites, so a
  subpath leaves both when its last importer goes:
  `reference/PLUGIN_ABI_STABILITY.md`.
- Deploy demos with `scripts/deploy-demo.sh`, never `aws s3 cp` (no versioning).
