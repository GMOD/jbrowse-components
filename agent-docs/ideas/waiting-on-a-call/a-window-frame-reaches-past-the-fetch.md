---
name: a-window-frame-reaches-past-the-fetch
description: A `window` step's frame (a smoothed trend, rolling mean, moving average over a QuantitativeTrack on the mark display) counts rows, so it is cut at the fetch edge and its reach in bases follows the zoom over a BigWig summary tier. Read before proposing a trend line or a bp-unit frame on wiggle.
---

# A window frame reaches past the fetch

A smoothed trend over raw values is live: the mark display runs on a
`QuantitativeTrack`, and a `marks` list can draw points under a line whose
`transform` is a `window` step (the methylation tutorial's bedMethyl recipe,
`frame: [-50, 50]` with a coverage `weight`). The questions below are what that
step still gets wrong at the edges and across zooms.

The mark display fetches each displayed region's buffered span
(`planRegionFetch`, `bufferedVisibleRegions`) and the worker runs the steps
over what came back. `windowStep.ts` cuts a frame at its group's ends, so the
first and last rows of a fetch average over fewer rows than the frame names.

## When it shows

On HG002's chr15 bedMethyl, about 94 bp per CpG, a frame of 500 rows either
side spans about 47 kb on each side. A view narrower than about 94 kb leaves its
buffer shorter than that, so values near both edges average a cut frame, and a
pan that refetches moves the cut and the curve with it, and the display draws
a cut frame the same way as a whole one.

## Options

- **Pad the fetch** by the frame times a row-spacing estimate: the median
  spacing of the region last fetched, or a per-adapter default. A sparse
  stretch still leaves the frame short, and a dense one overfetches.
- **Mark the cut rows**: the step writes how many rows each frame held, and the
  line fades or breaks where a frame came up short. The mark then shows the cut
  at any zoom, at the cost of a field and a rule.
- **Both**: pad by the estimate, and mark what the pad did not cover.

## The call

Which of the three, and whether a cut frame is a rendering concern or a notice.
`pathSeries.ts`'s `frameSpanBp` already measures the bases a frame spans per
row, which either option can read.

## Two more questions the step raises

- **The frame's unit.** `frame` counts rows. Over a BigWig, whose rows are
  summary bins that widen as the view zooms out, the same frame covers more
  bases at every zoom step, so the curve's smoothness follows the zoom. A
  frame in bases would hold it; `frameSpanBp` is the measure either way. Shoot a
  phyloP or ChIP BigWig with a bar mark and a windowed line before deciding.
- **The default wiggle display.** A trend line today means switching the track
  to the mark display, which is still experimental in v5. Offering it on the
  wiggle display moves its plots toward render-core's marks, so that is a call
  under ADR-227's reconsider conditions, not a new design: wiggle's one plot
  family per region (`wiggleParams` reads `sources[0]`) is what it would undo.
