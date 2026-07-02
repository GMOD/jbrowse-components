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

### LinearAlignmentsDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearalignmentsdisplay).

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

<details open>
<summary>LinearAlignmentsDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                |
| ------------------------------------------ | ---------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"LinearAlignmentsDisplay">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`              |

</details>

<details>
<summary>LinearAlignmentsDisplay - Properties (all signatures)</summary>

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

</details>

<details open>
<summary>LinearAlignmentsDisplay - Volatiles</summary>

#### volatile: contextMenuRpcData

Block-level worker result under a right-click, so the indicator/coverage
context-menu detail items can open the aggregate widget (mirrors the left-click
path in useAlignmentsBase).

```ts
// type signature
type contextMenuRpcData = PileupDataResult | undefined
// code
contextMenuRpcData: undefined as PileupDataResult | undefined
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

#### volatile: hoverCoverageBand

Screen-px coverage band of the section currently under a coverage/indicator
hover. Drives the tooltip's vertical hover bar so it lands on the hovered
group's coverage band, not always the top one. `undefined` when not hovering
coverage.

```ts
// type signature
type hoverCoverageBand =
  { topOffset: number; coverageHeight: number } | undefined
// code
hoverCoverageBand: undefined as
  { topOffset: number; coverageHeight: number } | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                             | Signature                                          |
| ------------------------------------------------------------------ | -------------------------------------------------- |
| [`featureIdUnderMouse`](#volatile-featureidundermouse)             | `string \| undefined`                              |
| [`mouseoverExtraInformation`](#volatile-mouseoverextrainformation) | `TooltipPayload \| undefined`                      |
| [`contextMenuFeature`](#volatile-contextmenufeature)               | `Feature \| undefined`                             |
| [`contextMenuCoord`](#volatile-contextmenucoord)                   | `[number, number] \| undefined`                    |
| [`contextMenuCigarHit`](#volatile-contextmenucigarhit)             | `CigarHitResult \| undefined`                      |
| [`contextMenuIndicatorHit`](#volatile-contextmenuindicatorhit)     | `IndicatorHitResult \| undefined`                  |
| [`contextMenuRefName`](#volatile-contextmenurefname)               | `string \| undefined`                              |
| [`rpcDataMap`](#volatile-rpcdatamap)                               | `ObservableMap<number, GroupedAlignmentsResult>`   |
| [`highlightedChainIds`](#volatile-highlightedchainids)             | `string[]`                                         |
| [`selectedChainIds`](#volatile-selectedchainids)                   | `string[]`                                         |
| [`colorTagMap`](#volatile-colortagmap)                             | `Record<string, string>`                           |
| [`visibleModifications`](#volatile-visiblemodifications)           | `ObservableMap<string, ModificationTypeWithColor>` |
| [`modificationsReady`](#volatile-modificationsready)               | `false`                                            |
| [`overCigarItem`](#volatile-overcigaritem)                         | `false`                                            |

</details>

<details>
<summary>LinearAlignmentsDisplay - Volatiles (all signatures)</summary>

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

</details>

<details open>
<summary>LinearAlignmentsDisplay - Getters</summary>

#### getter: showLinkedReadLines

Whether to draw the straight-line pass connecting normal read-pairs in pileup
layout. Only meaningful when bezier connections are on AND we are in pileup mode
— chain layout has its own connecting-line pass that already covers normal
pairs.

```ts
type showLinkedReadLines = boolean
```

#### getter: showSashimiLabels

Whether to draw the supporting-read count on each sashimi arc (config slot
`showSashimiLabels`, overridable from the track menu).

```ts
type showSashimiLabels = any
```

#### getter: groupBy

In-track stacked grouping dimension (undefined = ungrouped). Falls back to the
`groupBy` config slot, so a track can be pre-grouped declaratively. Sent to the
worker via rpcProps; the worker partitions one fetch into N sections.

```ts
type groupBy = GroupBy | undefined
```

#### getter: prefersOffset

Offset the track label above the visualization when grouping, so the stacked
group sections aren't hidden behind an overlapping label.

```ts
type prefersOffset = boolean
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

