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
<summary>LinearAlignmentsDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearAlignmentsDisplay'>
// code
type: types.literal('LinearAlignmentsDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: linkedReads

```ts
// type signature
type linkedReads = IOptionalIType<ISimpleType<LinkedReadsMode>, [undefined]>
// code
linkedReads: types.stripDefault(
  types.enumeration<LinkedReadsMode>('LinkedReadsMode', ['off', 'normal']),
  'off',
)
```

#### property: showBezierConnections

Draw paired-read connection curves (bezier overlay + GPU straight lines for
normal pairs). Orthogonal to `linkedReads` layout, so curves work over an
ordinary pileup or chain layout.

```ts
// type signature
type showBezierConnections = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showBezierConnections: types.stripDefault(types.boolean, false)
```

#### property: showCoverage

```ts
// type signature
type showCoverage = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCoverage: types.stripDefault(types.boolean, true)
```

#### property: showPileup

Draw the stacked-read pileup band. Turn off to keep only the coverage histogram
and read-connection arcs (the pileup band collapses to zero height), e.g. an
arcs-only structural-variant view.

```ts
// type signature
type showPileup = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showPileup: types.stripDefault(types.boolean, true)
```

#### property: coverageHeight

```ts
// type signature
type coverageHeight = IOptionalIType<ISimpleType<number>, [undefined]>
// code
coverageHeight: types.stripDefault(types.number, 45)
```

#### property: showMismatches

```ts
// type signature
type showMismatches = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showMismatches: types.stripDefault(types.boolean, true)
```

#### property: showInterbaseIndicators

```ts
// type signature
type showInterbaseIndicators = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showInterbaseIndicators: types.stripDefault(types.boolean, true)
```

#### property: drawSingletons

```ts
// type signature
type drawSingletons = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawSingletons: types.stripDefault(types.boolean, true)
```

#### property: drawProperPairs

```ts
// type signature
type drawProperPairs = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawProperPairs: types.stripDefault(types.boolean, true)
```

#### property: flipStrandLongReadChains

```ts
// type signature
type flipStrandLongReadChains = IOptionalIType<
  ISimpleType<boolean>,
  [undefined]
>
// code
flipStrandLongReadChains: types.stripDefault(types.boolean, true)
```

#### property: drawInter

```ts
// type signature
type drawInter = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawInter: types.stripDefault(types.boolean, true)
```

#### property: drawLongRange

```ts
// type signature
type drawLongRange = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawLongRange: types.stripDefault(types.boolean, true)
```

#### property: arcColorByType

```ts
// type signature
type arcColorByType = IOptionalIType<ISimpleType<ArcColorByType>, [undefined]>
// code
arcColorByType: types.stripDefault(arcColorByTypes, 'insertSizeAndOrientation')
```

#### property: readConnections

read-connection rendering mode (mate pairs + split reads), orthogonal to
direction

```ts
// type signature
type readConnections = IOptionalIType<
  ISimpleType<ReadConnectionsMode>,
  [undefined]
>
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

```ts
// type signature
type readConnectionsDown = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
readConnectionsDown: types.stripDefault(types.boolean, false)
```

#### property: showSashimiArcs

```ts
// type signature
type showSashimiArcs = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSashimiArcs: types.stripDefault(types.boolean, true)
```

#### property: minSashimiScore

hide sashimi junction arcs with fewer than this many supporting reads (0 shows
all)

```ts
// type signature
type minSashimiScore = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minSashimiScore: types.stripDefault(types.number, 0)
```

#### property: sashimiArcsHeight

```ts
// type signature
type sashimiArcsHeight = IOptionalIType<ISimpleType<number>, [undefined]>
// code
sashimiArcsHeight: types.stripDefault(types.number, 40)
```

#### property: readConnectionsHeight

```ts
// type signature
type readConnectionsHeight = IOptionalIType<ISimpleType<number>, [undefined]>
// code
readConnectionsHeight: types.stripDefault(types.number, 40)
```

#### property: showSoftClipping

```ts
// type signature
type showSoftClipping = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showSoftClipping: types.stripDefault(types.boolean, false)
```

</details>

<details open>
<summary>LinearAlignmentsDisplay - Volatiles</summary>

#### volatile: featureIdUnderMouse

```ts
// type signature
type featureIdUnderMouse = string | undefined
// code
featureIdUnderMouse: undefined as undefined | string
```

#### volatile: mouseoverExtraInformation

```ts
// type signature
type mouseoverExtraInformation = TooltipPayload | undefined
// code
mouseoverExtraInformation: undefined as TooltipPayload | undefined
```

#### volatile: contextMenuFeature

```ts
// type signature
type contextMenuFeature = Feature | undefined
// code
contextMenuFeature: undefined as Feature | undefined
```

#### volatile: contextMenuCoord

```ts
// type signature
type contextMenuCoord = [number, number] | undefined
// code
contextMenuCoord: undefined as [number, number] | undefined
```

#### volatile: contextMenuCigarHit

```ts
// type signature
type contextMenuCigarHit = CigarHitResult | undefined
// code
contextMenuCigarHit: undefined as CigarHitResult | undefined
```

#### volatile: contextMenuIndicatorHit

```ts
// type signature
type contextMenuIndicatorHit = IndicatorHitResult | undefined
// code
contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined
```

#### volatile: contextMenuRefName

```ts
// type signature
type contextMenuRefName = string | undefined
// code
contextMenuRefName: undefined as string | undefined
```

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, GroupedAlignmentsResult>
// code
rpcDataMap: observable.map<number, GroupedAlignmentsResult>()
```

#### volatile: scrollTop

pileup vertical scroll offset in px. Also read by the BreakpointSplitView
overlay to position its SVG curves.

```ts
// type signature
type scrollTop = number
// code
scrollTop: 0
```

#### volatile: collapsedGroups

Group keys whose pileup is collapsed to just its coverage band (in-track
grouping). Keyed by group key so it survives re-fetches; volatile so it resets
on reload. Stale keys from a prior grouping dimension are harmless — they never
match the new keys.

```ts
// type signature
type collapsedGroups = ObservableSet<string>
// code
collapsedGroups: observable.set<string>()
```

#### volatile: groupMaxHeightOverrides

Per-group pileup height override in px (in-track grouping). Keyed by group key,
volatile like `collapsedGroups`; absent keys fall back to the display-wide
`maxHeight`. Lets a dense section be shrunk independently. Cleared by
`setGroupBy`.

```ts
// type signature
type groupMaxHeightOverrides = ObservableMap<string, number>
// code
groupMaxHeightOverrides: observable.map<string, number>()
```

#### volatile: highlightedChainIds

```ts
// type signature
type highlightedChainIds = string[]
// code
highlightedChainIds: [] as string[]
```

#### volatile: selectedChainIds

```ts
// type signature
type selectedChainIds = string[]
// code
selectedChainIds: [] as string[]
```

#### volatile: colorTagMap

```ts
// type signature
type colorTagMap = Record<string, string>
// code
colorTagMap
```

#### volatile: visibleModifications

```ts
// type signature
type visibleModifications = ObservableMap<string, ModificationTypeWithColor>
// code
visibleModifications: observable.map<string, ModificationTypeWithColor>({})
```

#### volatile: modificationsReady

```ts
// type signature
type modificationsReady = false
// code
modificationsReady: false
```

#### volatile: overCigarItem

```ts
// type signature
type overCigarItem = false
// code
overCigarItem: false
```

#### volatile: hoverCoverageBand

Screen-px coverage band of the section currently under a coverage/indicator
hover. Drives the tooltip's vertical hover bar so it lands on the hovered
group's coverage band, not always the top one. `undefined` when not hovering
coverage.

```ts
// type signature
type hoverCoverageBand =
  | { topOffset: number; coverageHeight: number }
  | undefined
// code
hoverCoverageBand: undefined as
  | { topOffset: number; coverageHeight: number }
  | undefined
```

</details>

<details open>
<summary>LinearAlignmentsDisplay - Getters</summary>

#### getter: isChainMode

```ts
type isChainMode = boolean
```

#### getter: showLinkedReadLines

Whether to draw the straight-line pass connecting normal read-pairs in pileup
layout. Only meaningful when bezier connections are on AND we are in pileup mode
— chain layout has its own connecting-line pass that already covers normal
pairs.

```ts
type showLinkedReadLines = boolean
```

#### getter: scaleType

```ts
type scaleType = 'linear' | 'log'
```

#### getter: autoscaleType

```ts
type autoscaleType = 'local' | 'localsd'
```

#### getter: minScore

```ts
type minScore = number
```

#### getter: maxScore

```ts
type maxScore = number
```

#### getter: minScoreBound

```ts
type minScoreBound = number | undefined
```

#### getter: maxScoreBound

```ts
type maxScoreBound = number | undefined
```

#### getter: numStdDev

```ts
type numStdDev = number
```

#### getter: featureWidgetType

```ts
type featureWidgetType = { type: string; id: string }
```

#### getter: selectedFeatureId

```ts
type selectedFeatureId = string | undefined
```

#### getter: TooltipComponent

```ts
type TooltipComponent = LazyExoticComponent<
  ({
    model,
    clientMouseCoord,
    offsetMouseCoord,
  }: {
    model: {
      mouseoverExtraInformation: TooltipPayload | undefined
      hoverCoverageBand:
        | { topOffset: number; coverageHeight: number }
        | undefined
    }
    offsetMouseCoord?: Coord | undefined
    clientMouseCoord: Coord
  }) => Element | null
>
```

#### getter: visibleModificationTypes

```ts
type visibleModificationTypes = string[]
```

#### getter: colorBy

```ts
type colorBy = ColorBy
```

#### getter: filterBy

```ts
type filterBy = FilterBy
```

#### getter: featureHeight

```ts
type featureHeight = number
```

#### getter: featureSpacing

```ts
type featureSpacing = number
```

#### getter: maxHeight

```ts
type maxHeight = number
```

#### getter: chainIdMap

```ts
type chainIdMap = Map<string, string[]>
```

#### getter: mismatchAlpha

```ts
type mismatchAlpha = boolean
```

#### getter: showLowFreqMismatches

```ts
type showLowFreqMismatches = boolean
```

#### getter: showLegend

```ts
type showLegend = boolean
```

#### getter: sortedBy

```ts
type sortedBy = SortedBy | undefined
```

#### getter: groupBy

In-track stacked grouping dimension (undefined = ungrouped). Sent to the worker
via rpcProps; the worker partitions one fetch into N sections.

```ts
type groupBy = GroupBy | undefined
```

#### getter: prefersOffset

Offset the track label above the visualization when grouping, so the stacked
group sections aren't hidden behind an overlapping label.

```ts
type prefersOffset = boolean
```

#### getter: coverageIsLog

```ts
type coverageIsLog = boolean
```

#### getter: coverageStats

```ts
type coverageStats = ScoreStats | undefined
```

#### getter: coverageDomain

```ts
type coverageDomain = [number, number] | undefined
```

#### getter: coverageTicks

```ts
type coverageTicks = YScaleTicks | undefined
```

#### getter: colorLegendCategories

Read-color buckets actually present across the rendered reads, the single input
that lets the legend list only relevant swatches (see legendUtils). Shares
readColorCategory with the renderer so the two can't disagree. Empty while the
legend is hidden so the O(reads) scan is skipped; MobX memoizes it against
rpcDataMap + scheme + mode.

```ts
type colorLegendCategories = Set<ReadColorCategory>
```

#### getter: colorPalette

```ts
type colorPalette = ColorPalette
```

#### getter: laidOutByGroup

Per-group laid-out data: group key → (region index → laid-out data). Each group
lays out independently (own `maxRows` cap) so a dense group can't starve the
rest. Tag colors are baked here (not in the worker) so colorTagMap stays a
main-thread tier-2 setting — see readTagColors.

```ts
type laidOutByGroup = LaidOutByGroup
```

#### getter: groupOrder

Group keys + labels in stacking order; a single entry (key '') when ungrouped.
Derived straight from the fetched `rpcDataMap` (not from the layout pass), so
group identity/order stays stable across relayouts.

```ts
type groupOrder = GroupId[]
```

#### getter: laidOutPileupMap

Renderer-facing per-region layout. Stage 2 draws a single section, so this
exposes the first (for ungrouped, the only) group; Stage 3 switches the
renderers to loop `sections` directly.

```ts
type laidOutPileupMap = Map<number, PileupDataResult>
```

#### getter: sourceSections

Per-section renderer input, in stacking order. One entry per group (the single
key '' when ungrouped). Pairs each group's laid-out region map with its key so
the renderers can namespace HAL region keys per section. Parallel to
`renderState.sections`.

```ts
type sourceSections = {
  groupKey: string
  laidOutPileupMap: Map<number, PileupDataResult>
  arcsRpcDataMap: Map<number, ArcsUploadData>
}[]
```

#### getter: maxY

Row count of the primary group across its regions. This reads only the first
group (`laidOutPileupMap`), so it is meaningful only on the
single-section/ungrouped path (`totalPileupHeight`, `searchFeatureByID`, and the
no-data synthetic section in `sections`). Grouped layout sizes each section from
its own `groupMaxY`; don't use this as a cross-group aggregate.

```ts
type maxY = number
```

#### getter: pileupTruncated

True when any group hit `maxHeight` and overflow reads were collapsed — drives
the "max height reached" / "show all" banner. Groups the user explicitly shrank
(a per-group height drag) are skipped: their truncation is intentional, not the
global cap the banner offers to lift.

```ts
type pileupTruncated = boolean
```

#### getter: rawDataByGroup

Raw (un-laid-out) data regrouped as group key → (region idx → data),
insertion-ordered so the first key is the primary group. The arc compute and the
per-section sashimi overlay both read one group's raw map from here; ungrouped
is the single key `''`.

```ts
type rawDataByGroup = Map<string, Map<number, PileupDataResult>>
```

#### getter: arcsByGroup

Per-group arc upload feed: group key → (region idx → `ArcsUploadData`). The
heavy `computeArcsFromPileupData` pass runs once per group (arcs are pre-grouped
by refName so each region lookup is O(1)); ungrouped is the single-group case.
Empty map when read-connections are off, so the off-path skips the per-read
region scan entirely. Source of truth for the per-section arc feed
(`sourceSections`) and the shared cross-group `arcsYDomainBp`.

```ts
type arcsByGroup = Map<string, Map<number, ArcsUploadData>>
```

#### getter: modificationThreshold

```ts
type modificationThreshold = number
```

#### getter: colorSchemeIndex

```ts
type colorSchemeIndex = number
```

#### getter: showModifications

```ts
type showModifications = boolean
```

#### getter: showPerBaseQuality

```ts
type showPerBaseQuality = boolean
```

#### getter: showPerBaseLetter

```ts
type showPerBaseLetter = boolean
```

#### getter: totalPileupHeight

```ts
type totalPileupHeight = number
```

#### getter: readIdIndexMap

```ts
type readIdIndexMap = Map<
  string,
  { displayedRegionIndex: number; groupKey: string; idx: number }
>
```

#### getter: readConnectionsLineWidth

```ts
type readConnectionsLineWidth = number
```

#### getter: hasSashimiArcs

True when any loaded region has a junction passing minSashimiScore. Drives
whether the below-coverage band reserves space, so a threshold that hides every
arc also reclaims the empty band.

```ts
type hasSashimiArcs = boolean
```

#### getter: belowCoverageBands

Geometry of the bands stacked below coverage in arcs-down mode, top to bottom:
coverage → paired-end arcs → sashimi. Single source of truth so the layout
height, the renderers, and the three resize handles can't drift apart.
`arcsBandTop`/`sashimiBandTop` are each band's top edge; `bottom` is where the
pileup begins (== coverageDisplayHeight).

```ts
type belowCoverageBands = {
  hasArcsBand: boolean
  hasSashimiBand: boolean
  arcsBandTop: number
  sashimiBandTop: number
  bottom: number
}
```

#### getter: coverageDisplayHeight

```ts
type coverageDisplayHeight = number
```

#### getter: sections

Single source of all vertical band geometry, one entry per stacked group.
`computeStackedSections` reproduces the prior ungrouped reserved layout exactly
for its single-section (N==1) case, so ungrouped is not a special branch here —
it is the one-group call, with a synthetic group when no data has arrived yet
(so `laidOutPileupMap`/`renderState` still see one section). The
sticky-coverage-vs-scroll distinction lives downstream in `buildSectionRenders`,
keyed off section count.

```ts
type sections = SectionsLayout
```

#### getter: renderSections

Per-section data + content-space band tops for the overlay/hit-test pipeline
(labels, highlights, hit-test). Pairs each section's group data map with its
`pileupTop` (used as the row `topOffset`) and coverage band so a screen-y can be
mapped to the right section and its group. Reads straight off `sections` (every
field already lives on the `Section`); ungrouped is the single section, so the
pipeline reduces to pre-grouping.

```ts
type renderSections = {
  groupKey: string
  label: string
  laidOutPileupMap: Map<number, PileupDataResult>
  topOffset: number
  coverageTop: number
  coverageHeight: number
  pileupHeight: number
}[]
```

#### getter: sashimiSections

Per-section sashimi band placement, in stacking order. Each entry pairs a
group's raw data (sashimi counts live per-group) with the content-space top of
its sashimi band: down mode uses the reserved sashimi band, up mode overlays the
section's own coverage. The overlay and SVG export both map over this so their
geometry can't drift; ungrouped is the single-section case (sticky band below
sticky coverage, raw map == the only group). Empty when sashimi is off.

