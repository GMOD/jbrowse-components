---
status: Accepted
summary: "The linear synteny view leaves CIGAR indels as see-through gaps unless `indels.encoding.opacity` is set nonzero: the wedge's shape already says which genome has the sequence, and op colors competed with the ribbon's color channel and painted over the alignments a large gap is made of. The dotplot keeps its indel lines"
---

# ADR-277: A synteny indel is a gap by default

## Status

Accepted (2026-11-18).

## Context

The linear synteny view painted every rendered CIGAR indel in its op color,
deletions `#00f` and insertions `#ff0`. Against hs1→mm39 colored by `query`,
two things went wrong:

- **Two color languages on one channel.** The chromosome palette has its own
  blues and yellows, so a wedge read as another chromosome's ribbon, and the
  1–2 px slivers at chromosome zoom broke up the ribbon a reader follows.
- **A large wedge hid real alignments.** One chrX chain carries
  `209565I 62459961D`. Painted, the deletion is a solid 62 Mbp wedge over hs1
  chrX 51–114M, where the other chrX chains run.

A wedge's shape already says which genome holds the sequence: wide on top and
pointed below is a deletion. The color repeated that on the channel the view
had given to something else.

## Decision

- **An unset `indels.encoding.opacity` leaves each indel a gap in the synteny
  view.** `indelsDrawingOf` takes the view's drawing for an unset opacity: the
  synteny view and its tables pass `'matches'`.
- **Colored indels is opt-in**, written as `{ encoding: { opacity: 1 } }`.
  `indelsOfDrawing('full')` writes that, and the menu lists Transparent indels
  first.
- **The dotplot keeps drawing a lone indel's line.** There the line is the
  alignment's path in its own color; without it, one alignment reads as
  separate diagonals.
- **`executeSyntenyFeaturesAndPositions` defaults `cigarMode` to `'matches'`**,
  so a caller that passes none draws what the view draws.

## Rejected

- **Gaps only while `color` maps a field**, keeping wedges on the red default:
  a default that switches on another setting, and the occlusion is the same on
  red.
- **Wedges in the ribbon's own color**: one color language, but they still
  paint over the alignments behind a large gap.

## Consequences

- A gap has no tooltip, as ADR-275's unaligned stretch has none.
- Every walked feature is tiled. A feature with N rendered indels draws about
  N+1 match tiles where colored mode drew one base and N wedges, so the
  instance count is unchanged. Since ADR-275, colored mode already tiled every
  feature holding a paired gap.
- Sessions that never set `indels` now open with gaps. One that chose Colored
  indels before this wrote no opacity and reads as gaps too.
- ADR-275's pairing still decides Colored mode and the dotplot, and it pairs a
  D with the wrong I when a sub-pixel partner sits between them:
  `ideas/ready/cigar-indel-pairing-follows-the-cigar-not-pixels.md`.