#### getter: belowCoverageBandsInput

Inputs to `belowCoverageBandsGeometry` — the below-coverage band settings plus
whether any sashimi junction is present. Defined here (an earlier .views block
than `belowCoverageBands`) so the fit-budget `laidOutByGroup` and the
`belowCoverageBands` getter share one source.

```ts
type belowCoverageBandsInput = {
  showCoverage: boolean
  coverageHeight: number
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  readConnectionsHeight: number
  showSashimiArcs: boolean
  sashimiArcsMode: SashimiArcsMode
  sashimiArcsHeight: number
  hasSashimiArcs: boolean
}
```

#### getter: laidOutByGroup

Per-group laid-out data: group key → (region index → laid-out data). Each group
lays out independently (own `maxRows` cap) so a dense group can't starve the
rest. When grouped, the default cap fits all sections into the viewport
(`fitGroupMaxRows`) so the stack doesn't tower and need scrolling; a per-group
height drag / expand still overrides it. Tag colors are baked here (not in the
worker) so colorTagMap stays a main-thread tier-2 setting — see readTagColors.

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

True when the ungrouped pileup hit `maxHeight` and overflow reads were collapsed
— drives the "max height reached" / "show all" banner. Only the ungrouped
(single-group) case: grouped sections surface their own truncation per-label
(`isGroupTruncated`), where raising `maxHeight` wouldn't lift the
fit-to-viewport cap anyway — expanding the group does.

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
group's raw data (sashimi counts live per-group) with the content-space tops of
_both_ sub-bands: `coverageOverlayTop` for arcs drawn over the coverage
histogram and `sashimiBandTop` for arcs in the reserved strip below it. In
'auto' both are used at once; 'up'/'down' use one. The overlay and SVG export
both map over this so their geometry can't drift; ungrouped is the
single-section case (sticky band below sticky coverage, raw map == the only
group). Empty when sashimi is off.

