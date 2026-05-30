# BaseLinearDisplay fetch system

## Production code

| File                                | Purpose                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `models/FetchMixin.ts`              | Stop-token rotation, staleness, `fetchGeneration`, `isLoading`    |
| `models/MultiRegionDisplayMixin.ts` | Four autoruns, `fetchRegions`, `loadedRegions`, overridable hooks |

## MultiRegionDisplayMixin

### Four autoruns installed in `afterAttach`

| Name                                 | Trigger                                                                                                 | Action                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `DisplayedRegionsChange`             | `view.displayedRegions` entries change (chromosome navigation)                                          | `clearAllRpcData()`                                       |
| `FetchVisibleRegions`                | `fetchGeneration` (bumps at fetch end), `view.visibleRegions`, `error`, `regionTooLarge` (600 ms delay) | calls `fetchNeeded` with uncovered buffered regions       |
| `SettingsInvalidate`                 | `self.rpcProps()` (any field it reads); installed only when subclass defines the method                 | `clearAllRpcData()`                                       |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions`                                                                                   | `clearAllRpcData()` if `regionTooLarge` or `error` is set |

All four early-return on `!view.initialized`. The track-vs-region assembly
mismatch check lives inside `FetchVisibleRegions`, so a mismatch error surfaces
only after its 600 ms debounce.

`onDisplayedRegionsChange(self, clear, name?)` (exported helper, NOT a 5th
installed autorun) is opt-in for per-region state keyed by
`displayedRegionIndex` that must survive `clearAllRpcData` — chromosome nav
reuses indices, so a stale entry would apply to the wrong chromosome (canvas's
`densityStatsPerRegion` is the case). Displays cleared via
`clearDisplaySpecificData` don't need it.

### Overridable hooks — subclasses must/can override

| Hook                         | Default     | Override to                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchNeeded(needed)`        | no-op       | call `this.fetchRegions(needed, async ctx => { ... })`                                                                                                                                                                                                                                       |
| `rpcProps()`                 | not defined | declare a method returning the literal RPC payload; every field it reads becomes a cache key via `SettingsInvalidate`. The mixin doesn't declare a base default so subclass return types stay narrow through MST `.views()` chains; subclasses extend via the standard super-capture pattern |
| `isCacheValid(idx)`          | `true`      | return `false` to force re-fetch at current zoom (wiggle uses this for zoom-level changes)                                                                                                                                                                                                   |
| `getByteEstimateConfig()`    | `null`      | return config to enable byte-estimate gating before fetch                                                                                                                                                                                                                                    |
| `clearDisplaySpecificData()` | no-op       | clear subclass-owned data maps (rpcDataMap, cellData, etc.)                                                                                                                                                                                                                                  |

### `loadedRegions`

`fetchRegions` calls `setLoadedRegion` (an MST action) only after the work
callback returns — this keeps the mutation inside an action context after the
async boundary, and ensures the GPU upload autorun never sees `loadedRegions`
populated before the backing data exists. `FetchVisibleRegions` checks coverage
against `view.visibleRegions` but requests `view.bufferedVisibleRegions` (wider,
for smooth scrolling), so subsequent pans within the buffer require no re-fetch.

### `clearAllRpcData` vs `invalidateLoadedRegions`

`clearAllRpcData` — full reset: cancels fetch, clears error, regionTooLarge,
loadedRegions, display-specific data, and canvas drawn flag.

`invalidateLoadedRegions` — lighter reset: cancels fetch and clears
loadedRegions, leaving error and regionTooLarge intact. Used by alignments after
sort/group change.

### `untracked` semantics

| Call                                                   | Type            | Reason                                                                                                                                       |
| ------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `untracked(() => self.isLoading)`                      | perf guard      | prevents extra fire on fetch start; `fetchGeneration` already covers post-fetch re-evaluation                                                |
| `untracked(() => self.loadedRegions.get(...))`         | perf guard      | prevents autorun re-fire when regions are populated; `fetchGeneration` bump covers it                                                        |
| `untracked(() => self.regionTooLarge \|\| self.error)` | **correctness** | if either were tracked, setting them would immediately re-fire `ClearBlockingStateOnViewportChange` and wipe them before any viewport change |

### `isBlockCovered` / `viewportWithinLoadedData`

`isBlockCovered(loaded, block)` (exported helper) is the single source of truth
for "is this visible block already fetched":

```ts
loaded?.refName === block.refName &&
  Math.floor(block.start) >= loaded.start &&
  Math.ceil(block.end) <= loaded.end
```

`Math.floor`/`Math.ceil` handle fractional bpPerPx where visible block edges
land on non-integer genomic positions. Two consumers:

- `FetchVisibleRegions` autorun — `!isBlockCovered` (plus `!isCacheValid`) is
  the refetch trigger.
- `viewportWithinLoadedData` getter — true when **every** visible block is
  covered. Because `loadedRegions[i]` is the exact region the adapter was queried
  with, this is _exactly_ the range where fetched data (e.g. pileup coverage) is
  complete, so it's a precise staleness test, not a heuristic. Goes false the
  instant the viewport extends past loaded data (zoom-out / pan beyond buffer),
  _before_ the debounced refetch starts.

The `loadingOverlayVisible` getter packages the whole policy in one place:
`(!isReady || !viewportWithinLoadedData) && !regionTooLarge && !error`. **Every**
display type's loading overlay is the one shared `DisplayLoadingOverlay`
component reading this getter — alignments, canvas, wiggle, multi-wiggle,
manhattan, maf (no per-display overlay wrappers). `isReady` stays
`canvasDrawn && !isLoading` (the render-lifecycle axis) and `viewportWithinLoadedData`
stays separate rather than folded into `isReady`, because the autorun reads
`loadedRegions` untracked while the getter reads it tracked.

Known gap: the check is spatial only, so wiggle-family displays still have a
brief un-flagged window on _zoom_ (resolution rebinning is an `isCacheValid`
axis, not a `loadedRegions` bounds axis).

## Test files

| File                              | What it tests                                   | Simplifications vs production                                                            |
| --------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `fetchLifecycle.test.ts`          | Fetch state machine (no MobX)                   | `withFetchLifecycle` bundles `runFetch` + `fetchRegions`; field names differ (see below) |
| `fetchAutorun.test.ts`            | `boundsValid` / `isCacheValid` logic            | Wrapped `{ region, displayedRegionIndex }` shape; production blocks are flat             |
| `fetchAutorunIntegration.test.ts` | MobX autorun reactivity + `untracked` semantics | no assembly check; visible blocks used directly instead of `bufferedVisibleRegions`      |

### `fetchLifecycle.test.ts` field name mapping

| Test                 | Production (`FetchMixin`)                  |
| -------------------- | ------------------------------------------ |
| `renderingStopToken` | `activeStopToken`                          |
| `dataVersion`        | test-only (counts `setLoadedRegion` calls) |
