# JBrowse 2 — Agent PRD (root)

Governs agent work on `webgl-poc`. Read first: what to work on, rules to
follow, where to look for detail.

**Branch:** `webgl-poc` | **Updated:** 2026-04-20

---

## 1. Mission

Migrate JBrowse 2 from block-based HTML canvas rendering to a GPU pipeline
(WebGPU → WebGL2 → Canvas 2D; SVG export via Canvas 2D). Keep every existing
track type working on every backend.

---

## 2. Where the code lives

Verify against source, not memory.

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

Work top-down unless the user redirects.

### P1 — In-flight refactors

- **Dotplot: adopt shared MST autorun lifecycle.** Today: open-coded
  view-level draw autorun + per-display upload autorun. Plan:
  `DOTPLOT_REFACTOR.md`.
- **Synteny PR-B: view owns one canvas + backend.** PR-A (keyed backend +
  MST-driven autorun) landed. Plan: `SYNTENY_REFACTOR_PR_B.md`.
- **Backend conformance suite** before shipping dotplot/synteny — one
  `describe.each(ALL_BACKENDS)` covering idempotent upload, no-op
  render-before-ready, prune/delete, `dispose()` buffer release, context-loss
  reinit. Target: `packages/core/src/gpu/backendConformance.test.ts`.
- **Pickable backend mixin** — `Pickable<HitT>` with
  `pick(x, y): Promise<Hit | undefined>`. Synteny needs it; unifies async
  WebGPU readback with sync Canvas2D picking.

### P2 — Config migration

- **PileupRenderer → display-level config.** Old configs with
  `configuration.renderer.type === 'PileupRenderer'` silently drop
  `featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`. Add
  `migrateDisplayConfiguration()` in `migrateSessionSnapshot.ts` and wire into
  `migrateTrackSnapshot`. Verify `config_demo.json` and `volvox/config.json`
  load with JEXL color expressions intact. See `CONFIG_PATTERN.md`.
- **Renderer property promotion check** for `CanvasFeatureRenderer`,
  `SvgFeatureRenderer`, `ArcRenderer`, `LollipopRenderer` — no migration
  expected, but confirm promotion works.

### P3 — Shader authoring

Draw shaders are all Slang. Remaining:

- **Compute shaders** (`plugins/variants/src/VariantRPC/{ldComputeShader,
  ldPhasedComputeShader}.ts`) can migrate to Slang (WebGPU-only,
  `//! targets: wgsl`). Not urgent.
- **Build-time WGSL struct-size validator** — Jest test asserting
  `sizeof(instanceStruct) % 16 === 0`. Currently caught only at runtime in
  `WebGPUHal.create`.

### P4 — CI / Test infrastructure

- **WebGPU CI.** Chrome flags set in `runner.ts`, Vulkan missing. Add
  Lavapipe (`mesa-vulkan-drivers`) + `xvfb-run` with
  `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json`. See
  `TEST_INFRASTRUCTURE.md`.
- **Browser suite speed & flake reduction.**

### P5 — Cleanup (after P1 ships)

- Delete dead code: `uploadChangedRegions.ts`, `uploadRegionDataToGPU`,
  `pruneRegionMap` helpers, `renderProps()` on GPU displays, `dataVersion`
  debug counter.
- Move tab-visibility listener into the HAL (drops `useTabVisibilityRerender`
  + `renderNow()` from the public mixin API).
- Full backlog in `TODO.md`.

---

## 4. Non-negotiable invariants

Correctness contracts — violations cause silent bugs.

- **MST owns the render autorun.** Lifecycle flows through cached getters +
  util autoruns, not React `useEffect`.
- **Per-region upload values must be freshly constructed, never mutated** —
  the upload autorun diffs by reference identity.
- **Render-state changes don't re-run upload.** The util splits upload and
  render autoruns to keep hover/selection cheap; don't fold them.
- **Plugins only call `startGpuBackendLifecycle(backend)`.** Handle slot,
  dispose, `markCanvasDrawn`, tab-visibility rerender all live in the
  mixin/util.
- **Structural types across lazy boundaries.** Importing MST model types
  across lazy imports is a circular-reference trap — use duck-typed
  interfaces.
- **Shared backends (dotplot, synteny PR-B) use per-key delete, not prune.**
  Active-set prune would wipe sibling displays' data.
- **Render fires only after data is on the GPU.** Multi-region waits for
  ≥1 upload, single-data waits for every entry, `renderState: undefined`
  suppresses both. The slot mixin wires `markCanvasDrawn` post-render —
  never call it inline.
- **`readConfObject` / `getConf` are hot-path traversals.** Cache outside
  loops; prefer `getConfSnapshot` + `readConfigValue` on plain objects at
  the rendering layer (`CONFIG_PATTERN.md`).

Coding conventions live in `CLAUDE.md` (root) and `~/.claude/CLAUDE.md` —
follow them.

---

## 5. Definition of done

- **Type check** the touched packages (`pnpm tsc -b` scoped), full project
  once locally.
- **Unit tests** for changed paths (`pnpm test -- <path>`).
- **Browser test** when UI behavior changed, on the backend(s) you touched
  (`node --experimental-strip-types browser-tests/runner.ts --filter=<suite>`;
  flags in `TEST_INFRASTRUCTURE.md`).
- **Lint** with `--cache --fix` on changed files.
- **Snapshots** regenerated only after intentional, visually verified change
  (`--update-snapshots`).
- **§4 invariants** preserved — re-read §4 after lifecycle or upload changes.

Do **not** open a PR (`gh pr create`) unless explicitly asked.

---

## 6. Reading order for new agents

- `PRD.md` (this file).
- `ARCHITECTURE.md` — canonical GPU lifecycle.
- `CONFIG_PATTERN.md` — config flow from MST → renderers / workers.
- `TEST_INFRASTRUCTURE.md` — browser + unit test invocation.
- `TODO.md` — categorized backlog.
- `architecture-decision-records/` — ADR-001 … ADR-005.
- Active plans only when relevant: `DOTPLOT_REFACTOR.md`,
  `SYNTENY_REFACTOR_PR_B.md`, `wiggle-core-plan.md`.
- `OTHER_IDEAS.md` — future directions.
- `completed/` — historical migration state.

---

## 7. When to update this PRD

- P1 item ships → move to `completed/COMPLETED.md`, promote next priority.
- New invariant discovered → add to §4 with one-line reason.
- Plan in §3 completes → archive plan doc in `completed/`, drop the bullet.
- Path in §2 moves → update.

Keep under 200 lines. Detail belongs in the referenced docs.
