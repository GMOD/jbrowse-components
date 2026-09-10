---
name: dark-theme-palette-gaps
description: Three colour sets in packages/core/src/ui/palette.ts resolve to one light value in both themes — `colorNeutralRead`, the modification fills and the categorical tag laps — so a dark track paints light-theme colour under the split-read, modifications and tag schemes. Each is a palette decision rather than a defect, and the same decision three times.
---

# The palette's dark-theme gaps

Every read colour the alignments display uses resolves through the theme except
three sets, all defined once in `packages/core/src/ui/palette.ts` with no `dark`
counterpart. They are one question asked three times — relight the set, or
declare it a brand that stays put and let the surface around it move — so the
answer should be taken once rather than per set.

## `colorNeutralRead`

Moved out of `TODO.md` on 2026-08-26, when the backlog was cut to what v5.0.0
turns on. Every release so far has shipped it.

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

## The modification fills and the categorical tag laps

Left open by the LinearAlignmentsDisplay review that landed on 2026-09-02
(`8e44ed5a78`, `d68391829b`). The review closed every legend gap it found in
the colour modules; this one it kept separate as a palette call.

The modification fills sit in the `modifications` block with no `dark`
counterpart, and the categorical tag palette that `colorTagUtils.ts` hashes
values into is likewise a single lap set relit rather than a per-theme pair. So
a modifications or tag colour scheme paints light-theme colour on a dark track.

What deciding it involves:

- whether the modification colours are a brand — the ML/MM colour conventions
  users recognise from other browsers — that should stay identical in both
  themes with only the read body changing, or a palette to relight;
- the same question for the tag laps, where `colorTagUtils.ts` already relights
  three laps for distinguishability and a dark set would be three more;
- the legend swatches follow whichever answer, since they composite the same
  fills.
