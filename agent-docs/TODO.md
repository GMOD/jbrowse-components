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




## reversed-region coverage: app wiring + a human look

The alignments **draw path** is now covered both orientations by
`renderers/reversedMirror.test.ts` (drive `drawAlignmentBlocks` forward and
reversed over identical data; every mark must have a mirrored twin). What that
does NOT cover, and what's left:

- **The wiring above the renderer.** The mirror test hands `reversed: true`
  straight to `renderBlocks`. Nothing asserts the model actually delivers it —
  displayedRegion → `renderBlocks` → `renderState`. A jsdom test would:
  `ReversedRegionLabels.test.tsx` is the working pattern
  (`navToLocString('ctgA:1..7,720[rev]')` + SVG export, which runs the Canvas2D
  path through `SvgCanvas` with no real canvas); swap the track for
  `volvox_alignments_pileup_coverage`. Assert a property, not a snapshot — a
  snapshot would have happily recorded the off-by-one-base bug.
- **Nobody has looked at a reversed pileup.** Every check so far is programmatic.
- **The overlap layer has no reversed coverage** in any test: `shouldDrawOverlaps`
  needs a linked-reads layout, so the mirror fixture skips it.

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




