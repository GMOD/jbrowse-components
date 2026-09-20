---
name: one-zoomed-row-forces-a-genome-wide-fine-fetch
description: A synteny view's tier resolves off the min bpPerPx of both rows, so a whole-genome row against a zoomed-in one fetches the fine PIF tier across the genome. Waste, not wrong output; measure how often real views straddle the threshold before building the per-axis tier, which wants the bidirectional fetch.
---

# One zoomed-in row forces a genome-wide fine fetch

`LinearSyntenyDisplay.lodTier` resolves off `min(bpPerPx)` of the two rows, so
a whole-genome top row against a zoomed-in bottom row fetches the fine tier
across the genome. A follow that zooms one row past the threshold flips the
tier the same way. The wire table in
[reference/SYNTENY_LOD.md](../../reference/SYNTENY_LOD.md) gives the whole-genome
cost per tier on hs1 vs mm39.

A per-axis tier needs the bidirectional fetch
([TWO_AXIS_SYNTENY_FETCH.md](../../reference/TWO_AXIS_SYNTENY_FETCH.md)), so each
row can be served at its own tier and joined on `syntenyId`. Measure on a real
hub file how often the two rows straddle the threshold before building it.
