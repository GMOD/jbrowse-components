---
name: gpu-display-lifecycle
description: How does a GPU display wire to its model — what RenderLifecycleMixin owns, the activity phase, context-loss recovery, the installUpload cell contract and the upload patterns by map key?
kind: spec
---

# GPU display lifecycle and uploads

How a display's MST model drives its backend: the two autoruns, the activity
phase that raises the scrim, recovery from a lost context, and the one upload
installer. [GPU_RENDERING.md](GPU_RENDERING.md) is the hub and lists the sibling
docs for backends, the HAL and shaders.

## The core contract

- `renderState` is a plain resolved getter, never `undefined`. "The view isn't
  measured yet" is the mixin's `canRender` gate.
- **Forward `renderBlocks`' answer; don't re-derive it** (`rpcDataMap.size === 0`
  and friends). The backend holds the regions map and owns "did real content
  reach the canvas" (ADR-009). Add a guard only for something the backend cannot
  see (alignments' zero-group fetch, MAF's first-paint gate).
- On `true` the mixin calls `markCanvasDrawn()`, and `isReady` follows once
  `isLoading` clears.

## What the mixin owns

**The activity phase is one expression, `computeActivityPhase`**
(`@jbrowse/render-core/displayPhase`), evaluated by every foundation. Customize
through the `fetchInert` hook, never by overriding `displayPhase`.
`viewportCurrent` is a **thunk** because it is the only input reading the
containing view. Parity is pinned in `displayPhase.test.ts` and
`displayPhaseWiring.test.ts`.
`installGlobalFetchAutorun` schedules **leading-edge**: MobX's `{ delay }` is
trailing-only and would stall cold open, so a `primed` flag drives a custom
`scheduler`.

## Context-loss recovery

- **A WebGL loss is silent and unfixable in place.** Calls on a lost context are
  no-ops that never throw, and `getContext('webgl2')` keeps returning the lost
  context. The hook waits a grace window for `webglcontextrestored`, then reports
  `createGpuContextLostError()` into `renderError`, which unmounts the canvas.
- **The recovery budget is windowed** (`RecoveryBudget`): a lifetime counter would
  spend a second loss an hour later on the first. A successful re-init does not
  reset it, since every flap contains one; a real `webglcontextrestored` or
  manual Retry does. **A WebGPU device loss shares the budget** and needs it more:
  that path re-inits invisibly, so uncapped it re-initializes against a dying
  device for the life of the tab.

**Every re-init needs a canvas element that never held a context.**
`getContext('webgl2')` returns the same lost context, and `getContext('2d')`
returns `null` on any element that once had WebGL. **A canvas's context kind is
permanent**, so a re-init whose HAL ladder lands on a different rung is stuck.

## Upload patterns

**One installer, one contract.** A display's wiring is one call,
`installUpload(self, backend, { cells, inputs?, encode?, render })`
([ADR-088](../architecture-decision-records/adr-088-one-upload-installer-over-one-cell-contract.md)).
`cells` is a map of immutable payloads. The installer diffs it by reference on
every commit, encodes and uploads what moved, releases what left, and re-uploads
everything into a fresh backend after context loss. Every backend implements
`upload(key, data)` and `release(key)`, so what remains per display is **what its
map is keyed by**:

| Key | Use when |
|---|---|
| `displayedRegionIndex` (`PerRegionRenderingBackend`) | each region's data is independent, or a whole-map computed hands back per-region payloads |
| a slot name, via `oneCell` | one payload for the whole view |
| a sibling's `sharedBackendKey`, one canvas-wide block each | one canvas paints several displays |

- **A cell keyed on a value reads it from its own computed.** The diff is by
  reference, so a cell built from a per-frame render-state getter re-uploads per
  frame. Synteny's clicked-outline cell once read `clickedFeatureId` off
  `renderParams` and re-packed on every pan frame. **No rendering gate sees this**
  (the picture is identical); a test that pans with a selection live and counts
  `upload` calls does (`outlineUploadSchedule.test.ts`).
- **Release is per key, never an active-set prune.** A prune computed from one
  display's map would wipe its siblings' buffers on a shared canvas (the HAL's
  old `pruneRegions(active)`). That is why the three installers (ADR-079)
  collapsed to one.
- **Absence is absence.** A whole-view display with nothing fetched leaves the key
  out (`oneCell(0, self.rpcData)` does), so the key is released and the frame
  clears. A fetch that came back *empty* must stay in the map, so `renderBlocks`
  answers true and `canvasDrawn` flips; otherwise the scrim never lifts.

### One autorun and a diff (`installUpload`)

- **`inputs` is the whole contract.** `encode`'s own reads wake the autorun but
  invalidate nothing, so a wide read there re-runs the diff and encodes nothing.
  Anything a settings change must reach the buffer through goes in `inputs`.
  [ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md)
  has the reasoning.

### Whole-map synced: skipping a region without leaving stale buffers

- **Forget a key when it leaves**: delete the HAL buffers and the memo entry
  together, or a returning region with an identical payload skips an upload onto
  destroyed buffers.
- **The one sub-region exception is the recolor.** `readYs` identity means "same
  layout run", so same bytes except the two per-read colour arrays rewrites the
  read pass alone. This needs the model to bake colour in its own computed
  downstream of layout (`laidOutByGroupUncolored` → `laidOutByGroupFramed` →
  `laidOutByGroup`).