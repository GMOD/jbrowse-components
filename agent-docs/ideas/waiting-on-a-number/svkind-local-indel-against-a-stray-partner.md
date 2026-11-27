---
name: svkind-local-indel-against-a-stray-partner
description: A long read with an SV-size CIGAR indel and a stray supplementary on another chromosome files under "Partner elsewhere", against ADR-258's "a local event outranks a partner elsewhere". Count partner-band reads with an SV-size indel at a known translocation first.
---

# svKind: a local indel against a stray partner

`svKindOf` (`plugins/alignments/src/shared/svKind.ts`) files a read by its split
class first and falls back to `evidenceKind` only when there is none. So a HiFi
or ONT primary with `500M2000D500M300S` and an SA piece at MAPQ 30 on another
contig files `elsewhere`, though its own CIGAR holds a 2 kb deletion.
[ADR-258](../../architecture-decision-records/adr-258-sv-channels-band-reads-by-the-sv-their-evidence-points-at.md)
ranks a local event over a partner elsewhere, but applies the rank among
junctions only. Band and arc agree today: a CIGAR deletion draws no read arc, and
the junction draws a tick.

## The fix that survived review

Keep a local split class as it is. Only when the split class is `elsewhere` or
absent, take the higher-ranked of it and `evidenceKind`'s answer, gating the
pair kind on `!(bits & READ_MATE_UNPLACED)`. Extend ADR-258's precedence
sentence to the record's own indels and pair.

Ranking every kind by `SV_KIND_PRECEDENCE` is wrong: a split insertion with an
unrelated CIGAR deletion would move to `deletionType` (the direction the
2026-11-09 amendment took and dropped), a pair kind would compete with a local
junction, and a MAPQ-0 mate would outrank an indel.

## The number that decides it

On HG002 ONT, 20:10-11 Mb, 383 of 3,409 placed records (11.2%) carry a CIGAR
indel of 50 bp or more. Of 90 records whose only placed SA piece is on another
chromosome, 8 carry one, so the fix would move 8.9% of the partner band into
indel bands. At a real translocation the supporting reads would leave their
band at about that background indel rate.

Count, at a known long-read translocation, the share of partner-band reads with
`READ_SV_INDEL`, against the share of a known deletion's reads carrying a stray
supplementary. HiFi is unmeasured.
