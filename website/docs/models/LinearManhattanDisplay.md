---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearManhattanDisplay.md)

## Overview

GWAS Manhattan-plot display drawing -log10 p-values as a scored scatter along
the genome, with a feature widget on click.

### LinearManhattanDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmanhattandisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[effectiveTrackConfig](../basedisplay#getter-effectivetrackconfig),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderProps](../basedisplay#method-renderprops),
[renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

### Available via [TrackHeightMixin](../trackheightmixin)

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:**
[loadedRegions](../multiregiondisplaymixin#volatile-loadedregions)

**Getters:** [isReady](../multiregiondisplaymixin#getter-isready),
[viewportWithinLoadedData](../multiregiondisplaymixin#getter-viewportwithinloadeddata),
[svgReady](../multiregiondisplaymixin#getter-svgready),
[svgReadyExtraTerminal](../multiregiondisplaymixin#getter-svgreadyextraterminal),
[renderBlocks](../multiregiondisplaymixin#getter-renderblocks),
[displayPhase](../multiregiondisplaymixin#getter-displayphase)

**Actions:**
[setLoadedRegion](../multiregiondisplaymixin#action-setloadedregion),
[clearDisplaySpecificData](../multiregiondisplaymixin#action-cleardisplayspecificdata),
[clearAllRpcData](../multiregiondisplaymixin#action-clearallrpcdata),
[reload](../multiregiondisplaymixin#action-reload),
[invalidateLoadedRegions](../multiregiondisplaymixin#action-invalidateloadedregions),
[fetchNeeded](../multiregiondisplaymixin#action-fetchneeded),
[isCacheValid](../multiregiondisplaymixin#action-iscachevalid),
[getByteEstimateConfig](../multiregiondisplaymixin#action-getbyteestimateconfig),
[fetchRegions](../multiregiondisplaymixin#action-fetchregions),
[afterAttach](../multiregiondisplaymixin#action-afterattach)

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:**
[userByteSizeLimit](../regiontoolargemixin#property-userbytesizelimit)

**Volatiles:**
[regionTooLargeState](../regiontoolargemixin#volatile-regiontoolargestate),
[regionTooLargeReasonState](../regiontoolargemixin#volatile-regiontoolargereasonstate),
[featureDensityStats](../regiontoolargemixin#volatile-featuredensitystats)

**Getters:** [regionTooLarge](../regiontoolargemixin#getter-regiontoolarge),
[regionTooLargeReason](../regiontoolargemixin#getter-regiontoolargereason)

**Methods:**
[regionCannotBeRenderedText](../regiontoolargemixin#method-regioncannotberenderedtext)

**Actions:**
[setRegionTooLarge](../regiontoolargemixin#action-setregiontoolarge),
[setFeatureDensityStats](../regiontoolargemixin#action-setfeaturedensitystats),
[setFeatureDensityStatsLimit](../regiontoolargemixin#action-setfeaturedensitystatslimit),
[reload](../regiontoolargemixin#action-reload),
[forceLoad](../regiontoolargemixin#action-forceload)

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** [canvasDrawn](../renderlifecyclemixin#volatile-canvasdrawn),
[currentRenderingBackend](../renderlifecyclemixin#volatile-currentrenderingbackend),
[renderTick](../renderlifecyclemixin#volatile-rendertick),
[autorunsInstalled](../renderlifecyclemixin#volatile-autorunsinstalled),
[renderError](../renderlifecyclemixin#volatile-rendererror)

**Actions:** [markCanvasDrawn](../renderlifecyclemixin#action-markcanvasdrawn),
[resetCanvasDrawn](../renderlifecyclemixin#action-resetcanvasdrawn),
[stopRenderingBackend](../renderlifecyclemixin#action-stoprenderingbackend),
[renderNow](../renderlifecyclemixin#action-rendernow),
[setRenderError](../renderlifecyclemixin#action-setrendererror),
[attachRenderingBackend](../renderlifecyclemixin#action-attachrenderingbackend)

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** [activeStopToken](../fetchmixin#volatile-activestoptoken),
[fetchGeneration](../fetchmixin#volatile-fetchgeneration),
[error](../fetchmixin#volatile-error),
[statusMessage](../fetchmixin#volatile-statusmessage),
[statusProgress](../fetchmixin#volatile-statusprogress),
[fetchCanceled](../fetchmixin#volatile-fetchcanceled),
[regionStatuses](../fetchmixin#volatile-regionstatuses)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[resetStatus](../fetchmixin#action-resetstatus),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [WiggleScoreConfigMixin](../wigglescoreconfigmixin)

**Properties:** [resolution](../wigglescoreconfigmixin#property-resolution),
[displayCrossHatches](../wigglescoreconfigmixin#property-displaycrosshatches)

**Volatiles:** [loadedBpPerPx](../wigglescoreconfigmixin#volatile-loadedbpperpx)

**Getters:**
[scalebarOverlapLeft](../wigglescoreconfigmixin#getter-scalebaroverlapleft),
[posColor](../wigglescoreconfigmixin#getter-poscolor),
[negColor](../wigglescoreconfigmixin#getter-negcolor),
[bicolorPivot](../wigglescoreconfigmixin#getter-bicolorpivot),
[scaleType](../wigglescoreconfigmixin#getter-scaletype),
[autoscaleType](../wigglescoreconfigmixin#getter-autoscaletype),
[numStdDev](../wigglescoreconfigmixin#getter-numstddev),
[scatterPointSize](../wigglescoreconfigmixin#getter-scatterpointsize),
[summaryScoreMode](../wigglescoreconfigmixin#getter-summaryscoremode),
[renderingType](../wigglescoreconfigmixin#getter-renderingtype),
[minScore](../wigglescoreconfigmixin#getter-minscore),
[maxScore](../wigglescoreconfigmixin#getter-maxscore),
[minScoreBound](../wigglescoreconfigmixin#getter-minscorebound),
[maxScoreBound](../wigglescoreconfigmixin#getter-maxscorebound),
[hasResolution](../wigglescoreconfigmixin#getter-hasresolution)

**Actions:**
[toggleCrossHatches](../wigglescoreconfigmixin#action-togglecrosshatches),
[setResolution](../wigglescoreconfigmixin#action-setresolution),
[setLoadedBpPerPx](../wigglescoreconfigmixin#action-setloadedbpperpx),
[setScaleType](../wigglescoreconfigmixin#action-setscaletype),
[setColor](../wigglescoreconfigmixin#action-setcolor),
[setMinScore](../wigglescoreconfigmixin#action-setminscore),
[setMaxScore](../wigglescoreconfigmixin#action-setmaxscore),
[setRenderingType](../wigglescoreconfigmixin#action-setrenderingtype),
[setSummaryScoreMode](../wigglescoreconfigmixin#action-setsummaryscoremode),
[setAutoscale](../wigglescoreconfigmixin#action-setautoscale),
[isCacheValid](../wigglescoreconfigmixin#action-iscachevalid)

<details open>
<summary>LinearManhattanDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearManhattanDisplay'>
// code
type: types.literal('LinearManhattanDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: indexSnp

Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based) string.
Auto-tracks the highest-scoring loaded SNP unless the user pins one (see
`indexSnpPinned`).

```ts
// type signature
type indexSnp = IMaybe<ISimpleType<string>>
// code
indexSnp: types.maybe(types.string)
```

#### property: indexSnpPinned

True once the user pins a specific index SNP (right-clicking a point). While
false, the index auto-tracks the top hit as data loads.

```ts
// type signature
type indexSnpPinned = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
indexSnpPinned: types.stripDefault(types.boolean, false)
```

</details>

<details open>
<summary>LinearManhattanDisplay - Volatiles</summary>

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, ManhattanRpcResult>
// code
rpcDataMap: observable.map<number, ManhattanRpcResult>()
```

#### volatile: flatbushes

```ts
// type signature
type flatbushes = ObservableMap<number, Flatbush>
// code
flatbushes: observable.map<number, Flatbush>()
```

#### volatile: featureUnderMouse

```ts
// type signature
type featureUnderMouse = ManhattanHit | undefined
// code
featureUnderMouse: undefined as ManhattanHit | undefined
```

#### volatile: showLdLegend

```ts
// type signature
type showLdLegend = true
// code
showLdLegend: true
```

</details>

<details open>
<summary>LinearManhattanDisplay - Getters</summary>

#### getter: DisplayMessageComponent

```ts
type DisplayMessageComponent = LazyExoticComponent<
  ({ model }: { model: ManhattanDisplayModel }) => Element
>
```

#### getter: TooltipComponent

```ts
type TooltipComponent = ({
  model,
  clientMouseCoord,
}: {
  model: TooltipModel
  clientMouseCoord: [number, number]
}) => Element | null
```

#### getter: color

resolved point color (config slot value or its override)

```ts
type color = string
```

#### getter: colorBy

resolved coloring mode: 'normal' uses `color`, 'ld' colors by r² to the index
SNP

```ts
type colorBy = 'normal' | 'ld'
```

#### getter: ldAdapterConfig

the configured PLINK .ld adapter, or undefined when none is set (the slot
defaults to null, normalized here to undefined for "absent")

```ts
type ldAdapterConfig = Record<string, unknown> | undefined
```

#### getter: hasLdData

LD coloring needs a configured .ld adapter; without one the colorBy='ld'
controls are inert, so they're hidden/disabled

```ts
type hasLdData = boolean
```

#### getter: domain

nice-rounded [min, max] -log10 p domain across loaded regions, or undefined
before any data loads

```ts
type domain = [number, number] | undefined
```

#### getter: ticks

y-axis tick positions. Manhattan plots are linear-only (pre-transformed -log10 p
values); the inherited scaleType config is intentionally ignored so the axis
ticks stay consistent with the linear `domain`.

```ts
type ticks = YScaleTicks | undefined
```

#### getter: renderState

render geometry for the inner canvas (between top/bottom YScaleBar label
offsets) — the area both the GPU renderer and findManhattanHit work in. Using
self.height directly would drift the hit-test off the rendered points.

```ts
type renderState = ManhattanRenderState | undefined
```

#### getter: regionRefNames

displayedRegionIndex → refName lookup. Hit-testing reads this on every
mousemove; MobX caches the view so visibleRegions changes invalidate it once
rather than rebuilding per event.

```ts
type regionRefNames = ReadonlyMap<number, string>
```

#### getter: topSnp

highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default LD index
SNP. Derived from loaded data (not a fetch input), so it's applied via the
auto-pick autorun rather than read into rpcProps.

```ts
type topSnp = string | undefined
```

#### getter: indexSnpMissing

true when LD coloring is active with data loaded, but no region's LD data
referenced the index SNP — so every point is grey. LD is a single-region
analysis, so "found in no loaded region" means missing.

```ts
type indexSnpMissing = boolean
```

</details>

<details open>
<summary>LinearManhattanDisplay - Methods</summary>

#### method: rpcProps

fetch inputs watched by SettingsInvalidate — any change (color, colorBy, index
SNP, LD adapter) triggers a refetch, since the worker bakes per-feature color
into the result

```ts
type rpcProps = () => {
  color: string
  colorBy: 'normal' | 'ld'
  indexSnp: string | undefined
  ldAdapterConfig: Record<string, unknown> | undefined
}
```

#### method: trackMenuItems

Manhattan track menu: shared Score submenu plus LD-coloring controls. Rendering
type / Resolution / Scale type don't apply to single-point rendering of
pre-transformed -log10 p values. Placed after the color/index actions so
referencing them doesn't make MST inference circular.

```ts
type trackMenuItems = () => MenuItem[]
```

#### method: contextMenuItems

right-click menu for a clicked point: feature details plus, when an LD adapter
is configured, a shortcut to recolor by LD to that SNP

```ts
type contextMenuItems = (hit: ManhattanHit) => MenuItem[]
```

</details>

<details open>
<summary>LinearManhattanDisplay - Actions</summary>

#### action: selectFeature

open the feature details widget for a clicked point

```ts
type selectFeature = (hit: ManhattanHit) => void
```

#### action: setRpcData

```ts
type setRpcData = (idx: number, data: ManhattanRpcResult) => void
```

#### action: setFeatureUnderMouse

```ts
type setFeatureUnderMouse = (hit: ManhattanHit | undefined) => void
```

#### action: setShowLdLegend

```ts
type setShowLdLegend = (val: boolean) => void
```

#### action: setColorBy

```ts
type setColorBy = (mode: 'normal' | 'ld') => void
```

#### action: setIndexSnp

```ts
type setIndexSnp = (snp?: string | undefined) => void
```

#### action: colorByLdToHit

right-click "Color by LD to this SNP": switch into LD mode and pin the index on
the clicked point, so the auto-pick stops tracking the top hit. Keyed by chr:bp
(1-based) to match the worker's posKey. All mutations happen in one action so
rpcProps settles once and only a single recolor fetch fires.

```ts
type colorByLdToHit = (hit: ManhattanHit) => void
```

#### action: useTopHitAsIndex

release a pinned index back to auto-tracking, seeded at the current top hit (the
auto-pick autorun then keeps it on the top hit as data loads)

```ts
type useTopHitAsIndex = () => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: fetchNeeded

Manhattan features are 1:1 with the underlying SNPs (pre-transformed -log10 p
values) and don't downsample by zoom, so we never need to refetch on bpPerPx
change. We intentionally don't call setLoadedBpPerPx — the inherited
isCacheValid short-circuits to true whenever loadedBpPerPx is undefined, which
is exactly the behavior we want here.

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void> | undefined
```

#### action: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

#### action: startRenderingBackend

identity encode — RPC result is the upload payload

```ts
type startRenderingBackend = (backend: ManhattanRenderingBackend) => void
```

</details>
