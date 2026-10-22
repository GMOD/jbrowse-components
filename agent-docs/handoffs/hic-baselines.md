---
name: hic-baselines
description: "Hi-C ratios against a baseline. Landed: observed/expected and observed/control as color fields, Compare with..., and the groundwork. Open: a ratio domain that can follow the data again, what an absent bin paints, a count filter for noisy ratios, and a treatment-versus-control demo. Read before touching plugins/hic, the LD color plumbing or @gmod/hic's footer reader."
---

# Hi-C against a baseline

A raw contact map is mostly distance decay. Juicebox's two baselines show the
biology: the same file's expected count at that distance (O/E: compartments,
loops) and a second condition's map (observed/control: lost loops, moved
boundaries). Both draw as a diverging ratio centred on 1, so both are color
fields: `observed`, `observed/expected`, `observed/control`.

Settled with Colin on 2026-10-22 after three reviews (design against the ADRs,
mechanism, a cold read of the surface):

- Fields take Juicebox's operand names.
- A ratio field's default domain is fixed at `[0.25, 4]` around `domainMid: 1`,
  so two conditions' tracks share one scale; a `{ quantile }` end on a ratio is
  symmetric in log space.
- O/E between chromosomes follows straw: `sumCounts` over
  `floor(size / binsize)` bins a side.
- Build in today's color object. `encoding.color` and `legend.show` wait for
  the app-wide pass in [vega-lite-vocabulary](vega-lite-vocabulary.md); the
  `data.resolution` spelling and direction settle with wiggle's there.

How O/E works is in
[reference/HIC_DECISION_TREE.md](../reference/HIC_DECISION_TREE.md).

## Next

1. **A ratio domain that follows the data again.** The `observed/expected`
   preset pins `[0.25, 4]`, and `maybeNumber` takes no `null`, so a written
   end can return to the preset and never to the loaded values. ADR-238's
   `domain: [min, { quantile }]` answers it, symmetric in log space.
2. **What an absent bin paints on a ratio.** A sparse file lists no zero
   bins, so a depleted cell with no contacts draws as the page, white, which
   on `redblue` reads as "ratio 1". Juicebox leaves it blank too; the
   alternative is the triangle's background in the `unknown` color.
3. **A count filter for noisy ratios.** The pseudocount of 1 tames a ratio of
   two small counts, and Juicebox stops there. ADR-238's
   `filter: [{ field: 'control', gte }]` would let a reader quiet the low-count
   speckle further; Hi-C has no `filter` slot yet.
4. **A treatment-versus-control demo.** The figure compares two cell lines
   (K562 over GM12878, `hic/observed_control`). Cohesin loss (Rao 2017,
   HCT116 RAD21-mAC with and without auxin) is the canonical lost-loops
   picture; check for a copy on a server with range support.

## Traps the reviews found

- The log scale floors at 1 (`scoreScale.slang`), so a ratio domain anchored at
  0 paints 0.5 and 0.01 alike.
- `withPreset` drops a preset whose scale differs from the written one;
  `MatrixRampMixin` fills only `scheme` across scales.
- A control spelling `1` where the map spells `chr1` comes back empty and reads
  as enrichment everywhere; `@gmod/hic` 2.0 dropped aliasing, so
  `controlChromosomes.ts` maps the spellings.
