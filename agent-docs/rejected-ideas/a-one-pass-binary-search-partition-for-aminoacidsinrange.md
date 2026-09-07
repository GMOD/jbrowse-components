---
name: a-one-pass-binary-search-partition-for-aminoacidsinrange
description: A one-pass binary-search partition for `aminoAcidsInRange`
area: performance-and-measurement
---

# A one-pass binary-search partition for `aminoAcidsInRange`

proposed
2026-08-20 and declined, because the disjointness it needs is not true of the
data. `aminoAcidsInRange` filters the whole residue list once per cleavage
product, so a SARS-CoV-2 ORF1ab (~16 products, ~7,100 residues) costs ~114k
comparisons to make ~7,100 assignments. Replacing it with one pass over the
residues plus a binary search into the product ranges measured **2.27ms ->
0.43ms** on that shape.

It is wrong. Mature protein regions **overlap**: a precursor and the products
it is cleaved into are both annotated as siblings, so one residue belongs to
several of them. `collectRenderData.test.ts` §"shows residues independently
for an overlapping precursor and its products" is the enterovirus case — VP0
spans VP4 and VP2 — and it goes red immediately, because a search that returns
the one containing range gives VP0 nothing.

Note also that the residue list cannot be searched directly whatever the
ranges do: it arrives in transcription order, which is `startBp` DESCENDING on
the minus strand.

An overlap-aware version is still O(products x residues) in the worst case and
keeps the same per-residue work, so it buys little of the 1.8ms. Left alone.
