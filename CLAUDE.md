# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU → WebGL →
Canvas2D). Worker output is **absolute genomic uint32**.

Background: `agent-docs/` — `ARCHITECTURE.md`, then `reference/` and the ADRs.

## Git

Worktree workflow is in `~/.claude/CLAUDE.md`. What differs here:

- **Never `git stash`** — the stack is repo-global and takes other agents' work.
  Use `git diff main -- <path>`.
- **Never merge a `*.generated.ts` conflict** — regenerate it.
- Worktree install, figures, base-ref drift: `reference/TOOLCHAIN.md`.

## MST

- `@jbrowse/mobx-state-tree` is our ESM fork; treat it like upstream.
- Keep the main model chain in one file.
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only via `resolveConf`.
- A bare getter returns a resolved value, never `undefined` — a sentinel prop
  gets a distinct resolved getter (`effectiveRowHeight`).
- In React, `autorun` inside `useEffect`, not `reaction`.
- **`detach` before `destroy`, and still destroy** (`scheduleDetachedDestroy`) —
  a detached-and-alive tree leaks silently. ADR-069.
- **An `autorun` must do its own reads** — MST actions run untracked, and a
  direct observable write inside an autorun body silently fails.
- **A NEW MST model exports `interface X extends Instance<…> {}`**, not a type
  alias. ADR-055 decided against retrofitting the ~107 existing aliases, so one
  in a file you are reading is not a finding — convert it when that model grows
  a mutual reference, which is the case the alias form cannot compile.
- Duck-typed `interface XSelf` extends `IStateTreeNode`, never
  `IAnyStateTreeNode` (which is `any`). **Duck-type across a lazy boundary too**
  — importing an MST model type across a lazy import is a circular-reference
  trap.
- Write observers inline — `observer(function(){})`. The `observer(F)` form gets
  compiled by React Compiler and can stale a MobX read.

## Names

- **Main thread**: user-supplied refName text goes through
  `getCanonicalRefName`; a display reading its own state uses
  `canonicalizeViewRefName`.
- **Worker side: don't** — `renameRegionsIfNeeded` already renamed `regions[]`.
  Alignments layout looks worker-side and is not (ADR-053).
- An assembly name off a track config must be canonical
  (`canonicalAssemblyNames`) **and** present (`assemblyManager.has`).
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
- Removals fail quietly on three plugin surfaces: `ReExports/modules.ts`, the
  session, and the accumulating extension points, where the guard is a TYPE and
  a prebuilt v4 bundle carries none — `reference/PLUGIN_ABI_STABILITY.md`.
- Deploy demos with `scripts/deploy-demo.sh`, never `aws s3 cp` (no versioning).