```ts
type sashimiSections = {
  groupKey: string
  rpcDataMap: Map<number, PileupDataResult>
  coverageOverlayTop: number
  sashimiBandTop: number
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

#### getter: highlightBoxes

Screen boxes for the hovered read / chain, painted by the `HighlightOverlay`
div. Deliberately NOT part of `renderState`: the hovered id changes on nearly
every mousemove, and routing it through the canvas would repaint the whole
pileup each move.

```ts
type highlightBoxes = HighlightBox[]
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                         | Signature                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`linkedReads`](#getter-linkedreads)                           | `LinkedReadsMode`                                                                                                                                                                                                                                                                                                   |
| [`showBezierConnections`](#getter-showbezierconnections)       | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showCoverage`](#getter-showcoverage)                         | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showPileup`](#getter-showpileup)                             | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`coverageHeight`](#getter-coverageheight)                     | `number`                                                                                                                                                                                                                                                                                                            |
| [`showMismatches`](#getter-showmismatches)                     | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showInterbaseIndicators`](#getter-showinterbaseindicators)   | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`drawSingletons`](#getter-drawsingletons)                     | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`drawProperPairs`](#getter-drawproperpairs)                   | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`flipStrandLongReadChains`](#getter-flipstrandlongreadchains) | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`colorSupplementaryChains`](#getter-colorsupplementarychains) | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`drawInter`](#getter-drawinter)                               | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`drawLongRange`](#getter-drawlongrange)                       | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`arcColorByType`](#getter-arccolorbytype)                     | `ArcColorByType`                                                                                                                                                                                                                                                                                                    |
| [`readConnections`](#getter-readconnections)                   | `ReadConnectionsMode`                                                                                                                                                                                                                                                                                               |
| [`readConnectionsDown`](#getter-readconnectionsdown)           | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showSashimiArcs`](#getter-showsashimiarcs)                   | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`sashimiArcsMode`](#getter-sashimiarcsmode)                   | `SashimiArcsMode`                                                                                                                                                                                                                                                                                                   |
| [`minSashimiScore`](#getter-minsashimiscore)                   | `number`                                                                                                                                                                                                                                                                                                            |
| [`sashimiArcsHeight`](#getter-sashimiarcsheight)               | `number`                                                                                                                                                                                                                                                                                                            |
| [`readConnectionsHeight`](#getter-readconnectionsheight)       | `number`                                                                                                                                                                                                                                                                                                            |
| [`showSoftClipping`](#getter-showsoftclipping)                 | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`isChainMode`](#getter-ischainmode)                           | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`scaleType`](#getter-scaletype)                               | `any`                                                                                                                                                                                                                                                                                                               |
| [`autoscaleType`](#getter-autoscaletype)                       | `any`                                                                                                                                                                                                                                                                                                               |
| [`minScore`](#getter-minscore)                                 | `any`                                                                                                                                                                                                                                                                                                               |
| [`maxScore`](#getter-maxscore)                                 | `any`                                                                                                                                                                                                                                                                                                               |
| [`minScoreBound`](#getter-minscorebound)                       | `any`                                                                                                                                                                                                                                                                                                               |
| [`maxScoreBound`](#getter-maxscorebound)                       | `any`                                                                                                                                                                                                                                                                                                               |
| [`numStdDev`](#getter-numstddev)                               | `any`                                                                                                                                                                                                                                                                                                               |
| [`featureWidgetType`](#getter-featurewidgettype)               | `{ type: string; id: string; }`                                                                                                                                                                                                                                                                                     |
| [`selectedFeatureId`](#getter-selectedfeatureid)               | `string \| undefined`                                                                                                                                                                                                                                                                                               |
| [`TooltipComponent`](#getter-tooltipcomponent)                 | `LazyExoticComponent<({ model, clientMouseCoord, offsetMouseCoord, }: { model: { mouseoverExtraInformation: TooltipPayload \| undefined; hoverCoverageBand: { topOffset: number; coverageHeight: number; } \| undefined; }; offsetMouseCoord?: Coord \| undefined; clientMouseCoord: Coord; }) => Element \| null>` |
| [`visibleModificationTypes`](#getter-visiblemodificationtypes) | `string[]`                                                                                                                                                                                                                                                                                                          |
| [`colorBy`](#getter-colorby)                                   | `ColorBy`                                                                                                                                                                                                                                                                                                           |
| [`filterBy`](#getter-filterby)                                 | `FilterBy`                                                                                                                                                                                                                                                                                                          |
| [`featureHeight`](#getter-featureheight)                       | `any`                                                                                                                                                                                                                                                                                                               |
| [`featureSpacing`](#getter-featurespacing)                     | `any`                                                                                                                                                                                                                                                                                                               |
| [`maxHeight`](#getter-maxheight)                               | `any`                                                                                                                                                                                                                                                                                                               |
| [`chainIdMap`](#getter-chainidmap)                             | `Map<string, string[]>`                                                                                                                                                                                                                                                                                             |
| [`mismatchAlpha`](#getter-mismatchalpha)                       | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showLowFreqMismatches`](#getter-showlowfreqmismatches)       | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showLegend`](#getter-showlegend)                             | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`sortedBy`](#getter-sortedby)                                 | `SortedBy \| undefined`                                                                                                                                                                                                                                                                                             |
| [`coverageIsLog`](#getter-coverageislog)                       | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`coverageStats`](#getter-coveragestats)                       | `ScoreStats \| undefined`                                                                                                                                                                                                                                                                                           |
| [`coverageDomain`](#getter-coveragedomain)                     | `[number, number] \| undefined`                                                                                                                                                                                                                                                                                     |
| [`coverageTicks`](#getter-coverageticks)                       | `YScaleTicks \| undefined`                                                                                                                                                                                                                                                                                          |
| [`colorPalette`](#getter-colorpalette)                         | `ColorPalette`                                                                                                                                                                                                                                                                                                      |
| [`modificationThreshold`](#getter-modificationthreshold)       | `number`                                                                                                                                                                                                                                                                                                            |
| [`colorSchemeIndex`](#getter-colorschemeindex)                 | `number`                                                                                                                                                                                                                                                                                                            |
| [`showModifications`](#getter-showmodifications)               | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showPerBaseQuality`](#getter-showperbasequality)             | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`showPerBaseLetter`](#getter-showperbaseletter)               | `boolean`                                                                                                                                                                                                                                                                                                           |
| [`totalPileupHeight`](#getter-totalpileupheight)               | `number`                                                                                                                                                                                                                                                                                                            |
| [`readIdIndexMap`](#getter-readidindexmap)                     | `Map<string, { displayedRegionIndex: number; groupKey: string; idx: number; }>`                                                                                                                                                                                                                                     |
| [`readConnectionsLineWidth`](#getter-readconnectionslinewidth) | `any`                                                                                                                                                                                                                                                                                                               |
| [`coverageDisplayHeight`](#getter-coveragedisplayheight)       | `number`                                                                                                                                                                                                                                                                                                            |
| [`scalebarOverlapLeft`](#getter-scalebaroverlapleft)           | `number`                                                                                                                                                                                                                                                                                                            |
| [`showOutline`](#getter-showoutline)                           | `any`                                                                                                                                                                                                                                                                                                               |
| [`visibleLabels`](#getter-visiblelabels)                       | `VisibleLabel[]`                                                                                                                                                                                                                                                                                                    |
| [`scrollableHeight`](#getter-scrollableheight)                 | `number`                                                                                                                                                                                                                                                                                                            |
| [`sortTag`](#getter-sorttag)                                   | `string \| undefined`                                                                                                                                                                                                                                                                                               |
| [`renderState`](#getter-renderstate)                           | `{ scrollTop: number; colorScheme: number; featureHeight: any; featureSpacing: any; showCoverage: boolean; coverageHeight: number; coverageYOffset: number; coverageMaxDepth: number \| undefined; ... 25 more ...; arcsYDomainBp: number \| undefined; } \| undefined`                                             |
| [`arcsYDomainBp`](#getter-arcsydomainbp)                       | `number \| undefined`                                                                                                                                                                                                                                                                                               |
| [`insertSizeTicks`](#getter-insertsizeticks)                   | `YScaleTicks \| undefined`                                                                                                                                                                                                                                                                                          |
| [`featureUnderMouse`](#getter-featureundermouse)               | `SimpleFeature \| undefined`                                                                                                                                                                                                                                                                                        |

</details>

<details>
<summary>LinearAlignmentsDisplay - Getters (all signatures)</summary>

#### getter: linkedReads

```ts
type linkedReads = LinkedReadsMode
```

#### getter: showBezierConnections

```ts
type showBezierConnections = boolean
```

#### getter: showCoverage

```ts
type showCoverage = boolean
```

#### getter: showPileup

```ts
type showPileup = boolean
```

#### getter: coverageHeight

```ts
type coverageHeight = number
```

#### getter: showMismatches

```ts
type showMismatches = boolean
```

#### getter: showInterbaseIndicators

```ts
type showInterbaseIndicators = boolean
```

#### getter: drawSingletons

```ts
type drawSingletons = boolean
```

#### getter: drawProperPairs

```ts
type drawProperPairs = boolean
```

#### getter: flipStrandLongReadChains

```ts
type flipStrandLongReadChains = boolean
```

#### getter: colorSupplementaryChains

```ts
type colorSupplementaryChains = boolean
```

#### getter: drawInter

```ts
type drawInter = boolean
```

#### getter: drawLongRange

```ts
type drawLongRange = boolean
```

#### getter: arcColorByType

```ts
type arcColorByType = ArcColorByType
```

#### getter: readConnections

```ts
type readConnections = ReadConnectionsMode
```

#### getter: readConnectionsDown

```ts
type readConnectionsDown = boolean
```

#### getter: showSashimiArcs

```ts
type showSashimiArcs = boolean
```

#### getter: sashimiArcsMode

```ts
type sashimiArcsMode = SashimiArcsMode
```

#### getter: minSashimiScore

```ts
type minSashimiScore = number
```

#### getter: sashimiArcsHeight

```ts
type sashimiArcsHeight = number
```

#### getter: readConnectionsHeight

```ts
type readConnectionsHeight = number
```

#### getter: showSoftClipping

```ts
type showSoftClipping = boolean
```

#### getter: isChainMode

```ts
type isChainMode = boolean
```

#### getter: scaleType

```ts
type scaleType = any
```

#### getter: autoscaleType

```ts
type autoscaleType = any
```

#### getter: minScore

```ts
type minScore = any
```

#### getter: maxScore

```ts
type maxScore = any
```

#### getter: minScoreBound

```ts
type minScoreBound = any
```

#### getter: maxScoreBound

```ts
type maxScoreBound = any
```

#### getter: numStdDev

```ts
type numStdDev = any
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
        { topOffset: number; coverageHeight: number } | undefined
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
type featureHeight = any
```

#### getter: featureSpacing

```ts
type featureSpacing = any
```

#### getter: maxHeight

```ts
type maxHeight = any
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

#### getter: colorPalette

```ts
type colorPalette = ColorPalette
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
type readConnectionsLineWidth = any
```

#### getter: coverageDisplayHeight

```ts
type coverageDisplayHeight = number
```

#### getter: scalebarOverlapLeft

```ts
type scalebarOverlapLeft = number
```

#### getter: showOutline

```ts
type showOutline = any
```

#### getter: visibleLabels

```ts
type visibleLabels = VisibleLabel[]
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
type renderState = { scrollTop: number; colorScheme: number; featureHeight: any; featureSpacing: any; showCoverage: boolean; coverageHeight: number; coverageYOffset: number; coverageMaxDepth: number | undefined; ... 25 more ...; arcsYDomainBp: number | undefined; } | undefined
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

#### method: hasGroupHeightOverride

Whether a stacked group carries a custom pileup-height override — set by
expanding it (show all reads) or dragging its resize handle (taller or shorter).
Drives the group label's restore-to-fit affordance.

```ts
type hasGroupHeightOverride = (key: string) => boolean
```

#### method: groupLaidOutMap

Laid-out region map for one group key, or an empty map for a key with no data.
Centralizes the empty-map fallback shared by the section getters so they never
have to branch on a missing group.

```ts
type groupLaidOutMap = (key: string) => Map<number, PileupDataResult>
```

#### method: isGroupTruncated

True when the row cap clipped reads from a group's pileup and the user hasn't
explicitly sized that group (a height drag/expand makes any truncation
intentional, so it isn't flagged). Drives the per-group "show all" affordance on
the section label.

```ts
type isGroupTruncated = (key: string) => boolean
```

#### method: trackMenuItems

Track menu items

```ts
type trackMenuItems = () => (MenuItem | { label: string; type: "subMenu"; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: MenuItem[]; } | { ...; } | { ...; } | { ...; })[]
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                                                                                                                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`legendItems`](#method-legenditems)                   | `() => LegendItem[]`                                                                                                                                                                                                       |
| [`findFeatureInRpcData`](#method-findfeatureinrpcdata) | `(featureId: string) => { displayedRegionIndex: number; idx: number; rpcData: PileupDataResult; start: number; end: number; } \| undefined`                                                                                |
| [`searchFeatureByID`](#method-searchfeaturebyid)       | `(featureId: string) => [number, number, number, number] \| undefined`                                                                                                                                                     |
| [`getFeatureInfoById`](#method-getfeatureinfobyid)     | `(featureId: string) => { id: string; name: string; start: number; end: number; flags: number; mapq: number; strand: number; refName: string; } \| undefined`                                                              |
| [`rpcProps`](#method-rpcprops)                         | `() => { filterBy: FilterBy; colorBy: ColorBy; sortTag: string \| undefined; groupBy: GroupBy \| undefined; showSoftClipping: boolean; drawSingletons: boolean; drawProperPairs: boolean; linkedReads: LinkedReadsMode; }` |
| [`contextMenuItems`](#method-contextmenuitems)         | `() => MenuItem[]`                                                                                                                                                                                                         |

</details>

<details>
<summary>LinearAlignmentsDisplay - Methods (all signatures)</summary>

#### method: legendItems

```ts
type legendItems = () => LegendItem[]
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

#### method: contextMenuItems

```ts
type contextMenuItems = () => MenuItem[]
```

</details>

<details open>
<summary>LinearAlignmentsDisplay - Actions</summary>

#### action: setGroupBy

Set (or remove, when undefined) the in-track stacked grouping dimension. A
tier-1 refetch setting (in `rpcProps`) — the worker re-partitions the fetch into
N sections. Resets the Y scroll since the stacked content height changes.
Ungrouping stores an explicit `null` override (not a cleared override) so it
beats a configured `groupBy` default rather than falling back to it.

```ts
type setGroupBy = (groupBy?: GroupBy | undefined) => void
```

#### action: toggleGroupCollapsed

Collapse/expand a stacked group's pileup (coverage stays visible).

```ts
type toggleGroupCollapsed = (key: string) => void
```

#### action: toggleGroupExpanded

Expand a fit-to-viewport group back to the full `maxHeight` cap (show all its
reads), or, if it already carries a height override (from expand or a drag),
drop the override to return it to the fit budget. Expanding makes the stack
overflow the viewport, which engages the pileup scroll. Pairs with
`hasGroupHeightOverride`.

```ts
type toggleGroupExpanded = (key: string) => void
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

#### action: setShowBezierConnections

Toggle the paired-read connection overlay. A main-thread tier-2/4 setting (read
in `laidOutPileupMap` + `renderState`), not in `rpcProps` — toggling it never
refetches.

```ts
type setShowBezierConnections = (flag: boolean) => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                 | Signature                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`clearMouseoverState`](#action-clearmouseoverstate)                   | `() => void`                                                                                                                                                                                                                      |
| [`setError`](#action-seterror)                                         | `(error?: unknown) => void`                                                                                                                                                                                                       |
| [`setRegionTooLarge`](#action-setregiontoolarge)                       | `(val: boolean, reason?: string \| undefined) => void`                                                                                                                                                                            |
| [`setRpcData`](#action-setrpcdata)                                     | `(displayedRegionIndex: number, data: GroupedAlignmentsResult \| null) => void`                                                                                                                                                   |
| [`clearDisplaySpecificData`](#action-cleardisplayspecificdata)         | `() => void`                                                                                                                                                                                                                      |
| [`setOverCigarItem`](#action-setovercigaritem)                         | `(flag: boolean) => void`                                                                                                                                                                                                         |
| [`setScrollTop`](#action-setscrolltop)                                 | `(scrollTop: number) => void`                                                                                                                                                                                                     |
| [`setHighlightedChainIds`](#action-sethighlightedchainids)             | `(ids: string[]) => void`                                                                                                                                                                                                         |
| [`clearHighlights`](#action-clearhighlights)                           | `() => void`                                                                                                                                                                                                                      |
| [`clearSelection`](#action-clearselection)                             | `() => void`                                                                                                                                                                                                                      |
| [`setSelectedChainIds`](#action-setselectedchainids)                   | `(ids: string[]) => void`                                                                                                                                                                                                         |
| [`setColorScheme`](#action-setcolorscheme)                             | `(colorBy: ColorBy) => void`                                                                                                                                                                                                      |
| [`updateColorTagMap`](#action-updatecolortagmap)                       | `(uniqueTag: string[]) => void`                                                                                                                                                                                                   |
| [`setFilterBy`](#action-setfilterby)                                   | `(filterBy: FilterBy) => void`                                                                                                                                                                                                    |
| [`setShowOutline`](#action-setshowoutline)                             | `(show: boolean \| undefined) => void`                                                                                                                                                                                            |
| [`toggleSoftClipping`](#action-togglesoftclipping)                     | `() => void`                                                                                                                                                                                                                      |
| [`toggleMismatchAlpha`](#action-togglemismatchalpha)                   | `() => void`                                                                                                                                                                                                                      |
| [`toggleShowLowFreqMismatches`](#action-toggleshowlowfreqmismatches)   | `() => void`                                                                                                                                                                                                                      |
| [`setSortedBy`](#action-setsortedby)                                   | `(type: string, tag?: string \| undefined) => void`                                                                                                                                                                               |
| [`setSortedByAtPosition`](#action-setsortedbyatposition)               | `(type: string, pos: number, refName: string) => void`                                                                                                                                                                            |
| [`clearSortedBy`](#action-clearsortedby)                               | `() => void`                                                                                                                                                                                                                      |
| [`setScaleType`](#action-setscaletype)                                 | `(val: string) => void`                                                                                                                                                                                                           |
| [`setAutoscale`](#action-setautoscale)                                 | `(val?: string \| undefined) => void`                                                                                                                                                                                             |
| [`setMinScore`](#action-setminscore)                                   | `(val?: number \| undefined) => void`                                                                                                                                                                                             |
| [`setMaxScore`](#action-setmaxscore)                                   | `(val?: number \| undefined) => void`                                                                                                                                                                                             |
| [`setFeatureHeight`](#action-setfeatureheight)                         | `(height?: number \| undefined) => void`                                                                                                                                                                                          |
| [`setFeatureSpacing`](#action-setfeaturespacing)                       | `(spacing?: number \| undefined) => void`                                                                                                                                                                                         |
| [`setMaxHeight`](#action-setmaxheight)                                 | `(height?: number \| undefined) => void`                                                                                                                                                                                          |
| [`setCompactness`](#action-setcompactness)                             | `(level: "normal" \| "compact" \| "super-compact") => void`                                                                                                                                                                       |
| [`setShowSashimiArcs`](#action-setshowsashimiarcs)                     | `(show: boolean) => void`                                                                                                                                                                                                         |
| [`setReadConnections`](#action-setreadconnections)                     | `(mode: ReadConnectionsMode) => void`                                                                                                                                                                                             |
| [`setReadConnectionsDown`](#action-setreadconnectionsdown)             | `(down: boolean) => void`                                                                                                                                                                                                         |
| [`setShowCoverage`](#action-setshowcoverage)                           | `(show: boolean) => void`                                                                                                                                                                                                         |
| [`setShowPileup`](#action-setshowpileup)                               | `(show: boolean) => void`                                                                                                                                                                                                         |
| [`setCoverageHeight`](#action-setcoverageheight)                       | `(height: number) => void`                                                                                                                                                                                                        |
| [`setReadConnectionsHeight`](#action-setreadconnectionsheight)         | `(height: number) => void`                                                                                                                                                                                                        |
| [`setSashimiArcsHeight`](#action-setsashimiarcsheight)                 | `(height: number) => void`                                                                                                                                                                                                        |
| [`setMinSashimiScore`](#action-setminsashimiscore)                     | `(score: number) => void`                                                                                                                                                                                                         |
| [`setSashimiArcsMode`](#action-setsashimiarcsmode)                     | `(mode: SashimiArcsMode) => void`                                                                                                                                                                                                 |
| [`setShowSashimiLabels`](#action-setshowsashimilabels)                 | `(show: boolean) => void`                                                                                                                                                                                                         |
| [`setReadConnectionsLineWidth`](#action-setreadconnectionslinewidth)   | `(width: number) => void`                                                                                                                                                                                                         |
| [`setDrawInter`](#action-setdrawinter)                                 | `(draw: boolean) => void`                                                                                                                                                                                                         |
| [`setDrawLongRange`](#action-setdrawlongrange)                         | `(draw: boolean) => void`                                                                                                                                                                                                         |
| [`setColorByType`](#action-setcolorbytype)                             | `(type: ArcColorByType) => void`                                                                                                                                                                                                  |
| [`setShowMismatches`](#action-setshowmismatches)                       | `(show: boolean) => void`                                                                                                                                                                                                         |
| [`setShowLegend`](#action-setshowlegend)                               | `(show: boolean \| undefined) => void`                                                                                                                                                                                            |
| [`setDrawSingletons`](#action-setdrawsingletons)                       | `(flag: boolean) => void`                                                                                                                                                                                                         |
| [`setDrawProperPairs`](#action-setdrawproperpairs)                     | `(flag: boolean) => void`                                                                                                                                                                                                         |
| [`setShowInterbaseIndicators`](#action-setshowinterbaseindicators)     | `(show: boolean) => void`                                                                                                                                                                                                         |
| [`setFlipStrandLongReadChains`](#action-setflipstrandlongreadchains)   | `(flag: boolean) => void`                                                                                                                                                                                                         |
| [`setColorSupplementaryChains`](#action-setcolorsupplementarychains)   | `(flag: boolean) => void`                                                                                                                                                                                                         |
| [`setLinkedReads`](#action-setlinkedreads)                             | `(mode: LinkedReadsMode) => void`                                                                                                                                                                                                 |
| [`updateVisibleModifications`](#action-updatevisiblemodifications)     | `(uniqueModifications: string[]) => void`                                                                                                                                                                                         |
| [`setModificationsReady`](#action-setmodificationsready)               | `(flag: boolean) => void`                                                                                                                                                                                                         |
| [`setFeatureIdUnderMouse`](#action-setfeatureidundermouse)             | `(feature?: string \| undefined) => void`                                                                                                                                                                                         |
| [`setMouseoverExtraInformation`](#action-setmouseoverextrainformation) | `(extra?: TooltipPayload \| undefined) => void`                                                                                                                                                                                   |
| [`setHoverState`](#action-sethoverstate)                               | `(state: { overCigarItem: boolean; featureIdUnderMouse: string \| undefined; mouseoverExtraInformation: TooltipPayload \| undefined; hoverCoverageBand?: { topOffset: number; coverageHeight: number; } \| undefined; }) => void` |
| [`setContextMenuFeature`](#action-setcontextmenufeature)               | `(feature?: Feature \| undefined) => void`                                                                                                                                                                                        |
| [`setContextMenuCoord`](#action-setcontextmenucoord)                   | `(coord?: [number, number] \| undefined) => void`                                                                                                                                                                                 |
| [`setContextMenuCigarHit`](#action-setcontextmenucigarhit)             | `(hit?: CigarHitResult \| undefined) => void`                                                                                                                                                                                     |
| [`setContextMenuIndicatorHit`](#action-setcontextmenuindicatorhit)     | `(hit?: IndicatorHitResult \| undefined) => void`                                                                                                                                                                                 |
| [`clearContextMenu`](#action-clearcontextmenu)                         | `() => void`                                                                                                                                                                                                                      |
| [`setContextMenuRefName`](#action-setcontextmenurefname)               | `(refName?: string \| undefined) => void`                                                                                                                                                                                         |
| [`setContextMenuRpcData`](#action-setcontextmenurpcdata)               | `(data?: PileupDataResult \| undefined) => void`                                                                                                                                                                                  |
| [`selectFeature`](#action-selectfeature)                               | `(feature: Feature) => void`                                                                                                                                                                                                      |
| [`startRenderingBackend`](#action-startrenderingbackend)               | `(backend: AlignmentsRenderingBackend) => void`                                                                                                                                                                                   |
| [`selectFeatureById`](#action-selectfeaturebyid)                       | `(featureId: string) => Promise<void>`                                                                                                                                                                                            |
| [`setContextMenuFeatureById`](#action-setcontextmenufeaturebyid)       | `(featureId: string) => Promise<void>`                                                                                                                                                                                            |
| [`getByteEstimateConfig`](#action-getbyteestimateconfig)               | `() => { adapterConfig: any; fetchSizeLimit: any; userByteSizeLimit: number \| undefined; visibleBp: number; }`                                                                                                                   |
| [`fetchNeeded`](#action-fetchneeded)                                   | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>`                                                                                                                                                  |
| [`renderSvg`](#action-rendersvg)                                       | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>`                                                                      |

</details>

<details>
<summary>LinearAlignmentsDisplay - Actions (all signatures)</summary>

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

#### action: setSashimiArcsMode

```ts
type setSashimiArcsMode = (mode: SashimiArcsMode) => void
```

#### action: setShowSashimiLabels

```ts
type setShowSashimiLabels = (show: boolean) => void
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

#### action: setColorSupplementaryChains

```ts
type setColorSupplementaryChains = (flag: boolean) => void
```

#### action: setLinkedReads

```ts
type setLinkedReads = (mode: LinkedReadsMode) => void
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

#### action: setContextMenuRpcData

```ts
type setContextMenuRpcData = (data?: PileupDataResult | undefined) => void
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
  fetchSizeLimit: any
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
