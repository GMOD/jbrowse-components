---
name: hic-baselines
description: "Hi-C ratios against a baseline. Landed: observed/expected as a color field (@gmod/hic 2.1.0's getExpectedValues, checked against straw) and the groundwork. Open: observed/control, a ratio domain that can follow the data again, and what an absent bin paints. Read before touching plugins/hic, the LD color plumbing or @gmod/hic's footer reader."
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
3. **`observed/control`**:
   - a `control` sub-adapter on `HicAdapter` (GWAS `ldAdapter` is the
     precedent);
   - refName aliasing, a chromosome-size check, and the intersection of
     binsizes and normalizations;
   - `@gmod/hic` reporting which bins its normalization vector masks, since
     it drops a masked bin exactly as it omits an empty one (`hicFile.ts`),
     and a masked control bin would otherwise read as a huge ratio;
   - an outer join by row bucketing (~0.4 s at 4.3M x 4.3M, a JS Map 3-5 s)
     so lost loops draw;
   - Juicebox's depth rule `(a/avgA)/(b/avgB)` with a pseudocount (check
     whether `avg` from raw `sumCounts` biases KR counts);
   - a default count filter on observed + control, a "Compare with track..."
     menu item, and the cohesin-loss tutorial (Rao 2017 HCT116 RAD21-mAC
     with and without auxin; check hosting with range support).

## Traps the reviews found

- The log scale floors at 1 (`scoreScale.slang`), so a ratio domain anchored at
  0 paints 0.5 and 0.01 alike.
- `withPreset` drops a preset whose scale differs from the written one;
  `MatrixRampMixin` fills only `scheme` across scales.
- A control spelling `1` where the primary spells `chr1` comes back empty and
  reads as enrichment everywhere; `@gmod/hic` 2.0 dropped aliasing.
