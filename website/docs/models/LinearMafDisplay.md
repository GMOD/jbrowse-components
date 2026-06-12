---
id: linearmafdisplay
title: LinearMafDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/stateModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearMafDisplay.md)

## Example usage

A complete `MafTrack` config to paste into `tracks`. `samples` lists the aligned
species in track order; `rowHeight` sets the per-sample band height:

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

**Getters:** isReady, viewportWithinLoadedData, renderBlocks, displayPhase,
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

### LinearMafDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearMafDisplay">
// code
type: types.literal('LinearMafDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: rowHeight

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowHeight: types.stripDefault(types.number, DEFAULTS.rowHeight)
```

#### property: rowProportion

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowProportion: types.stripDefault(types.number, DEFAULTS.rowProportion)
```

#### property: showAllLetters

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showAllLetters: types.stripDefault(
          types.boolean,
          DEFAULTS.showAllLetters,
        )
```

#### property: mismatchRendering

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
mismatchRendering: types.stripDefault(
          types.boolean,
          DEFAULTS.mismatchRendering,
        )
```

#### property: showAsUpperCase

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showAsUpperCase: types.stripDefault(
          types.boolean,
          DEFAULTS.showAsUpperCase,
        )
```

#### property: showTree

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showTree: types.stripDefault(types.boolean, DEFAULTS.showTree)
```

#### property: showBranchLength

Position tree nodes by their cluster merge height (dendrogram) rather than
evenly by topology (cladogram).

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showBranchLength: types.stripDefault(
          types.boolean,
          DEFAULTS.showBranchLength,
        )
```

#### property: showCoverage

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCoverage: types.stripDefault(types.boolean, DEFAULTS.showCoverage)
```

#### property: showAlignments

Show the per-sample alignment rows. When off, only the coverage band renders
(independent of `showCoverage`).

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showAlignments: types.stripDefault(
          types.boolean,
          DEFAULTS.showAlignments,
        )
```

#### property: coverageHeight

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
coverageHeight: types.stripDefault(
          types.number,
          DEFAULTS.coverageHeight,
        )
```

### LinearMafDisplay - Volatiles

#### volatile: rpcDataMap

```js
// type signature
ObservableMap<number, MafRegionData>
// code
rpcDataMap: observable.map<number, MafRegionData>()
```

#### volatile: summaryDataMap

Per-region `bigMafSummary` rows for the zoom-out path, populated by
`fetchMafSummaryData` only while `showSummary` is active. Kept separate from
`rpcDataMap` so the GPU sequence canvas and the summary overlay never read each
other's data.

```js
// type signature
ObservableMap<number, MafSummaryRecord[]>
// code
summaryDataMap: observable.map<number, MafSummaryRecord[]>()
```

#### volatile: prefersOffset

```js
// type signature
true
// code
prefersOffset: true
```

#### volatile: sourcesVolatile

The worker's authoritative row set, in tree (leaf) order. `layout` overlays any
user reorder/relabel on top; `editableSources` merges the two and `sources`
narrows that by the subtree filter.

```js
// type signature
MafSource[]
// code
sourcesVolatile: [] as MafSource[]
```

#### volatile: treeNewickVolatile

The worker's guide-tree Newick (the default, before any reorder). The active
displayed tree lives in the mixin's `clusterTree`, which a reorder clears (rows
no longer match the dendrogram) and "Clear arrangement" restores from here — so
we keep the worker tree separately rather than re-fetching it.

```js
// type signature
string | undefined
// code
treeNewickVolatile: undefined as string | undefined
```

#### volatile: colorPalette

Theme-derived color palette (per-base colors + match/gap/mismatch/
unknown/insertion). Pushed in from the React component via `setColorPalette`.
Read by `gpuProps()` and `renderState`, so theme changes trigger a main-thread
re-encode but never an RPC refetch. Mirrors the `ColorPalette` pattern in
plugin-alignments.

```js
// type signature
MafColorPalette | undefined
// code
colorPalette: undefined as MafColorPalette | undefined
```

### LinearMafDisplay - Getters

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so direct reads route through this to stay typed
(same move as `BaseAdapter<CONF>`)

