# LinearAlignmentsDisplay

## Layout architecture

Pileup and chain layout are computed on the **main thread**, not in the RPC
worker. Required because consistent Y-row assignment across multiple
`displayedRegions` is impossible per-region — each worker sees only one region,
so mates spanning region boundaries can't be placed on the same row.

Layout flows through the `laidOutPileupMap` getter. Raw fetched data lives in
`rpcDataMap` with zero-filled Y arrays; the getter returns shallow clones with
filled Y arrays, `maxY`, and (chain mode) connecting-line / Flatbush data.
MobX caches this — recomputes only when `rpcDataMap`, `sortedBy`,
`showSoftClipping`, or `renderingMode` change. Raw entries are never mutated.

### `placeRect` invariant

Both pileup (`sortLayout.ts`) and chain (`computeChainLayout.ts`) use
`placeRect(rows, start, end)`. Each row is a sorted `[s1,e1,s2,e2,...]` flat
list; placement is first-fit with gap-filling. **Do not reintroduce a
levels/right-edge-only array** — features arrive out of start order in both
chain layout (sorted by distance) and pileup sort-by-base/strand, so
right-edge-only would fragment layout. Start-sorted input hits an O(1)
fast-path that matches end-array performance in the common case.

### Worker contract

`executeRenderChainData.ts` returns chain metadata arrays and all Y arrays
initialized to 0. The main thread fills real Y values and builds connecting
lines / Flatbush.

## SVG export pipeline

`renderSvg.tsx` drives the same `drawAlignmentBlocks(ctx, regions, blocks,
state)` entry point used on-screen — it instantiates a headless
`Canvas2DAlignmentsRenderer(null)`, runs `uploadRegion` /
`uploadConnectingLinesForRegion` / `uploadArcsFromTypedArraysForRegion` from
`laidOutPileupMap` + `arcsState.rpcDataMap`, then paints into a real canvas
(when `opts.rasterizeLayers`) or an `SvgCanvas` (vector). Coverage,
indicators, paired arcs, pileup reads, mismatches, soft/hard clips,
modifications, and connecting lines all flow through the unified pass — do
not reintroduce parallel SVG-only draw functions.

### Sashimi is intentionally SVG-only

`drawSashimiArcs` lives in `renderSvg.tsx` (not in
`Canvas2DAlignmentsRenderer`) on purpose. Arc counts are low, vector output
performs fine, and SVG `<path>` elements give native hover/tooltip behavior
that the rasterized/canvas pipeline can't reproduce. This is a deliberate
keep, not a porting backlog item — do not "unify" sashimi into
`drawAlignmentBlocks`.
