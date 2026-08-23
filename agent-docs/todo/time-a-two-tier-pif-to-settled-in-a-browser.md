---
name: time-a-two-tier-pif-to-settled-in-a-browser
description: bytes are measured; what is left wants the app and the ready gate
metadata:
  area: synteny, PIF
  category: measure-first
---

# Time a two-tier PIF to settled, in a browser

The v5.0.0 draft carried a two-tier benchmark table nothing in-repo backed, so
the paragraph came out. **The bytes half is now taken** —
[measurements/pif-tier-wire-bytes.json](../measurements/pif-tier-wire-bytes.json)
(`bench`), one whole-genome pass over the hosted hs1-vs-mm39 PIF with the bytes
counted by the server the adapter fetches from. What is left is the half a
stopwatch answers.

Do **not** repeat the reasoning that wrote this off. The removed caption named a
UCSC liftOver chain, and the objection was that `ChainAdapter` declares no
tiering slot while `make-pif` takes PAF — but a chain is a *source format*, not
the adapter: `chain2paf` then `make-pif` gives a two-tier PIF that loads through
`PairwiseIndexedPAFAdapter`, which does declare the slot.
`~/data/hs1ToMm39/hs1ToMm39.over.chain.pif.gz` is one, and
[reference/HOSTING.md](../reference/HOSTING.md) has recorded the hosted copy as
two-tier since 2026-08-02.

What is still owed:

- **Time to settled**, using the same `data-app-phase="ready"` gate the figure
  captures use, so it is the number a reader experiences rather than a fetch
  timing. The measurement above deliberately publishes no wall-clock: served
  over loopback it is parse time, and it moved 27% between two runs of one arm.
- **The zoomed-in view**, where the fine tier is what should be served and the
  coarse tier's advantage ought to vanish. Only whole-genome is measured, and a
  release note claiming a win needs the case where there isn't one.
- **The crossing cost**: zooming across `coarseBpPerPxThreshold` refetches, and
  on a single-tier file it refetches identical bytes — see
  [ideas/single-tier-pif-refetches-at-the-threshold.md](../ideas/single-tier-pif-refetches-at-the-threshold.md).

Land it as a `measurements/` record with a `repro`, so the next release note
quotes it through the generator rather than retyping it.