```js
// type
ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: editableSources

The full row set with the user's arrangement applied: `layout` supplies order +
label/color overrides, merged over the worker's `sourcesVolatile` by name. Empty
`layout` (no customization) passes the worker set through. Not subtree-filtered
— this is what the arrangement dialog edits. Undefined until the first fetch
populates the worker set.

```js
// type
MafSource[] | undefined
```

#### getter: sources

The display rows: `editableSources` narrowed to the selected subtree.

```js
// type
MafSource[] | undefined
```

#### getter: samples

Sample list keyed by sample id (alias of `sources` mapped to the project's
canonical `{ id, label, color }` shape). Consumed by MafSequenceWidget, color
legend, etc.

```js
// type
Sample[] | undefined
```

#### getter: rowsHeight

Height of the per-sample rows area (excludes the coverage band). Zero when
alignments are hidden, collapsing the display to the coverage band.

```js
// type
number
```

#### getter: coverageDisplayHeight

Height of the coverage band above the rows (0 when hidden).

```js
// type
number
```

#### getter: totalHeight

Full display height = rows area + coverage band.

```js
// type
number
```

#### getter: height

Override BaseLinearDisplay.height so the track container matches the rendering
canvas height exactly (coverage band + rows × rowHeight).

```js
// type
number
```

#### getter: hierarchy

Positioned tree hierarchy. Coordinates are computed against
`(rowsHeight, treeAreaWidth)` so leaf rows align with row tops; the coverage
band is offset separately by the React layer.

```js
// type
PositionedHierarchyNode<NewickNode> | undefined
```

#### getter: spatialIndex

```js
// type
{ index: Flatbush; nodes: ClusterHierarchyNode[]; } | undefined
```

#### getter: renderState

Render state passed to GPU/Canvas2D backend each frame. Uses the rows- only
height so the GPU canvas only paints the per-sample band; the coverage band is
drawn on a separate Canvas2D overlay above.

```js
// type
MafGPURenderState | undefined
```

#### getter: coverageStats

Per-position depth stats across the currently visible content blocks, derived
from the worker-shipped `coverage.coverageDepths` arrays (which already reflect
the active subtree — see `rpcProps`). Feeds `coverageDomain` → `coverageTicks`.

```js
// type
ScoreStats | undefined
```

#### getter: coverageDomain

[min, max] coverage domain for the visible blocks. Linear scale only for MAF —
sample counts are already bounded and well-distributed.

```js
// type
;[number, number] | undefined
```

#### getter: coverageTicks

Y-axis tick marks for the coverage band.

```js
// type
YScaleTicks | undefined
```

#### getter: visibleLabels

```js
// type
VisibleLabel[]
```

#### getter: visibleEmptyLines

Positioned bridge-line segments for `e`-line (empty/bridged) rows.

```js
// type
EmptyLineSegment[]
```

#### getter: visibleInsertions

Positioned insertion markers (interbase) for the visible aligned rows.

```js
// type
InsertionMarker[]
```

#### getter: visibleDeletions

Positioned deletion runs for the visible aligned rows; the overlay draws the
deleted-base count inside each run when it fits.

```js
// type
DeletionMarker[]
```

#### getter: showSummary

Use the cheap summary path when a `bigMafSummary` sub-adapter is configured and
the view is zoomed out past the force-load threshold — exactly where the full
alignment fetch would be blocked by the byte gate. Tracks without a summary
never enter this path.

```js
// type
boolean
```

#### getter: visibleSummaryBars

Positioned per-species presence bars for the zoom-out summary overlay. Empty
unless `showSummary` is active. Unmatched `src` rows drop via the `sources`
index, keeping the render robust to summary files that list extra species.

```js
// type
SummaryBar[]
```

#### getter: msaHighlights

Get highlight regions from connected MSA views

```js
// type
MsaHighlight[]
```

### LinearMafDisplay - Methods

#### method: gpuProps

Inputs to the main-thread GPU instance encoder. Changes here re-encode in the
per-region encode autorun — no RPC roundtrip. Intentionally excludes
`showAsUpperCase` (label-only) and view-shape props (rowHeight, rowProportion —
driven by shader uniforms).

```js
// type signature
gpuProps: () => MafGpuProps | undefined
```

#### method: rpcProps

Worker-fetch inputs that invalidate cached data when changed (tier-1, via
MultiRegionDisplayMixin's `SettingsInvalidate` autorun → refetch).
`orderedSampleIds` is the display row order (layout reorder + subtree filter);
the worker emits block rows in it so `rowIndex` is the on-screen row. Loop-safe
despite deriving from worker output: `sources` is set-stable (`sourcesVolatile`
deepEqual-guarded in `setSamples`, `layout`/`subtreeFilter` user-driven), so it
doesn't churn per fetch.

```js
// type signature
rpcProps: () => { orderedSampleIds: string[] | undefined; }
```

#### method: rowHoverInfo

Resolve a hover hit on `rowIndex` at absolute genomic `bp` (uint32, per
worker-output convention): an aligned base (`cell`) or a bridged/empty region
(`empty`), each tagged with the sample label. Returns undefined when no fetched
block covers the bp, the row is out of range, or the cell is a gap.

```js
// type signature
rowHoverInfo: (displayedRegionIndex: number, gposFrac: number, rowIndex: number, bpPerPx: number) => { sampleLabel: string; kind: "cell"; base: string; chr?: string | undefined; pos?: number | undefined; strand?: number | undefined; context?: AlignmentContext | undefined; } | { ...; } | { ...; } | { ...; } | undefined
```

#### method: coverageTooltipBin

Build a per-position coverage tooltip bin (depth + SNP base counts) for the
given absolute genomic bp + region index. Delegates the math to
alignments-core's `buildCoverageTooltipBin` — same code path the alignments
display uses. Insertions are reported separately via `coverageInsertionHit`, so
they never mix into the depth/SNP table. Returns undefined when the region has
no fetched data or depth is zero.

```js
// type signature
coverageTooltipBin: (displayedRegionIndex: number, position: number, bpPerPx: number) => CoverageTooltipBin | undefined
```

#### method: coverageInsertionHit

Hit-test an insertion bar in the coverage band at fractional genomic `gposFrac`.
Returns the interbase summary (count + length range + interbaseDepth) when the
cursor is on the bar, else undefined — drives the dedicated interbase tooltip,
kept separate from the depth/SNP one.

```js
// type signature
coverageInsertionHit: (displayedRegionIndex: number, gposFrac: number, bpPerPx: number) => CoverageInsertionHit | undefined
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearMafDisplay - Actions

