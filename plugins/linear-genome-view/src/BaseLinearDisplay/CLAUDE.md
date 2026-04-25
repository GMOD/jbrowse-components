# BaseLinearDisplay fetch system

## Production code

| File | Purpose |
|------|---------|
| `models/FetchMixin.ts` | Stop-token rotation, staleness, `fetchSignal`, `isLoading` |
| `models/MultiRegionDisplayMixin.ts` | Four autoruns, `fetchRegions`, `loadedRegions` |

### Key invariants

- `fetchSignal` bumps at fetch **end** (success, error, or cancel). Autoruns use
  `void self.fetchSignal` to re-evaluate after a fetch completes. `isLoading` is
  intentionally **not** a dependency — it would cause an extra autorun fire on
  fetch start, wasting the 600 ms debounce window.
- `untracked(regionTooLarge || error)` in `ClearBlockingStateOnViewportChange` is
  a **correctness requirement**: if either were tracked, setting them would
  immediately re-fire the autorun and wipe them before any viewport change occurs.
- `untracked(isLoading)` and `untracked(loadedRegions.get(...))` in
  `FetchVisibleRegions` are performance guards only — removing them would not
  break correctness.

### `boundsValid` check

```ts
loaded?.refName === vr.refName &&
Math.floor(vr.start) >= loaded.start &&
Math.ceil(vr.end) <= loaded.end
```

`Math.floor`/`Math.ceil` handle fractional bpPerPx where visible block edges
land on non-integer genomic positions.

## Test files

| File | What it tests | Simplifications vs production |
|------|--------------|-------------------------------|
| `fetchLifecycle.test.ts` | Fetch state machine (no MobX) | `withFetchLifecycle` bundles `runFetch` + `fetchRegions`; field names differ (see below) |
| `fetchAutorun.test.ts` | `boundsValid` / `isCacheValid` logic | Wrapped `{ region, displayedRegionIndex }` shape; production blocks are flat |
| `fetchAutorunIntegration.test.ts` | MobX autorun reactivity | `fetchGeneration` proxies `fetchSignal`; no assembly check; visible blocks used directly instead of `bufferedVisibleRegions` |

### `fetchLifecycle.test.ts` field name mapping

| Test | Production (`FetchMixin`) |
|------|--------------------------|
| `renderingStopToken` | `activeStopToken` |
| `fetchGeneration` | `fetchSignal` |
| `dataVersion` | test-only (counts `setLoadedRegion` calls) |
