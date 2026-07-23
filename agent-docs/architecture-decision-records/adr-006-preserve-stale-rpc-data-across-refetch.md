---
status: Accepted
summary: "Preserve stale `rpcDataMap` through a refetch"
---

# ADR-006: Preserve stale `rpcDataMap` through a refetch

## Status

Accepted for viewport-agnostic display types (canvas today). Revises
ADR-003's blank-on-settings-change stance. Viewport-baked display types
keep clearing — see "When to preserve vs clear" below.

**Naming reconciled to current source.** The decision holds and is live in
`plugins/canvas/src/LinearBasicDisplay/baseModel.ts`, but the symbols in the
original code blocks were renamed. Map:

| ADR (original) | Current source |
| --- | --- |
| `rawRpcDataMap` | `rpcDataMap` |
| `onFetchNeeded` | `fetchNeeded` |
| `pruneRawRpcDataMapToVisible` | `pruneRpcDataMapToVisible` |
| `withFetchLifecycle` | `fetchRegions` (via `MultiRegionDisplayMixin`) |
| `fetchedBpPerPxMap` | removed — this display is `alwaysRender` (BigWig), so no per-region bpPerPx map |

Note also: `LinearBasicDisplay` preserves `rpcDataMap` (this ADR); its sibling
`LinearMultiRowFeatureDisplay` clears it in `clearDisplaySpecificData` — the
preserve-vs-clear test below is per display, not per plugin.

## When to preserve vs clear

**Preserve** if the display's per-region data is viewport-agnostic —
stale data rendered at a new `bpPerPx` still looks correct, just
potentially laid out differently. Examples: canvas features
(bp-space coordinates, layout re-derived main-thread).

**Clear** if the data is viewport-baked — rasterized or binned at
fetch-time `bpPerPx` so rendering at a different scale visibly incorrectly sizes
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

Don't clear `rpcDataMap` in `clearDisplaySpecificData`. Prune out-of-viewport
regions at the top of `fetchNeeded` to cap growth. (Current source; see the
naming map under Status for the original names.)

```typescript
clearDisplaySpecificData() {
  // Intentionally a no-op on the data: rpcDataMap (and densityStatsPerRegion,
  // for the derived too-large banner) survive clearAllRpcData. Growth is
  // capped by pruneRpcDataMapToVisible inside fetchNeeded instead.
},

pruneRpcDataMapToVisible(visible: Set<number>) {
  for (const key of self.rpcDataMap.keys()) {
    if (!visible.has(key)) {
      self.rpcDataMap.delete(key)
    }
  }
},

fetchNeeded(needed) {
  self.pruneRpcDataMapToVisible(
    new Set(view.bufferedVisibleRegions.map(b => b.displayedRegionIndex)),
  )
  self.fetchRegions(needed, /* ... */)
},
```

The derived `laidOutDataMap` computed recomputes on viewport/label changes, so
stale per-region data + current inputs gives a coherent intermediate frame.
When `regionTooLarge` is true, `laidOutDataMap` returns empty, so no stale
features render through the banner.

## No-leak argument

Every invalidation path routes through `FetchVisibleRegions` →
`fetchNeeded`, which prunes before fetching. A stale region number can
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

## Rejected extensions

**Alignments arcs.** Arc data (`arcX1/arcX2` as bp offsets) is viewport-agnostic
and could in principle be preserved. Not done: arcs are computed *from pileup
data* inside `fetchNeeded`, not fetched independently. Pileup must keep
clearing (compact-zoom pixel geometry is viewport-baked). Preserving arcs while
pileup is blank would show arc curves floating over empty space — worse than a
clean flash.

**MultiSampleVariantDisplay.** `clearDisplaySpecificData` is the base no-op.
Nothing to change.

## Revisit if

Someone complains that stale non-gene features visible for 600ms after
`setShowOnlyGenes(true)` is worse than the flash. Fix: split settings
into "data-shape" (clear) vs "rendering" (preserve). Not worth building
preemptively.
