---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
sidebar_label: Display -> LinearAlignmentsDisplay
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

## Example usage

The display goes in a track's `displays` array; here are three complete
`AlignmentsTrack` configs to paste into `tracks`.

Basic BAM, opened taller:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'ngs_reads',
  name: 'NGS reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
  displays: [
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'ngs_reads-LinearAlignmentsDisplay',
      height: 250,
    },
  ],
}
```

CRAM colored by CpG methylation (modBAM MM/ML tags):

```js
{
  type: 'AlignmentsTrack',
  trackId: 'methylation',
  name: 'Methylation',
  assemblyNames: ['hg38'],
  adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
  displays: [
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'methylation-LinearAlignmentsDisplay',
      colorBy: { type: 'methylation' },
    },
  ],
}
```

Long reads with soft-clipping shown and split/mate reads connected by arcs:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'long_reads',
  name: 'Long reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
  displays: [
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'long_reads-LinearAlignmentsDisplay',
      height: 400,
      showSoftClipping: true,
      linkedReads: 'normal',
      readConnections: 'arc',
    },
  ],
}
```

## Overview

State model factory for LinearAlignmentsDisplay

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Volatiles:** error, statusMessage

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightOverride

**Volatiles:** scrollTop

**Getters:** height

**Actions:** setScrollTop, setHeight, resizeHeight

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:** loadedRegions

**Getters:** isReady, viewportWithinLoadedData, svgReady, svgReadyExtraTerminal,
renderBlocks, displayPhase, loadingOverlayVisible

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

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage,
statusProgress, fetchCanceled, regionStatuses

**Getters:** isLoading

**Actions:** setError, setStatusMessage, setRegionStatus, cancelFetch,
cancelFetchByUser, runFetch

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
linkedReads: types.stripDefault(
            types.enumeration<LinkedReadsMode>('LinkedReadsMode', [
              'off',
              'normal',
            ]),
            'off',
          )
```

#### property: showBezierConnections

Draw paired-read connection curves (bezier overlay + GPU straight lines for
normal pairs). Orthogonal to `linkedReads` layout, so curves work over an
ordinary pileup or chain layout.

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showBezierConnections: types.stripDefault(types.boolean, false)
```

#### property: showCoverage

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCoverage: types.stripDefault(types.boolean, true)
```

#### property: coverageHeight

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
coverageHeight: types.stripDefault(types.number, 45)
```

#### property: showMismatches

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showMismatches: types.stripDefault(types.boolean, true)
```

#### property: showInterbaseIndicators

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showInterbaseIndicators: types.stripDefault(types.boolean, true)
```

#### property: drawSingletons

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawSingletons: types.stripDefault(types.boolean, true)
```

#### property: drawProperPairs

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawProperPairs: types.stripDefault(types.boolean, true)
```

#### property: flipStrandLongReadChains

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
flipStrandLongReadChains: types.stripDefault(types.boolean, true)
```

#### property: drawInter

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawInter: types.stripDefault(types.boolean, true)
```

#### property: drawLongRange

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawLongRange: types.stripDefault(types.boolean, true)
```

#### property: arcColorByType

```js
// type signature
IOptionalIType<ISimpleType<ArcColorByType>, [undefined]>
// code
arcColorByType: types.stripDefault(
            arcColorByTypes,
            'insertSizeAndOrientation',
          )
```

#### property: readConnections

read-connection rendering mode (mate pairs + split reads), orthogonal to
direction

```js
// type signature
IOptionalIType<ISimpleType<ReadConnectionsMode>, [undefined]>
// code
readConnections: types.stripDefault(
            types.enumeration<ReadConnectionsMode>('ReadConnectionsMode', [
              'off',
              'arc',
              'samplot',
            ]),
            'off',
          )
```

#### property: readConnectionsDown

draw read connections below the coverage band instead of over it

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
readConnectionsDown: types.stripDefault(types.boolean, false)
```

#### property: showSashimiArcs

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSashimiArcs: types.stripDefault(types.boolean, true)
```

#### property: minSashimiScore

hide sashimi junction arcs with fewer than this many supporting reads (0 shows
all)

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minSashimiScore: types.stripDefault(types.number, 0)
```

