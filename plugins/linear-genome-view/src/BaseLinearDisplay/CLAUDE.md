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

### `boundsValid` check

```ts
loaded?.refName === block.refName &&
  Math.floor(block.start) >= loaded.start &&
  Math.ceil(block.end) <= loaded.end
```

`Math.floor`/`Math.ceil` handle fractional bpPerPx where visible block edges
land on non-integer genomic positions.

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
