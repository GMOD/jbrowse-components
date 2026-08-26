---
name: give-colorneutralread-a-dark-variant-or-fold-it-into-colorpairlr
description: `colorNeutralRead` #c8c8c8 has no dark override and reads 11.2 against the dark theme's paper — brighter than the value that was darkened for painting glaring near-white blocks — and it backs the majority of a pileup under the split-read scheme. Two near-identical light neutrals is what makes it a decision rather than a patch.
---

# Give colorNeutralRead a dark variant, or fold it into colorPairLR

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Every release so far has shipped it, and the fix is a
palette decision rather than a defect to close.

`colorNeutralRead` #c8c8c8 has no dark override, and it reads **11.2** against
the dark theme's #121212 — brighter than `colorPairLR` #d3d3d3 was (12.5) before
`colorPairLRDark` #8a8a8a was added to stop it painting "glaring near-white
blocks". It is not a rare slot: `swatchPaletteKeys` backs `nonSplit` with it,
which is the majority of a pileup under the split-read scheme, plus
`mapqUnavailable` and the sashimi arcs of an unstranded RNA-seq library.

Someone has already hit this and fixed only their own path.
`LinearAlignmentsDisplay/readTagColors.ts` moved its untagged-read case off this
value and onto the themed `colorPairLR` — "being a fixed light grey it painted
untagged reads BRIGHTER than ordinary reads under the dark theme, where
colorPairLR darkens and colorNeutralRead does not". The general case is still
there.

**The reason this is a decision and not a patch** is that the two values are
dE **3.95** apart, so the palette carries two near-identical light neutrals
serving the same role in different schemes — this one for `noStrand` / `nonSplit`
/ `mapqUnavailable`, `colorPairLR` for `normalInsert` / `noTagValue` / `plain`.
Adding a dark variant makes two neutrals theme-correct; folding leaves one. The
second is the smaller palette and the bigger change, since the legend labels the
categories separately and a fold makes two swatch rows the same colour.
