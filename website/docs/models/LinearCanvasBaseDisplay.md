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

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
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
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearCanvasBaseDisplay - Properties</summary>

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: jexlFiltersSetting

Runtime "Filter by..." override. When set (even to an empty list) it replaces
the `jexlFilters` config slot; when undefined the config default applies. Stored
as already-`jexl:`-prefixed expressions (runtime convention), unlike the
deferred-evaluation config slot.

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFiltersSetting: types.maybe(types.array(types.string))
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearCanvasBaseDisplay - Volatiles</summary>

#### volatile: rpcDataMap

```js
// type signature
ObservableMap<number, LoadedFeatureData>
// code
rpcDataMap: observable.map<number, LoadedFeatureData>()
```

#### volatile: densityStatsPerRegion

```js
// type signature
ObservableMap<number, RegionDensityStats>
// code
densityStatsPerRegion: observable.map<number, RegionDensityStats>()
```

#### volatile: featureIdUnderMouse

```js
// type signature
string | null
// code
featureIdUnderMouse: null as string | null
```

#### volatile: subfeatureIdUnderMouse

```js
// type signature
string | null
// code
subfeatureIdUnderMouse: null as string | null
```

#### volatile: mouseoverExtraInformation

```js
// type signature
string | undefined
// code
mouseoverExtraInformation: undefined as string | undefined
```

#### volatile: contextMenuFeature

```js
// type signature
Feature | undefined
// code
contextMenuFeature: undefined as Feature | undefined
```

#### volatile: contextMenuInfo

```js
// type signature
{ item: FlatbushItem; displayedRegionIndex: number; } | undefined
// code
contextMenuInfo: undefined as
          | { item: FlatbushItem; displayedRegionIndex: number }
          | undefined
```

#### volatile: userFeatureDensityLimit

```js
// type signature
number | undefined
// code
userFeatureDensityLimit: undefined as number | undefined
```

#### volatile: byteEstimateVisibleBp

```js
// type signature
number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

#### volatile: heightBeforeExpand

```js
// type signature
number | undefined
// code
heightBeforeExpand: undefined as number | undefined
```

#### volatile: incrementalLayout

```js
// type signature
(rpcDataMap: ReadonlyMap<number, FeatureDataResult>, inputs: LayoutInputs) => Map<number, FeatureDataResult>
// code
incrementalLayout: createIncrementalLayout()
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearCanvasBaseDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so direct reads route through this to stay typed
(same move as `BaseAdapter<CONF>`). The override-aware reads use
`getConfWithOverride` instead.

