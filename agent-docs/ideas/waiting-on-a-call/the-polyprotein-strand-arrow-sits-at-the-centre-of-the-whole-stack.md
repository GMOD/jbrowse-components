---
name: the-polyprotein-strand-arrow-sits-at-the-centre-of-the-whole-stack
description: a visual call on where a strand arrow sits; the polyprotein's position is measured and disagrees with the transcript path, and a childless isoform row draws none
---

# The polyprotein strand arrow sits at the centre of the whole stack

Moved out of [TODO.md](../../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Verified as a position and not a size, and NOT verified
as wrong — an arrow for the whole ORF centred on the whole ORF block is
defensible.

`glyphEmitters.ts`'s mature-protein `emitStrandArrow` passes
`height: layout.height`, and for `layoutMatureProteinRegion` that is
`rowHeight * numRows` (`matureProteinRegion.ts`, `totalHeight`) — every cleavage
product's row at once. The arrow's y is `topPx + height / 2`
(`emitPrimitives.ts`), so on SARS-CoV-2 ORF1ab it lands about eight rows below
the CDS top. The transcript call two hundred lines up in the same file passes
`transcript.height`, one row.

**Verified**: the arrow is drawn at a fixed pixel size (`ARROW_LENGTH_PX`,
`HEAD_HALF_H_PX`), so `height` reaches only `snapBoxCenterYPx` and
`centeredRowVisible`. This is a position bug or nothing, never a size one.

**Not verified: that it is wrong.** An arrow for the whole ORF, centred on the
whole ORF block, is defensible; the case against it is that it disagrees with
the transcript path. Get the visual call before editing. In `below` mode each
product also owns a label row, so the drawn stack is taller than `totalHeight`
and the midpoint is off by more than the arithmetic above suggests.

## A childless isoform row draws no strand arrow

A gene stacked as isoforms where one child has no children of its own, such as
`[mRNA with exons, lnc_RNA with no children]`, draws the childless row with no
direction. `findGlyph.ts` falls through to `layoutBox` for it (the final return
after the subfeature checks). `emitBox` in `collect/glyphEmitters.ts` emits a
strand arrow only `if (isRoot)`, and a child is never the root. The enclosing
Subfeatures container (`emitSubfeaturesGlyph`) draws none, so nothing on the row
says which way the lnc_RNA runs. The comment above `processMatureProteinLayout`
describes the same gap for a nested polyprotein CDS, which that function closes
by drawing its arrow unconditionally.

The fix shape: `emitBox` emits `emitTopLevelStrandArrow` for a child whose layout
is an isoform-stack row, as well as for the root. A plain leaf child of a gene
(an exon-less `CDS` or `five_prime_UTR` box) must not gain one, so the
condition has to name the isoform-stack row rather than "any non-root box".

Not verified: how it looks. An arrow on a box row that has no exon structure
beside transcripts drawn with exons and introns may read as a different kind of
feature, and the arrow sits mid-box where the transcript path draws it on the
intron line. Get the visual call, together with the polyprotein one above,
before editing.
