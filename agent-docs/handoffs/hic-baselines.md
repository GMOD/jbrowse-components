---
name: hic-baselines
description: "Hi-C ratios against a baseline: Juicebox's observed/expected and observed/control as color fields, plus the groundwork (cuts, quantile off the fetch key, a shared matrix ramp with LD). Read before touching plugins/hic, the LD color plumbing or @gmod/hic's footer reader."
---

# Hi-C against a baseline

A raw contact map is mostly distance decay. Juicebox's two baselines show the
biology: the same file's expected count at that distance (O/E: compartments,
loops) and a second condition's map (observed/control: lost loops, moved
boundaries). Both draw as a diverging ratio centred on 1, so both are color
fields: `observed`, `observed/expected`, `observed/control`.

Settled with Colin on 2026-10-22 after three reviews (design against the ADRs,
mechanism, a cold read of the surface):

- Fields take Juicebox's operand names; `count` becomes `observed`.
- A ratio field's default domain is fixed at `[0.25, 4]` around `domainMid: 1`,
  so two conditions' tracks share one scale; a `{ quantile }` end on a ratio is
  symmetric in log space.
- O/E between chromosomes follows straw: `sumCounts / (nBins1 * nBins2)`.
- Build in today's color object. `encoding.color` and `legend.show` wait for
  the app-wide pass in [vega-lite-vocabulary](vega-lite-vocabulary.md); the
  `data.resolution` spelling and direction settle with wiggle's there.

## Order of work

1. Small fixes: `HicContactItem.counts`, the `symlog` doc, the worker's
   duplicate quantile default, `setSelectedNormalization`, the LGV dev dep.
2. Cut the resolution overlay (`showResolutionControls`; the legend title names
   the binsize) and the Color range dialog (ADR-208 declined a modal axis
   dialog; Edit plot and the toggles cover it).
3. The quantile is a per-call argument, not a fetch key: the worker answers for
   the q at issue, the main thread reselects only after an edit (~84 ms at
   4.5M; a worker quantile table sorts ~460 ms on every fetch and is inexact).
4. A shared matrix ramp mixin for LD and Hi-C. Hi-C's `scheme` and `reverse`
   lose their defaults so a field preset can set them (`withPreset` fills only
   unwritten members); `domainMid` and `unknown` reach the shader, Canvas2D,
   SVG and legend. `count` draws unchanged.
5. `@gmod/hic`: an indexed walk of the raw and normalized expected sections
   with their chromosome factors, `sumCounts` (read and dropped today), the
   applied normalization per region pair, and a validity mask so a masked bin
   is not a zero bin (`hicFile.ts` drops both alike).
6. `observed/expected`: the expected vector matches each pair's *applied*
   normalization (a chromosome lacking SCALE otherwise blanks or divides raw
   by SCALE); reads cover each pair's distance window, not a prefix; hover
   prints observed, expected and the ratio; rewrite the user guide's
   compartments section, which says JBrowse cannot draw O/E.
7. `observed/control`: a `control` sub-adapter on `HicAdapter` (GWAS
   `ldAdapter` is the precedent); refName aliasing, a chromosome-size check and
   the intersection of binsizes and normalizations; an outer join by row
   bucketing (~0.4 s at 4.3M x 4.3M, a JS Map 3-5 s) so lost loops draw;
   Juicebox's depth rule `(a/avgA)/(b/avgB)` with a pseudocount (check whether
   `avg` from raw `sumCounts` biases KR counts); a default count filter on
   observed + control; "Compare with track..."; the cohesin-loss tutorial.

## Traps the reviews found

- The log scale floors at 1 (`scoreScale.slang`), so a ratio domain anchored at
  0 paints 0.5 and 0.01 alike.
- `MIN_VISIBLE_ALPHA` discards the transparent end of the juicebox ramp; on a
  ratio field that end is the depleted half.
- A control spelling `1` where the primary spells `chr1` comes back empty and
  reads as enrichment everywhere; `@gmod/hic` 2.0 dropped aliasing.
