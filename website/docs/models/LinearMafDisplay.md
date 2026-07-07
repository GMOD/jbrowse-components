---
id: linearmafdisplay
title: LinearMafDisplay
sidebar_label: Display -> LinearMafDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/stateModel.ts).

## Example usage

A complete `MafTrack` config to paste into `tracks`. `samples` lists the aligned
species in track order; `rowHeight` sets the per-sample band height in px (or
`0` to stretch rows to fill the track height):

```js
{
  type: 'MafTrack',
  trackId: 'multiz',
  name: 'Multiz alignment',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigMafAdapter',
    bigBedLocation: { uri: 'https://example.com/multiz.bb' },
    samples: ['hg38', 'panTro4', 'mm10'],
  },
  displays: [
    {
      type: 'LinearMafDisplay',
      displayId: 'multiz-LinearMafDisplay',
      rowHeight: 16,
      showCoverage: true,
    },
  ],
}
```

## Overview

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
[regionStatuses](../fetchmixin#volatile-regionstatuses)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[resetStatus](../fetchmixin#action-resetstatus),
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

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
<summary>LinearMafDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearMafDisplay'>
// code
type: types.literal('LinearMafDisplay')
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
<summary>LinearMafDisplay - Volatiles</summary>

#### volatile: summaryDataMap

Per-region `bigMafSummary` rows for the zoom-out path, populated by
`fetchMafSummaryData` only while `showSummary` is active. Kept separate from
`rpcDataMap` so the GPU sequence canvas and the summary overlay never read each
other's data.

```ts
// type signature
type summaryDataMap = ObservableMap<number, MafSummaryRecord[]>
// code
summaryDataMap: observable.map<number, MafSummaryRecord[]>()
```

#### volatile: framesDataMap

Per-region CDS frame rows (UCSC `mafFrames`) for the annotation overlay,
populated by the frames RPC in parallel with the main fetch. Kept separate from
the alignment/summary maps so the overlay survives the summary↔detail data swap.

```ts
// type signature
type framesDataMap = ObservableMap<number, MafFrameRecord[]>
// code
framesDataMap: observable.map<number, MafFrameRecord[]>()
```

#### volatile: sourcesVolatile

The worker's authoritative row set, in tree (leaf) order. `layout` overlays any
user reorder/relabel on top; `editableSources` merges the two and `sources`
narrows that by the subtree filter.

```ts
// type signature
type sourcesVolatile = MafSource[]
// code
sourcesVolatile: [] as MafSource[]
```

#### volatile: treeNewickVolatile

The worker's guide-tree Newick (the default, before any reorder). The active
displayed tree lives in the mixin's `clusterTree`, which a reorder clears (rows
no longer match the dendrogram) and "Clear arrangement" restores from here — so
we keep the worker tree separately rather than re-fetching it.

```ts
// type signature
type treeNewickVolatile = string | undefined
// code
treeNewickVolatile: undefined as string | undefined
```

#### volatile: resizing

True during an active height drag. Gates the dense per-base letter overlay (a
Canvas2D pass that re-scans every visible cell and redraws thousands of glyphs
each frame) so the drag only restretches the cheap GPU cell canvas; letters snap
back when the drag settles.

```ts
// type signature
type resizing = false
// code
resizing: false
```

</details>