```ts
type sashimiSections = {
  groupKey: string
  rpcDataMap: Map<number, PileupDataResult>
  top: number
  down: boolean
}[]
```

#### getter: isGrouped

True when reads are stacked into >1 group section. Drives the scroll model:
ungrouped keeps coverage sticky (only the pileup scrolls); grouped scrolls the
whole coverage+pileup stack as one.

```ts
type isGrouped = boolean
```

#### getter: scrollModel

The scroll-projection inputs (`sectionScreen.ts`) every overlay needs to map a
content-space Y into screen space. Built once here so the label / resize-handle
/ coverage-axis overlays don't each re-assemble
`{ isGrouped, scrollTop, canvasHeight }` inline.

```ts
type scrollModel = ScrollModel
```

#### getter: pileupViewportHeight

Height of the scrollable viewport. Ungrouped excludes the sticky coverage band;
grouped scrolls the entire display.

```ts
type pileupViewportHeight = number
```

#### getter: pileupContentHeight

Total scrollable content height. Ungrouped is just the pileup (coverage is
sticky); grouped is the full stacked-sections height.

```ts
type pileupContentHeight = number
```

#### getter: scalebarOverlapLeft

```ts
type scalebarOverlapLeft = number
```

#### getter: showOutline

```ts
type showOutline = boolean
```