#### property: sashimiArcsHeight

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
sashimiArcsHeight: types.stripDefault(types.number, 40)
```

#### property: readConnectionsHeight

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
readConnectionsHeight: types.stripDefault(types.number, 40)
```

#### property: showSoftClipping

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSoftClipping: types.stripDefault(types.boolean, false)
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
ObservableMap<number, GroupedAlignmentsResult>
// code
rpcDataMap: observable.map<number, GroupedAlignmentsResult>()
```

#### volatile: scrollTop

pileup vertical scroll offset in px. Also read by the BreakpointSplitView
overlay to position its SVG curves.

```js
// type signature
number
// code
scrollTop: 0
```

#### volatile: collapsedGroups

Group keys whose pileup is collapsed to just its coverage band (in-track
grouping). Keyed by group key so it survives re-fetches; volatile so it resets
on reload. Stale keys from a prior grouping dimension are harmless — they never
match the new keys.

```js
// type signature
ObservableSet<string>
// code
collapsedGroups: observable.set<string>()
```

#### volatile: groupMaxHeightOverrides

Per-group pileup height override in px (in-track grouping). Keyed by group key,
volatile like `collapsedGroups`; absent keys fall back to the display-wide
`maxHeight`. Lets a dense section be shrunk independently. Cleared by
`setGroupBy`.

```js
// type signature
ObservableMap<string, number>
// code
groupMaxHeightOverrides: observable.map<string, number>()
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
;(Record < string,
  string >
    // code
    colorTagMap)
```

#### volatile: visibleModifications

```js
// type signature
ObservableMap<string, ModificationTypeWithColor>
// code
visibleModifications: observable.map<
            string,
            ModificationTypeWithColor
          >({})
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

#### volatile: hoverCoverageBand

Screen-px coverage band of the section currently under a coverage/indicator
hover. Drives the tooltip's vertical hover bar so it lands on the hovered
group's coverage band, not always the top one. `undefined` when not hovering
coverage.

```js
// type signature
{ topOffset: number; coverageHeight: number; } | undefined
// code
hoverCoverageBand: undefined as
            | { topOffset: number; coverageHeight: number }
            | undefined
```

### LinearAlignmentsDisplay - Getters

#### getter: isChainMode

```js
// type
boolean
```

#### getter: showLinkedReadLines

Whether to draw the straight-line pass connecting normal read-pairs in pileup
layout. Only meaningful when bezier connections are on AND we are in pileup mode
— chain layout has its own connecting-line pass that already covers normal
pairs.

```js
// type
boolean
```

#### getter: scaleType

```js
// type
'linear' | 'log'
```

#### getter: autoscaleType

```js
// type
'local' | 'localsd'
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

#### getter: minScoreBound

```js
// type
number | undefined
```

#### getter: maxScoreBound

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

#### getter: TooltipComponent

```js
// type
LazyExoticComponent<({ model, clientMouseCoord, offsetMouseCoord, }: { model: { mouseoverExtraInformation: TooltipPayload | undefined; hoverCoverageBand: { topOffset: number; coverageHeight: number; } | undefined; }; offsetMouseCoord?: Coord | undefined; clientMouseCoord: Coord; }) => Element | null>
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

#### getter: featureHeight

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
Map<string, string[]>
```

#### getter: mismatchAlpha

```js
// type
boolean
```

#### getter: showLowFreqMismatches

```js
// type
boolean
```

#### getter: showLegend

```js
// type
boolean
```

#### getter: sortedBy

```js
// type
SortedBy | undefined
```

#### getter: groupBy

In-track stacked grouping dimension (undefined = ungrouped). Sent to the worker
via rpcProps; the worker partitions one fetch into N sections.

```js
// type
GroupBy | undefined
```

#### getter: prefersOffset

Offset the track label above the visualization when grouping, so the stacked
group sections aren't hidden behind an overlapping label.

```js
// type
boolean
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

#### getter: colorLegendCategories

