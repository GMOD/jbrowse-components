---
name: todo
description: Action items to build or fix, the current backlog. Read when picking up work.
---

## Alignments / canvas

- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## Dotplot edge-zoom jump

Zoomed all the way out, then scrolling to zoom in near the edge of the plot
makes the plot "jump" so the cursor is no longer over the same region. At every
other zoom level the area under the cursor stays put; only reproduces from the
max-zoomed-out level, and is more noticeable near the plot edge.


## more accurate cgiab

look at wakhan, pycnv


## add extra large text svg mode for pub ready figures



## autofit height for lineargenomeview example-site demo


## review release process




## reversed-region coverage: remaining gaps

The alignments **draw path** is covered both orientations by
`renderers/reversedMirror.test.ts` (drive `drawAlignmentBlocks` forward and
reversed over identical data; every mark must have a mirrored twin), across a
plain pileup and a linked-reads layout — now **every** pileup-band layer,
including soft-clip bases and insertions. The reversed pileup has also been
eyeballed in the app and looks correct. A source read of every Canvas2D
`fillRect`/`rect` draw loop repo-wide found no cell/sliver/cull bug remaining.
What is still NOT covered:

- **The wiring above the renderer.** The mirror test hands `reversed: true`
  straight to `renderBlocks`. Nothing asserts the model actually delivers it —
  displayedRegion → `renderBlocks` → `renderState`. `ReversedRegionLabels.test.tsx`
  is the working pattern (`navToLocString('ctgA:1..7,720[rev]')` + SVG export,
  which runs the Canvas2D path through `SvgCanvas` with no real canvas); swap the
  track for `volvox_alignments_pileup_coverage`. Assert a property, not a
  snapshot — a snapshot would have happily recorded the off-by-one-base bug.
- **GPU rasterization.** The bp→clip pivot is centralized and unit-tested
  (`bpRangeXTuple`/`writeBpRangeUniforms`, `blockClipUtils.test.ts`) and no
  renderer hand-rolls it, but nothing rasterizes a reversed block to confirm
  `flipX` lands cells on the right pixels — needs a browser test.

## Hi-C / LD reversed regions

Both the Hi-C and LD triangle displays render **unflipped** on a reversed
displayed region — the matrix lays out by forward genomic position while the
ruler runs right-to-left, so it's mirrored relative to the axis. Not the
1bp-cell pixel class: it's architectural. Both share `computeRenderTransform`
(`BaseLinearDisplay/models/renderTransform.ts`), a single positive-scale affine
over the whole view that never consults `reversed` (a `FORWARD-ONLY` note is on
the helper). One linear map can't express a reversed — let alone
mixed-orientation — axis. A fix needs a per-region flip in both the transform
and the worker position computation (`hic/regionOffsets.ts` +
`executeRenderHicData.ts`, and the LD equivalent), and the hit-test must invert
whatever the render does. Niche (needs a flipped region over one of these
tracks); hover stays correct because it inverts the same forward transform.

## Canvas2D vs GPU `canvasDrawn` contract drift

`drawAlignmentBlocks` returns `true` whenever `regions.size > 0` — decided before
it knows whether any band painted. `GpuAlignmentsRenderer.drawSection` returns
`drewCoverage || drewPileup || sec.arcBand !== undefined`. The three cases
`coverageParity.test.ts:516` pins for the GPU ("returns false when no band
paints", "returns false when the block has no synced region") would fail against
Canvas2D.

Latent, not biting: the model already gates first paint on
`laidOutPileupMap.size === 0` (`model.ts:2882`), so the loading overlay behaves.
Worth extending those same parity cases to the Canvas2D backend — but note the
trap the GPU comment records: gating the return on the pileup band once left
read-cloud (arcs-only, empty pileup) stuck on "Loading" forever. Any tightening
has to keep coverage-only and arcs-only sections counting as a paint.




