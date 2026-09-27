---
name: grammar-next-steps
description: What the grammar thread does next as of 2026-09-27 - Colin's open call on where a linear y axis gets its 0, a reviewed and ranked list of the candidates (the clipped-bar marker first, wiggle onto the bar and point shapes second), the corrections that review made to older claims, and two leftovers of the domainQuantile call. Read before picking up grammar work or touching getNiceDomain.
---

# Grammar thread: next steps

ADR-181 (a centred point and a `rule` mark) and ADR-179's 2026-09-27 amendment
(each quantile end clips its own tail) landed that day. Figure reshoots wait on
ada and are listed in [scales-and-colour-keys](scales-and-colour-keys.md).

## Colin's call: where a linear y axis gets its 0

Every linear or symlog y axis starts at 0 today, whatever is drawn, because
`getNiceDomain` (`packages/wiggle-core/src/scale.ts`) lowers a positive minimum
to 0. So a plot of points whose values all sit between 30 and 60 draws 0 to 60,
its bottom half empty. The mark display already states the rule for bars
explicitly (its domain widens to `origin` only when a bar draws, `autoscaleRange`
in `plugins/marks/src/LinearMarkDisplay/model.ts`), and the hidden line in
`getNiceDomain` overrides it for every other mark.

The three answers put to Colin, who asked to clarify before choosing:

1. **Bars reach 0, the rest span their data** (recommended). ggplot2's rule: a
   bar reaches its baseline because the baseline is part of the bar, so wiggle's
   bar mode, the coverage band and a `bar` mark keep 0; points, lines and rules
   span their data. `domainMin: 0` forces 0 for anyone who wants it, so nothing
   new is added. Wiggle line and scatter plots and point-only mark plots over
   data far from 0 change (GC as a line: 30-60% rather than 0-60%); Manhattan
   barely moves, since p near 1 puts values near 0.
2. **Every axis starts at 0**, IGV's convention for signal tracks, with the rule
   moved out of `getNiceDomain` into one named, documented place. No picture
   changes.
3. **A `scales.y.zero` switch**, Vega-Lite's: on by default where a bar draws,
   off otherwise, visible in the config and Edit plot. The most explicit, and
   one more setting.

## Next, ranked

A review on 2026-09-27 checked each candidate against main. Its sizes and
probes come from that review and nobody has re-measured them.

1. **A marker for bars clipped at the top of an axis** (the bullet in
   scales-and-colour-keys). v4 drew a 2 px red `clipColor` strip on every
   clipped bar (`git show bafc8df5b4^:plugins/wiggle/src/drawXY.ts`), and
   `bafc8df5b4` removed it with the canvas code. The coverage band now clips at
   0.99 by default, so a collapsed-repeat pile-up reads as the axis maximum
   with no sign of the clip. First step: capture a coverage band over a
   collapsed repeat as now, with v4's strip, and with one alternative, locally,
   and show Colin. About 1.5-2 days after that, across wiggle, alignments-core's
   coverage bar and render-core's `bar`, on GPU, Canvas2D and SVG.
2. **Wiggle's xyplot and scatter onto render-core's `bar` and `point`.** Of the
   four blockers sized on 2026-09-26, the bin-midpoint one is gone (ADR-181
   centres a point), the interleaved positions live only in the payload
   (`plugins/wiggle/src/shared/util.ts`; the GPU record already matches
   `bar`'s x/x2), and the row's f32-against-u32 is about an hour. Still real:
   `markColor.slang` has no symlog, and wiggle holds one colour and one row per
   source where `bar` and `point` read both per instance. ADR-165 stage 2's row
   table already gives them a per-row colour, so the question for Colin is
   whether a layer may carry a per-source constant or wiggle fills constant
   arrays at pack time; a bench decides the cost. 7-10 days in all. The first
   step, once that is answered: un-interleave the positions (1-1.5 days, about
   25 files, no pixels moved, held by `wiggleInstanceBuffer.test.ts` and the
   pack benches at 1.00x or better).
3. **Links on a circular ring sit off by the slice spacing**, and **a far link's
   hover box is its whole bounding box**: items 3 and 4 of [review](review.md),
   about half a day each. The review reached the first by default through
   `config_demo`'s dbsuper track; the dome across the ring's wrap point needs a
   call (chords on the circle, or no links on a ring), and the second needs
   `ink` to return several boxes.
4. **The alignments read-colour key's title and labels**, in
   scales-and-colour-keys, about a day; its direction is not yet put to Colin.
5. **Link items 1 and 2 of review**: real in code, triggered by nothing in the
   repo, an hour or two each.
6. **review's `domainQuantile` range check and the Clip outliers re-tick**,
   under an hour each; nothing reaches either by default.

## Leftovers of the domainQuantile call

Both leftovers surfaced in the probe behind the 2026-09-27 call.

- **Wiggle's density mode colours through the niced y domain**, so a GC BigWig
  drawn as a heatmap spans 0 to its top at any quantile: an axis's 0 applied to
  a colour. The axis call above decides it too.
- **Ties fill a nearest-rank quantile**: at 0.95 a segmented copy-number track
  pins 99.5% of its values to one colour, because one value holds the rank.
  Unrelated to the zero anchor.
