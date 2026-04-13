# ADR-003: Settings-invalidation autorun pattern for withFetchLifecycle displays

## Status

Accepted

## Context

Display types that use `MultiRegionDisplayMixin` + `withFetchLifecycle` (canvas
`LinearBasicDisplay`, wiggle `LinearWiggleDisplay` / `MultiLinearWiggleDisplay`,
alignments `LinearAlignmentsDisplay`) all need to invalidate and re-fetch when
user-facing settings change — e.g. `showOnlyGenes`, `colorByCDS`, `filterBy`,
`resolution`.

Before standardization, three different patterns existed across these types:

**Canvas** used a `reaction` with a data-function that returned a plain object,
a custom `equals` comparator to prevent spurious fires, and a conditional guard
in the effect:

```typescript
reaction(
  () => ({ subfeatureLabels, colorByCDS, geneGlyphMode, showOnlyGenes, displayMode }),
  () => {
    if (self.loadedRegions.size > 0 || self.regionTooLarge) {
      self.refetchForCurrentView()
    }
  },
  { delay: 100, fireImmediately: false, equals: (a, b) => ... },
)
```

**Wiggle** used two separate `autorun`s, one per setting, each with its own
`prevValue` variable:

```typescript
let prevPivot: number | undefined
autorun(() => {
  const pivot = self.effectiveBicolorPivot
  if (prevPivot !== undefined && pivot !== prevPivot) {
    self.clearAllRpcData()
  }
  prevPivot = pivot
})

let prevResolution: number | undefined
autorun(() => {
  const { resolution } = self
  if (prevResolution !== undefined && resolution !== prevResolution) {
    self.clearAllRpcData()
  }
  prevResolution = resolution
})
```

**Alignments** used a single `autorun` with a JSON-stringified key over all
settings — already the most correct approach:

```typescript
let prevKey: string | undefined
autorun(() => {
  const key = JSON.stringify({ filterBy, showLinkedReads, colorBy, ... })
  if (prevKey !== undefined && key !== prevKey) { self.clearAllRpcData() }
  prevKey = key
}, { name: 'LinearAlignmentsDisplay:invalidateData' })
```

### Bug in the canvas reaction

The canvas guard `self.loadedRegions.size > 0 || self.regionTooLarge` silently
dropped settings changes that arrived while a fetch was already in-flight.
`loadedRegions` is cleared by `softReset()` at the start of every
`refetchForCurrentView()` call, so `loadedRegions.size === 0` during any active
fetch. If the user changed `showOnlyGenes` while the track was loading, the
reaction fired but the guard failed: no new fetch was triggered. The in-flight
fetch completed with the old settings, populated `loadedRegions`, and nothing
triggered a second fetch — leaving the filter inactive until the user scrolled
to a new region.

This explained the intermittent failure: the guard passed when data was fully
loaded but failed during loading, so the feature "sometimes worked".

### Evaluated alternative: refetchForCurrentView() vs clearAllRpcData()

During standardization, canvas continued to call `refetchForCurrentView()`
(which uses `softReset()` — preserves `rpcDataMap`) while wiggle/alignments
called `clearAllRpcData()` (which clears `rpcDataMap` immediately). The argument
for canvas was "smooth UX: old features remain visible while the new fetch
completes, avoiding a blank flash."

This was evaluated and rejected for settings changes:

- For `showOnlyGenes`, keeping old features visible is actively confusing:
  features the user just asked to hide remain rendered until the fetch
  completes.
- For `colorByCDS`, `displayMode`, and `geneGlyphMode`, a brief blank canvas is
  no worse than seeing transiently incorrect features.
- `softReset()` (preserve `rpcDataMap`) is appropriate when the existing data is
  still valid but needs repositioning — specifically the zoom-relayout path
  (`ZoomRelayout` reaction, `needsLayoutRefresh`). For settings changes the old
  data is not valid at all.

## Decision

All `withFetchLifecycle` display types use the **autorun + prevKey +
`clearAllRpcData()`** pattern for settings invalidation:

```typescript
let prevSettingsKey: string | undefined
addDisposer(self, autorun(() => {
  const key = JSON.stringify({ setting1: self.setting1, setting2: self.setting2, ... })
  if (prevSettingsKey !== undefined && key !== prevSettingsKey) {
    self.clearAllRpcData()
  }
  prevSettingsKey = key
}, { name: 'DisplayType:SettingsInvalidate' }))
```

Wiggle's two separate per-setting autoruns are consolidated into one.

## Reasoning

**`autorun` + prevKey is safer than `reaction` + object return + custom
`equals`.** A `reaction` that returns a plain object fires on every observation
because object references always differ; a custom `equals` is required to
prevent this. `autorun`

- JSON-stringified prevKey avoids the object-comparison problem entirely with
  simpler, more readable code.

**No conditional guard is needed.** `clearAllRpcData()` is safe in all states:
it stops any in-flight fetch, clears data, and increments `fetchGeneration` to
trigger `FetchVisibleRegions`. There is no state in which calling it is harmful.
The old `loadedRegions.size > 0` guard was both incorrect (missed the
`isLoading` case) and unnecessary.

**One autorun per display type is cleaner than one per setting.** A single
JSON-stringified key handles any number of settings, prevents the double-call
edge case when two settings change in the same MobX action, and matches the
structure alignments already used.

**`clearAllRpcData()` gives honest visual feedback.** A blank canvas signals
that data is being re-fetched with new parameters. Showing stale data while
fetching new data is potentially misleading for any settings change.

## Consequences

- All three display families (canvas, wiggle, alignments) use one uniform
  invalidation pattern. New display types using `withFetchLifecycle` should
  follow the same structure.
- `softReset()` (preserving `rpcDataMap`) remains the correct tool for the
  zoom-relayout path — where the same data needs repositioning at a new
  `bpPerPx` — not for settings invalidation.
- `HiC` and `MultiVariantDisplay` / `MultiVariantMatrixDisplay` use a different
  fetch model (a single async autorun that directly performs the RPC call and
  re-fires when any observable changes). They do not use `withFetchLifecycle`
  and are not affected by this decision.
- The `showOnlyGenes` filter in `executeRenderFeatureData.ts` was also corrected
  in the same pass: it now preserves top-level `mRNA`, `transcript`, and `CDS`
  features (not just `gene`), since these are valid top-level feature types in
  GFF3 that represent gene-like entries without a parent gene record.