#### action: setRowHeight

```js
// type signature
setRowHeight: (n: number) => void
```

#### action: setRowProportion

```js
// type signature
setRowProportion: (n: number) => void
```

#### action: setShowAllLetters

```js
// type signature
setShowAllLetters: (f: boolean) => void
```

#### action: setMismatchRendering

```js
// type signature
setMismatchRendering: (f: boolean) => void
```

#### action: setColorPalette

Push the theme-derived color palette in from the React layer. Callers useMemo by
theme so the reference is stable across renders.

```js
// type signature
setColorPalette: (p: MafColorPalette) => void
```

#### action: setSamples

Receive worker-authoritative `samples` + serialized Newick tree. Samples + tree
are config-derived and identical on every region fetch, so the deepEqual guard
makes this fire once and skips the redundant frozen-array reassignment (and
downstream `sources`/instance-buffer recompute) on later scroll/zoom. The active
`clusterTree` is set from the worker tree only when there's no custom
arrangement — a reorder has cleared it and must keep it cleared until the user
clears the layout.

```js
// type signature
setSamples: ({ samples, treeNewick, }: { samples: Sample[]; treeNewick: string | undefined; }) => void
```

#### action: setShowAsUpperCase

```js
// type signature
setShowAsUpperCase: (arg: boolean) => void
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

#### action: setShowCoverage

```js
// type signature
setShowCoverage: (arg: boolean) => void
```

#### action: setShowAlignments

```js
// type signature
setShowAlignments: (arg: boolean) => void
```

#### action: setCoverageHeight

```js
// type signature
setCoverageHeight: (arg: number) => void
```

#### action: showInsertionSequenceDialog

```js
// type signature
showInsertionSequenceDialog: (insertionData: { sequence: string; sampleLabel: string; chr: string; pos: number; }) => void
```

#### action: clearLayout

Drop the custom arrangement and restore the worker's guide tree (the base
`clearLayout` only clears it — the worker tree lives in `treeNewickVolatile`).

```js
// type signature
clearLayout: () => void
```

#### action: setRpcData

```js
// type signature
setRpcData: (regionIndex: number, data: MafRegionData) => void
```

#### action: setSummaryData

```js
// type signature
setSummaryData: (regionIndex: number, records: MafSummaryRecord[]) => void
```

#### action: clearAlignmentData

```js
// type signature
clearAlignmentData: () => void
```

#### action: clearDisplaySpecificData

```js
// type signature
clearDisplaySpecificData: () => void
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => void
```

#### action: startRenderingBackend

```js
// type signature
startRenderingBackend: (backend: MafRenderingBackend) => void
```

#### action: fetchNeeded

```js
// type signature
fetchNeeded: (needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>
```

#### action: isCacheValid

Force a refetch when the loaded data is the wrong kind for the current zoom:
crossing the summary↔detail threshold within an already-loaded region wouldn't
trip the bounds-based coverage check, so the mode is keyed on which map holds
the region.

```js
// type signature
isCacheValid: (displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

Enable byte-estimate gating: above ~20kb visible, the adapter's MAF-aware byte
estimate (per-species sequence × span) is checked against `fetchSizeLimit`,
blocking the detail fetch with a force-load prompt rather than downloading
hundreds of species' bases at genome scale.

Returns null in summary mode — the summary read is cheap (zoom-reduced BigBed),
so it must never be blocked by the gate.

```js
// type signature
getByteEstimateConfig: () => { adapterConfig: any; fetchSizeLimit: number; userByteSizeLimit: number | undefined; visibleBp: number; } | null
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | AwaitedReactNode>
```
