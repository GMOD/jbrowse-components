---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
sidebar_label: Display -> MultiLinearWiggleDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiLinearWiggleDisplay.md)

## Overview

Wiggle display overlaying/stacking multiple quantitative subtracks in one area,
with optional clustering and a tree sidebar.

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

### Available via [WiggleCommonMixin](../wigglecommonmixin)

**Volatiles:** [rpcDataMap](../wigglecommonmixin#volatile-rpcdatamap)

**Getters:** [visibleScoreRange](../wigglecommonmixin#getter-visiblescorerange),
[domain](../wigglecommonmixin#getter-domain)

**Actions:**
[clearDisplaySpecificData](../wigglecommonmixin#action-cleardisplayspecificdata)

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

<details open>
<summary>MultiLinearWiggleDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                 |
| ------------------------------------------ | ----------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"MultiLinearWiggleDisplay">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`               |

</details>

<details>
<summary>MultiLinearWiggleDisplay - Properties (all signatures)</summary>

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

</details>

<details open>
<summary>MultiLinearWiggleDisplay - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                              |
| -------------------------------------------------- | -------------------------------------- |
| [`sourcesVolatile`](#volatile-sourcesvolatile)     | `SourceInfo[]`                         |
| [`featureUnderMouse`](#volatile-featureundermouse) | `WiggleFeatureUnderMouse \| undefined` |

</details>

<details>
<summary>MultiLinearWiggleDisplay - Volatiles (all signatures)</summary>

#### volatile: sourcesVolatile

```ts
// type signature
type sourcesVolatile = SourceInfo[]
// code
sourcesVolatile: [] as SourceInfo[]
```

#### volatile: featureUnderMouse

```ts
// type signature
type featureUnderMouse = WiggleFeatureUnderMouse | undefined
// code
featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined
```

</details>

<details open>
<summary>MultiLinearWiggleDisplay - Getters</summary>

#### getter: prefersOffset

Offset the track label above the visualization so the stacked per-source rows
aren't hidden behind an overlapping label.

```ts
type prefersOffset = boolean
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                 | Signature                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`DisplayMessageComponent`](#getter-displaymessagecomponent)           | `LazyExoticComponent<({ model, }: { model: MultiWiggleDisplayModel; }) => Element>` |
| [`isDensityMode`](#getter-isdensitymode)                               | `boolean`                                                                           |
| [`isOverlay`](#getter-isoverlay)                                       | `boolean`                                                                           |
| [`sourcesWithoutLayout`](#getter-sourceswithoutlayout)                 | `Source[]`                                                                          |
| [`editableSources`](#getter-editablesources)                           | `Source[]`                                                                          |
| [`sources`](#getter-sources)                                           | `Source[]`                                                                          |
| [`numSources`](#getter-numsources)                                     | `number`                                                                            |
| [`rowHeight`](#getter-rowheight)                                       | `number`                                                                            |
| [`rowHeightTooSmallForScalebar`](#getter-rowheighttoosmallforscalebar) | `boolean`                                                                           |
| [`ticks`](#getter-ticks)                                               | `YScaleTicks \| undefined`                                                          |
| [`renderState`](#getter-renderstate)                                   | `WiggleGPURenderState \| undefined`                                                 |
| [`showTree`](#getter-showtree)                                         | `any`                                                                               |
| [`showBranchLength`](#getter-showbranchlength)                         | `any`                                                                               |
| [`showRowSeparators`](#getter-showrowseparators)                       | `any`                                                                               |
| [`hierarchy`](#getter-hierarchy)                                       | `PositionedHierarchyNode<NewickNode> \| undefined`                                  |
| [`spatialIndex`](#getter-spatialindex)                                 | `{ index: Flatbush; nodes: ClusterHierarchyNode[]; } \| undefined`                  |

</details>

<details>
<summary>MultiLinearWiggleDisplay - Getters (all signatures)</summary>

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
type renderState = WiggleGPURenderState | undefined
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

<details open>
<summary>MultiLinearWiggleDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`rpcProps`](#method-rpcprops)             | `() => { bicolorPivot: number; resolution: number; }`                                                                                              |
| [`gpuProps`](#method-gpuprops)             | `() => { sources: Source[]; posColor: string; negColor: string; summaryScoreMode: string; renderingType: string; isDensityMode: boolean; }`        |
| [`trackMenuItems`](#method-trackmenuitems) | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| { ...; } \| { ...; } \| { ...; })[]` |

</details>

<details>
<summary>MultiLinearWiggleDisplay - Methods (all signatures)</summary>

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
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; })[]
```

</details>

<details open>
<summary>MultiLinearWiggleDisplay - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                         | Signature                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`clearDisplaySpecificData`](#action-cleardisplayspecificdata) | `() => void`                                                                                                                                                 |
| [`setRpcData`](#action-setrpcdata)                             | `(displayedRegionIndex: number, data: WiggleDataResult) => void`                                                                                             |
| [`startRenderingBackend`](#action-startrenderingbackend)       | `(backend: WiggleRenderingBackend) => void`                                                                                                                  |
| [`setShowTree`](#action-setshowtree)                           | `(arg: boolean) => void`                                                                                                                                     |
| [`setShowBranchLength`](#action-setshowbranchlength)           | `(arg: boolean) => void`                                                                                                                                     |
| [`setShowRowSeparators`](#action-setshowrowseparators)         | `(arg: boolean) => void`                                                                                                                                     |
| [`setFeatureUnderMouse`](#action-setfeatureundermouse)         | `(feat?: WiggleFeatureUnderMouse \| undefined) => void`                                                                                                      |
| [`selectFeature`](#action-selectfeature)                       | `(feat: WiggleFeatureUnderMouse) => void`                                                                                                                    |
| [`fetchNeeded`](#action-fetchneeded)                           | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void> \| undefined`                                                                |
| [`renderSvg`](#action-rendersvg)                               | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>` |

</details>

<details>
<summary>MultiLinearWiggleDisplay - Actions (all signatures)</summary>

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

#### action: setFeatureUnderMouse

```ts
type setFeatureUnderMouse = (feat?: WiggleFeatureUnderMouse | undefined) => void
```

#### action: selectFeature

```ts
type selectFeature = (feat: WiggleFeatureUnderMouse) => void
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
