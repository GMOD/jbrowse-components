---
id: multisamplevariantbasemodel
title: MultiSampleVariantBaseModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/MultiSampleVariantBaseModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/MultiSampleVariantBaseModel.md)

## Example usage

`renderingMode`, `colorBy`, and `minorAlleleFrequencyFilter` are config slots
(see `SharedVariantConfigSchema`) read at runtime through `getConfWithOverride`
— they are NOT plain MST properties. How you preset one depends on whether
you're writing a track _config_ or a display _instance_ snapshot:

In a track's `displays` array (config schema), set the slot directly to change
the default:

```js
displays: [
  {
    type: 'LinearMultiSampleVariantMatrixDisplay',
    displayId: 'my-matrix',
    renderingMode: 'phased',
  },
]
```

In a display _instance_ snapshot (a session / `displaySnapshot`), set it flat —
exactly what a saved session serializes:

```js
{
  type: 'LinearMultiSampleVariantMatrixDisplay',
  renderingMode: 'phased',
}
```

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Volatiles:** rendererTypeName, error, statusMessage

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightOverride

**Volatiles:** scrollTop

**Getters:** height

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

### MultiSampleVariantBaseModel - Properties

#### property: type

```js
// type signature
ISimpleType<string>
// code
type: types.string
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: rowHeightMode

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowHeightMode: types.stripDefault(types.number, 0)
```

#### property: jexlFilters

```js
// type signature
IOptionalIType<IMaybe<IArrayType<ISimpleType<string>>>, [undefined]>
// code
jexlFilters: types.stripDefault(
            types.maybe(types.array(types.string)),
            undefined,
          )
```

#### property: lineZoneHeight

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineZoneHeight: types.stripDefault(types.number, 0)
```

### MultiSampleVariantBaseModel - Volatiles

#### volatile: showLegend

```js
// type signature
true
// code
showLegend: true
```

#### volatile: sourcesLoadingStopToken

```js
// type signature
StopToken | undefined
// code
sourcesLoadingStopToken: undefined as StopToken | undefined
```

#### volatile: contextMenuFeature

```js
// type signature
Feature | undefined
// code
contextMenuFeature: undefined as Feature | undefined
```

#### volatile: sourcesVolatile

```js
// type signature
Source[] | undefined
// code
sourcesVolatile: undefined as Source[] | undefined
```

#### volatile: hoveredGenotype

```js
// type signature
(Record<string, unknown> & { genotype: string; name: string; }) | undefined
// code
hoveredGenotype: undefined as
          | (Record<string, unknown> & { genotype: string; name: string })
          | undefined