Read-color buckets actually present across the rendered reads, the single input
that lets the legend list only relevant swatches (see legendUtils). Shares
readColorCategory with the renderer so the two can't disagree. Empty while the
legend is hidden so the O(reads) scan is skipped; MobX memoizes it against
rpcDataMap + scheme + mode.

```js
// type
Set<ReadColorCategory>
```

#### getter: colorPalette

```js
// type
ColorPalette
```

#### getter: laidOutByGroup

Per-group laid-out data: group key → (region index → laid-out data). Each group
lays out independently (own `maxRows` cap) so a dense group can't starve the
rest. Tag colors are baked here (not in the worker) so colorTagMap stays a
main-thread tier-2 setting — see readTagColors.

```js
// type
LaidOutByGroup
```

#### getter: groupOrder

Group keys + labels in stacking order; a single entry (key '') when ungrouped.
Derived straight from the fetched `rpcDataMap` (not from the layout pass), so
group identity/order stays stable across relayouts.

```js
// type
GroupId[]
```

#### getter: laidOutPileupMap

Renderer-facing per-region layout. Stage 2 draws a single section, so this
exposes the first (for ungrouped, the only) group; Stage 3 switches the
renderers to loop `sections` directly.

```js
// type
Map<number, PileupDataResult>
```

#### getter: sourceSections

Per-section renderer input, in stacking order. One entry per group (the single
key '' when ungrouped). Pairs each group's laid-out region map with its key so
the renderers can namespace HAL region keys per section. Parallel to
`renderState.sections`.

```js
// type
{ groupKey: string; laidOutPileupMap: Map<number, PileupDataResult>; arcsRpcDataMap: Map<number, ArcsUploadData>; }[]
```

#### getter: maxY

Row count of the primary group across its regions. This reads only the first
group (`laidOutPileupMap`), so it is meaningful only on the
single-section/ungrouped path (`totalPileupHeight`, `searchFeatureByID`, and the
no-data synthetic section in `sections`). Grouped layout sizes each section from
its own `groupMaxY`; don't use this as a cross-group aggregate.

```js
// type
number
```

#### getter: pileupTruncated

True when any group hit `maxHeight` and overflow reads were collapsed — drives
the "max height reached" / "show all" banner. Groups the user explicitly shrank
(a per-group height drag) are skipped: their truncation is intentional, not the
global cap the banner offers to lift.

```js
// type
boolean
```

#### getter: rawDataByGroup

Raw (un-laid-out) data regrouped as group key → (region idx → data),
insertion-ordered so the first key is the primary group. The arc compute and the
per-section sashimi overlay both read one group's raw map from here; ungrouped
is the single key `''`.

```js
// type
Map<string, Map<number, PileupDataResult>>
```

#### getter: arcsByGroup

Per-group arc upload feed: group key → (region idx → `ArcsUploadData`). The
heavy `computeArcsFromPileupData` pass runs once per group (arcs are pre-grouped
by refName so each region lookup is O(1)); ungrouped is the single-group case.
Empty map when read-connections are off, so the off-path skips the per-read
region scan entirely. Source of truth for the per-section arc feed
(`sourceSections`) and the shared cross-group `arcsYDomainBp`.

```js
// type
Map<string, Map<number, ArcsUploadData>>
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

#### getter: showPerBaseLetter

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
Map<string, { displayedRegionIndex: number; groupKey: string; idx: number; }>
```

#### getter: readConnectionsLineWidth

```js
// type
number
```

#### getter: hasSashimiArcs

True when any loaded region has a junction passing minSashimiScore. Drives
whether the below-coverage band reserves space, so a threshold that hides every
arc also reclaims the empty band.

```js
// type
boolean
```

#### getter: belowCoverageBands

Geometry of the bands stacked below coverage in arcs-down mode, top to bottom:
coverage → paired-end arcs → sashimi. Single source of truth so the layout
height, the renderers, and the three resize handles can't drift apart.
`arcsBandTop`/`sashimiBandTop` are each band's top edge; `bottom` is where the
pileup begins (== coverageDisplayHeight).

```js
// type
{
  hasArcsBand: boolean
  hasSashimiBand: boolean
  arcsBandTop: number
  sashimiBandTop: number
  bottom: number
}
```

