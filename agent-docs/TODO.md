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




## reversed-region integration coverage beyond gene labels

Exactly one test flips a region: `products/jbrowse-web/src/tests/ReversedRegionLabels.test.tsx`
(`navToLocString('ctgA:1..7,720[rev]')` → SVG export of gff3tabix_genes labels).
Nothing exercises a reversed region for **alignments**, and nothing anywhere
checks reversed per-base cells — which is how the 1bp-cell bug (all five
alignments cell painters painting the neighboring base, now fixed via
`makeCellLeftMapper`) went unnoticed. It's unit-tested now, but nobody has
looked at a reversed pileup on the Canvas2D fallback in a real app.

Cheap because the harness exists: copy `ReversedRegionLabels.test.tsx` and swap
the track for volvox alignments (per-base letters / mismatches at high zoom, so
cells are wider than a pixel and a one-base slip is visible). That covers the
whole orientation class rather than the one bug.

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