```js
// type
ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: visibleFeatureDensityPerPx

```js
// type
number
```

#### getter: renderState

```js
// type
{
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}
```

#### getter: DisplayMessageComponent

```js
// type
LazyExoticComponent<({ model }: Props) => Element>
```

#### getter: showTooltipsEnabled

```js
// type
boolean
```

#### getter: showLegend

```js
// type
boolean
```

#### getter: maxHeight

```js
// type
number
```

#### getter: autoHeight

```js
// type
boolean
```

#### getter: displayMode

```js
// type
;'normal' | 'compact' | 'superCompact' | 'reducedRepresentation' | 'collapse'
```

#### getter: showLabelsMode

```js
// type
;'auto' | 'off' | 'on'
```

#### getter: showLabels

```js
// type
boolean
```

#### getter: showDescriptions

```js
// type
boolean
```

#### getter: showOutline

```js
// type
boolean
```

#### getter: featureColor

```js
// type
string
```

#### getter: utrColor

```js
// type
string
```

#### getter: colorByMode

```js
// type
;'strand' | 'attribute' | 'solid'
```

#### getter: colorByAttribute

```js
// type
string
```

#### getter: effectiveShowDescriptions

```js
// type
boolean
```

#### getter: selectedFeatureId

```js
// type
string | undefined
```

#### getter: maxFeatureDensity

```js
// type
number | undefined
```

#### getter: colorByCDS

```js
// type
boolean
```

#### getter: sequenceAdapter

```js
// type
any
```

#### getter: regionKeys

```js
// type
Map<number, string>
```

#### getter: reversedRegions

```js
// type
Set<number>
```

#### getter: featureWidgetType

```js
// type
{
  type: string
  id: string
}
```

#### getter: estimatedVisibleBytes

The cached byte estimate scaled from the span it was measured over
(`byteEstimateVisibleBp`) to the currently visible span. The estimate is roughly
proportional to span, so scaling makes it a pure function of the current view —
mirroring densityTooLarge. Crucially it self-releases on zoom-in: without
scaling, a large zoomed-out estimate stays above the limit forever and gates
refetch (FetchVisibleRegions won't re-estimate while regionTooLarge holds) — a
permanently stuck banner.

```js
// type
number | undefined
```

#### getter: bytesEstimateTooLarge

```js
// type
boolean
```

#### getter: densityTooLarge

```js
// type
boolean
```

#### getter: regionTooLarge

```js
// type
boolean
```

#### getter: regionTooLargeReason

```js
// type
string
```

#### getter: laidOutDataMap

```js
// type
Map<number, FeatureDataResult>
```

#### getter: maxY

```js
// type
number
```

#### getter: hasOverflow

```js
// type
boolean
```

#### getter: featureIdIndex

```js
// type
Map<string, FlatbushItem>
```

#### getter: subfeatureIdIndex

```js
// type
Map<string, SubfeatureInfo>
```

#### getter: hoveredFeature

```js
// type
FlatbushItem | null
```

#### getter: hoveredSubfeature

```js
// type
SubfeatureInfo | null
```

#### getter: featureItemMap

```js
// type
Map<string, FeatureItemEntry>
```

#### getter: flatbushIndexes

```js
// type
Map<number, FlatbushRegionIndexes>
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearCanvasBaseDisplay - Methods</summary>

#### method: activeFilters

The filters actually applied, as `jexl:`-prefixed expressions. The runtime
override shadows the config slot when set; otherwise the deferred-evaluation
`jexlFilters` config slot is prefixed on read. This is the single source of
truth for both the worker (via rpcProps) and the "Filter by..." dialog (so
existing config filters show up and are editable).

```js
// type signature
activeFilters: () => string[]
```

#### method: rpcProps

```js
// type signature
rpcProps: () => {
  displayConfig: DisplayConfig
  maxFeatureDensity: number | undefined
  colorByCDS: boolean
  theme: SerializableThemeArgs | undefined
}
```

#### method: getFeatureById

```js
// type signature
getFeatureById: (featureId: string) => FlatbushItem | undefined
```

#### method: searchFeatureByID

```js
// type signature
searchFeatureByID: (id: string) => readonly [number, number, number, number] | undefined
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

#### method: showSubmenuMenuItems

```js
// type signature
showSubmenuMenuItems: () => ({ label: string; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; } | { label: string; type: "checkbox"; checked: boolean; onClick: () => void; })[]
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
```

#### method: colorBySubMenuItems

The "Color by..." radio choices (solid/strand/attribute). Split out so
subclasses can reuse them while assembling their own color menu.

```js
// type signature
colorBySubMenuItems: () => { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]
```

#### method: colorMenuItems

Color-related track menu entries: a single "Color by..." entry whose "Solid
color..." choice opens the solid+UTR color picker. Subclasses (e.g. variants)
override to drop the gene-oriented UTR picker.

```js
// type signature
colorMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; }[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; } | { ...; } | { ...; })[]
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearCanvasBaseDisplay - Actions</summary>

#### action: expandToFit

```js
// type signature
expandToFit: () => void
```

#### action: collapseFromExpand

```js
// type signature
collapseFromExpand: () => void
```

#### action: clearHeightBeforeExpand

```js
// type signature
clearHeightBeforeExpand: () => void
```

#### action: setRpcData

```js
// type signature
setRpcData: (displayedRegionIndex: number, data: FeatureDataResult, loadedBpPerPx: number, region: Region) => void
```

#### action: setDensityStats