#### getter: coverageDisplayHeight

```js
// type
number
```

#### getter: sections

Single source of all vertical band geometry, one entry per stacked group.
`computeStackedSections` reproduces the prior ungrouped reserved layout exactly
for its single-section (N==1) case, so ungrouped is not a special branch here —
it is the one-group call, with a synthetic group when no data has arrived yet
(so `laidOutPileupMap`/`renderState` still see one section). The
sticky-coverage-vs-scroll distinction lives downstream in `buildSectionRenders`,
keyed off section count.

```js
// type
SectionsLayout
```

#### getter: renderSections

Per-section data + content-space band tops for the overlay/hit-test pipeline
(labels, highlights, hit-test). Pairs each section's group data map with its
`pileupTop` (used as the row `topOffset`) and coverage band so a screen-y can be
mapped to the right section and its group. Reads straight off `sections` (every
field already lives on the `Section`); ungrouped is the single section, so the
pipeline reduces to pre-grouping.

```js
// type
{ groupKey: string; label: string; laidOutPileupMap: Map<number, PileupDataResult>; topOffset: number; coverageTop: number; coverageHeight: number; pileupHeight: number; }[]
```

#### getter: sashimiSections

Per-section sashimi band placement, in stacking order. Each entry pairs a
group's raw data (sashimi counts live per-group) with the content-space top of
its sashimi band: down mode uses the reserved sashimi band, up mode overlays the
section's own coverage. The overlay and SVG export both map over this so their
geometry can't drift; ungrouped is the single-section case (sticky band below
sticky coverage, raw map == the only group). Empty when sashimi is off.

```js
// type
{ groupKey: string; rpcDataMap: Map<number, PileupDataResult>; top: number; down: boolean; }[]
```

#### getter: isGrouped

True when reads are stacked into >1 group section. Drives the scroll model:
ungrouped keeps coverage sticky (only the pileup scrolls); grouped scrolls the
whole coverage+pileup stack as one.

```js
// type
boolean
```

#### getter: scrollModel

The scroll-projection inputs (`sectionScreen.ts`) every overlay needs to map a
content-space Y into screen space. Built once here so the label / resize-handle
/ coverage-axis overlays don't each re-assemble
`{ isGrouped, scrollTop, canvasHeight }` inline.

```js
// type
ScrollModel
```

#### getter: pileupViewportHeight

Height of the scrollable viewport. Ungrouped excludes the sticky coverage band;
grouped scrolls the entire display.

```js
// type
number
```

#### getter: pileupContentHeight

Total scrollable content height. Ungrouped is just the pileup (coverage is
sticky); grouped is the full stacked-sections height.

```js
// type
number
```

#### getter: scalebarOverlapLeft

```js
// type
number
```

#### getter: showOutline

```js
// type
boolean
```

#### getter: visibleLabels

```js
// type
VisibleLabel[]
```

#### getter: highlightBoxes

Screen boxes for the hovered read / chain, painted by the `HighlightOverlay`
div. Deliberately NOT part of `renderState`: the hovered id changes on nearly
every mousemove, and routing it through the canvas would repaint the whole
pileup each move.

```js
// type
HighlightBox[]
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
{ scrollTop: number; colorScheme: number; featureHeight: number; featureSpacing: number; showCoverage: boolean; coverageHeight: number; coverageYOffset: number; coverageMaxDepth: number | undefined; ... 24 more ...; arcsYDomainBp: number | undefined; } | undefined
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

#### method: isGroupCollapsed

Whether a stacked group's pileup is collapsed to just its coverage.

```js
// type signature
isGroupCollapsed: (key: string) => boolean
```

#### method: legendItems

```js
// type signature
legendItems: () => LegendItem[]
```

#### method: groupLaidOutMap

Laid-out region map for one group key, or an empty map for a key with no data.
Centralizes the empty-map fallback shared by the section getters so they never
have to branch on a missing group.

```js
// type signature
groupLaidOutMap: (key: string) => Map<number, PileupDataResult>
```

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
rpcProps: () => {
  filterBy: FilterBy
  colorBy: ColorBy
  sortTag: string | undefined
  groupBy: GroupBy | undefined
  showSoftClipping: boolean
  drawSingletons: boolean
  drawProperPairs: boolean
  linkedReads: LinkedReadsMode
}
```

