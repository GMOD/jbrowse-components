---
id: multiregiondisplaymixin
title: MultiRegionDisplayMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiRegionDisplayMixin.md)

## Docs

Per-region fetch lifecycle for LGV-based GPU displays. Installs four autoruns in
`afterAttach` and exposes overridable hooks (`fetchNeeded`, `rpcProps`,
`isCacheValid`, `getByteEstimateConfig`, `clearDisplaySpecificData`) plus the
`fetchRegions` / `loadedRegions` machinery.

extends

- [RegionTooLargeMixin](../regiontoolargemixin)
- [RenderLifecycleMixin](../renderlifecyclemixin)
- [FetchMixin](../fetchmixin)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload, forceLoad

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** canvasDrawn, currentRenderingBackend, renderTick,
autorunsInstalled, renderError

**Actions:** markCanvasDrawn, resetCanvasDrawn, stopRenderingBackend, renderNow,
setRenderError, attachRenderingBackend

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage

**Getters:** isLoading

**Actions:** setError, setStatusMessage, cancelFetch, runFetch

### MultiRegionDisplayMixin - Volatiles

#### volatile: loadedRegions

regions whose data has been fetched and committed, keyed by
displayedRegionIndex; populated only after the fetch work callback returns

```js
// type signature
ObservableMap<number, Region>
// code
loadedRegions: observable.map<number, Region>()
```

### MultiRegionDisplayMixin - Getters

#### getter: isReady

true once the canvas has painted and no fetch is in flight

```js
// type
boolean
```

#### getter: viewportWithinLoadedData

true when every visible block lies within an already-fetched region — i.e. the
viewport shows data we actually loaded, not the stale fringe left after a
zoom-out/pan. Drives the loading overlay through the pre-refetch debounce.
Spatial only; see CLAUDE.md for why this is exact and for the
resolution-staleness gap.

```js
// type
boolean
```

#### getter: renderBlocks

Shared cached view for every LGV-based GPU display. A single displayedRegion may
produce multiple render blocks (shared GPU buffer, different scissor clips on
screen). Plugins that want to suppress rendering in certain states (e.g. no
domain yet) can override this getter to return [] — the autorun lifecycle will
then issue an empty-blocks render that clears the canvas.

```js
// type
RenderBlock[]
```

#### getter: loadingOverlayVisible

whether the loading scrim should show: data not ready yet, or stale data
(viewport past loaded) still on screen. Not while regionTooLarge / fetch error /
renderError — those render their own terminal UI. The single signal every
display's loading overlay reads.

```js
// type
boolean
```

### MultiRegionDisplayMixin - Actions

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```js
// type signature
setLoadedRegion: (displayedRegionIndex: number, region: Region) => void
```

#### action: clearDisplaySpecificData

no-op base — subclasses override to clear rpcDataMap etc.

```js
// type signature
clearDisplaySpecificData: () => void
```

#### action: clearAllRpcData

full reset: cancels fetch, clears error, regionTooLarge, loadedRegions,
display-specific data, and the canvas-drawn flag

```js
// type signature
clearAllRpcData: () => void
```

#### action: reload

Default reload: full reset. Subclasses with extra teardown can override (and
chain to `clearAllRpcData` directly if needed).

```js
// type signature
reload: () => void
```

#### action: invalidateLoadedRegions

lighter reset: cancels fetch and clears loadedRegions, leaving error and
regionTooLarge intact

```js
// type signature
invalidateLoadedRegions: () => void
```

#### action: fetchNeeded

Overridable hook (no-op base): override to call
`this.fetchRegions(needed, async ctx => { ... })`.

```js
// type signature
fetchNeeded: (_needed: { region: Region; displayedRegionIndex: number; }[]) => void
```

#### action: isCacheValid

Overridable hook: return `false` to force re-fetch at the current zoom (wiggle
uses this for zoom-level changes).

```js
// type signature
isCacheValid: (_displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

Overridable hook: return config to enable byte-estimate gating before fetch.

```js
// type signature
getByteEstimateConfig: () => ByteEstimateConfig | null
```

#### action: fetchRegions

Run a per-region fetch with byte-estimate gating. Marks regions as loaded only
AFTER the work callback has populated display-specific data (rpcDataMap,
cellData, etc) so the GPU upload autorun sees committed data when it observes
loadedRegions.

```js
// type signature
fetchRegions: (needed: { region: Region; displayedRegionIndex: number; }[], work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```

#### action: afterAttach

installs the four fetch-lifecycle autoruns (DisplayedRegionsChange,
FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange)

```js
// type signature
afterAttach: () => void
```
