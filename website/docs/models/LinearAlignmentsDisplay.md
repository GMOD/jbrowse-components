---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearAlignmentsDisplay.md)

## Docs

State model factory for LinearAlignmentsDisplay

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

**Getters:** isReady, renderBlocks

**Actions:** setLoadedRegion, clearDisplaySpecificData, clearAllRpcData, reload,
invalidateLoadedRegions, fetchNeeded, isCacheValid, getByteEstimateConfig,
fetchRegions, afterAttach

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText, regionCannotBeRendered

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload

### Available via [GpuLifecycleMixin](../gpulifecyclemixin)

**Volatiles:** canvasDrawn, currentBackend, renderTick, autorunsInstalled

**Actions:** markCanvasDrawn, resetCanvasDrawn, stopBackend, renderNow,
attachBackend

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage

**Getters:** isLoading

**Actions:** setError, setStatusMessage, cancelFetch, runFetch

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### LinearAlignmentsDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearAlignmentsDisplay">
// code
type: types.literal('LinearAlignmentsDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: linkedReads

```js
// type signature
IOptionalIType<ISimpleType<LinkedReadsMode>, [undefined]>
// code
linkedReads: types.optional(
            types.enumeration<LinkedReadsMode>('LinkedReadsMode', [
              'off',
              'normal',
              'bezier',
            ]),
            'off',
          )
```

#### property: showCoverage

```js
// type signature
true
// code
showCoverage: true
```

#### property: coverageHeight

```js
// type signature
number
// code
coverageHeight: 45
```

#### property: showMismatches

```js
// type signature
true
// code
showMismatches: true
```

#### property: showInterbaseIndicators

```js
// type signature
true
// code
showInterbaseIndicators: true
```

#### property: showYScalebar

```js
// type signature
true
// code
showYScalebar: true
```

#### property: drawSingletons

```js
// type signature
true
// code
drawSingletons: true
```

#### property: drawProperPairs

```js
// type signature
true
// code
drawProperPairs: true
```

#### property: flipStrandLongReadChains

```js
// type signature
true
// code
flipStrandLongReadChains: true
```

#### property: lineWidthSetting

```js
// type signature
IMaybe<ISimpleType<number>>
// code
lineWidthSetting: types.maybe(types.number)
```

#### property: drawInter

```js
// type signature
true
// code
drawInter: true
```

#### property: drawLongRange

```js
// type signature
true
// code
drawLongRange: true
```

#### property: arcColorByType

```js
// type signature
IOptionalIType<ISimpleType<ArcColorByType>, [undefined]>
// code
arcColorByType: types.optional(
            arcColorByTypes,
            'insertSizeAndOrientation',
          )
```

#### property: pairedArcs

```js
// type signature
IOptionalIType<ISimpleType<PairedArcsMode>, [undefined]>
// code
pairedArcs: types.optional(
            types.enumeration<PairedArcsMode>('PairedArcsMode', [
              'off',
              'up',
              'down',
              'samplot',
            ]),
            'off',
          )
```

#### property: sashimiArcs

```js
// type signature
IOptionalIType<ISimpleType<ArcDirection>, [undefined]>
// code
sashimiArcs: types.optional(
            types.enumeration<ArcDirection>('SashimiArcsMode', [
              'off',
              'up',
              'down',
            ]),
            'up',
          )
```

#### property: sashimiArcsHeight

```js
// type signature
number
// code
sashimiArcsHeight: 40
```

#### property: arcsHeight

```js
// type signature
number
// code
arcsHeight: 40
```

#### property: showSoftClipping

```js
// type signature
false
// code
showSoftClipping: false
```

### LinearAlignmentsDisplay - Volatiles

#### volatile: featureIdUnderMouse

```js
// type signature
string | undefined
// code
featureIdUnderMouse: undefined as undefined | string
```

#### volatile: mouseoverExtraInformation

```js
// type signature
TooltipPayload | undefined
// code
mouseoverExtraInformation: undefined as TooltipPayload | undefined
```

#### volatile: contextMenuFeature

```js
// type signature
Feature | undefined
// code
contextMenuFeature: undefined as Feature | undefined
```

#### volatile: contextMenuCoord

```js
// type signature
[number, number] | undefined
// code
contextMenuCoord: undefined as [number, number] | undefined
```

#### volatile: contextMenuCigarHit

```js
// type signature
CigarHitResult | undefined
// code
contextMenuCigarHit: undefined as CigarHitResult | undefined
```

#### volatile: contextMenuIndicatorHit

```js
// type signature
IndicatorHitResult | undefined
// code
contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined
```

#### volatile: contextMenuRefName

```js
// type signature
string | undefined
// code
contextMenuRefName: undefined as string | undefined
```

#### volatile: rpcDataMap

```js
// type signature
ObservableMap<number, PileupDataResult>
// code
rpcDataMap: observable.map<number, PileupDataResult>()
```

#### volatile: currentRangeY

```js
// type signature
[number, number]
// code
currentRangeY: [0, 600] as [number, number]
```

#### volatile: highlightedChainIds

```js
// type signature
string[]
// code
highlightedChainIds: [] as string[]
```

#### volatile: selectedChainIds

```js
// type signature
string[]
// code
selectedChainIds: [] as string[]
```

#### volatile: colorTagMap

```js
// type signature
Record<string, string>
// code
colorTagMap: {} as Record<string, string>
```

#### volatile: visibleModifications

```js
// type signature
ObservableMap<string, ModificationTypeWithColor>
// code
visibleModifications: observable.map<string, ModificationTypeWithColor>(
          {},
        )
```

#### volatile: simplexModifications

```js
// type signature
Set<string>
// code
simplexModifications: new Set<string>()
```

#### volatile: modificationsReady

```js
// type signature
false
// code
modificationsReady: false
```

#### volatile: overCigarItem

```js
// type signature
false
// code
overCigarItem: false
```

#### volatile: colorPalette

```js
// type signature
ColorPalette | null
// code
colorPalette: null as ColorPalette | null
```

### LinearAlignmentsDisplay - Getters

#### getter: isChainMode

```js
// type
boolean
```

#### getter: scaleType

```js
// type
string
```

#### getter: autoscaleType

```js
// type
string
```

#### getter: minScore

```js
// type
number
```

#### getter: maxScore

```js
// type
number
```

#### getter: minScoreConfig

```js
// type
number | undefined
```

#### getter: maxScoreConfig

```js
// type
number | undefined
```

#### getter: numStdDev

```js
// type
number
```

#### getter: featureWidgetType

```js
// type
{
  type: string
  id: string
}
```

#### getter: selectedFeatureId

```js
// type
string | undefined
```

#### getter: DisplayMessageComponent

```js
// type
LazyExoticComponent<({ model, }: { model: LinearAlignmentsDisplayModel; }) => Element>
```

#### getter: TooltipComponent

```js
// type
LazyExoticComponent<({ model, height, clientMouseCoord, offsetMouseCoord, }: { model: { mouseoverExtraInformation: TooltipPayload | undefined; showCoverage: boolean; coverageHeight: number; }; height: number; offsetMouseCoord?: Coord | undefined; clientMouseCoord: Coord; }) => Element | null>
```

#### getter: visibleModificationTypes

```js
// type
string[]
```

#### getter: colorBy

```js
// type
ColorBy
```

#### getter: filterBy

```js
// type
FilterBy
```

#### getter: featureHeightSetting

```js
// type
number
```

#### getter: featureSpacing

```js
// type
number
```

#### getter: maxHeight

```js
// type
number
```

#### getter: chainIdMap

```js
// type
Map<number, string[]>
```

#### getter: mismatchAlpha

```js
// type
boolean
```

#### getter: showLegend

```js
// type
boolean | undefined
```

#### getter: sortedBy

```js
// type
SortedBy | undefined
```

#### getter: coverageIsLog

```js
// type
boolean
```

#### getter: coverageStats

```js
// type
ScoreStats | undefined
```

#### getter: coverageDomain

```js
// type
;[number, number] | undefined
```

#### getter: coverageTicks

```js
// type
YScaleTicks | undefined
```

#### getter: legendItems

```js
// type
LegendItem[]
```

#### getter: laidOutPileupMap

```js
// type
Map<number, PileupDataResult>
```

#### getter: maxY

```js
// type
number
```

#### getter: arcsComputed

```js
// type
{ regionInfos: { refName: string; start: number; end: number; displayedRegionIndex: number; }[]; arcsByRef: Map<string, ComputedArc[]>; linesByRef: Map<string, ComputedLine[]>; } | undefined
```

#### getter: arcsRpcDataMap

```js
// type
Map<any, any>
```

#### getter: modificationThreshold

```js
// type
number
```

#### getter: colorSchemeIndex

```js
// type
number
```

#### getter: showModifications

```js
// type
boolean
```

#### getter: showPerBaseQuality

```js
// type
boolean
```

#### getter: totalPileupHeight

```js
// type
number
```

#### getter: readIdIndexMap

```js
// type
Map<string, { displayedRegionIndex: number; idx: number; }>
```

#### getter: lineWidth

```js
// type
number
```

#### getter: scrollTop

Compatibility getter for BreakpointSplitView overlay which reads
display.scrollTop to position SVG curves. The WebGL display manages Y scrolling
via currentRangeY[0] rather than the inherited scrollTop.

```js
// type
number
```

#### getter: coverageDisplayHeight

```js
// type
number
```

#### getter: pileupViewportHeight

```js
// type
number
```

#### getter: scalebarOverlapLeft

```js
// type
number
```

#### getter: showOutlineSetting

```js
// type
boolean
```

#### getter: visibleLabels

```js
// type
VisibleLabel[]
```

#### getter: scrollableHeight

```js
// type
number
```

#### getter: sortTag

```js
// type
string | undefined
```

#### getter: renderState

```js
// type
{ rangeY: [number, number]; colorScheme: number; featureHeight: number; featureSpacing: number; showCoverage: boolean; coverageHeight: number; coverageYOffset: number; coverageMaxDepth: number | undefined; ... 20 more ...; arcsYDomainBp: number | undefined; } | undefined
```

#### getter: arcsYDomainBp

```js
// type
number | undefined
```

#### getter: insertSizeTicks

```js
// type
YScaleTicks | undefined
```

#### getter: featureUnderMouse

```js
// type
SimpleFeature | undefined
```

### LinearAlignmentsDisplay - Methods

#### method: findFeatureInRpcData

```js
// type signature
findFeatureInRpcData: (featureId: string) => { displayedRegionIndex: number; idx: number; rpcData: PileupDataResult; start: number; end: number; } | undefined
```

#### method: searchFeatureByID

```js
// type signature
searchFeatureByID: (featureId: string) => [number, number, number, number] | undefined
```

#### method: getFeatureInfoById

```js
// type signature
getFeatureInfoById: (featureId: string) => { id: string; name: string; start: number; end: number; flags: number; mapq: number; strand: number; refName: string; } | undefined
```

#### method: rpcProps

```js
// type signature
rpcProps: () => { filterBy: FilterBy; colorBy: ColorBy; colorTagMap: Record<string, string>; sortTag: string | undefined; showSoftClipping: boolean; drawSingletons: boolean; drawProperPairs: boolean; linkedReads: LinkedReadsMode; }
```

#### method: trackMenuItems

Track menu items

```js
// type signature
trackMenuItems: () => MenuItem[]
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => MenuItem[]
```

### LinearAlignmentsDisplay - Actions

#### action: clearMouseoverState

```js
// type signature
clearMouseoverState: () => void
```

#### action: setError

```js
// type signature
setError: (error?: unknown) => void
```

#### action: setRegionTooLarge

```js
// type signature
setRegionTooLarge: (val: boolean, reason?: string | undefined) => void
```

#### action: setRpcData

```js
// type signature
setRpcData: (displayedRegionIndex: number, data: PileupDataResult | null) => void
```

#### action: clearDisplaySpecificData

```js
// type signature
clearDisplaySpecificData: () => void
```

#### action: setOverCigarItem

```js
// type signature
setOverCigarItem: (flag: boolean) => void
```

#### action: setColorPalette

```js
// type signature
setColorPalette: (palette: ColorPalette | null) => void
```

#### action: setScrollTop

```js
// type signature
setScrollTop: (scrollTop: number) => void
```

#### action: setCurrentRangeY

```js
// type signature
setCurrentRangeY: (rangeY: [number, number]) => void
```

#### action: setHighlightedChainIds

```js
// type signature
setHighlightedChainIds: (ids: string[]) => void
```

#### action: clearHighlights

```js
// type signature
clearHighlights: () => void
```

#### action: clearSelection

```js
// type signature
clearSelection: () => void
```

#### action: setSelectedChainIds

```js
// type signature
setSelectedChainIds: (ids: string[]) => void
```

#### action: setColorScheme

```js
// type signature
setColorScheme: (colorBy: ColorBy) => void
```

#### action: updateColorTagMap

```js
// type signature
updateColorTagMap: (uniqueTag: string[]) => boolean
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filterBy: FilterBy) => void
```

#### action: setShowOutline

```js
// type signature
setShowOutline: (show: boolean | undefined) => void
```

#### action: toggleSoftClipping

```js
// type signature
toggleSoftClipping: () => void
```

#### action: toggleMismatchAlpha

```js
// type signature
toggleMismatchAlpha: () => void
```

#### action: setSortedBy

```js
// type signature
setSortedBy: (type: string, tag?: string | undefined) => void
```

#### action: setSortedByAtPosition

```js
// type signature
setSortedByAtPosition: (type: string, pos: number, refName: string) => void
```

#### action: clearSortedBy

```js
// type signature
clearSortedBy: () => void
```

#### action: setMaxHeight

```js
// type signature
setMaxHeight: (n?: number | undefined) => void
```

#### action: setScaleType

```js
// type signature
setScaleType: (val: string) => void
```

#### action: setAutoscale

```js
// type signature
setAutoscale: (val?: string | undefined) => void
```

#### action: setMinScore

```js
// type signature
setMinScore: (val?: number | undefined) => void
```

#### action: setMaxScore

```js
// type signature
setMaxScore: (val?: number | undefined) => void
```

#### action: setFeatureHeight

```js
// type signature
setFeatureHeight: (height?: number | undefined) => void
```

#### action: setFeatureSpacing

```js
// type signature
setFeatureSpacing: (spacing?: number | undefined) => void
```

#### action: setCompactness

```js
// type signature
setCompactness: (level: "normal" | "compact" | "super-compact") => void
```

#### action: setSashimiArcs

```js
// type signature
setSashimiArcs: (mode: ArcDirection) => void
```

#### action: setPairedArcs

```js
// type signature
setPairedArcs: (mode: PairedArcsMode) => void
```

#### action: setShowCoverage

```js
// type signature
setShowCoverage: (show: boolean) => void
```

#### action: setCoverageHeight

```js
// type signature
setCoverageHeight: (height: number) => void
```

#### action: setArcsHeight

```js
// type signature
setArcsHeight: (height: number) => void
```

#### action: setSashimiArcsHeight

```js
// type signature
setSashimiArcsHeight: (height: number) => void
```

#### action: setLineWidth

```js
// type signature
setLineWidth: (width: number) => void
```

#### action: setDrawInter

```js
// type signature
setDrawInter: (draw: boolean) => void
```

#### action: setDrawLongRange

```js
// type signature
setDrawLongRange: (draw: boolean) => void
```

#### action: setColorByType

```js
// type signature
setColorByType: (type: ArcColorByType) => void
```

#### action: setShowMismatches

```js
// type signature
setShowMismatches: (show: boolean) => void
```

#### action: setShowYScalebar

```js
// type signature
setShowYScalebar: (show: boolean) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (show: boolean | undefined) => void
```

#### action: setDrawSingletons

```js
// type signature
setDrawSingletons: (flag: boolean) => void
```

#### action: setDrawProperPairs

```js
// type signature
setDrawProperPairs: (flag: boolean) => void
```

#### action: setShowInterbaseIndicators

```js
// type signature
setShowInterbaseIndicators: (show: boolean) => void
```

#### action: setFlipStrandLongReadChains

```js
// type signature
setFlipStrandLongReadChains: (flag: boolean) => void
```

#### action: setLinkedReads

```js
// type signature
setLinkedReads: (mode: LinkedReadsMode) => void
```

#### action: updateVisibleModifications

```js
// type signature
updateVisibleModifications: (uniqueModifications: string[]) => void
```

#### action: setSimplexModifications

```js
// type signature
setSimplexModifications: (simplex: string[]) => void
```

#### action: setModificationsReady

```js
// type signature
setModificationsReady: (flag: boolean) => void
```

#### action: setFeatureIdUnderMouse

```js
// type signature
setFeatureIdUnderMouse: (feature?: string | undefined) => void
```

#### action: setMouseoverExtraInformation

```js
// type signature
setMouseoverExtraInformation: (extra?: TooltipPayload | undefined) => void
```

#### action: setHoverState

```js
// type signature
setHoverState: (state: { overCigarItem: boolean; featureIdUnderMouse: string | undefined; mouseoverExtraInformation: TooltipPayload | undefined; }) => void
```

#### action: setContextMenuFeature

```js
// type signature
setContextMenuFeature: (feature?: Feature | undefined) => void
```

#### action: setContextMenuCoord

```js
// type signature
setContextMenuCoord: (coord?: [number, number] | undefined) => void
```

#### action: setContextMenuCigarHit

```js
// type signature
setContextMenuCigarHit: (hit?: CigarHitResult | undefined) => void
```

#### action: setContextMenuIndicatorHit

```js
// type signature
setContextMenuIndicatorHit: (hit?: IndicatorHitResult | undefined) => void
```

#### action: clearContextMenu

```js
// type signature
clearContextMenu: () => void
```

#### action: setContextMenuRefName

```js
// type signature
setContextMenuRefName: (refName?: string | undefined) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: startBackend

```js
// type signature
startBackend: (backend: AlignmentsBackend) => void
```

#### action: selectFeatureById

```js
// type signature
selectFeatureById: (featureId: string) => Promise<void>
```

#### action: setContextMenuFeatureById

```js
// type signature
setContextMenuFeatureById: (featureId: string) => Promise<void>
```

#### action: getByteEstimateConfig

```js
// type signature
getByteEstimateConfig: () => {
  adapterConfig: any
  fetchSizeLimit: number
  userByteSizeLimit: number | undefined
  visibleBp: number
}
```

#### action: fetchNeeded

```js
// type signature
fetchNeeded: (needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```