#### method: trackMenuItems

Track menu items

```js
// type signature
trackMenuItems: () => (MenuItem | { label: string; type: "subMenu"; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: MenuItem[]; } | { ...; } | { ...; })[]
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
setRpcData: (displayedRegionIndex: number, data: GroupedAlignmentsResult | null) => void
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

#### action: setScrollTop

```js
// type signature
setScrollTop: (scrollTop: number) => void
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
updateColorTagMap: (uniqueTag: string[]) => void
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

#### action: toggleShowLowFreqMismatches

```js
// type signature
toggleShowLowFreqMismatches: () => void
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

#### action: setGroupBy

Set (or clear, when undefined) the in-track stacked grouping dimension. A tier-1
refetch setting (in `rpcProps`) — the worker re-partitions the fetch into N
sections. Resets the Y scroll since the stacked content height changes.

```js
// type signature
setGroupBy: (groupBy?: GroupBy | undefined) => void
```

#### action: toggleGroupCollapsed

Collapse/expand a stacked group's pileup (coverage stays visible).

```js
// type signature
toggleGroupCollapsed: (key: string) => void
```

#### action: resizeGroupHeight

Drag a stacked group's pileup band taller/shorter by `dy` px, capping how many
rows that group lays out; one row is the floor.

The override accumulates continuously across drag frames. It must not re-seed
from the section's displayed `pileupHeight` each frame: that height is
row-snapped (`maxY * rowHeight`) and content-capped, so a sub-row `dy` rounds
away to nothing while a sub-row negative `dy` snaps off a whole row — the drag
stutters and biases toward shrinking. Instead grow the stored px value directly,
seeding from the displayed height only on the first frame. When the override
already runs past the real content (displayed height < override), clamp back to
one row of headroom so reversing the drag responds immediately.

```js
// type signature
resizeGroupHeight: (key: string, dy: number) => void
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

#### action: setMaxHeight

```js
// type signature
setMaxHeight: (height?: number | undefined) => void
```

#### action: setCompactness

```js
// type signature
setCompactness: (level: "normal" | "compact" | "super-compact") => void
```

#### action: setShowSashimiArcs

```js
// type signature
setShowSashimiArcs: (show: boolean) => void
```

#### action: toggleSashimiArcs

```js
// type signature
toggleSashimiArcs: () => void
```

#### action: setReadConnections

```js
// type signature
setReadConnections: (mode: ReadConnectionsMode) => void
```

#### action: setReadConnectionsDown

```js
// type signature
setReadConnectionsDown: (down: boolean) => void
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

#### action: setReadConnectionsHeight

```js
// type signature
setReadConnectionsHeight: (height: number) => void
```

#### action: setSashimiArcsHeight

```js
// type signature
setSashimiArcsHeight: (height: number) => void
```

#### action: setMinSashimiScore

```js
// type signature
setMinSashimiScore: (score: number) => void
```

#### action: setReadConnectionsLineWidth

```js
// type signature
setReadConnectionsLineWidth: (width: number) => void
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

#### action: setShowBezierConnections

Toggle the paired-read connection overlay. A main-thread tier-2/4 setting (read
in `laidOutPileupMap` + `renderState`), not in `rpcProps` — toggling it never
refetches.

```js
// type signature
setShowBezierConnections: (flag: boolean) => void
```

#### action: updateVisibleModifications

```js
// type signature
updateVisibleModifications: (uniqueModifications: string[]) => void
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
setHoverState: (state: { overCigarItem: boolean; featureIdUnderMouse: string | undefined; mouseoverExtraInformation: TooltipPayload | undefined; hoverCoverageBand?: { topOffset: number; coverageHeight: number; } | undefined; }) => void
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

#### action: startRenderingBackend

```js
// type signature
startRenderingBackend: (backend: AlignmentsRenderingBackend) => void
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