<details>
<summary>LinearMafDisplay - Volatiles (other undocumented members)</summary>

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, MafRegionData>
// code
rpcDataMap: observable.map<number, MafRegionData>()
```

#### volatile: prefersOffset

```ts
// type signature
type prefersOffset = true
// code
prefersOffset: true
```

#### volatile: resizeSettleTimer

```ts
// type signature
type resizeSettleTimer = Timeout | undefined
// code
resizeSettleTimer: undefined as ReturnType<typeof setTimeout> | undefined
```

</details>

<details open>
<summary>LinearMafDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so direct reads route through this to stay typed
(same move as `BaseAdapter<CONF>`)

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: lgv

The containing LGV, typed once here so views/actions don't each repeat the
`getContainingView(self) as LinearGenomeViewModel` cast.

```ts
type lgv = ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>
```

#### getter: annotationAdapterConfig

The configured CDS-frame annotation adapter snapshot (UCSC `mafFrames`), or
undefined when unset. Read from the MAF _adapter_ config as a swappable
sub-adapter (alongside `summaryAdapter`), not the display — a frozen slot, so
this is a plain snapshot the frames RPC hands straight to `getAdapter`.

```ts
type annotationAdapterConfig = Record<string, unknown> | undefined
```

#### getter: annotationsActive

Whether the per-species CDS frame _strip_ should draw: an annotation adapter is
configured and the "Show CDS frames" toggle is on. The codon view consumes the
same frames data but is gated separately (see `annotationDataActive`), so the
strip can be off while codon view is on.

```ts
type annotationsActive = boolean
```

#### getter: annotationDataActive

Whether the frames data needs to be fetched: an annotation adapter is configured
and either the strip or the codon view wants it. Gates the frames RPC and keys
the fetch cache so toggling _either_ consumer on triggers the fetch.

```ts
type annotationDataActive = boolean
```

#### getter: editableSources

The full row set with the user's arrangement applied: `layout` supplies order +
label/color overrides, merged over the worker's `sourcesVolatile` by name. Empty
`layout` (no customization) passes the worker set through. Not subtree-filtered
— this is what the arrangement dialog edits. Undefined until the first fetch
populates the worker set.

```ts
type editableSources = MafSource[] | undefined
```

#### getter: sources

The display rows: `editableSources` narrowed to the selected subtree.

```ts
type sources = MafSource[] | undefined
```

#### getter: samples

Sample list keyed by sample id (alias of `sources` mapped to the project's
canonical `{ id, label, color }` shape). Consumed by MafSequenceWidget, color
legend, etc.

```ts
type samples = Sample[] | undefined
```

#### getter: orderedSampleIds

Display row order shipped to the worker so its block `rowIndex` matches the
on-screen row. Single source for both `rpcProps` (cache-invalidation key) and
the alignment-fetch RPC arg so the two can't drift.

```ts
type orderedSampleIds = string[] | undefined
```

#### getter: rowIndexBySrc

Maps a `src` (species) to its display row index. The single source for the
`src`→row projection used by the summary-bar and CDS-frame overlays and the
frame hover lookup, so they can't disagree on row placement.

```ts
type rowIndexBySrc = Map<string, number>
```

#### getter: defaultCodonSpecies

The anchor species whose `mafFrames` reading frame is used to translate every
row (UCSC `codonDefault`). Tied to the _reference assembly_, not the top display
row: every species' codon is compared against the reference sequence
(`block.refSeqBytes`), so the frame must be enumerated from the reference's own
frames. A row reorder (layout) can move a non-reference species to row 0 —
reading `sources[0]` there would enumerate codons in the wrong frame. Falls back
to the worker's canonical first row (pre-reorder) when the reference isn't
itself a listed sample.

```ts
type defaultCodonSpecies = string | undefined
```

#### getter: coverageDisplayHeight

Height of the coverage band above the rows (0 when hidden).

```ts
type coverageDisplayHeight = number
```

#### getter: conservationDisplayHeight

Height of the conservation (percent identity) band (0 when hidden).

```ts
type conservationDisplayHeight = number
```

#### getter: rowsTopOffset

Top offset of the per-sample rows area = the stacked band heights above it
(coverage + conservation). The single source of truth for "where the rows start"
— every rows hit-test / draw / export offset routes through this so adding a
band can't desync them.

```ts
type rowsTopOffset = number
```

#### getter: nrow

Number of displayed rows (at least 1, so the fit-mode division is safe).

```ts
type nrow = number
```

#### getter: maxRowsHeight

Max CSS-px height the rows canvas may take before its backing store (`× dpr`)
hits the browser/GPU canvas limit. The single ceiling both the fit-target sizing
and the `rowHeight` cap respect.

```ts
type maxRowsHeight = number
```

#### getter: fitTargetHeight

The track height that fit-to-height mode divides among rows. Once the user
drags, the explicit `height` config slot wins; before any drag we size to show
every row at the default px height, so a typical alignment looks exactly like
fixed mode. Huge alignments are bounded by the `rowHeight` cap, not here, so
this needs no cap of its own.

```ts
type fitTargetHeight = number
```

#### getter: autoRowHeight

Per-row height in fit-to-height mode: the rows area (track height minus the
fixed bands) split evenly across rows.

```ts
type autoRowHeight = number
```

#### getter: effectiveRowHeight

Resolved per-row height. `rowHeight === 0` is fit-to-height (rows stretch to the
dragged track height); any positive value is a pinned px height. Every consumer
reads this getter, never the raw `rowHeight` property.

Capped so the rows canvas backing store (`rowsHeight × dpr`) can never exceed
the browser/GPU max canvas size: a fixed px height across hundreds of species
would otherwise throw `Canvas exceeds max size`. The cap shrinks rows to fit
instead of crashing (or clipping); fit mode already stays small so it never
engages there. Bands have their own small canvases, so the rows-only ceiling is
the whole limit.

```ts
type effectiveRowHeight = number
```

#### getter: rowsHeight

Height of the per-sample rows area (excludes the coverage band). Zero when
alignments are hidden, collapsing the display to the coverage band.

```ts
type rowsHeight = number
```

#### getter: totalHeight

Full display height = rows area + stacked bands.

```ts
type totalHeight = number
```

#### getter: height

Override BaseLinearDisplay.height so the track container matches the rendering
canvas height exactly (coverage band + rows × rowHeight).

```ts
type height = number
```

#### getter: hierarchy

Positioned tree hierarchy. Coordinates are computed against
`(rowsHeight, treeAreaWidth)` so leaf rows align with row tops; the coverage
band is offset separately by the React layer.

```ts
type hierarchy = PositionedHierarchyNode<NewickNode> | undefined
```

#### getter: colorPalette

Theme-derived color palette (per-base colors + match/gap/mismatch/
unknown/insertion), read by `gpuProps()` and `renderState`. Derived from the
session theme so it's always available — including headless SVG export and RPC,
where no component mounts to seed it. Theme changes trigger a main-thread
re-encode but never an RPC refetch.

```ts
type colorPalette = MafColorPalette
```

#### getter: renderState

Render state passed to GPU/Canvas2D backend each frame. Uses the rows- only
height so the GPU canvas only paints the per-sample band; the coverage band is
drawn on a separate Canvas2D overlay above.

```ts
type renderState = MafGPURenderState | undefined
```

#### getter: coverageStats

Per-position depth stats across the currently visible content blocks, derived
from the worker-shipped `coverage.coverageDepths` arrays (which already reflect
the active subtree — see `rpcProps`). Feeds `coverageDomain` → `coverageTicks`.

```ts
type coverageStats = ScoreStats | undefined
```

#### getter: coverageDomain

[min, max] coverage domain for the visible blocks. Linear scale only for MAF —
sample counts are already bounded and well-distributed.

```ts
type coverageDomain = [number, number] | undefined
```

#### getter: coverageTicks

Y-axis tick marks for the coverage band.

```ts
type coverageTicks = YScaleTicks | undefined
```

#### getter: visibleEmptyLines

Positioned bridge-line segments for `e`-line (empty/bridged) rows.

```ts
type visibleEmptyLines = EmptyLineSegment[]
```

#### getter: visibleInsertions

Positioned insertion markers (interbase) for the visible aligned rows.

```ts
type visibleInsertions = InsertionMarker[]
```

#### getter: visibleDeletions

Positioned deletion runs for the visible aligned rows; the overlay draws the
deleted-base count inside each run when it fits.

```ts
type visibleDeletions = DeletionMarker[]
```

#### getter: visibleInversions

Positioned strand-flip (inversion) markers for the visible aligned rows. Empty
unless the indicator is toggled on.

```ts
type visibleInversions = InversionMarker[]
```

#### getter: showSummary

Use the cheap summary path when a `bigMafSummary` sub-adapter is configured and
the view is zoomed out past the force-load threshold — exactly where the full
alignment fetch would be blocked by the byte gate. Tracks without a summary
never enter this path.

```ts
type showSummary = boolean
```

#### getter: zoomedToBaseLevel

At base level each reference base spans at least a pixel, so individual bases /
SNP marks are legible (UCSC's `zoomedToBaseLevel`). Read off the debounced
`coarseBpPerPx` so the rendering swap it gates doesn't thrash mid-zoom. False
until the view is initialized.

```ts
type zoomedToBaseLevel = boolean
```

#### getter: codonViewActive

The codon view is on: the toggle is set, frame data is available to define the
reading frame, and we're zoomed to base level (so codons are meaningful) and not
in the cheap summary path. When active it replaces the per-base SNP rendering
with per-codon change coloring.

```ts
type codonViewActive = boolean
```

#### getter: activeRowRendering

Single source of truth for what the per-sample rows area draws right now:
`bases` (the GPU SNP/base coloring), `codon` (per-codon change coloring from
`mafFrames`), `sourceChrom` (color-by-source-chromosome SV mode), or a per-row
identity style (`heatmap` / `xyplot`). Codon view takes precedence when on, then
color-by-chromosome (an explicit SV toggle, but not in the cheap summary path
which carries no per-row chr); otherwise, with `rowIdentityAutoZoom` (default)
it emulates UCSC `wigMaf` — bases at base level, the identity plot when zoomed
out; with auto off the selected mode is pinned. The GPU canvas, the
identity/chromosome canvases, the codon overlay, and SVG export all branch on
this one getter so they can't disagree about what's on screen.

```ts
type activeRowRendering = 'codon' | 'bases' | 'sourceChrom' | RowIdentityMode
```

#### getter: visibleLabels

Positioned per-base SNP/sequence letters. Suppressed in any non-base rendering
(the identity plot and codon view both replace the letters).

```ts
type visibleLabels = VisibleLabel[]
```

#### getter: visibleSummaryBars

Positioned per-species presence bars for the zoom-out summary overlay. Empty
unless `showSummary` is active. Unmatched `src` rows drop via the `sources`
index, keeping the render robust to summary files that list extra species.

```ts
type visibleSummaryBars = SummaryBar[]
```

#### getter: visibleFrames

Positioned per-species CDS frame boxes for the annotation overlay. Empty unless
an annotation adapter is configured and the overlay is on. Reuses the `src`→row
mapping the summary bars established, so frame rows for species the track
doesn't list drop out.

```ts
type visibleFrames = FrameMarker[]
```

#### getter: visibleCodons

Per-species codon cells for the codon view (the per-codon change coloring that
replaces the SNP cells). Empty unless codon view is the active rendering and an
anchor species is known.

```ts
type visibleCodons = CodonMarker[]
```

#### getter: visibleCodonConservation

Per-codon amino-acid conservation bars for the conservation band's codon mode.
Empty unless the band is on in `codon` mode, an anchor species is known, and
we're not in the cheap summary path (which ships no per-base blocks to
translate). Draws only inside the CDS (where frames define codons); everywhere
else the band is blank.

```ts
type visibleCodonConservation = CodonConservationBar[]
```

#### getter: sourceChromLegend

Rank-based legend for the color-by-source-chromosome mode: one entry per
source-chromosome rank actually present across the visible rows (rank 0 = each
species' main chromosome, higher ranks = the minority chromosomes a row switches
to at a rearrangement). Because coloring is by per-row rank rather than
chromosome name (see `perRowChromRanks`), the legend is this short fixed scheme,
not a per-scaffold rainbow. Empty unless the mode is active; a single "Main
chromosome" entry means nothing rearranges in view.

```ts
type sourceChromLegend = { label: string; color: string }[]
```

#### getter: msaHighlights

Get highlight regions from connected MSA views

```ts
type msaHighlights = MsaHighlight[]
```

</details>

<details>
<summary>LinearMafDisplay - Getters (other undocumented members)</summary>

#### getter: rowHeight

```ts
type rowHeight = number
```

#### getter: rowProportion

```ts
type rowProportion = number
```

#### getter: showAllLetters

```ts
type showAllLetters = boolean
```

#### getter: mismatchRendering

```ts
type mismatchRendering = boolean
```

#### getter: showAsUpperCase

```ts
type showAsUpperCase = boolean
```

#### getter: showTree

```ts
type showTree = boolean
```

#### getter: showBranchLength

```ts
type showBranchLength = boolean
```

#### getter: showCoverage

```ts
type showCoverage = boolean
```

#### getter: showAlignments

```ts
type showAlignments = boolean
```

#### getter: coverageHeight

```ts
type coverageHeight = number
```

#### getter: showConservation

```ts
type showConservation = boolean
```

#### getter: conservationHeight

```ts
type conservationHeight = number
```

#### getter: conservationMode

```ts
type conservationMode = 'base' | 'codon'
```

#### getter: rowIdentityMode

```ts
type rowIdentityMode = 'none' | 'xyplot' | 'heatmap'
```

#### getter: rowIdentityAutoZoom

```ts
type rowIdentityAutoZoom = boolean
```

#### getter: showAnnotations

```ts
type showAnnotations = boolean
```

#### getter: showTranslation

```ts
type showTranslation = boolean
```

#### getter: colorByChromosome

```ts
type colorByChromosome = boolean
```

#### getter: showInversions

```ts
type showInversions = boolean
```

#### getter: spatialIndex

```ts
type spatialIndex =
  { index: Flatbush; nodes: ClusterHierarchyNode[] } | undefined
