# JBrowse 2 — Agent PRD (root)

This is the governing document for agent work on the `webgl-poc` branch.
Read this first. It tells you **what to work on, what rules to follow, and
where to look for detail**.

**Branch:** `webgl-poc` | **Updated:** 2026-04-18

---

## 1. Mission

Migrate JBrowse 2 from block-based HTML canvas rendering to a GPU-accelerated
pipeline with three backends (WebGPU → WebGL2 → Canvas 2D fallback; SVG export
via Canvas 2D). Keep all existing track types working across all backends.

---

## 2. Where the code lives

Agents should prefer verifying against source over memory.

| Concern                     | Path                                                     |
| --------------------------- | -------------------------------------------------------- |
| GPU primitives / HAL        | `packages/core/src/gpu/`                                 |
| Lifecycle mixin             | `packages/core/src/gpu/GpuBackendLifecycleSlotMixin.ts`  |
| Multi-region lifecycle util | `packages/core/src/gpu/startGpuBackendAutorunLifecycle.ts` |
| Single-data lifecycle util  | `packages/core/src/gpu/startGpuSingleDataBackendAutorunLifecycle.ts` |
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

## 3. Active priorities

Work in this order unless the user requests otherwise.

### P1 — In-flight refactors

- **Dotplot: adopt shared MST autorun lifecycle.** Currently has an open-coded
  view-level draw autorun + per-display upload autorun. Plan:
  `DOTPLOT_REFACTOR.md`.
- **Synteny PR-B: view owns one canvas + backend.** PR-A (keyed backend +
  MST-driven autorun) has landed. Plan: `SYNTENY_REFACTOR_PR_B.md`.
- **Backend conformance test suite** before shipping dotplot/synteny to catch
  per-backend drift. One `describe.each(ALL_BACKENDS)` covering idempotent
  upload, no-op render-before-ready, prune/delete, `dispose()` buffer release,
  context-loss reinit. Lives at `packages/core/src/gpu/backendConformance.test.ts`.
- **Pickable backend mixin** (`Pickable<HitT>` with
  `pick(x, y): Promise<Hit | undefined>`). Synteny needs it; unifies async
  WebGPU readback with sync Canvas2D picking.

### P2 — Config migration

- **PileupRenderer → display-level config migration.** Old configs with
  `configuration.renderer.type === 'PileupRenderer'` silently drop settings
  (`featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`). Add
  `migrateDisplayConfiguration()` in `migrateSessionSnapshot.ts`; wire into
  `migrateTrackSnapshot`. Verify `config_demo.json` and `volvox/config.json`
  load with JEXL color expressions intact. See `CONFIG_PATTERN.md`.
- **Verify renderer property promotion** for `CanvasFeatureRenderer`,
  `SvgFeatureRenderer`, `ArcRenderer`, `LollipopRenderer` — no migration
  needed, but check promotion path works.

### P3 — Shader authoring

All production draw shaders are now Slang-authored. Remaining:

- **Compute shaders** (`plugins/variants/src/VariantRPC/ldComputeShader.ts`,
  `ldPhasedComputeShader.ts`) can migrate to Slang authoring (WebGPU-only, set
  `//! targets: wgsl`). Not urgent — they work as hand-written WGSL.
- **Build-time WGSL struct size validator** — Jest test asserting
  `sizeof(instanceStruct) % 16 === 0`. Currently only caught at runtime in
  `WebGPUHal.create`.

### P4 — CI / Test infrastructure

- **WebGPU CI.** Chrome flags set in `runner.ts` but Vulkan missing. Add
  Lavapipe (`mesa-vulkan-drivers`) + `xvfb-run` with
  `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json`. See
  `TEST_INFRASTRUCTURE.md`.
- **Test suite speed & stability.** Browser suite is slow; some flakes.

### P5 — Cleanup (after P1 ships)

- `regionNumber` → `displayedRegionIndex` rename (~550 sites, 73 files).
  Mechanical. Do **last** so other migrations don't churn it mid-flight.
- Delete dead code: `uploadChangedRegions.ts`, `uploadRegionDataToGPU`,
  `pruneRegionMap` helpers, `renderProps()` on GPU displays, `dataVersion`
  debug counter.
