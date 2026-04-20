# GPU Rendering Migration — Next Steps

All LGV-family + HiC/LD/variant-matrix + dotplot displays are on the
MST-driven autorun pattern. Synteny is the last migration.

## Tier 1 — Synteny

See `SYNTENY_REFACTOR.md`. Goal: view owns one canvas + backend;
displays contribute uploads keyed by track index, same pattern as
dotplot.

Dotplot established the shared-canvas shape:
- Backend has `uploadRegion(k, data)` + `deleteRegion(k)` (no
  active-set prune — it would trample sibling displays).
- View runs `startSingleDataGpuLifecycle` with `uploadSlots: []`.
- Each display runs `startMultiRegionGpuLifecycle` with no
  `pruneRegionsNotIn`; `beforeDestroy` calls `backend.deleteRegion`.
- Display's `onAfterCommit` calls `view.renderNow()` so the first
  paint doesn't race ahead of upload.

**Prerequisite:** pickable backend mixin (Tier 2).

## Tier 2 — Correctness

### Backend conformance suite

`packages/core/src/gpu/backendConformance.test.ts`, one
`describe.each(ALL_BACKENDS)`. Cases:

- Idempotent upload
- No-op render-before-ready
- `deleteRegion` / prune removes absent keys
- `dispose()` releases GPU buffers (count via `MockHal`)
- Context-loss reinit produces equivalent draw calls + uniforms

Forces self-registration via `ALL_BACKENDS` to catch drift. Land
before synteny.

### Pickable backend mixin

`Pickable<HitT>` with `pick(x, y): Promise<Hit | undefined>`.
Backends that pick implement it; components install one mouse
handler. Synteny needs it (async WebGPU, sync Canvas2D — Promise
absorbs both).

## Tier 3 — Cleanup

### Tab visibility → HAL

Move `useTabVisibilityRerender` + `renderNow()` into the HAL's own
`visibilitychange` listener. Drops the React hook and lets
`renderNow` leave the public slot-mixin API.

### Dead code (after synteny)

- `packages/core/src/gpu/uploadChangedRegions.ts`
- `plugins/alignments/.../alignmentComponentUtils.ts::uploadRegionDataToGPU`
- `pruneRegionMap` helpers (grep callers first)
- `renderProps()` on GPU displays if unused
- `dataVersion` debug counter in `MultiRegionDisplayMixin`

Search: `grep -r 'uploadChangedRegions\|uploadRegionDataToGPU\|pruneRegionMap' packages/ plugins/`

### `displayedRegionIndex` → `displayedRegionIndex`

~550 occurrences, 73 files. Scripted sed + tsc. Do last — mechanical
pass shouldn't overlap active migrations.

### Structural `RenderSvgModel`

Matrix + variants use it; wiggle/alignments/canvas still import the
MST model type. Mechanical conversion; hardens against type
circularity (hit it in variants).

### `chainIdMap` perf

Gate to linkedRead + chain highlights active. Currently iterates
every read × region on every data update.

## Tier 4 — Docs

Rewrite `ARCHITECTURE.md`: "Upload/render lifecycle" and
"Plugin-level Backend interfaces" are stale. Point at
`NEW_ARCHITECTURE.md`.

---

## Ordering

1. Backend conformance suite
2. Pickable mixin
3. Synteny

Separate: displayedRegionIndex rename (last), doc rewrite (once stable),
tab-visibility → HAL (post-synteny), dead code deletion.

---

## Invariants

- **MST owns the autorun.** Cached getters + util autoruns, not
  `useEffect`.
- **Per-region values are fresh, never mutated.** Identity diff
  depends on it.
- **Render-state changes don't re-run upload.** Split autoruns
  enforce it — don't fold back.
- **Plugins touch `startGpuBackendLifecycle(backend)` only.** Rest
  lives in util/mixin.
- **Structural types across lazy boundaries.** Importing MST model
  types across lazy imports is a circular-reference trap.
- **Shared backend needs per-key delete, not prune.** Active-set
  prune wipes sibling displays.
- **Split upload/render utils need `onAfterCommit` → `renderNow`.**
  Otherwise first paint races the first upload.
