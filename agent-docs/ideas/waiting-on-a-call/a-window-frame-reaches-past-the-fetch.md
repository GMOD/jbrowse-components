---
name: a-window-frame-reaches-past-the-fetch
description: A `window` step counts its frame in rows, and the worker runs it over the region the display fetched, the visible span plus the buffer. A frame wider than the rows the buffer holds is cut at the fetch edge, so near the view's edges a 1,001-CpG average covers fewer CpGs and redraws differently on each refetch while panning. Padding the fetch needs bases for a frame counted in rows, so it needs an estimate of row spacing before the data arrives.
---

# A window frame reaches past the fetch

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
