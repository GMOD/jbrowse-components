---
name: two-color-methylation-composites-by-draw-order-at-wide-zoom
description: At wide zoom a read's two-color methylation calls share pixel columns and composite in draw order, so a column shows the last call painted rather than the read's methylation. Read before binning modification calls or changing their alpha.
audience: internal
---

# Two-color methylation composites by draw order at wide zoom

**Nothing here is built.** The question is whether a zoomed-out read should
show the methylation of each stretch it covers, or the calls that happened to
paint last.

## What happens now

Every call is one cell at least one pixel wide (`pileupCellX`). The pass
blends (`slangPass` defaults `blend` on), and each call's alpha is
`min(1, p² + 0.1)` (`buildModificationArrays`). So where a read's calls share a
pixel column they composite src-over in the order the worker emitted them,
which along a read is ascending position: a confident call nearly overwrites,
and the rightmost confident call in a column is what the column shows.

`plugins/alignments/benches/modPixelCollisions.probe.ts` over
`200x.longread.mod.bam` (chr22_mask:0-400000, 1037 reads, the shipped extract),
2026-11-03:

| bp/px | two-color calls | columns with >1 call | columns mixing colors |
| ----: | --------------: | -------------------: | --------------------: |
|     5 |         755,151 |                 3.4% |                  1.4% |
|    10 |                 |                 9.6% |                  4.2% |
|    20 |                 |                20.0% |                  9.1% |
|    50 |                 |                40.8% |                 21.0% |
|   100 |                 |                62.2% |                 36.6% |

The by-type view collides as often (16.5% of columns at 20 bp/px) and mixes
no colors there, since a 5mC-only read has one; its composite only darkens.
At 20 bp/px a 2000 px canvas spans 40 kb, an ordinary long-read view.

## The proposal

Bin each read's calls into `perBaseBinBp`-wide windows in the worker and
emit one cell per occupied bin carrying the mean P(mod) over its calls (in
two-color, over the cytosines in context it scored). Two-color would paint the
bin on the blue-to-red ramp by that mean, by-type in the type's color at that
alpha.

`ideas/waiting-on-a-call/per-base-wall-at-wide-zoom.md` declined a per-window
aggregate for per-base letters because four separated hues average to one mud
color. That objection does not carry: P(mod) is one scalar per call, and its
mean is the read's methylation fraction over the window, the same quantity the
coverage band reports per column across reads.

## What deciding it involves

- **The refetch.** `perBaseBinBp` changes once per octave and refetches on
  zoom; `reference/PER_BASE_SUBPIXEL_BIN.md` counts that cost for quality.
  Modifications would join the same fetch key.
- **The hit test and tooltip.** `hitTestModification` names one call. A bin
  would report its count, mean and span instead.
- **Mod coverage stays per column.** It already aggregates across reads and
  is not drawn per read.
- **Where the bin starts.** At 5-10 bp/px only 1-4% of columns mix colors, so
  binning below that would trade per-call detail for nothing.