```

</details>

<details open>
<summary>LinearMafDisplay - Methods</summary>

#### method: gpuProps

Inputs to the main-thread GPU instance encoder. Changes here re-encode in the
per-region encode autorun — no RPC roundtrip. Intentionally excludes
`showAsUpperCase` (label-only) and view-shape props (rowHeight, rowProportion —
driven by shader uniforms).

```ts
type gpuProps = () => MafGpuProps
```

#### method: rpcProps

Worker-fetch inputs that invalidate cached data when changed (tier-1, via
MultiRegionDisplayMixin's `SettingsInvalidate` autorun → refetch).
`orderedSampleIds` is the display row order (layout reorder + subtree filter);
the worker emits block rows in it so `rowIndex` is the on-screen row. Loop-safe
despite deriving from worker output: `sources` is set-stable (`sourcesVolatile`
deepEqual-guarded in `setSamples`, `layout`/`subtreeFilter` user-driven), so it
doesn't churn per fetch.

```ts
type rpcProps = () => {
  orderedSampleIds: string[] | undefined
  annotationDataActive: boolean
}
```

#### method: rowHoverInfo

Resolve a hover hit on `rowIndex` at absolute genomic `bp` (uint32, per
worker-output convention): an aligned base (`cell`) or a bridged/empty region
(`empty`), each tagged with the sample label. Returns undefined when no fetched
block covers the bp, the row is out of range, or the cell is a gap.

```ts
type rowHoverInfo = (displayedRegionIndex: number, gposFrac: number, rowIndex: number, bpPerPx: number) => { sampleLabel: string; kind: "cell"; base: string; chr?: string | undefined; pos?: number | undefined; strand?: number | undefined; context?: AlignmentContext | undefined; } | { ...; } | { ...; } | { ...; } | undefined
```

#### method: frameHoverInfo

The CDS frame record covering absolute genomic `bp` (uint32) on display
`rowIndex`, or undefined when no frame overlaps there (or no frames data is
loaded). Gated on `annotationDataActive` not the strip toggle, so the gene name
still reads on hover in codon view with the strip off. The species is matched by
the same `src`→row projection the overlay draws with, so the tooltip and the
strip can't disagree about which row a gene is on.

```ts
type frameHoverInfo = (
  displayedRegionIndex: number,
  bp: number,
  rowIndex: number,
) => { name: string } | undefined
```

#### method: coverageTooltipBin

Build a per-position coverage tooltip bin (depth + SNP base counts) for the
given absolute genomic bp + region index. Delegates the math to
alignments-core's `buildCoverageTooltipBin` — same code path the alignments
display uses. Insertions are reported separately via `coverageInsertionHit`, so
they never mix into the depth/SNP table. Returns undefined when the region has
no fetched data or depth is zero.

```ts
type coverageTooltipBin = (displayedRegionIndex: number, position: number, bpPerPx: number) => { identity: number; position: number; depth: number; fwdDepth?: number | undefined; revDepth?: number | undefined; ... 4 more ...; modifications?: Record<...> | undefined; } | undefined
```

#### method: coverageInsertionHit

Hit-test an insertion bar in the coverage band at fractional genomic `gposFrac`.
Returns the interbase summary (count + length range + interbaseDepth) when the
cursor is on the bar, else undefined — drives the dedicated interbase tooltip,
kept separate from the depth/SNP one.

```ts
type coverageInsertionHit = (
  displayedRegionIndex: number,
  gposFrac: number,
  bpPerPx: number,
) => CoverageInsertionHit | undefined
```

#### method: codonHoverInfo

The codon under the cursor on display `rowIndex` at absolute genomic `bp`, when
the codon view is the active rendering: the species' codon + amino acid, the
reference codon + amino acid, and the syn/nonsyn/stop classification. Reuses the
same anchor frames + reference comparison the colored cells are drawn from
(`findCodonAt`), so the tooltip and the cell agree. Undefined off codon view or
where no codon covers the row there.

```ts
type codonHoverInfo = (
  displayedRegionIndex: number,
  bp: number,
  rowIndex: number,
) => CodonHit | undefined
```

</details>

<details>
<summary>LinearMafDisplay - Methods (other undocumented members)</summary>

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

</details>

<details open>
<summary>LinearMafDisplay - Actions</summary>

#### action: setSamples

Receive worker-authoritative `samples` + serialized Newick tree. Samples + tree
are config-derived and identical on every region fetch, so the deepEqual guard
makes this fire once and skips the redundant frozen-array reassignment (and
downstream `sources`/instance-buffer recompute) on later scroll/zoom. The active
`clusterTree` is set from the worker tree only when there's no custom
arrangement — a reorder has cleared it and must keep it cleared until the user
clears the layout.

```ts
type setSamples = ({
  samples,
  treeNewick,
}: {
  samples: Sample[]
  treeNewick: string | undefined
}) => void
```

#### action: clearLayout

Drop the custom arrangement and restore the worker's guide tree (the base
`clearLayout` only clears it — the worker tree lives in `treeNewickVolatile`).

```ts
type clearLayout = () => void
```

#### action: setFitToHeight

Switch to fit-to-height mode: rows stretch to fill the track height. Seeds the
`height` config slot from the current content height so toggling on doesn't
jump, then `rowHeight = 0` makes `effectiveRowHeight` derive from it.

```ts
type setFitToHeight = () => void
```

#### action: resizeHeight

Drag-resize. In fit mode the new height drives `autoRowHeight` (rows stretch).
In fixed mode the pinned `rowHeight` scales proportionally so dragging still
resizes rows. Mirrors the variants display.

Flips `resizing` for the duration of the drag (cleared a beat after the last
tick) so the dense letter overlay sits out the frame-by-frame restretch — see
the `resizing` volatile.

```ts
type resizeHeight = (distance: number) => number
```

#### action: isCacheValid

Force a refetch when the loaded data is the wrong kind for the current zoom:
crossing the summary↔detail threshold within an already-loaded region wouldn't
trip the bounds-based coverage check, so the mode is keyed on which map holds
the region.

```ts
type isCacheValid = (displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

Enable byte-estimate gating: above ~20kb visible, the adapter's MAF-aware byte
estimate (per-species sequence × span) is checked against `fetchSizeLimit`,
blocking the detail fetch with a force-load prompt rather than downloading
hundreds of species' bases at genome scale.

Returns null in summary mode — the summary read is cheap (zoom-reduced BigBed),
so it must never be blocked by the gate.

```ts
type getByteEstimateConfig = () => {
  adapterConfig: any
  fetchSizeLimit: number
  userByteSizeLimit: number | undefined
  visibleBp: number
} | null
```

</details>

<details>
<summary>LinearMafDisplay - Actions (other undocumented members)</summary>

#### action: setRowHeight

```ts
type setRowHeight = (n: number) => void
```

#### action: setResizing

```ts
type setResizing = (arg: boolean) => void
```

#### action: setRowProportion

```ts
type setRowProportion = (n: number) => void
```

#### action: setShowAllLetters

```ts
type setShowAllLetters = (f: boolean) => void
```

#### action: setMismatchRendering

```ts
type setMismatchRendering = (f: boolean) => void
```

#### action: setShowAsUpperCase

```ts
type setShowAsUpperCase = (arg: boolean) => void
```

#### action: setShowTree

```ts
type setShowTree = (arg: boolean) => void
```

#### action: setShowBranchLength

```ts
type setShowBranchLength = (arg: boolean) => void
```

#### action: setShowCoverage

```ts
type setShowCoverage = (arg: boolean) => void
```

#### action: setShowAlignments

```ts
type setShowAlignments = (arg: boolean) => void
```

#### action: setCoverageHeight

```ts
type setCoverageHeight = (arg: number) => void
```

#### action: setShowConservation

```ts
type setShowConservation = (arg: boolean) => void
```

#### action: setConservationMode

```ts
type setConservationMode = (arg: 'base' | 'codon') => void
```

#### action: setRowIdentityMode

```ts
type setRowIdentityMode = (arg: 'none' | 'xyplot' | 'heatmap') => void
```

#### action: setRowIdentityAutoZoom

```ts
type setRowIdentityAutoZoom = (arg: boolean) => void
```

#### action: setShowAnnotations

```ts
type setShowAnnotations = (arg: boolean) => void
```

#### action: setShowTranslation

```ts
type setShowTranslation = (arg: boolean) => void
```

#### action: setColorByChromosome

```ts
type setColorByChromosome = (arg: boolean) => void
```

#### action: setShowInversions

```ts
type setShowInversions = (arg: boolean) => void
```

#### action: setConservationHeight

```ts
type setConservationHeight = (arg: number) => void
```

#### action: setRpcData

```ts
type setRpcData = (regionIndex: number, data: MafRegionData) => void
```

#### action: setSummaryData

```ts
type setSummaryData = (regionIndex: number, records: MafSummaryRecord[]) => void
```

#### action: setFramesData

```ts
type setFramesData = (regionIndex: number, records: MafFrameRecord[]) => void
```

#### action: clearAlignmentData

```ts
type clearAlignmentData = () => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: MafRenderingBackend) => void
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void>
```

#### action: renderSvg

```ts
type renderSvg = (
  opts: ExportSvgDisplayOptions,
) => Promise<
  | ReactElement<unknown, string | JSXElementConstructor<any>>
  | Iterable<ReactNode>
  | AwaitedReactNode
>
```

</details>
