---
status: Accepted
summary: "A rendered CIGAR indel is a segment of its own: `visitCigarRenderedSegments` emits the sub-pixel ops accumulated ahead of it as a match first, so an indel never absorbs the matches before it. The pixel arm of both emission bounds doubles"
---

# ADR-276: A rendered indel is a segment of its own

## Status

Accepted (2026-11-18). Settles the parked idea "a merged CIGAR segment is
labelled by its last op".

## Context

`visitCigarRenderedSegments` accumulates ops until a segment clears a pixel on
either axis and labels the whole segment after the op that closed it. Sub-pixel
matches ahead of a rendered indel were therefore labelled as that indel: the
colored wedge read up to a pixel wider than the indel, and transparent mode,
which leaves indels see-through, dropped the matches. Where matches are
consistently sub-pixel and indels are not, as at a repeat expansion, every
segment was an indel: 50 bp matches alternating with 150 bp deletions at
100 bp/px drew no match tile at all in transparent mode.

ADR-275 made the label decide pairing too. A segment that was mostly matches
but closed on an insertion paired with the deletion before it, and the gap was
drawn over aligned bases. Over 1,000 random CIGARs at 1x, 1.7x and 5x the
`--coarse` bound, the fine CIGAR and its coarse fold disagreed on the rendered
indels and pairs in 68 of 18,000 walks for that reason.

## Decision

- **An indel at least `MIN_INDEL_PX` on its own axis first emits whatever
  accumulated ahead of it as `CIGAR_M`, then itself.** It always closes its own
  segment, including at exactly one pixel, where it used to keep accumulating.
- **The pixel arm of both emission bounds doubles**:
  `min(ops, 2 * ceil(widthPx0 + widthPx1) + 4)` in `buildSyntenyGeometry`'s
  `cigarBudget` and the dotplot's `segmentCapacity`. A normal flush advances
  over a pixel and a rendered indel at least one, and the extra match flush is
  at most one per rendered indel; the op arm still holds, since the flush and
  the indel together consume at least two ops. A 1 bp match before every
  exactly-one-pixel indel overflows the old bound, and
  `cigarRenderedSegments.random.test.ts` keeps that shape.
- **Every segment that is not a rendered indel is reported as `CIGAR_M`**,
  whichever op closed it. No consumer distinguishes =, X or a run from M, and
  labelling by the closing op was the same mislabel for them.
- **`visitCigarPairedIndelSegments` pairs across match segments while the
  lesser of their two advances is at most a pixel on the finer axis.** Matched
  bases advance both axes by the same bp, so such segments hold under a pixel
  of matches on either axis, whatever sub-pixel indels they also carry. A rule
  of "at most a pixel on either axis" hid 900 bp of match, 90 px, between a
  pair viewed at 1,000 and 10 bp/px. `5000D 3M 5000I` and
  `5000D 3M 9D 3M 9D 5000I` at 10 bp/px still draw as one gap.
- **The fine and coarse tiers now agree** on rendered indels and pairs over
  the 6,000 walks `cigarRenderedSegments.random.test.ts` takes, where the
  previous walk disagreed on 23. `buildSyntenyGeometry.cigarMode.test.ts` and
  `dotplotCigarDetail.test.ts` pin the two callers' bounds: with the old
  synteny bound, 900 one-pixel deletions behind 2 bp of match kept 455.

## Consequences

- The doubled bound reserves more only where the pixel arm binds, a feature
  with more ops than pixels, and is transferred across the RPC as `subarray`
  views.
- A segment closed by a sub-pixel indel run can still exceed a pixel while
  labelled `CIGAR_M`; every op in it was individually sub-pixel.
- The hover tooltip on an indel reports the indel's own length rather than
  the merged span.
