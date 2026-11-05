# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU → WebGL →
Canvas2D). Worker output is **absolute genomic uint32**.

Background: `agent-docs/` — `ARCHITECTURE.md` (the map), then the doc its "Where
to read next" table names for the task, then the ADRs. Before proposing or
re-reviewing, grep `ideas/`, `handoffs/` and `architecture-decision-records/`
for the subsystem's names, then skim the generated `README.md` index in each
(one capped row per doc; the ADRs' Rejected rows are the declined ideas): a
parked proposal often kills the obvious version already, and an open handoff
often has the bug.

Rules live here only while nothing in the tree enforces them. Once a check
exists, the rule leaves this file — lint (`no-restricted-syntax` in
`eslint.config.mjs`), the build, `.githooks/` and
`.claude/hooks/refuse-commands.sh` explain themselves when they fire.

## Git

- **Code work goes in a worktree**; land it from the primary checkout with
  `git merge --ff-only <branch>`.
- **Resolve a `*.generated.ts` conflict by regenerating**, with the command its
  header names.

## MST

- A bare getter returns a resolved value, never `undefined` — a sentinel prop
  gets a distinct resolved getter (`effectiveRowHeight`).
- **`detach` before `destroy`, and still destroy** (`scheduleDetachedDestroy`) —
  a detached-and-alive tree leaks silently. ADR-069.
- **An `autorun` must do its own reads** — MST actions run untracked, and a
  direct observable write inside an autorun body silently fails.
- **A NEW MST model exports `interface X extends Instance<…> {}`**, not a type
  alias. Existing aliases stay (ADR-055) and are not findings.
- A duck-typed `XSelf` across a lazy boundary imports no model type — that is a
  circular-reference trap.

## Names

- **Main thread**: user-supplied refName text goes through
  `getCanonicalRefName`; a display reading its own state uses
  `canonicalizeViewRefName` (`reference/REFNAME_NAMESPACES.md`).
- **Worker side, use `regions[]` as given** — `renameRegionsIfNeeded` already
  renamed them.
- An assembly name off a track config must be canonical
  (`canonicalAssemblyNames`) **and** present (`assemblyManager.has`). Compare
  two with `isSameAssemblyName` (`reference/VIEW_INIT.md`).
- **Resolve an assembly name before the RPC** — a worker has no assembly
  manager.

## Tooling

- **`pnpm verify`, then the changed code's own suites.** `npx jest <file>` for a
  named test file or two; `pnpm test-related` when you cannot name the blast
  radius, reading `-- --listTests` first. `reference/TEST_INFRASTRUCTURE.md`.
- **The `jbrowse-web` jest project is CI's**, snapshot changes included —
  `pnpm test-ci` runs it on push, and a red there gets fixed forward.
- **Prove a memo sabotage with `NO_RC=1 npx jest <file>`** — the React Compiler
  stands in for a missing memo under `pnpm test`.
- `pnpm autogen` answers any "X is out of date", and only that. **Land without
  running it** — pre-push regenerates and commits.
- Removing a plugin export, session member or extension point fails quietly:
  `reference/PLUGIN_ABI_STABILITY.md`.
- Deploy demos with `scripts/deploy-demo.sh`.
- **Examples, demo configs, tests and CI fetch from copies hosted on
  jbrowse.org**, Ensembl data included — Ensembl's outages turn main red.
