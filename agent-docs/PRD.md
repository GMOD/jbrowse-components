# JBrowse 2 — Agent PRD (root)

Governs agent work on `webgl-poc`. Read first: invariants, where the code
lives, how to know when you're done. **Backlog and priorities live in
`TODO.md`** — keep this doc stable.

**Branch:** `webgl-poc` | **Updated:** 2026-04-20

---

## Mission

Migrate JBrowse 2 from block-based HTML canvas rendering to a GPU pipeline
(WebGPU → WebGL2 → Canvas 2D; SVG export via Canvas 2D). Keep every existing
track type working on every backend.

---

## Where the code lives

Verify against source, not memory.

| Concern                     | Path                                                     |
| --------------------------- | -------------------------------------------------------- |
| GPU primitives / HAL        | `packages/core/src/gpu/`                                 |
| Lifecycle mixin             | `packages/core/src/gpu/GpuBackendLifecycleSlotMixin.ts`  |
| Shader codegen              | `scripts/build-shaders.ts`, `scripts/shader-codegen/`    |
| Shared slang modules        | `packages/core/src/gpu/shaders/`                         |
| Browser tests               | `products/jbrowse-web/browser-tests/`                    |
| Canvas display              | `plugins/canvas/`                                        |
| Wiggle / multi-wiggle       | `plugins/wiggle/`                                        |
| Alignments + coverage       | `plugins/alignments/`                                    |
| Variants + variant matrix   | `plugins/variants/`                                      |
| HiC / LD                    | `plugins/hic/`, `plugins/variants/` (matrix + LD)        |
| Dotplot                     | `plugins/dotplot-view/`                                  |
| Linear synteny              | `plugins/linear-comparative-view/`                       |

---

## Non-negotiable invariants

Correctness contracts — violations cause silent bugs.

- **MST owns the upload + render autoruns.** They are spawned by
  `installGpuDisplay` on `GpuBackendLifecycleSlotMixin`, not by React
  `useEffect`.
- **Per-region upload values must be freshly constructed, never mutated.**
  Backends diff by reference identity; in-place mutation leaks stale bytes.
- **Only write MST observables via actions.** Direct writes inside an
  autorun body (e.g. `self.canvasDrawn = true`, `self.maxY = x`) silently
  fail under MST action enforcement. Use the defined action.
- **Plugins define only `startGpuBackendLifecycle(backend)`.** Body is
  one `self.installGpuDisplay(backend, {upload, render})` call.
  `canvasDrawn`, `renderNow`, `stopGpuBackendLifecycle`, tab-visibility
  rerender all live in the mixin.
- **Structural types across lazy boundaries.** Importing MST model types
  across lazy imports is a circular-reference trap — use duck-typed
  interfaces.
- **Shared backends (dotplot, synteny) use a per-plugin `lastKeys`
  closure** to fire `deleteGeometry` on removed keys; active-set prune
  would wipe sibling displays' data.
- **Render callback returns `false` to skip.** Any other return
  (including `void`) marks the canvas drawn via `markCanvasDrawn`.
- **`readConfObject` / `getConf` are hot-path traversals.** Cache outside
  loops; prefer `getConfSnapshot` + `readConfigValue` on plain objects at
  the rendering layer (`CONFIG_PATTERN.md`).

Coding conventions live in `CLAUDE.md` (root) and `~/.claude/CLAUDE.md` —
follow them.

---

## Definition of done

- **Type check** the touched packages (`pnpm tsgo -b` scoped), full project
  once locally.
- **Unit tests** for changed paths (`pnpm test -- <path>`).
- **Browser test** when UI behavior changed, on the backend(s) you touched
  (`node --experimental-strip-types browser-tests/runner.ts --filter=<suite>`;
  flags in `TEST_INFRASTRUCTURE.md`).
- **Lint** with `--cache --fix` on changed files.
- **Snapshots** regenerated only after intentional, visually verified change
  (`--update-snapshots`).
- **Invariants** preserved — re-read the invariants section after lifecycle
  or upload changes.

Do **not** open a PR (`gh pr create`) unless explicitly asked.

---

## Reading order for new agents

- `PRD.md` (this file) — invariants, paths, definition of done.
- `TODO.md` — what to work on, categorized.
- `ARCHITECTURE.md` — canonical GPU lifecycle.
- `CONFIG_PATTERN.md` — config flow from MST → renderers / workers.
- `TEST_INFRASTRUCTURE.md` — browser + unit test invocation.
- `architecture-decision-records/` — ADR-001 … ADR-005.
- `OTHER_IDEAS.md` — future directions.
- `completed/` — historical migration state.

---

## When to update this PRD

- New invariant discovered → add it with a one-line reason.
- Path in the code-locations table moves → update.
- Backlog churn → `TODO.md`, not here.
