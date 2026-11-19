---
name: cigar-indel-pairing-follows-the-cigar-not-pixels
description: visitCigarPairedIndelSegments pairs rendered segments greedily, so a sub-pixel partner lets a D pair with the next gap's I and leaves a 62 Mbp deletion lone in Colored mode and the dotplot. Pair adjacent D/I ops in the CIGAR instead, and keep the coarse fold from splitting a pair.
---

# CIGAR indel pairing follows the CIGAR, not pixels

[ADR-275](../../architecture-decision-records/adr-275-a-deletion-meeting-an-insertion-is-drawn-as-a-gap.md)
pairs a D and an I only when both are rendered segments, and
`visitCigarPairedIndelSegments` bridges sub-pixel match segments between them.
A liftOver chain writes each double-sided gap as an adjacent `xI yD`, but when
one side is under a pixel the walk never sees it as an indel.

The hosted `hs1ToMm39.over.chain.pif.gz` chain over hs1 chrX 36.9–153.5M holds:

```
21851I 4470494D   ~31 kb of M   209565I 62459961D
```

At 95 / 84 kb/px the 21851I is sub-pixel, so the 4.47 Mbp D is pending when the
sub-pixel matches bridge to the 209565I, and they pair. The 62 Mbp D is left
lone. At 1.8 Mb/px every one of that chain's four >1 Mbp gaps draws lone. Over
the whole chain file, 650 of the 662 gaps of 100 kb or more have both sides
nonzero.

Since [ADR-277](../../architecture-decision-records/adr-277-a-synteny-indel-is-a-gap-by-default.md)
the synteny default draws a lone indel and a pair alike, as see-through, so
this shows in Colored indels mode (a blue wedge) and in the dotplot (a 62 Mbp
horizontal line).

## Proposal

- Treat a maximal run of adjacent D and I ops as one segment in
  `visitCigarRenderedSegments`: unaligned when it holds both, rendered when
  either side reaches a pixel.
- Keep the coarse fold (`coarseCigar.ts`) from folding the partner of a kept
  indel into the neighbouring run, or the coarse tier still draws the lone D
  the fine tier pairs; that changes the hosted PIFs' `cr:Z:` and needs them
  rebuilt.
- Pin it with this op sequence at both zooms, fine and coarse.
