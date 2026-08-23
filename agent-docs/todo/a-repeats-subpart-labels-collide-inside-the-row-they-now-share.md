---
name: a-repeats-subpart-labels-collide-inside-the-row-they-now-share
description: the row is reserved now; decide whether the one-row design survives
metadata:
  area: canvas
  category: ready
---

# A repeat's subpart labels collide inside the row they now share

`layoutRepeatRegion` reserves the shared label row now (`sharedChildLabelRows`,
2026-08-22), so nothing overflows into the feature below — what is left is
legibility *inside* that row, and on a real EDTA-style intact retrotransposon it
is bad. Measured on the fixture in `belowLabelRows.test.ts`: four of the five
subpart labels sit at exactly y=10, and the internal `*_retrotransposon` body is
the only one offset, by 1.75px, because `centerShrink(…, 0.65)` ends its box at
8.25.

Each label is pinned to its OWN span's left edge by `computeLabelLeftPx` and no
decimation runs among siblings sharing a row, so "TSD-left" (x=100, 40px wide)
runs straight over "LTR-left" (x=105), and "Copia-internal" (x=105, y=8.25) lands
on top of "LTR-left" (x=105, y=10). Side-by-side subparts are fine by
construction; the internal span, which *contains* the LTRs, is the one that
cannot share a row with them.

**First move: decide whether the one-row design survives.** The repeat glyph puts
every subpart on one row deliberately — that is what makes a repeat one row tall
instead of five. Horizontal collision resolution among one feature's subparts
keeps that and is mechanical (drop a label whose box overlaps a sibling's, the
way the display already drops labels that do not fit a block). Stacking
non-adjacent subparts onto their own rows reads better and gives the design up,
so it is the call, not the implementation, that is open.

Not an overflow bug and not a regression: all of it stays inside the row the
reservation buys, and `belowLabelRows.test.ts` pins that boundary.
