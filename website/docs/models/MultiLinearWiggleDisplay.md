---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
sidebar_label: Display -> MultiLinearWiggleDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts).

## Example usage

`runClustering` is a transient declarative launch spec, the same idea as
`LinearGenomeView`'s `init`: set it to run the real "Cluster columns" RPC once
automatically (no dialog) as soon as subtrack data is available, and it clears
itself afterwards so a saved session never re-triggers it.

```js
displays: [
  {
    type: 'MultiLinearWiggleDisplay',
    runClustering: true,
  },
]
```

## Overview

Wiggle display overlaying/stacking multiple quantitative subtracks in one area,
with optional clustering and a tree sidebar.

## Members

| Member                                                               | Kind       | Description                                                                                                              |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| [type](#property-type)                                               | Properties |                                                                                                                          |
| [configuration](#property-configuration)                             | Properties |                                                                                                                          |
| [runClustering](#property-runclustering)                             | Properties |                                                                                                                          |
| [sourcesVolatile](#volatile-sourcesvolatile)                         | Volatiles  |                                                                                                                          |
| [DisplayMessageComponent](#getter-displaymessagecomponent)           | Getters    |                                                                                                                          |
| [isDensityMode](#getter-isdensitymode)                               | Getters    |                                                                                                                          |
| [isOverlay](#getter-isoverlay)                                       | Getters    |                                                                                                                          |
| [sourcesWithoutLayout](#getter-sourceswithoutlayout)                 | Getters    |                                                                                                                          |
| [editableSources](#getter-editablesources)                           | Getters    |                                                                                                                          |
| [sources](#getter-sources)                                           | Getters    |                                                                                                                          |
| [numSources](#getter-numsources)                                     | Getters    |                                                                                                                          |
| [autoscaleSourceNames](#getter-autoscalesourcenames)                 | Getters    |                                                                                                                          |
| [rowHeight](#getter-rowheight)                                       | Getters    |                                                                                                                          |
| [rowHeightTooSmallForScalebar](#getter-rowheighttoosmallforscalebar) | Getters    |                                                                                                                          |
| [ticks](#getter-ticks)                                               | Getters    |                                                                                                                          |
| [renderState](#getter-renderstate)                                   | Getters    |                                                                                                                          |
| [showTree](#getter-showtree)                                         | Getters    |                                                                                                                          |
| [showBranchLength](#getter-showbranchlength)                         | Getters    |                                                                                                                          |
| [showRowSeparators](#getter-showrowseparators)                       | Getters    |                                                                                                                          |
| [prefersOffset](#getter-prefersoffset)                               | Getters    | Offset the track label above the visualization so the stacked per-source rows aren't hidden behind an overlapping label. |
| [hierarchy](#getter-hierarchy)                                       | Getters    |                                                                                                                          |
| [spatialIndex](#getter-spatialindex)                                 | Getters    |                                                                                                                          |
| [rpcProps](#method-rpcprops)                                         | Methods    |                                                                                                                          |
| [gpuProps](#method-gpuprops)                                         | Methods    |                                                                                                                          |
| [trackMenuItems](#method-trackmenuitems)                             | Methods    |                                                                                                                          |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)         | Actions    |                                                                                                                          |
| [setRpcData](#action-setrpcdata)                                     | Actions    |                                                                                                                          |
| [startRenderingBackend](#action-startrenderingbackend)               | Actions    |                                                                                                                          |
| [setShowTree](#action-setshowtree)                                   | Actions    |                                                                                                                          |
| [setShowBranchLength](#action-setshowbranchlength)                   | Actions    |                                                                                                                          |
| [setShowRowSeparators](#action-setshowrowseparators)                 | Actions    |                                                                                                                          |
| [setRunClustering](#action-setrunclustering)                         | Actions    |                                                                                                                          |
| [fetchNeeded](#action-fetchneeded)                                   | Actions    |                                                                                                                          |
| [renderSvg](#action-rendersvg)                                       | Actions    |                                                                                                                          |

### MultiLinearWiggleDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/multilinearwiggledisplay).

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

### Available via [WiggleCommonMixin](../wigglecommonmixin)

**Volatiles:** [rpcDataMap](../wigglecommonmixin#volatile-rpcdatamap),
[featureUnderMouse](../wigglecommonmixin#volatile-featureundermouse)

**Getters:**
[autoscaleSourceNames](../wigglecommonmixin#getter-autoscalesourcenames),
[visibleScoreRange](../wigglecommonmixin#getter-visiblescorerange),
[domain](../wigglecommonmixin#getter-domain)

**Actions:**
[clearDisplaySpecificData](../wigglecommonmixin#action-cleardisplayspecificdata),
[setFeatureUnderMouse](../wigglecommonmixin#action-setfeatureundermouse),
[selectFeature](../wigglecommonmixin#action-selectfeature)

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

### Available via [TreeSidebarMixin](../treesidebarmixin)

**Properties:** [layout](../treesidebarmixin#property-layout),
[clusterTree](../treesidebarmixin#property-clustertree),
[treeAreaWidth](../treesidebarmixin#property-treeareawidth),
[subtreeFilter](../treesidebarmixin#property-subtreefilter)

**Volatiles:** [hoveredTreeNode](../treesidebarmixin#volatile-hoveredtreenode),
[treeCanvas](../treesidebarmixin#volatile-treecanvas),
[mouseoverCanvas](../treesidebarmixin#volatile-mouseovercanvas)

**Getters:** [parsedTree](../treesidebarmixin#getter-parsedtree),
[root](../treesidebarmixin#getter-root),
[treeHasBranchLengths](../treesidebarmixin#getter-treehasbranchlengths)

**Methods:** [willClearTree](../treesidebarmixin#method-willcleartree)

**Actions:** [setLayout](../treesidebarmixin#action-setlayout),
[clearLayout](../treesidebarmixin#action-clearlayout),
[setClusterTree](../treesidebarmixin#action-setclustertree),
[setLayoutAndClusterTree](../treesidebarmixin#action-setlayoutandclustertree),
[setTreeAreaWidth](../treesidebarmixin#action-settreeareawidth),
[setSubtreeFilter](../treesidebarmixin#action-setsubtreefilter),
[setHoveredTreeNode](../treesidebarmixin#action-sethoveredtreenode),
[setTreeCanvasRef](../treesidebarmixin#action-settreecanvasref),
[setMouseoverCanvasRef](../treesidebarmixin#action-setmouseovercanvasref)

<details>
<summary>MultiLinearWiggleDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'MultiLinearWiggleDisplay'>
// code
type: types.literal('MultiLinearWiggleDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: runClustering

```ts
// type signature
type runClustering = IMaybe<ISimpleType<boolean>>
// code
runClustering: types.maybe(types.boolean)
```

</details>

<details>
<summary>MultiLinearWiggleDisplay - Volatiles</summary>

#### volatile: sourcesVolatile

```ts
// type signature
type sourcesVolatile = SourceInfo[]
// code
sourcesVolatile: [] as SourceInfo[]
```

</details>

<details>
<summary>MultiLinearWiggleDisplay - Getters</summary>

#### getter: prefersOffset

Offset the track label above the visualization so the stacked per-source rows
aren't hidden behind an overlapping label.

```ts
type prefersOffset = boolean
```

</details>

<details>
<summary>MultiLinearWiggleDisplay - Getters (other undocumented members)</summary>

#### getter: DisplayMessageComponent

```ts
type DisplayMessageComponent = LazyExoticComponent<
  ({ model }: { model: MultiWiggleDisplayModel }) => Element
>
```

#### getter: isDensityMode

```ts
type isDensityMode = boolean
```

#### getter: isOverlay

```ts
type isOverlay = boolean
```

#### getter: sourcesWithoutLayout

```ts
type sourcesWithoutLayout = Source[]
```

#### getter: editableSources

```ts
type editableSources = Source[]
```

#### getter: sources

```ts
type sources = Source[]
```

#### getter: numSources

```ts
type numSources = number
```

#### getter: autoscaleSourceNames

```ts
type autoscaleSourceNames = Set<string>
```

#### getter: rowHeight

```ts
type rowHeight = number
```

#### getter: rowHeightTooSmallForScalebar

```ts
type rowHeightTooSmallForScalebar = boolean
```

#### getter: ticks

```ts
type ticks = YScaleTicks | undefined
```

#### getter: renderState

```ts
type renderState = WiggleGPURenderState
```

#### getter: showTree

```ts
type showTree = any
```

#### getter: showBranchLength

```ts
type showBranchLength = any
```

#### getter: showRowSeparators

```ts
type showRowSeparators = any
```

#### getter: hierarchy

```ts
type hierarchy = PositionedHierarchyNode<NewickNode> | undefined
```

#### getter: spatialIndex

```ts
type spatialIndex =
  { index: Flatbush; nodes: ClusterHierarchyNode[] } | undefined
```

</details>

<details>
<summary>MultiLinearWiggleDisplay - Methods</summary>

#### method: rpcProps

```ts
type rpcProps = () => { bicolorPivot: number; resolution: number }
```

#### method: gpuProps

```ts
type gpuProps = () => {
  sources: Source[]
  posColor: string
  negColor: string
  summaryScoreMode: string
  renderingType: string
  isDensityMode: boolean
}
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; } | { ...; })[]
```

</details>

<details>
<summary>MultiLinearWiggleDisplay - Actions</summary>

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: setRpcData

```ts
type setRpcData = (displayedRegionIndex: number, data: WiggleDataResult) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: WiggleRenderingBackend) => void
```

#### action: setShowTree

```ts
type setShowTree = (arg: boolean) => void
```

#### action: setShowBranchLength

```ts
type setShowBranchLength = (arg: boolean) => void
```

#### action: setShowRowSeparators

```ts
type setShowRowSeparators = (arg: boolean) => void
```

#### action: setRunClustering

```ts
type setRunClustering = (arg?: boolean | undefined) => void
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void> | undefined
```

#### action: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

</details>
