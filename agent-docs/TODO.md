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




## Hi-C matrix is res-floor shifted against the ruler

`calcRegionCombinedOffsets` subtracts `Math.floor(region.start / res)`, so
`positions[]` puts `u = 0` at the block's **resolution-floored** start while
`renderTransform` draws `u = 0` at the block's actual left edge. The matrix
therefore sits `(start % res) / bpPerPx` px right of truth — up to one full bin.

Measured, not derived: with `res = 100`, a `region.start` of 0 / 50 / 99 all draw
their first cell at `rx = 0`, where truth is 0 / -50 / -99 px. Zero only when the
viewport happens to be res-aligned. Since `contentBlocks.start` moves as you pan,
this predicts the matrix jittering against the ruler by up to a bin while
scrolling — worth confirming that's what a user sees before fixing.

Orientation-independent, and reversed inherits it symmetrically (the mirror is
taken about the block's own width, so reversed is the exact mirror of forward)
rather than compounding it. LD may well have the same shape.

## LD reversed regions

The LD triangle renders **unflipped** on a reversed displayed region — it lays
out by forward genomic position while the ruler runs right-to-left. Architectural,
not the 1bp-cell class. Purely visual (hover inverts the same forward transform)
and niche: needs a flipped region over an LD track.

Copy hic: it mirrors each contact within its own region's span when the worker
builds `positions[]` (`hic/regionOffsets.ts` `mirrorUInRegion`), so every
renderer stays orientation-agnostic and `computeRenderTransform` stays
forward-only. Don't mirror via a negative ctx scale — `SvgCanvas` gets that wrong
under rotation, and the SVG export shares the draw.

LD differs in blast radius (call sites enumerated at
`LDDisplay/components/LinesConnectingMatrixToGenomicPosition.tsx:20`): it's
all-or-nothing, and its index positioning mode mirrors over indices rather than
genomic px.

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




