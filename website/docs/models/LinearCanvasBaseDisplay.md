---
id: linearcanvasbasedisplay
title: LinearCanvasBaseDisplay
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

## Docs

Shared GPU-accelerated feature display base for canvas-rendered tracks. Handles
fetching, layout, the "Show labels" / "Show descriptions" UI, and the
fetch-invalidation autorun. Subclasses layer schema-specific properties and
menus via the showSubmenuMenuItems / trackMenuItems / contextMenuItems
super-extension pattern, and extend rpcProps() via the standard super-capture
pattern.

extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [MultiRegionDisplayMixin](../multiregiondisplaymixin)
- [ConfigOverrideMixin](../configoverridemixin)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightPreConfig

**Volatiles:** scrollTop

**Actions:** setScrollTop, setHeight, resizeHeight

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:** loadedRegions

**Getters:** isReady, viewportWithinLoadedData, renderBlocks,
loadingOverlayVisible

**Actions:** setLoadedRegion, clearDisplaySpecificData, clearAllRpcData, reload,
invalidateLoadedRegions, fetchNeeded, isCacheValid, getByteEstimateConfig,
fetchRegions, afterAttach

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

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### LinearCanvasBaseDisplay - Properties

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### LinearCanvasBaseDisplay - Volatiles

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

### LinearCanvasBaseDisplay - Getters

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

### LinearCanvasBaseDisplay - Methods

#### method: rpcProps

```js
// type signature
rpcProps: () => {
  displayConfig: DisplayConfig
  maxFeatureDensity: number | undefined
  colorByCDS: boolean
  theme: ThemeOptions | undefined
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
showSubmenuMenuItems: () => ({ label: string; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; type?: undefined; checked?: undefined; onClick?: undefined; } | { label: string; type: "checkbox"; checked: boolean; onClick: () => void; subMenu?: undefined; })[]
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: ({ label: string; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; type?: undefined; checked?: undefined; onClick?: undefined; } | { ...; })[]; onClick?: undefined; } | {...
```

### LinearCanvasBaseDisplay - Actions

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
setRpcData: (displayedRegionIndex: number, data: FeatureDataResult, loadedBpPerPx: number) => void
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

#### action: setFeatureIdUnderMouse

```js
// type signature
setFeatureIdUnderMouse: (featureId: string | null) => void
```

#### action: setSubfeatureIdUnderMouse

```js
// type signature
setSubfeatureIdUnderMouse: (featureId: string | null) => void
```

#### action: clearHover

```js
// type signature
clearHover: () => void
```

#### action: setMouseoverExtraInformation

```js
// type signature
setMouseoverExtraInformation: (info: string | undefined) => void
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
