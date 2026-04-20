# ADR-006: Preserve stale `rpcDataMap` through a refetch

## Status

Accepted for viewport-agnostic display types (canvas today). Revises
ADR-003's blank-on-settings-change stance. Viewport-baked display types
keep clearing — see "When to preserve vs clear" below.

## When to preserve vs clear

**Preserve** if the display's per-region data is viewport-agnostic —
stale data rendered at a new `bpPerPx` still looks correct, just
potentially laid out differently. Examples: canvas features
(bp-space coordinates, layout re-derived main-thread), alignments arcs.

**Clear** if the data is viewport-baked — rasterized or binned at
fetch-time `bpPerPx` so rendering at a different scale visibly mis-sizes
the output. Examples: wiggle tiles (bin widths stretch), alignments
pileup (glyph pixel geometry baked for compact zooms).

The test: "can I render this at a different `bpPerPx` than it was fetched
at and still trust what I see?" If no, clear — the flash is unavoidable
for correctness.

## Context

Canvas `clearDisplaySpecificData` used to call `rawRpcDataMap.clear()` on
every settings change, pan across regions, and reload. The derived
`rpcDataMap` returned empty; labels, glyphs, and overlays disappeared for
~300 ms + RPC round-trip. Users read this as a bug.

ADR-003 defended the blank as "honest feedback that data is being
re-fetched." Empirically, it reads as a flicker and the loading spinner
already signals loading.

## Decision

Don't clear `rawRpcDataMap` in `clearDisplaySpecificData`. Prune
out-of-viewport regions at the top of `onFetchNeeded` to cap growth.

```typescript
clearDisplaySpecificData() {
  self.fetchedBpPerPxMap.clear()
  self.setRegionTooLarge(false)
  self.setScrollTop(0)
},

pruneRawRpcDataMapToVisible(visible: Set<number>) {
  for (const key of [...self.rawRpcDataMap.keys()]) {
    if (!visible.has(key)) {
      self.rawRpcDataMap.delete(key)
      self.fetchedBpPerPxMap.delete(key)
    }
  }
},

onFetchNeeded(needed) {
  self.pruneRawRpcDataMapToVisible(
    new Set(view.bufferedVisibleRegions.map(b => b.displayedRegionIndex)),
  )
  self.withFetchLifecycle(needed, /* ... */)
},
```

The derived `rpcDataMap` view recomputes on viewport/label changes, so
stale raw + current inputs gives a coherent intermediate frame.

## No-leak argument

Every invalidation path routes through `FetchVisibleRegions` →
`onFetchNeeded`, which prunes before fetching. A stale region number can
only survive if no fetch ever fires after a clear — teardown only.

## Revises ADR-003

ADR-003's two premises were both shaky:

- "Brief blank is no worse than stale features" — false past ~200 ms,
  which is common.
- "For `showOnlyGenes`, stale features mislead" — partially true, but
  most settings only change styling, not which features return. For those
  the stale frame is correct-looking.

Net: "honest blank" overfit `showOnlyGenes` and ignored the default case.
ADR-003's consolidation of `clearAllRpcData` over `refetchForCurrentView`
still stands — we just stop clearing *data* along with *state*.

## Revisit if

Someone complains that stale non-gene features visible for 600ms after
`setShowOnlyGenes(true)` is worse than the flash. Fix: split settings
into "data-shape" (clear) vs "rendering" (preserve). Not worth building
preemptively.
