# BaseLinearDisplay fetch system

`models/FetchMixin.ts` (stop-token rotation, staleness, `fetchGeneration`,
`isLoading`) + `models/MultiRegionDisplayMixin.ts` (the five autoruns,
`fetchRegions`, `loadedRegions`, overridable hooks).

The **status chrome** that renders this fetch state (loading overlay / error bar
/ too-large banner) is `components/DisplayChrome.tsx` — the single wrapper every
GPU display uses, branching on `computeDisplayPhase`. See
`agent-docs/reference/DISPLAYCHROME.md` (adoption map + the SVG arc exception)
and `agent-docs/architecture-decision-records/adr-026-*` (why the layering
stays; don't re-litigate). Its comment block holds the load-bearing
early-`return` + loading-thunk constraints.

## MultiRegionDisplayMixin

### Five autoruns installed in `afterAttach`

| Name                                 | Trigger                                                                                                 | Action                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `DisplayedRegionsChange`             | `view.displayedRegions` entries change (chromosome navigation)                                          | `clearAllRpcData()`                                       |
| `FetchVisibleRegions`                | `fetchGeneration` (bumps at fetch end), `view.visibleRegions`, `error`, `regionTooLarge` (600 ms delay) | calls `fetchNeeded` with uncovered buffered regions       |
| `SettingsInvalidate`                 | `self.rpcProps()` (any field it reads); installed only when subclass defines the method                 | `clearAllRpcData()`                                       |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions`                                                                                   | `clearAllRpcData()` if `error` or `fetchCanceled` is set (the derived `regionTooLarge` self-releases, so it isn't part of this) |
| `ClearHoverOnRegionTooLarge`         | `self.regionTooLarge`                                                                                   | fires the overridable `onRegionTooLarge()` hook (no-op base) when it becomes true, so a display can drop its hover/tooltip when the banner replaces the content (alignments clears its mouseover) |

All five are installed via `autorunOnReadyView(self, view => …, opts)`, which
runs its body only once `view.initialized` (measured width + ready assemblies)
and passes the view in. Use it for **any** view-dependent autorun on an LGV
display — before init, view-derived getters like `view.width` throw by design,
and an unguarded read in an `afterAttach` body propagates out of display
instantiation and gets misread by the session loader as an invalid track (it
then drops it). Never read `view.width`/`dynamicBlocks`/`showLabels`-style
getters synchronously in an `afterAttach` body; do it inside
`autorunOnReadyView`. The track-vs-region assembly mismatch check lives inside
`FetchVisibleRegions`, so a mismatch error surfaces only after its 600 ms
debounce.

**A display's own `afterAttach` must NOT `superAfterAttach()`.** Unlike regular
actions (`rpcProps`, `setError`, … — extend those via the super-capture pattern),
`@jbrowse/mobx-state-tree` **auto-chains lifecycle hooks** (`afterAttach`,
`beforeDestroy`, …): the fork runs the base hook automatically before the
subclass's. Capturing `const superAfterAttach = self.afterAttach` and calling it
runs `MultiRegionDisplayMixin.afterAttach` **twice**, double-installing all five
autoruns (masked by the `isLoading`/stale guards, but wasteful). Just define
`afterAttach` and let the auto-chain run the base. Proven in
`models/afterAttachAutoChain.test.ts`.

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
| `onRegionTooLarge()`         | no-op       | clear transient hover/tooltip state when `regionTooLarge` becomes true (the banner replaces the content); fired by the `ClearHoverOnRegionTooLarge` autorun                                                                                                                                   |

The region-too-large gate itself lives in `RegionTooLargeMixin`: a derived byte estimate (the old imperative `setRegionTooLarge` flag path was removed). A byte-gated display opts into the derived, self-releasing banner by overriding `derivedRegionTooLargeEnabled` → true (+ `configuredFetchSizeLimit`, and `densityTooLargeForDerivedGate` for a second axis). See that mixin's header comment.

### `loadedRegions`

`fetchRegions` calls `setLoadedRegion` (an MST action) only after the work
callback returns — this keeps the mutation inside an action context after the
async boundary, and ensures the GPU upload autorun never sees `loadedRegions`
populated before the backing data exists. `FetchVisibleRegions` checks coverage
against `view.visibleRegions` but requests `view.bufferedVisibleRegions` (wider,
for smooth scrolling), so subsequent pans within the buffer require no re-fetch.

### `clearAllRpcData` vs `invalidateLoadedRegions`

`clearAllRpcData` — full reset: cancels fetch, clears error, loadedRegions,
display-specific data, and canvas drawn flag. It does NOT touch the too-large
gate — that's derived (a pure function of the cached estimate × viewport) and
self-releases, and the cached estimate deliberately survives so the banner
doesn't flicker on a viewport-change clear.

`invalidateLoadedRegions` — lighter reset: cancels fetch and clears
loadedRegions, leaving error intact. Used by alignments after sort/group change.

### `untracked` semantics

| Call                                                   | Type            | Reason                                                                                                                                       |
| ------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `untracked(() => self.isLoading)`                      | perf guard      | prevents extra fire on fetch start; `fetchGeneration` already covers post-fetch re-evaluation                                                |
| `untracked(() => self.loadedRegions.get(...))`         | perf guard      | prevents autorun re-fire when regions are populated; `fetchGeneration` bump covers it                                                        |
| `untracked(() => self.error \|\| self.fetchCanceled)` | **correctness** | if either were tracked, setting them would immediately re-fire `ClearBlockingStateOnViewportChange` and wipe them before any viewport change |

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
  covered. Because `loadedRegions[i]` is the exact region the adapter was
  queried with, this is _exactly_ the range where fetched data (e.g. pileup
  coverage) is complete, so it's a precise staleness test, not a heuristic. Goes
  false the instant the viewport extends past loaded data (zoom-out / pan beyond
  buffer), _before_ the debounced refetch starts.

`displayPhase` packages the whole policy in one place: its `loading` term is
`!isReady || !viewportWithinLoadedData || fetchCanceled`, ranked below the
terminal `regionTooLarge`/`error`/`renderError` states in `computeDisplayPhase`.
**Every** display type's loading overlay is the one shared
`DisplayLoadingOverlay` component, made visible by `DisplayChrome` passing
`visible={displayPhase === 'loading'}` — alignments, canvas, wiggle,
multi-wiggle, manhattan, maf (no per-display overlay wrappers, no
`loadingOverlayVisible` getter). `isReady` stays `canvasDrawn && !isLoading`
(the render-lifecycle axis) and `viewportWithinLoadedData` stays separate rather
than folded into `isReady`, because the autorun reads `loadedRegions` untracked
while the getter reads it tracked.

Known gap: the check is spatial only, so wiggle-family displays still have a
brief un-flagged window on _zoom_ (resolution rebinning is an `isCacheValid`
axis, not a `loadedRegions` bounds axis).

## Test files

Tests in `fetchLifecycle.test.ts` / `fetchAutorun.test.ts` /
`fetchAutorunIntegration.test.ts` use simplified shapes vs production — notably
`fetchLifecycle` renames `activeStopToken`→`renderingStopToken` and adds a
test-only `dataVersion` counter, and uses wrapped
`{ region, displayedRegionIndex }` blocks where production blocks are flat.
Check the test helpers before assuming a field name matches the model.
