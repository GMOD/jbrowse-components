---
name: grammar-next-steps
description: What the grammar thread does next as of 2026-09-27 - a reviewed and ranked list of the candidates (the clipped-bar marker first, wiggle onto the bar and point shapes second), the corrections that review made to older claims, and one leftover of the domainQuantile call. Read before picking up grammar work.
---

# Grammar thread: next steps

ADR-181 (a centred point and a `rule` mark), ADR-179's 2026-09-27 amendment
(each quantile end clips its own tail) and ADR-182 (`scales.y.zero`, the axis's
0 as a slot and a Score-menu tick) landed that day. Figure reshoots wait on ada
and are listed in [scales-and-colour-keys](scales-and-colour-keys.md).

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
   (`plugins/wiggle/src/util.ts`; the GPU record already matches
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

## Leftover of the domainQuantile call

**Ties fill a nearest-rank quantile**: at 0.95 a segmented copy-number track
pins 99.5% of its values to one colour, because one value holds the rank. It
surfaced in the probe behind the 2026-09-27 amendment and nothing decides it
yet.
