# ADR-009: `canvasDrawn` reliability — backend-owned return and reset on invalidation

## Status

Accepted.

## Problem

`canvasDrawn` is the flag test selectors and loading overlays wait on. Two bugs
could set it spuriously:

**Bug 1 — early flip.** The render callback returned `true` (flipping
`canvasDrawn`) before any region data had arrived. Because `FetchVisibleRegions`
has a 600 ms debounce, the canvas showed as "done" while still blank.

**Bug 2 — stale flip.** `clearAllRpcData` cleared the canvas data and the
loaded-regions map but never reset `canvasDrawn`. After navigation or settings
change the flag stayed `true` from the previous paint, so tests that waited for
`pileup-display-done` got the old empty canvas.

## Decision

### `renderBlocks` returns `boolean`

The `AlignmentsBackend.renderBlocks` interface returns `boolean`:  
`true` — the backend drew content; `false` — nothing to draw (no regions loaded).

The render callback in `startGpuBackendLifecycle` propagates this directly:

```ts
render: b => {
  const state = self.renderState
  if (!state) return false
  return b.renderBlocks(self.renderBlocks, state)
}
```

The backend is the authoritative source of "is there anything to draw" — it owns
the regions map. The model layer must not duplicate that check (e.g. by reading
`loadedRegions.size`) because that leaks fetch-layer knowledge into the GPU layer.

### `clearAllRpcData` resets `canvasDrawn`

`MultiRegionDisplayMixin.clearAllRpcData` calls `self.resetCanvasDrawn()`.
`canvasDrawn` is re-earned only after the backend paints real content on the
next render tick.

`invalidateLoadedRegions` does **not** reset `canvasDrawn` — per ADR-006, stale
canvas content stays visible during a background re-fetch.

### `resetCanvasDrawn` lives in the mixin

The mutation is owned by `GpuBackendLifecycleSlotMixin` via an explicit
`resetCanvasDrawn()` action, symmetric with `markCanvasDrawn()`. Direct
assignment to `canvasDrawn` outside the mixin's own actions is not allowed
(MST enforces this).

## Invariants

- `renderBlocks` must return `false` when `regions.size === 0`, `true` after
  painting. A backend that always returns `true` will flip `canvasDrawn` on a
  blank canvas.
- Any code path that clears the canvas (clears `rpcDataMap` / display-specific
  data) must call `resetCanvasDrawn()`, either directly via `clearAllRpcData` or
  explicitly.
- The render callback must not add its own "skip" conditions based on fetch-layer
  state; all "nothing to draw" logic belongs in the backend's `renderBlocks`.
