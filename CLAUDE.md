# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU → WebGL →
Canvas2D). Worker output is **absolute genomic uint32**.

Background: `agent-docs/` — `ARCHITECTURE.md`, then `reference/` and the ADRs.
Skim the generated `README.md` indexes (`reference/`, `ideas/`, `handoffs/`, and
the ADRs, whose Rejected rows are the declined ideas) before proposing or
re-reviewing: a parked proposal often kills the obvious version already, and an
open handoff often has the bug.

Rules live here only while nothing in the tree enforces them. Once a check
exists, the rule leaves this file — lint (`no-restricted-syntax` in
`eslint.config.mjs`), the build, and `.claude/hooks/refuse-commands.sh` explain
themselves when they fire.

**Comment density in this tree is not a licence to match it** — dense neighbours
are not the subsystem asking for more.

## Git

Worktree workflow is in `~/.claude/CLAUDE.md`. Here, additionally:

- **Never merge a `*.generated.ts` conflict** — regenerate it.
- Worktree install, figures, base-ref drift: `reference/TOOLCHAIN.md`.

## MST

- `@jbrowse/mobx-state-tree` is our ESM fork; treat it like upstream.
- Keep the main model chain in one file.
- A bare getter returns a resolved value, never `undefined` — a sentinel prop
  gets a distinct resolved getter (`effectiveRowHeight`).
- In React, `autorun` inside `useEffect`, not `reaction`.
- **`detach` before `destroy`, and still destroy** (`scheduleDetachedDestroy`) —
  a detached-and-alive tree leaks silently. ADR-069.
- **An `autorun` must do its own reads** — MST actions run untracked, and a
  direct observable write inside an autorun body silently fails.
- **A NEW MST model exports `interface X extends Instance<…> {}`**, not a type
  alias. The ~107 existing aliases stay (ADR-055) and are not findings.
- A duck-typed `XSelf` across a lazy boundary still extends `IStateTreeNode`;
  importing the model type there is a circular-reference trap.

## Tracks

A track a feature stands up for the user goes to `addSessionTrackConf`;
`publishTrackConf` is for Add-track workflows only.

## Names

- **Main thread**: user-supplied refName text goes through
  `getCanonicalRefName`; a display reading its own state uses
  `canonicalizeViewRefName`.
- **Worker side: don't** — `renameRegionsIfNeeded` already renamed `regions[]`.
  Alignments layout looks worker-side and is not (ADR-053).
- An assembly name off a track config must be canonical
  (`canonicalAssemblyNames`) **and** present (`assemblyManager.has`). Compare
  two with `isSameAssemblyName`, never `===`.
- **Resolve an assembly name before the RPC** — a worker has no assembly
  manager.
- `reference/REFNAME_NAMESPACES.md`, `reference/VIEW_INIT.md`.

## Tooling

- **`pnpm verify`, then the changed code's own suite** — `npx jest <file>`, one
  file, since jest skips the machine-wide slots `pnpm typecheck`, lint,
  `build:esm` and `pnpm test` queue on.
- **`pnpm test-related` is the escalation**, for a change whose blast radius you
  cannot name: a hub module sits in 300-900 suites. Read `-- --listTests` first.
  `reference/TEST_INFRASTRUCTURE.md`.
- **Don't run the `jbrowse-web` jest project locally**, even for a snapshot
  change — `pnpm test-ci` runs it on push, and a red there gets fixed forward.
- **An agent's jest run prints nothing for a passing suite**, console noise
  included. `--reporters=default` shows it.
- **A memo sabotage green under `pnpm test` proves nothing** — React Compiler
  stands in. `pnpm test-ci-no-react-compiler`;
  `reference/COMPILER_TERNARY_FINDING.md`.
- `pnpm autogen` answers any "X is out of date". **Check `pnpm gen:shaders`'s
  exit code** — a failed compile leaves the stale `.generated.ts` passing.
- `typescript` 6.x lints, `typescript7` typechecks.
- Removing a plugin export, session member or extension point fails quietly:
  `reference/PLUGIN_ABI_STABILITY.md`.
- Deploy demos with `scripts/deploy-demo.sh`, never `aws s3 cp` (no versioning).
- Editing `jb` or the MCP text: `packages/app-core/src/JbApi/CLAUDE.md`.
