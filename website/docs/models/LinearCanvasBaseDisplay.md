---
id: linearcanvasbasedisplay
title: LinearCanvasBaseDisplay
sidebar_label: Display -> LinearCanvasBaseDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/baseModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearCanvasBaseDisplay.md)

## Overview

Shared GPU-accelerated feature display base for canvas-rendered tracks. Handles
fetching, layout, the "Show labels" / "Show descriptions" UI, and the
fetch-invalidation autorun. Subclasses layer schema-specific properties and
menus via the showSubmenuMenuItems / trackMenuItems / contextMenuItems
super-extension pattern, and extend rpcProps() via the standard super-capture
pattern.

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

**Properties:** [heightOverride](../trackheightmixin#property-heightoverride)

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
[displayPhase](../multiregiondisplaymixin#getter-displayphase),
[loadingOverlayVisible](../multiregiondisplaymixin#getter-loadingoverlayvisible)

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

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:**
[configOverrides](../configoverridemixin#property-configoverrides)

**Methods:** [getOverride](../configoverridemixin#method-getoverride),
[getConfWithOverride](../configoverridemixin#method-getconfwithoverride)

**Actions:** [setOverride](../configoverridemixin#action-setoverride),
[clearOverride](../configoverridemixin#action-clearoverride)

<details open>
<summary>LinearCanvasBaseDisplay - Properties</summary>

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: jexlFiltersSetting

Runtime "Filter by..." override. When set (even to an empty list) it replaces
the `jexlFilters` config slot; when undefined the config default applies. Stored
as already-`jexl:`-prefixed expressions (runtime convention), unlike the
deferred-evaluation config slot.

```ts
// type signature
type jexlFiltersSetting = IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFiltersSetting: types.maybe(types.array(types.string))
```

</details>

<details open>
<summary>LinearCanvasBaseDisplay - Volatiles</summary>

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, LoadedFeatureData>
// code
rpcDataMap: observable.map<number, LoadedFeatureData>()
```

#### volatile: densityStatsPerRegion

```ts
// type signature
type densityStatsPerRegion = ObservableMap<number, RegionDensityStats>
// code
densityStatsPerRegion: observable.map<number, RegionDensityStats>()
```

#### volatile: featureIdUnderMouse

```ts
// type signature
type featureIdUnderMouse = string | null
// code
featureIdUnderMouse: null as string | null
```

#### volatile: subfeatureIdUnderMouse

```ts
// type signature
type subfeatureIdUnderMouse = string | null
// code
subfeatureIdUnderMouse: null as string | null
```

#### volatile: mouseoverExtraInformation

```ts
// type signature
type mouseoverExtraInformation = string | undefined
// code
mouseoverExtraInformation: undefined as string | undefined
```

#### volatile: contextMenuFeature

```ts
// type signature
type contextMenuFeature = Feature | undefined
// code
contextMenuFeature: undefined as Feature | undefined
```

#### volatile: contextMenuInfo

```ts
// type signature
type contextMenuInfo =
  | { item: FlatbushItem; displayedRegionIndex: number }
  | undefined
// code
contextMenuInfo: undefined as
  | { item: FlatbushItem; displayedRegionIndex: number }
  | undefined
```

#### volatile: userFeatureDensityLimit

```ts
// type signature
type userFeatureDensityLimit = number | undefined
// code
userFeatureDensityLimit: undefined as number | undefined
```

#### volatile: byteEstimateVisibleBp

```ts
// type signature
type byteEstimateVisibleBp = number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

#### volatile: heightBeforeExpand

```ts
// type signature
type heightBeforeExpand = number | undefined
// code
heightBeforeExpand: undefined as number | undefined
```

#### volatile: incrementalLayout

```ts
// type signature
type incrementalLayout = (
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LayoutInputs,
) => Map<number, FeatureDataResult>
// code
incrementalLayout: createIncrementalLayout()
```

#### volatile: morphFromTops

```ts
// type signature
type morphFromTops = Map<string, number> | undefined
// code
morphFromTops: undefined as Map<string, number> | undefined
```

#### volatile: morphProgress

```ts
// type signature
type morphProgress = number
// code
morphProgress: 1
```

#### volatile: morphStartMs

```ts
// type signature
type morphStartMs = number
// code
morphStartMs: 0
```

#### volatile: morphFromMaxY

```ts
// type signature
type morphFromMaxY = number
// code
morphFromMaxY: 0
```

</details>

<details open>
<summary>LinearCanvasBaseDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so direct reads route through this to stay typed
(same move as `BaseAdapter<CONF>`). The override-aware reads use
`getConfWithOverride` instead.

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: visibleFeatureDensityPerPx

```ts
type visibleFeatureDensityPerPx = number
```

#### getter: renderState

```ts
type renderState = {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}
```

#### getter: DisplayMessageComponent

```ts
type DisplayMessageComponent = LazyExoticComponent<
  ({ model }: Props) => Element
>
```

#### getter: showTooltipsEnabled

```ts
type showTooltipsEnabled = boolean
```

#### getter: showLegend

```ts
type showLegend = boolean
```

#### getter: maxHeight

```ts
type maxHeight = number
```

#### getter: autoHeight

```ts
type autoHeight = boolean
```

#### getter: displayMode

```ts
type displayMode =
  | 'normal'
  | 'compact'
  | 'superCompact'
  | 'reducedRepresentation'
  | 'collapse'
```

#### getter: showLabelsMode

```ts
type showLabelsMode = 'auto' | 'off' | 'on'
```

#### getter: showLabels

```ts
type showLabels = boolean
```

#### getter: showDescriptions

```ts
type showDescriptions = boolean
```

#### getter: showOutline

```ts
type showOutline = boolean
```

#### getter: featureColor

```ts
type featureColor = string
```

#### getter: utrColor

```ts
type utrColor = string
```

#### getter: colorByMode

```ts
type colorByMode = 'strand' | 'attribute' | 'solid'
```

#### getter: colorByAttribute

```ts
type colorByAttribute = string
```

#### getter: effectiveShowDescriptions

```ts
type effectiveShowDescriptions = boolean
```

#### getter: selectedFeatureId

```ts
type selectedFeatureId = string | undefined
```

#### getter: maxFeatureDensity

```ts
type maxFeatureDensity = number | undefined
```

#### getter: colorByCDS

```ts
type colorByCDS = boolean
```

#### getter: sequenceAdapter

```ts
type sequenceAdapter = any
```

#### getter: regionKeys

```ts
type regionKeys = Map<number, string>
```

#### getter: reversedRegions

```ts
type reversedRegions = Set<number>
```

#### getter: featureWidgetType

```ts
type featureWidgetType = { type: string; id: string }
```

#### getter: estimatedVisibleBytes

The cached byte estimate scaled from the span it was measured over
(`byteEstimateVisibleBp`) to the currently visible span. The estimate is roughly
proportional to span, so scaling makes it a pure function of the current view —
mirroring densityTooLarge. Crucially it self-releases on zoom-in: without
scaling, a large zoomed-out estimate stays above the limit forever and gates
refetch (FetchVisibleRegions won't re-estimate while regionTooLarge holds) — a
permanently stuck banner.

```ts
type estimatedVisibleBytes = number | undefined
```

#### getter: bytesEstimateTooLarge

```ts
type bytesEstimateTooLarge = boolean
```

#### getter: densityTooLarge

```ts
type densityTooLarge = boolean
```

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

#### getter: laidOutDataMap

```ts
type laidOutDataMap = Map<number, FeatureDataResult>
```

#### getter: renderDataMap

```ts
type renderDataMap = Map<number, FeatureDataResult>
```

#### getter: maxY

```ts
type maxY = number
```

#### getter: hasOverflow

```ts
type hasOverflow = boolean
```

#### getter: fitHeight

```ts
type fitHeight = number
```

#### getter: featureIdIndex

```ts
type featureIdIndex = Map<string, FlatbushItem>
```

#### getter: subfeatureIdIndex

```ts
type subfeatureIdIndex = Map<string, SubfeatureInfo>
```

#### getter: hoveredFeature

```ts
type hoveredFeature = FlatbushItem | null
```

#### getter: hoveredSubfeature

```ts
type hoveredSubfeature = SubfeatureInfo | null
```

#### getter: featureItemMap

```ts
type featureItemMap = Map<string, FeatureItemEntry>
```

#### getter: flatbushIndexes

```ts
type flatbushIndexes = Map<number, FlatbushRegionIndexes>
```

</details>

<details open>
<summary>LinearCanvasBaseDisplay - Methods</summary>

#### method: observedMaxDensity

```ts
type observedMaxDensity = (bpPerPx: number) => number
```

#### method: activeFilters

The filters actually applied, as `jexl:`-prefixed expressions. The runtime
override shadows the config slot when set; otherwise the deferred-evaluation
`jexlFilters` config slot is prefixed on read. This is the single source of
truth for both the worker (via rpcProps) and the "Filter by..." dialog (so
existing config filters show up and are editable).

```ts
type activeFilters = () => string[]
```

#### method: rpcProps

```ts
type rpcProps = () => {
  displayConfig: DisplayConfig
  maxFeatureDensity: number | undefined
  colorByCDS: boolean
  theme: SerializableThemeArgs | undefined
}
```

#### method: getFeatureById

```ts
type getFeatureById = (featureId: string) => FlatbushItem | undefined
```

#### method: searchFeatureByID

```ts
type searchFeatureByID = (
  id: string,
) => readonly [number, number, number, number] | undefined
```

#### method: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

#### method: showSubmenuMenuItems

```ts
type showSubmenuMenuItems = () => (
  | {
      label: string
      subMenu: {
        label: string
        type: 'radio'
        checked: boolean
        onClick: () => void
      }[]
    }
  | { label: string; type: 'checkbox'; checked: boolean; onClick: () => void }
)[]
```

#### method: contextMenuItems

```ts
type contextMenuItems = () => {
  label: string
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
  onClick: () => void
}[]
```

#### method: colorBySubMenuItems

The "Color by..." radio choices (solid/strand/attribute). Split out so
subclasses can reuse them while assembling their own color menu.

```ts
type colorBySubMenuItems = () => {
  label: string
  type: 'radio'
  checked: boolean
  onClick: () => void
}[]
```

#### method: colorMenuItems

Color-related track menu entries: a single "Color by..." entry whose "Solid
color..." choice opens the solid+UTR color picker. Subclasses (e.g. variants)
override to drop the gene-oriented UTR picker.

```ts
type colorMenuItems = () => {
  label: string
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
  subMenu: {
    label: string
    type: 'radio'
    checked: boolean
    onClick: () => void
  }[]
}[]
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; } | { ...; } | { ...; })[]
```

</details>

<details open>
<summary>LinearCanvasBaseDisplay - Actions</summary>

#### action: beginYMorph

```ts
type beginYMorph = (fromTops: Map<string, number>, fromMaxY: number) => void
```

#### action: setMorphProgress

```ts
type setMorphProgress = (t: number) => void
```

#### action: endYMorph

```ts
type endYMorph = () => void
```

#### action: expandToFit

```ts
type expandToFit = () => void
```

#### action: collapseFromExpand

```ts
type collapseFromExpand = () => void
```

#### action: clearHeightBeforeExpand

```ts
type clearHeightBeforeExpand = () => void
```

#### action: setRpcData

```ts
type setRpcData = (
  displayedRegionIndex: number,
  data: FeatureDataResult,
  loadedBpPerPx: number,
  region: Region,
) => void
```

#### action: setDensityStats

```ts
type setDensityStats = (
  displayedRegionIndex: number,
  stats: RegionDensityStats,
) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: pruneRpcDataMapToVisible

```ts
type pruneRpcDataMapToVisible = (
  visibleDisplayedRegionIndices: Set<number>,
) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: CanvasFeatureRenderingBackend) => void
```

#### action: setFeatureDensityStatsLimit

```ts
type setFeatureDensityStatsLimit = (
  stats?:
    | { bytes?: number | undefined; fetchSizeLimit?: number | undefined }
    | undefined,
) => void
```

#### action: setHover

```ts
type setHover = (
  featureId: string | null,
  subfeatureId: string | null,
  tooltip: string | undefined,
) => void
```

#### action: clearHover

```ts
type clearHover = () => void
```

#### action: setContextMenuFeature

```ts
type setContextMenuFeature = (feature?: Feature | undefined) => void
```

#### action: setContextMenuInfo

```ts
type setContextMenuInfo = (
  info?: { item: FlatbushItem; displayedRegionIndex: number } | undefined,
) => void
```

#### action: selectFeature

```ts
type selectFeature = (feature: Feature) => void
```

#### action: clearSelection

```ts
type clearSelection = () => void
```

#### action: setShowLabels

```ts
type setShowLabels = (value: 'auto' | 'off' | 'on') => void
```

#### action: setAutoHeight

```ts
type setAutoHeight = (value: boolean) => void
```

#### action: setShowDescriptions

```ts
type setShowDescriptions = (value: boolean) => void
```

#### action: setJexlFilters

Sets the runtime filter override (already-`jexl:`-prefixed expressions). Pass
undefined to clear it and fall back to the config `jexlFilters` slot.

```ts
type setJexlFilters = (filters?: string[] | undefined) => void
```

#### action: setShowOutline

```ts
type setShowOutline = (value: boolean) => void
```

#### action: setFeatureColor

```ts
type setFeatureColor = (color?: string | undefined) => void
```

#### action: setUtrColor

```ts
type setUtrColor = (color?: string | undefined) => void
```

#### action: showContextMenuForFeature

```ts
type showContextMenuForFeature = (
  featureInfo: FlatbushItem,
  displayedRegionIndex: number,
) => void
```

#### action: openSetColorDialog

```ts
type openSetColorDialog = (showUtrColor?: any) => void
```

#### action: openColorByAttributeDialog

```ts
type openColorByAttributeDialog = () => void
```

#### action: openFilterDialog

```ts
type openFilterDialog = () => void
```

#### action: fetchFullFeature

```ts
type fetchFullFeature = (
  featureId: string,
  displayedRegionIndex: number,
) => Promise<SimpleFeature | undefined>
```

#### action: selectFeatureById

```ts
type selectFeatureById = (
  featureInfo: FlatbushItem,
  subfeatureInfo: SubfeatureInfo | undefined,
  displayedRegionIndex: number,
) => void
```

#### action: isCacheValid

```ts
type isCacheValid = (displayedRegionIndex: number) => boolean
```

#### action: byteSizeLimit

```ts
type byteSizeLimit = () => number | undefined
```

#### action: selectFullFeature

```ts
type selectFullFeature = (
  featureId: string,
  displayedRegionIndex: number,
) => void
```

#### action: reload

```ts
type reload = () => Promise<void>
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => void
```

#### action: setFeatureDensityStats

Records the span the byte estimate was measured at so `estimatedVisibleBytes`
can scale it to the current view (see `byteEstimateVisibleBp`).

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: clearStaleDensityState

```ts
type clearStaleDensityState = () => void
```

#### action: resizeHeight

A manual drag-resize means the user wants a fixed height; turn off auto-fit
first, otherwise the CanvasAutoHeight autorun snaps the height back on the next
layout change and the drag appears to do nothing.

```ts
type resizeHeight = (distance: number) => number
```

#### action: afterAttach

```ts
type afterAttach = () => void
```

</details>