#### getter: visibleLabels

```ts
type visibleLabels = VisibleLabel[]
```

#### getter: highlightBoxes

Screen boxes for the hovered read / chain, painted by the `HighlightOverlay`
div. Deliberately NOT part of `renderState`: the hovered id changes on nearly
every mousemove, and routing it through the canvas would repaint the whole
pileup each move.

```ts
type highlightBoxes = HighlightBox[]
```

#### getter: scrollableHeight

```ts
type scrollableHeight = number
```

#### getter: sortTag

```ts
type sortTag = string | undefined
```

#### getter: renderState

```ts
type renderState = { scrollTop: number; colorScheme: number; featureHeight: number; featureSpacing: number; showCoverage: boolean; coverageHeight: number; coverageYOffset: number; coverageMaxDepth: number | undefined; ... 24 more ...; arcsYDomainBp: number | undefined; } | undefined
```

#### getter: arcsYDomainBp

```ts
type arcsYDomainBp = number | undefined
```

#### getter: insertSizeTicks

```ts
type insertSizeTicks = YScaleTicks | undefined
```

#### getter: featureUnderMouse

```ts
type featureUnderMouse = SimpleFeature | undefined
```

</details>

<details open>
<summary>LinearAlignmentsDisplay - Methods</summary>

#### method: isGroupCollapsed

