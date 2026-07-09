---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts).

## Overview

GWAS Manhattan-plot display drawing -log10 p-values as a scored scatter along
the genome, with a feature widget on click.

## Members

| Member                                                       | Kind       | Description                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                       | Properties |                                                                                                                                                                                                                                                                                                                                                                         |
| [configuration](#property-configuration)                     | Properties |                                                                                                                                                                                                                                                                                                                                                                         |
| [indexSnp](#property-indexsnp)                               | Properties | Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based) string. Auto-tracks the highest-scoring loaded SNP unless the user pins one (see `indexSnpPinned`).                                                                                                                                                                                                     |
| [indexSnpPinned](#property-indexsnppinned)                   | Properties | True once the user pins a specific index SNP (right-clicking a point). While false, the index auto-tracks the top hit as data loads.                                                                                                                                                                                                                                    |
| [rpcDataMap](#volatile-rpcdatamap)                           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                         |
| [flatbushes](#volatile-flatbushes)                           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                         |
| [featureUnderMouse](#volatile-featureundermouse)             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                         |
| [showLdLegend](#volatile-showldlegend)                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                         |
| [view](#getter-view)                                         | Getters    | the containing LGV, typed once here so downstream getters don't repeat the `getContainingView` cast                                                                                                                                                                                                                                                                     |
| [DisplayMessageComponent](#getter-displaymessagecomponent)   | Getters    |                                                                                                                                                                                                                                                                                                                                                                         |
| [TooltipComponent](#getter-tooltipcomponent)                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                         |
| [color](#getter-color)                                       | Getters    | resolved point color                                                                                                                                                                                                                                                                                                                                                    |
| [colorBy](#getter-colorby)                                   | Getters    | resolved coloring mode: 'normal' uses `color`, 'ld' colors by r² to the index SNP                                                                                                                                                                                                                                                                                       |
| [ldAdapterConfig](#getter-ldadapterconfig)                   | Getters    | the configured PLINK .ld adapter, or undefined when none is set (the slot defaults to null, normalized here to undefined for "absent")                                                                                                                                                                                                                                  |
| [hasLdData](#getter-haslddata)                               | Getters    | LD coloring needs a configured .ld adapter; without one the colorBy='ld' controls are inert, so they're hidden/disabled                                                                                                                                                                                                                                                 |
| [domain](#getter-domain)                                     | Getters    | nice-rounded [min, max] -log10 p domain across loaded regions, or undefined before any data loads                                                                                                                                                                                                                                                                       |
| [ticks](#getter-ticks)                                       | Getters    | y-axis tick positions. Manhattan plots are linear-only (pre-transformed -log10 p values); the inherited scaleType config is intentionally ignored so the axis ticks stay consistent with the linear `domain`.                                                                                                                                                           |
| [renderState](#getter-renderstate)                           | Getters    | render geometry for the inner canvas (between top/bottom YScaleBar label offsets) — the area both the GPU renderer and findManhattanHit work in. Using self.height directly would drift the hit-test off the rendered points.                                                                                                                                           |
| [regionRefNames](#getter-regionrefnames)                     | Getters    | displayedRegionIndex → refName lookup. Hit-testing reads this on every mousemove; MobX caches the view so visibleRegions changes invalidate it once rather than rebuilding per event.                                                                                                                                                                                   |
| [topSnp](#getter-topsnp)                                     | Getters    | highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default LD index SNP. Derived from loaded data (not a fetch input), so it's applied via the auto-pick autorun rather than read into rpcProps.                                                                                                                                                           |
| [indexSnpMissing](#getter-indexsnpmissing)                   | Getters    | true when LD coloring is active with data loaded, but no region's LD data referenced the index SNP — so every point is grey. LD is a single-region analysis, so "found in no loaded region" means missing.                                                                                                                                                              |
| [indexSnpOffscreen](#getter-indexsnpoffscreen)               | Getters    | When the index SNP is a `chr:bp` locus, whether it lies outside every visible region — the benign, pannable cause of `indexSnpMissing` (PLINK `--ld-window` files carry no records once you pan away from the index), as opposed to reference-name aliasing or the SNP being absent from the file. A bare rsID index returns false since its position isn't known here. |
| [rpcProps](#method-rpcprops)                                 | Methods    | fetch inputs watched by SettingsInvalidate — any change (color, colorBy, index SNP, LD adapter) triggers a refetch, since the worker bakes per-feature color into the result                                                                                                                                                                                            |
| [trackMenuItems](#method-trackmenuitems)                     | Methods    | Manhattan track menu: shared Score submenu plus LD-coloring controls. Rendering type / Resolution / Scale type don't apply to single-point rendering of pre-transformed -log10 p values. Placed after the color/index actions so referencing them doesn't make MST inference circular.                                                                                  |
| [contextMenuItems](#method-contextmenuitems)                 | Methods    | right-click menu for a clicked point: feature details plus, when an LD adapter is configured, a shortcut to recolor by LD to that SNP                                                                                                                                                                                                                                   |
| [selectFeature](#action-selectfeature)                       | Actions    | open the feature details widget for a clicked point                                                                                                                                                                                                                                                                                                                     |
| [setRpcData](#action-setrpcdata)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                         |
| [setFeatureUnderMouse](#action-setfeatureundermouse)         | Actions    |                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowLdLegend](#action-setshowldlegend)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                         |
| [setColorBy](#action-setcolorby)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                         |
| [setIndexSnp](#action-setindexsnp)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                         |
| [colorByLdToHit](#action-colorbyldtohit)                     | Actions    | right-click "Color by LD to this SNP": switch into LD mode and pin the index on the clicked point, so the auto-pick stops tracking the top hit. Keyed by chr:bp (1-based) to match the worker's posKey. All mutations happen in one action so rpcProps settles once and only a single recolor fetch fires.                                                              |
| [useTopHitAsIndex](#action-usetophitasindex)                 | Actions    | release a pinned index back to auto-tracking, seeded at the current top hit (the auto-pick autorun then keeps it on the top hit as data loads)                                                                                                                                                                                                                          |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata) | Actions    |                                                                                                                                                                                                                                                                                                                                                                         |
| [fetchNeeded](#action-fetchneeded)                           | Actions    | Manhattan features are 1:1 with the underlying SNPs (pre-transformed -log10 p values) and don't downsample by zoom, so we never need to refetch on bpPerPx change. We intentionally don't call setLoadedBpPerPx — the inherited isCacheValid short-circuits to true whenever loadedBpPerPx is undefined, which is exactly the behavior we want here.                    |
| [renderSvg](#action-rendersvg)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                         |
| [startRenderingBackend](#action-startrenderingbackend)       | Actions    | identity encode — RPC result is the upload payload                                                                                                                                                                                                                                                                                                                      |

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
[statusMessage](../basedisplay#volatile-statusmessage),
[statusProgress](../basedisplay#volatile-statusprogress)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderingProps](../basedisplay#method-renderingprops),
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
[regionStatuses](../fetchmixin#volatile-regionstatuses),
[lastStatusMs](../fetchmixin#volatile-laststatusms)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[throttleStatus](../fetchmixin#action-throttlestatus),
[resetStatus](../fetchmixin#action-resetstatus),
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
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
[setMinScore](../wigglescoreconfigmixin#action-setminscore),
[setMaxScore](../wigglescoreconfigmixin#action-setmaxscore),
[setRenderingType](../wigglescoreconfigmixin#action-setrenderingtype),
[setSummaryScoreMode](../wigglescoreconfigmixin#action-setsummaryscoremode),
[setScatterPointSize](../wigglescoreconfigmixin#action-setscatterpointsize),
[setAutoscale](../wigglescoreconfigmixin#action-setautoscale),
[isCacheValid](../wigglescoreconfigmixin#action-iscachevalid)

<details>
<summary>LinearManhattanDisplay - Properties</summary>

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

<details>
<summary>LinearManhattanDisplay - Properties (other undocumented members)</summary>

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

</details>

<details>
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

<details>
<summary>LinearManhattanDisplay - Getters</summary>

#### getter: view

the containing LGV, typed once here so downstream getters don't repeat the
`getContainingView` cast

```ts
type view = ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>
```

#### getter: color

resolved point color

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
type renderState = ManhattanRenderState
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

#### getter: indexSnpOffscreen

When the index SNP is a `chr:bp` locus, whether it lies outside every visible
region — the benign, pannable cause of `indexSnpMissing` (PLINK `--ld-window`
files carry no records once you pan away from the index), as opposed to
reference-name aliasing or the SNP being absent from the file. A bare rsID index
returns false since its position isn't known here.

```ts
type indexSnpOffscreen = boolean
```

</details>

<details>
<summary>LinearManhattanDisplay - Getters (other undocumented members)</summary>

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

</details>

<details>
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

<details>
<summary>LinearManhattanDisplay - Actions</summary>

#### action: selectFeature

open the feature details widget for a clicked point

```ts
type selectFeature = (hit: ManhattanHit) => void
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

#### action: startRenderingBackend

identity encode — RPC result is the upload payload

```ts
type startRenderingBackend = (backend: ManhattanRenderingBackend) => void
```

</details>

<details>
<summary>LinearManhattanDisplay - Actions (other undocumented members)</summary>

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

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

</details>
