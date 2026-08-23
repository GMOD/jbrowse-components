---
name: the-polyprotein-strand-arrow-sits-at-the-centre-of-the-whole-stack
description: a visual call; the position is measured and the disagreement with the transcript path is the only argument against it
metadata:
  area: canvas, glyphs
  category: visual-call
---

# The polyprotein strand arrow sits at the centre of the whole stack

`glyphEmitters.ts`'s mature-protein `emitStrandArrow` passes
`height: layout.height`, and for `layoutMatureProteinRegion` that is
`rowHeight * numRows` (`matureProteinRegion.ts`, `totalHeight`) — every cleavage
product's row at once. The arrow's y is `topPx + height / 2`
(`emitPrimitives.ts`), so on SARS-CoV-2 ORF1ab it lands about eight rows below
the CDS top. The transcript call two hundred lines up in the same file passes
`transcript.height`, one row.

**Verified**: the arrow is drawn at a fixed pixel size (`STEM_LENGTH_PX`,
`HEAD_HALF_H_PX`), so `height` reaches only `snapBoxCenterYPx` and
`centeredRowVisible`. This is a position bug or nothing, never a size one.

**Not verified: that it is wrong.** An arrow for the whole ORF, centred on the
whole ORF block, is defensible; the case against it is that it disagrees with
the transcript path. Get the visual call before editing. In `below` mode each
product also owns a label row, so the drawn stack is taller than `totalHeight`
and the midpoint is off by more than the arithmetic above suggests.