- Move tab-visibility listener into the HAL (drops `useTabVisibilityRerender`
  hook and `renderNow()` from the public mixin API).
- See `TODO.md` for the full category-organized list.

---

## 4. Non-negotiable invariants

These are correctness contracts. Violating them produces silent bugs.

- **MST owns the render autorun.** Lifecycle flows through cached getters +
  util autoruns, not React `useEffect`.
- **Per-region upload values must be freshly constructed, never mutated.**
  The upload autorun's identity diff depends on reference inequality.
- **Render-state changes don't re-run upload.** The util splits upload and
  render autoruns precisely to keep hover/selection cheap. Don't fold them.
- **Plugins only call `startGpuBackendLifecycle(backend)`.** The rest (handle
  slot, dispose, `markCanvasDrawn`, tab-visibility rerender) lives in the
  mixin/util.
- **Structural types across lazy boundaries.** Importing MST model types
  across lazy imports is a circular-reference trap — use structural
  (duck-typed) interfaces instead.
- **Shared backend (dotplot, synteny PR-B) needs per-key delete, not prune.**
  An active-set prune would wipe sibling displays' data.
- **Split upload/render utils need `onAfterCommit` → `renderNow`.** Otherwise
  the first paint races the first upload.
- **`readConfObject` / `getConf` are hot-path traversals.** Cache outside
  loops. Prefer `getConfSnapshot` + `readConfigValue` on plain objects at the
  rendering layer (see `CONFIG_PATTERN.md`).

Coding rules from `CLAUDE.md`:

- No explicit TypeScript return types; no `any`/typecasts.
- Minimal comments; self-explanatory code.
- Do not "early return"; nest `if` instead.
- Do not `push(...list)` (stack overflow) — loop and push.
- Prefer MobX `autorun` over `reaction`. Be wary of `useEffect` with MST.
- Do not add try/catch inside MST getters; push to time-of-use.
- Prefer `node --experimental-strip-types` over `tsx` / `ts-node`.
- `tsc` and tests are slow — keep scope narrow.

---

## 5. Definition of done

Before declaring a task complete:

1. **Type check** narrowly: `pnpm tsc -b` scoped to the touched packages, or
   project-wide once locally.
2. **Relevant unit tests** pass (`pnpm test -- <path>`).
3. **Browser test** where UI behavior changed. Run with the backend(s) you
   touched: `node --experimental-strip-types browser-tests/runner.ts
   --filter=<suite>` (see `TEST_INFRASTRUCTURE.md` for backend flags).
4. **Lint** with `--cache --fix` on the changed files.
5. **Snapshots** regenerated only when the change is intentional and visually
   verified (`--update-snapshots`).
6. **Invariants above** preserved. If you changed a lifecycle or upload path,
   re-read §4.

Do **not** open a PR (`gh pr create`) unless explicitly asked.

---

## 6. Reading order for new agents

1. This file (PRD.md).
2. `ARCHITECTURE.md` — current GPU lifecycle pattern (canonical).
3. `CONFIG_PATTERN.md` — how config flows from MST to renderers / workers.
4. `TEST_INFRASTRUCTURE.md` — how to run browser and unit tests.
5. `TODO.md` — categorized backlog.
6. `architecture-decision-records/` — design decisions (ADR-001 … ADR-005).
7. Active plans only if the task touches them:
   `DOTPLOT_REFACTOR.md`, `SYNTENY_REFACTOR_PR_B.md`, `wiggle-core-plan.md`.
8. `OTHER_IDEAS.md` — future directions, not current work.
9. `completed/` — historical migration state; consult if the change retraces
   old ground.

---

## 7. When to update this PRD

- A P1 item ships → move to `completed/COMPLETED.md`, promote the next priority.
- A new invariant is discovered (a subtle bug whose fix is a contract) → add
  to §4 with a one-line reason.
- A plan in §3 completes → archive the plan doc under `completed/` and
  remove the bullet.
- A directory in §2 moves → update the path.

Keep the doc under 200 lines. Detail belongs in the referenced docs, not here.