Whether a stacked group's pileup is collapsed to just its coverage.

```ts
type isGroupCollapsed = (key: string) => boolean
```

#### method: legendItems

```ts
type legendItems = () => LegendItem[]
```

#### method: groupLaidOutMap

Laid-out region map for one group key, or an empty map for a key with no data.
Centralizes the empty-map fallback shared by the section getters so they never
have to branch on a missing group.

```ts
type groupLaidOutMap = (key: string) => Map<number, PileupDataResult>
```

#### method: findFeatureInRpcData

```ts
type findFeatureInRpcData = (featureId: string) =>
  | {
      displayedRegionIndex: number
      idx: number
      rpcData: PileupDataResult
      start: number
      end: number
    }
  | undefined
```

#### method: searchFeatureByID

```ts
type searchFeatureByID = (
  featureId: string,
) => [number, number, number, number] | undefined
```

#### method: getFeatureInfoById

```ts
type getFeatureInfoById = (featureId: string) =>
  | {
      id: string
      name: string
      start: number
      end: number
      flags: number
      mapq: number
      strand: number
      refName: string
    }
  | undefined
```

#### method: rpcProps

```ts
type rpcProps = () => {
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

```ts
type trackMenuItems = () => (MenuItem | { label: string; type: "subMenu"; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: MenuItem[]; } | { ...; } | { ...; })[]
```

#### method: contextMenuItems

```ts
type contextMenuItems = () => MenuItem[]
```

</details>

<details open>
<summary>LinearAlignmentsDisplay - Actions</summary>

#### action: clearMouseoverState

```ts
type clearMouseoverState = () => void
```

#### action: setError

```ts
type setError = (error?: unknown) => void
```

#### action: setRegionTooLarge

```ts
type setRegionTooLarge = (val: boolean, reason?: string | undefined) => void
```

#### action: setRpcData

```ts
type setRpcData = (
  displayedRegionIndex: number,
  data: GroupedAlignmentsResult | null,
) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: setOverCigarItem

