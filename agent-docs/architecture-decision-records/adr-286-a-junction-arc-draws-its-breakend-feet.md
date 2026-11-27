---
status: Accepted
summary: "A curved arc that says something draws its breakend feet, in the read-connections and junctions bands: outward for a deletion-type junction, inward for a duplication-type, parallel for an inversion. Concordant pairs, read clouds, splice junctions, gap deletions and split insertions draw none. Amends ADR-170"
---

# ADR-286: A junction arc draws its breakend feet

## Status

Accepted (2026-11-23), Colin's call on the COLO829 foldback at
chr3:26,622,430. Amends
[ADR-170](adr-170-the-read-connections-band-is-a-marks-list.md), whose
"Breakend feet stay on interchromosomal arcs" this replaces.

Amended 2026-11-27 by
[ADR-288](adr-288-the-junctions-band-counts-a-deletion-the-reads-carry-as-a-gap.md):
a deletion the reads carry as a gap draws as a junctions-band arc with no feet,
as a splice draws none, since its orientation is never in doubt. The Context's
"there is no fan to crowd" does not hold in a tandem repeat: at HG002 ONT
chr17:43,250,000-43,266,000 (the RNU2 repeat) 139 reads spell one deletion
of about 8 kb as 337 distinct gaps, 101 of them shared by two or more reads, so
it draws as about a hundred arcs. ADR-170's Rejected row on giving every arc its
feet rests on the same premise from the other side ("the fan over a
well-supported junction is already dense"), and there it holds; no feet draw on
that fan, since gap deletions take none. Split junctions keep their feet.

## Context

ADR-170 kept breakend feet to interchromosomal arcs: a same-chromosome arc read
its type from its color, and feet on every arc of a fan over a well-supported
junction would crowd it. On the COLO829 ONT cards the arc over the coverage is
one junction, coalesced from every read that crosses it, so there is no fan to
crowd. Its color names the type only through the key, while two feet pointing
the same way show a foldback without it, the way the breakpoint split view
already draws one.

The arc over the coverage in chain mode is the junctions band's split junction
(ADR-222), not the read-connections band, so the rule has to hold in both.

## Decision

- **A curved arc with a category draws its feet.** In the read-connections band
  that is `ARC_SHAPE_ARC` with `arcPaintRank` 1 (`drawsFeet` in
  `features/arcs/bandFeed.ts`); in the junctions band, a split junction of a
  class other than an insertion (`junctionFeet`).
- **Each foot lies over the arm its junction keeps.** The read-connections band
  takes the first coalesced connection's `p1Dir`/`p2Dir`, now on every
  `ComputedArc` and packed as `arcX1Dirs`/`arcX2Dirs`, safe because the arc's
  color class fixes its orientation. The junctions band reads them off the
  class: deletion-type outward, duplication-type inward, LL both left, RR both
  right.
- **Interchromosomal arcs keep their feet,** as before.

## Rejected

| Option | Why |
| ------ | --- |
| Feet on every arc, concordant pairs included | A short-read pileup is about 50 concordant pairs to one categorized arc (`arcPaintRank`), and each would add two outward feet that say nothing |
| Feet on read-cloud bars | A bar plots a fragment size, not a junction, and already ends in squares |
| Feet on split insertions | Both feet sit on about one base, so they would draw as a bar through the junction |

## Consequences

- A foldback's arc over the coverage ends in two feet pointing the same way,
  checked in a jb2export of COLO829 at chr3:26,621,800-26,623,600.
- `ArcsUploadData` carries two more `Int8Array` lanes per region.