```js
// type signature
setDensityStats: (displayedRegionIndex: number, stats: RegionDensityStats) => void
```

#### action: clearDisplaySpecificData

```js
// type signature
clearDisplaySpecificData: () => void
```

#### action: pruneRpcDataMapToVisible

```js
// type signature
pruneRpcDataMapToVisible: (visibleDisplayedRegionIndices: Set<number>) => void
```

#### action: startRenderingBackend

```js
// type signature
startRenderingBackend: (backend: CanvasFeatureRenderingBackend) => void
```

#### action: setFeatureDensityStatsLimit

```js
// type signature
setFeatureDensityStatsLimit: (stats?: { bytes?: number | undefined; fetchSizeLimit?: number | undefined; } | undefined) => void
```

#### action: setHover

```js
// type signature
setHover: (featureId: string | null, subfeatureId: string | null, tooltip: string | undefined) => void
```

#### action: clearHover

```js
// type signature
clearHover: () => void
```

#### action: setContextMenuFeature

```js
// type signature
setContextMenuFeature: (feature?: Feature | undefined) => void
```

#### action: setContextMenuInfo

```js
// type signature
setContextMenuInfo: (info?: { item: FlatbushItem; displayedRegionIndex: number; } | undefined) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: clearSelection

```js
// type signature
clearSelection: () => void
```

#### action: setShowLabels

```js
// type signature
setShowLabels: (value: "auto" | "off" | "on") => void
```

#### action: setAutoHeight

```js
// type signature
setAutoHeight: (value: boolean) => void
```

#### action: setShowDescriptions

```js
// type signature
setShowDescriptions: (value: boolean) => void
```

#### action: setJexlFilters

Sets the runtime filter override (already-`jexl:`-prefixed expressions). Pass
undefined to clear it and fall back to the config `jexlFilters` slot.

```js
// type signature
setJexlFilters: (filters?: string[] | undefined) => void
```

#### action: setShowOutline

```js
// type signature
setShowOutline: (value: boolean) => void
```

#### action: setFeatureColor

```js
// type signature
setFeatureColor: (color?: string | undefined) => void
```

#### action: setUtrColor

```js
// type signature
setUtrColor: (color?: string | undefined) => void
```

#### action: showContextMenuForFeature

```js
// type signature
showContextMenuForFeature: (featureInfo: FlatbushItem, displayedRegionIndex: number) => void
```

#### action: openSetColorDialog

```js
// type signature
openSetColorDialog: (showUtrColor?: any) => void
```

#### action: openColorByAttributeDialog

```js
// type signature
openColorByAttributeDialog: () => void
```

#### action: openFilterDialog

```js
// type signature
openFilterDialog: () => void
```

#### action: fetchFullFeature

```js
// type signature
fetchFullFeature: (featureId: string, displayedRegionIndex: number) => Promise<SimpleFeature | undefined>
```

#### action: selectFeatureById

```js
// type signature
selectFeatureById: (featureInfo: FlatbushItem, subfeatureInfo: SubfeatureInfo | undefined, displayedRegionIndex: number) => void
```

#### action: isCacheValid

```js
// type signature
isCacheValid: (displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

```js
// type signature
getByteEstimateConfig: () => ByteEstimateConfig | null
```

#### action: selectFullFeature

```js
// type signature
selectFullFeature: (featureId: string, displayedRegionIndex: number) => void
```

#### action: reload

```js
// type signature
reload: () => Promise<void>
```

#### action: fetchNeeded

```js
// type signature
fetchNeeded: (needed: { region: Region; displayedRegionIndex: number; }[]) => void
```

#### action: setFeatureDensityStats

Records the span the byte estimate was measured at so `estimatedVisibleBytes`
can scale it to the current view (see `byteEstimateVisibleBp`).

```js
// type signature
setFeatureDensityStats: (stats?: FeatureDensityStats | undefined) => void
```

#### action: clearStaleDensityState

```js
// type signature
clearStaleDensityState: () => void
```

#### action: afterAttach

```js
// type signature
afterAttach: () => void
```

</details>
