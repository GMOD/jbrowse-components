---
name: what-colour-is-an-arc-with-no-pair-orientation
description: a pair with no orientation is the deliberate neutral grey to the read fills and falls to `pairLR` on the arcs, so one meaning gets two greys and two legend rows — the last meaning still split between the two classifiers, and closing it is a visual choice between giving the arcs a `nonSplit` slot and dropping the distinction on the read side
---

# What colour is an arc with no pair orientation

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Two greys where there should be one, in a legend that has
carried both for every release so far.

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
