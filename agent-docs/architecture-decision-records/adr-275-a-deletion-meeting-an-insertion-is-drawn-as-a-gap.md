---
status: Accepted
summary: "A rendered deletion meeting a rendered insertion is drawn as a gap: `visitCigarPairedIndelSegments` reports it as one `CIGAR_UNALIGNED` segment, colored synteny mode tiles a feature that has one, and the dotplot draws no line for it. A replacement plus a net indel was rejected"
---

# ADR-275: A deletion meeting an insertion is drawn as a gap

## Status

Accepted (2026-11-18).

## Context

A CIGAR spells a stretch that aligns to nothing on either side as a deletion
beside an insertion: `6106D 6511I`, often with a base or two of match between.
A liftOver chain writes every double-sided gap that way, and the hosted
hg38→panTro6 PIF carries thousands of pairs with both sides over 2 kb on chr1
alone. `visitCigarRenderedSegments` reports the two separately, so colored
indels painted a deletion wedge and an insertion wedge that together filled
the pair's trapezoid in both indel colors, reading as two events where the
alignment records one unaligned stretch.

## Decision

- **`visitCigarPairedIndelSegments` (`@jbrowse/cigar-utils`) wraps the
  rendered walk** and reports a D and an I (either order) that arrive as
  consecutive rendered segments as one `CIGAR_UNALIGNED` segment spanning
  both. A sub-pixel match between them pairs too; a rendered one does not.
  `CIGAR_N` is never paired.
- **Nothing is drawn for it, in either mode.** Its top edge is the one side's
  unaligned stretch and its bottom edge the other's, so the gap's shape shows
  both lengths without placing a net indel anywhere.
- **Colored mode tiles a feature whose walk has one.** The full-span base
  would paint the gap as aligned, so `buildSyntenyGeometry` buffers a
  feature's segments, and lays down match tiles instead of the base when an
  unaligned segment is among them, the way transparent mode always does. The
  CIGAR is still walked once.
- **No location marker lands in it.** A tick needs a correspondence, and the
  stretch has none.
- **The dotplot draws no line for it either.** It drew a pair as an L-step,
  a long horizontal then a long vertical line through a stretch where nothing
  corresponds; the flanking matches land in the same places without it. A
  lone indel still draws as its line.
- **The multiway view keeps the plain walk**, since it already leaves both
  halves unpainted.

## Rejected

- **A replacement plus the net indel**: the shorter length drawn as a match on
  both axes and the difference as one wedge. It painted unaligned sequence as
  aligned, put the net wedge at a position the CIGAR does not give, and its
  tooltip reported a length no op has.

## Consequences

- Synteny shot on ada against the hg38→panTro6 chain at hg38 chr1:69,663,705 (an
  L1MA3/L1PA7 swap, 6,106 D beside 6,511 I) and chr1:91,000,680 (4,374 D
  beside 10,559 I).
- A gap has no instance, so it shows no tooltip, as a transparent-mode indel
  never has.