```

#### volatile: cellData

Single source of truth for fetched per-display data. hasPhased, sampleInfo, and
featuresVolatile are derived from this via getters — fetchNeeded only needs to
call setCellData(result).

```js
// type signature
CellDataResult | undefined
// code
cellData: undefined as CellDataResult | undefined
```

#### volatile: loadedBpPerPx

```js
// type signature
number | undefined
// code
loadedBpPerPx: undefined as number | undefined
```

#### volatile: reloadCount

```js
// type signature
number
// code
reloadCount: 0
```

#### volatile: pendingClusterTree

```js
// type signature
string | undefined
// code
pendingClusterTree: undefined as string | undefined
```

### MultiSampleVariantBaseModel - Getters

#### getter: featuresVolatile

SimpleFeature instances derived from the simplifiedFeatures list in the most
recent cellData payload. Cached by MobX while cellData is unchanged. Named
`featuresVolatile` for backwards-compat with consumers that originally read it
as a volatile field.

These carry ONLY positional fields (id/start/end/refName/name) — not ALT or
genotypes. Don't re-derive feature-level facts from them (`.get('ALT')` etc.
returns undefined); summary facts are computed in the worker and exposed as
scalars (hasPhased/hasSecondaryAlt/ hasUnphased), and per-feature genotype info
lives in the cell-data featureGenotypeMap/featureData.

```js
// type
Feature[] | undefined
```

#### getter: hasPhased

```js
// type
boolean
```

#### getter: hasSecondaryAlt

Whether any visible site is multiallelic (drives the "Other alt allele" legend
entry). Computed in the worker since the simplified features sent to the client
don't carry ALT.

```js
// type
boolean
```

#### getter: hasUnphased

Whether any genotype call is unphased (drives the "Unphased" legend entry in
phased mode).

```js
// type
boolean
```

#### getter: sampleInfo

```js
// type
Record<string, SampleInfo> | undefined
```

#### getter: renderingMode

Returns the effective rendering mode, falling back to config

```js
// type
string
```

#### getter: featureWidgetType

```js
// type
{
  type: string
  id: string
}
```

#### getter: fetchSizeLimit

```js
// type
number
```

#### getter: minorAlleleFrequencyFilter

Returns the effective minor allele frequency filter, falling back to config

```js
// type
number
```

#### getter: filters

The jexl filter expressions (from the Edit filters dialog) as a
SerializableFilterChain, ready to pass as the RPC `filters` arg.
MultiSampleVariantGet{CellData,GenotypeMatrix,ClusterGenotypeMatrix} all extend
RpcMethodTypeWithFiltersAndRenameRegions, which serializes this to string[] and
rebuilds it in the worker with pluginManager.jexl.

```js
// type
SerializableFilterChain | undefined
```

#### getter: showSidebarLabels

```js
// type
boolean
```

#### getter: showTree

```js
// type
boolean
```

#### getter: showBranchLength

```js
// type
boolean
```

#### getter: referenceDrawingMode

```js
// type
string
```

#### getter: sourcesWithoutLayout

```js
// type
ProcessedSource[] | undefined
```

#### getter: sourcesBase

```js
// type
ProcessedSource[] | undefined
```

#### getter: sources

sourcesBase expanded for phased rendering when sampleInfo is available. Sources
already carrying HP (from clustering) pass through unchanged.

```js
// type
ProcessedSource[] | undefined
```

#### getter: editableSources

Layout-merged, phased-expanded view for the Edit Color/Arrangement dialog. Does
NOT apply the subtree filter — submitting the dialog persists every row back to
`layout`, so filtered samples must be present or they would be wiped from layout
on submit.

```js
// type
ProcessedSource[] | undefined
```

#### getter: sourceMap

```js
// type
{ [k: string]: Source; } | undefined
```

#### getter: availableHeight

Available height for rows (total height minus lineZoneHeight)

```js
// type
number
```

#### getter: nrow

```js
// type
number
```

#### getter: autoRowHeight

```js
// type
number
```

#### getter: rowHeight

rowHeightMode === 0 means auto-fit (computed from availableHeight / nrow); any
positive value is a user-pinned height. `resizeHeight` scales pinned values
proportionally so manual + display-resize stay in sync without snap-back
fuzziness.

```js
// type
number
```

#### getter: hierarchy

```js
// type
PositionedHierarchyNode<NewickNode> | undefined
```

#### getter: spatialIndex

```js
// type
{ index: Flatbush; nodes: ClusterHierarchyNode[]; } | undefined
```

#### getter: canDisplayLabels

```js
// type
boolean
```

#### getter: totalHeight

```js
// type
number
```

#### getter: featuresReady

```js
// type
boolean
```

### MultiSampleVariantBaseModel - Methods

#### method: rpcProps

```js
// type signature
rpcProps: () => { sources: ProcessedSource[] | undefined; minorAlleleFrequencyFilter: number; filters: SerializableFilterChain | undefined; renderingMode: string; referenceDrawingMode: string; }
```

#### method: showSubmenuItems

```js
// type signature
showSubmenuItems: () => MenuItem[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => MenuItem[]
```

#### method: getPortableSettings

```js
// type signature
getPortableSettings: () => { jexlFilters: (IMSTArray<ISimpleType<string>> & IStateTreeNode<IOptionalIType<IMaybe<IArrayType<ISimpleType<string>>>, [undefined]>>) | undefined; ... 5 more ...; $__mstStateTreeNodeType__?: [...] | ... 1 more ... | undefined; }
```

#### method: legendItems

Returns legend items for rendering colors based on current mode

```js
// type signature
legendItems: () => LegendItem[]
```

### MultiSampleVariantBaseModel - Actions

#### action: setCellData

```js
// type signature
setCellData: (data: CellDataResult | undefined) => void
```

#### action: setContextMenuFeature

```js
// type signature
setContextMenuFeature: (feature?: Feature | undefined) => void
```

#### action: setLoadedBpPerPx

```js
// type signature
setLoadedBpPerPx: (bpPerPx: number | undefined) => void
```

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (f?: string[] | undefined) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (s: boolean) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: setRowHeight

```js
// type signature
setRowHeight: (arg: number) => void
```

#### action: setHoveredGenotype

```js
// type signature
setHoveredGenotype: (arg?: (Record<string, unknown> & { genotype: string; name: string; }) | undefined) => void
```

#### action: setSourcesLoading

```js
// type signature
setSourcesLoading: (token: StopToken) => void
```

#### action: setSources

```js
// type signature
setSources: (sources: Source[]) => void
```

#### action: clearLayout

Restore the configured default arrangement — empties the layout and clears the
cluster tree, then re-applies the `colorBy` palette if one is configured.
Overrides the mixin's `clearLayout` so the user gets the same starting state
they had on initial load.

```js
// type signature
clearLayout: () => void
```

#### action: setMafFilter

```js
// type signature
setMafFilter: (arg: number) => void
```

#### action: setShowSidebarLabels

```js
// type signature
setShowSidebarLabels: (arg: boolean) => void
```

#### action: setShowTree

```js
// type signature
setShowTree: (arg: boolean) => void
```

#### action: setShowBranchLength

```js
// type signature
setShowBranchLength: (arg: boolean) => void
```

#### action: setLayoutAndPendingClusterTree

```js
// type signature
setLayoutAndPendingClusterTree: (layout: Source[], tree: string) => void
```

#### action: setPhasedMode

```js
// type signature
setPhasedMode: (arg: string) => void
```

#### action: setFitToHeight

Toggle auto height mode. When turning off, uses default of 10px per row.

```js
// type signature
setFitToHeight: () => void
```

#### action: resizeHeight

Override resizeHeight to scale row heights proportionally when the display is
vertically resized

```js
// type signature
resizeHeight: (distance: number) => number
```

#### action: setReferenceDrawingMode

```js
// type signature
setReferenceDrawingMode: (arg: string) => void
```

#### action: sortByGenotype

```js
// type signature
sortByGenotype: (featureId: string) => void
```

#### action: clearDisplaySpecificData

```js
// type signature
clearDisplaySpecificData: () => void
```

#### action: isCacheValid

```js
// type signature
isCacheValid: (_displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

```js
// type signature
getByteEstimateConfig: () => ByteEstimateConfig | null
```

#### action: fetchNeeded

```js
// type signature
fetchNeeded: (_needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>
```

#### action: reload

```js
// type signature
reload: () => void
```
