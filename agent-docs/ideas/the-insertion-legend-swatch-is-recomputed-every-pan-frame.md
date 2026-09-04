---
name: the-insertion-legend-swatch-is-recomputed-every-pan-frame
description: LinearMultiSampleVariantDisplay's insertionLegendColor asks the painter's own markersForBlock over every render block on every pan frame, so the swatch is exact and the walk is per-frame. Making it pan-stable was tried and reverted — the snap phase is offsetPx, so no cheaper answer agrees with the painter. The open question is whether an exact per-frame legend or a stable approximate one is wanted.
---

# The insertion legend swatch is recomputed every pan frame

`insertionLegendColor`
(`plugins/variants/src/LinearMultiSampleVariantDisplay/model.ts`) walks every
render block and asks `markersForBlock` — the painter's own test — whether any
insertion marker is drawn, then `FloatingLegend` re-renders. Its inputs include
`offsetPx` through the blocks, so it re-runs on every pan frame over every
loaded record.

## Why the obvious fix is not available

`72eb504835` moved the walk onto a synthetic block pinned at offset 0 and was
reverted in `251ee1c67f`. The claim it rested on — "`markersForBlock` culls
nothing, so only `pxPerBp` and the snap phase come off the block" — is true, and
the snap phase is the problem: `snapCellEdgePx` differences round to `floor(d)`
or `ceil(d)` depending on `frac(screenStartPx - start * pxPerBp)`, which the
painter takes live. Measured against the real model, the painter drew a marker
on 12 of 24 half-pixel pan positions where the synthetic block showed none, and
the synthetic block advertised one on 4 of 16 frames where the painter drew
none. Reachable on the long-REF-plus-longer-ALT pangenome shape `getInsertedBp`
exists for. Walking `perRegionCellMap` instead was a second regression: the
swatch lit for a displayed region scrolled entirely off screen.

So **an exact answer cannot be pan-stable**, and the swatch's own docstring
argues at length for why it must be exact — both cheaper approximations put a
576px swatch on figures that draw no glyph, which is how three of fourteen
committed figures looked before it.

## The decision, not the cleanup

Two ways out, and they are a product call rather than a refactor:

- **Keep it exact.** Then the cost is the thing to attack: the walk is
  `renderBlocks × cells`, and it could hold its answer against a key of
  everything the painter's geometry depends on (`pxPerBp`, and the snap phase
  quantised the way `snapCellEdgePx` quantises it) rather than against the
  frame.
- **Make it stable and approximate.** Then say so in the legend — a swatch that
  does not come and go with a half-pixel pan, at the cost of appearing on a
  frame where the glyph is under the cell floor.

Nothing here is a correctness defect: today's behaviour is exact, and what it
costs is a per-frame walk on a display that already walks per frame to paint.