```ts
type setOverCigarItem = (flag: boolean) => void
```

#### action: setScrollTop

```ts
type setScrollTop = (scrollTop: number) => void
```

#### action: setHighlightedChainIds

```ts
type setHighlightedChainIds = (ids: string[]) => void
```

#### action: clearHighlights

```ts
type clearHighlights = () => void
```

#### action: clearSelection

```ts
type clearSelection = () => void
```

#### action: setSelectedChainIds

```ts
type setSelectedChainIds = (ids: string[]) => void
```

#### action: setColorScheme

```ts
type setColorScheme = (colorBy: ColorBy) => void
```

#### action: updateColorTagMap

```ts
type updateColorTagMap = (uniqueTag: string[]) => void
```

#### action: setFilterBy

```ts
type setFilterBy = (filterBy: FilterBy) => void
```

#### action: setShowOutline

```ts
type setShowOutline = (show: boolean | undefined) => void
```

#### action: toggleSoftClipping

```ts
type toggleSoftClipping = () => void
```

#### action: toggleMismatchAlpha

```ts
type toggleMismatchAlpha = () => void
```

#### action: toggleShowLowFreqMismatches

```ts
type toggleShowLowFreqMismatches = () => void
```

#### action: setSortedBy

```ts
type setSortedBy = (type: string, tag?: string | undefined) => void
```

