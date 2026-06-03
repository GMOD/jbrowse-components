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

## Docs

extends BaseDisplay + TrackHeightMixin + MultiRegionDisplayMixin +
TreeSidebarMixin

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
15
// code
rowHeight: DEFAULTS.rowHeight
```

#### property: rowProportion

```js
// type signature
0.8
// code
rowProportion: DEFAULTS.rowProportion
```

#### property: showAllLetters

```js
// type signature
false
// code
showAllLetters: DEFAULTS.showAllLetters
```

#### property: mismatchRendering

```js
// type signature
true
// code
mismatchRendering: DEFAULTS.mismatchRendering
```

#### property: showAsUpperCase

```js
// type signature
true
// code
showAsUpperCase: DEFAULTS.showAsUpperCase
```

#### property: showTree

```js
// type signature
true
// code
showTree: DEFAULTS.showTree
```

#### property: showCoverage

```js
// type signature
true
// code
showCoverage: DEFAULTS.showCoverage
```

#### property: coverageHeight

```js
// type signature
45
// code
coverageHeight: DEFAULTS.coverageHeight
```

### LinearMafDisplay - Volatiles

#### volatile: rpcDataMap

```js
// type signature
ObservableMap<number, MafRegionData>
// code
rpcDataMap: observable.map<number, MafRegionData>()
```

#### volatile: prefersOffset

```js
// type signature
true
// code
prefersOffset: true
```

#### volatile: sourcesVolatile

Canonical row metadata received from the worker. Reordering / recoloring lives
in TreeSidebarMixin's `layout`; this volatile holds the unfiltered authoritative
set so the merged `sources` view can fall back when `layout` is empty.

```js
// type signature
MafSource[]
// code
sourcesVolatile: [] as MafSource[]
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

#### getter: sources

Merged row set: prefer the persisted `layout` when present (carries any user
reordering / recoloring) and fall back to the worker's `sourcesVolatile`.
Subtree filter narrows in both cases.

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

Height of the per-sample rows area (excludes the coverage band).

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
from the worker-shipped `coverage.coverageDepths` arrays. Feeds `coverageDomain`
→ `coverageTicks`.

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

#### method: cellHoverInfo

Resolve a per-cell hover hit: given a region index, absolute genomic bp (uint32,
per worker-output convention), and a row index into `sources`, return the sample
label + base at that cell. Returns undefined when no fetched block covers the
bp, the row is out of range, or the cell is a gap. Base-case folding mirrors
`computeVisibleLabels`.

```js
// type signature
cellHoverInfo: (displayedRegionIndex: number, bp: number, rowIndex: number) => { sampleLabel: string; base: string; } | undefined
```

#### method: coverageTooltipBin

Build a per-position coverage tooltip bin (depth + SNP base counts) for the
given absolute genomic bp + region index. Delegates the math to
alignments-core's `buildCoverageTooltipBin` — same code path the alignments
display uses for hover info. Returns undefined when the region has no fetched
data or the bin has zero depth.

```js
// type signature
coverageTooltipBin: (displayedRegionIndex: number, position: number) => CoverageTooltipBin | undefined
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
are derived from track config, so they're identical on every region fetch — the
deepEqual guard makes this fire once and skips the redundant frozen-array
reassignment (plus the downstream `sources`/instance-buffer recompute) on each
later scroll/zoom, while preserving any in-session row reordering held in
`layout`. Goes through TreeSidebarMixin's `setLayoutAndClusterTree` so the
mixin's `root` getter re-parses; `sourcesVolatile` carries the full pre-filter
set used as the fallback in the merged `sources` view.

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

#### action: setShowCoverage

```js
// type signature
setShowCoverage: (arg: boolean) => void
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

#### action: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | AwaitedReactNode>
```
