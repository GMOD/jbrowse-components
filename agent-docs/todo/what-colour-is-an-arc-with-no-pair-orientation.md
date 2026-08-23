---
name: what-colour-is-an-arc-with-no-pair-orientation
description: a visual call, then one of two edits
metadata:
  area: alignments
  category: visual-call
---

# What colour is an arc with no pair orientation

The last meaning still split between the read fills and the arc overlay. A pair
with `po === 0` is `nonSplit` to the reads — deliberately the neutral grey,
"distinct from the strand-colored split segments" — and the arcs have no such
slot, so they fall to their baseline, `pairLR`. `swatchPaletteKeys` maps those
to `colorNeutralRead` (`#c8c8c8`, `palette.ts:385`) and `colorPairLR`
(`#d3d3d3`, `palette.ts:353`): two greys, not the same grey, and two legend rows
for one thing. Pinned by the last `describe` in
`shaders/overlayPaletteParity.test.ts:142`.

Two ways to close it, and the choice is visual rather than structural:

- **Give the arcs a `nonSplit` slot.** Correct, and the wider change: the Slang
  `arcColor` uniform grows by one entry, `ARC_SLOT_CATEGORY` gains a row, and
  the shader's own CI job covers it. An unknown-orientation arc then draws the
  same grey as the read under it.
- **Stop distinguishing it on the read side.** Smaller, and gives up a
  distinction the read fills document as deliberate.

Everything else these two classifiers once disagreed about now derives from one
table, so this is the whole of what is left.