#### action: setSortedByAtPosition

```ts
type setSortedByAtPosition = (
  type: string,
  pos: number,
  refName: string,
) => void
```

#### action: clearSortedBy

```ts
type clearSortedBy = () => void
```

#### action: setGroupBy

Set (or clear, when undefined) the in-track stacked grouping dimension. A tier-1
refetch setting (in `rpcProps`) — the worker re-partitions the fetch into N
sections. Resets the Y scroll since the stacked content height changes.

```ts
type setGroupBy = (groupBy?: GroupBy | undefined) => void
```

#### action: toggleGroupCollapsed

Collapse/expand a stacked group's pileup (coverage stays visible).

```ts
type toggleGroupCollapsed = (key: string) => void
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

```ts
type resizeGroupHeight = (key: string, dy: number) => void
```

#### action: setScaleType

```ts
type setScaleType = (val: string) => void
```

#### action: setAutoscale

```ts
type setAutoscale = (val?: string | undefined) => void
```

#### action: setMinScore

```ts
type setMinScore = (val?: number | undefined) => void
```

#### action: setMaxScore

```ts
type setMaxScore = (val?: number | undefined) => void
```

#### action: setFeatureHeight

```ts
type setFeatureHeight = (height?: number | undefined) => void
```

#### action: setFeatureSpacing

```ts
type setFeatureSpacing = (spacing?: number | undefined) => void
```

#### action: setMaxHeight

```ts
type setMaxHeight = (height?: number | undefined) => void
```

#### action: setCompactness

```ts
type setCompactness = (level: 'normal' | 'compact' | 'super-compact') => void
```

#### action: setShowSashimiArcs

```ts
type setShowSashimiArcs = (show: boolean) => void
```

#### action: setReadConnections

```ts
type setReadConnections = (mode: ReadConnectionsMode) => void
```

#### action: setReadConnectionsDown

```ts
type setReadConnectionsDown = (down: boolean) => void
```

#### action: setShowCoverage

```ts
type setShowCoverage = (show: boolean) => void
```

#### action: setShowPileup

```ts
type setShowPileup = (show: boolean) => void
```

#### action: setCoverageHeight

```ts
type setCoverageHeight = (height: number) => void
```

#### action: setReadConnectionsHeight

```ts
type setReadConnectionsHeight = (height: number) => void
```

#### action: setSashimiArcsHeight

```ts
type setSashimiArcsHeight = (height: number) => void
```

#### action: setMinSashimiScore

```ts
type setMinSashimiScore = (score: number) => void
```

#### action: setReadConnectionsLineWidth

```ts
type setReadConnectionsLineWidth = (width: number) => void
```

#### action: setDrawInter

```ts
type setDrawInter = (draw: boolean) => void
```

#### action: setDrawLongRange

```ts
type setDrawLongRange = (draw: boolean) => void
```

#### action: setColorByType

```ts
type setColorByType = (type: ArcColorByType) => void
```

#### action: setShowMismatches

```ts
type setShowMismatches = (show: boolean) => void
```

#### action: setShowLegend

```ts
type setShowLegend = (show: boolean | undefined) => void
```

#### action: setDrawSingletons

```ts
type setDrawSingletons = (flag: boolean) => void
```

#### action: setDrawProperPairs

```ts
type setDrawProperPairs = (flag: boolean) => void
```

#### action: setShowInterbaseIndicators

```ts
type setShowInterbaseIndicators = (show: boolean) => void
```

#### action: setFlipStrandLongReadChains

```ts
type setFlipStrandLongReadChains = (flag: boolean) => void
```

#### action: setLinkedReads

```ts
type setLinkedReads = (mode: LinkedReadsMode) => void
```

#### action: setShowBezierConnections

Toggle the paired-read connection overlay. A main-thread tier-2/4 setting (read
in `laidOutPileupMap` + `renderState`), not in `rpcProps` — toggling it never
refetches.

```ts
type setShowBezierConnections = (flag: boolean) => void
```

#### action: updateVisibleModifications

```ts
type updateVisibleModifications = (uniqueModifications: string[]) => void
```

#### action: setModificationsReady

```ts
type setModificationsReady = (flag: boolean) => void
```

#### action: setFeatureIdUnderMouse

```ts
type setFeatureIdUnderMouse = (feature?: string | undefined) => void
```

#### action: setMouseoverExtraInformation

```ts
type setMouseoverExtraInformation = (extra?: TooltipPayload | undefined) => void
```

#### action: setHoverState

```ts
type setHoverState = (state: {
  overCigarItem: boolean
  featureIdUnderMouse: string | undefined
  mouseoverExtraInformation: TooltipPayload | undefined
  hoverCoverageBand?: { topOffset: number; coverageHeight: number } | undefined
}) => void
```

#### action: setContextMenuFeature

```ts
type setContextMenuFeature = (feature?: Feature | undefined) => void
```

#### action: setContextMenuCoord

```ts
type setContextMenuCoord = (coord?: [number, number] | undefined) => void
```

#### action: setContextMenuCigarHit

```ts
type setContextMenuCigarHit = (hit?: CigarHitResult | undefined) => void
```

#### action: setContextMenuIndicatorHit

```ts
type setContextMenuIndicatorHit = (hit?: IndicatorHitResult | undefined) => void
```

#### action: clearContextMenu

```ts
type clearContextMenu = () => void
```

#### action: setContextMenuRefName

```ts
type setContextMenuRefName = (refName?: string | undefined) => void
```

#### action: selectFeature

```ts
type selectFeature = (feature: Feature) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: AlignmentsRenderingBackend) => void
```

#### action: selectFeatureById

```ts
type selectFeatureById = (featureId: string) => Promise<void>
```

#### action: setContextMenuFeatureById

```ts
type setContextMenuFeatureById = (featureId: string) => Promise<void>
```

#### action: getByteEstimateConfig

```ts
type getByteEstimateConfig = () => {
  adapterConfig: any
  fetchSizeLimit: number
  userByteSizeLimit: number | undefined
  visibleBp: number
}
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void>
```

#### action: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

</details>
