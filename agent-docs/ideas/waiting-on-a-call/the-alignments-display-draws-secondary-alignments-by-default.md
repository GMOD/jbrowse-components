---
name: the-alignments-display-draws-secondary-alignments-by-default
description: The default read filter keeps secondary alignments, so they count in coverage and fill the pileup; in one HG002 ONT tandem repeat they tripled the apparent depth. Should the default hide them, or stack them below primary reads?
---

# The alignments display draws secondary alignments by default

The display's default `filter` drops unmapped, QC-failed and duplicate reads
(`flags.UNMAP`, `flags.QCFAIL`, `flags.DUP` `equal: false`) and nothing else. A
secondary alignment (flag 0x100) passes, so it counts in the coverage and
takes a pileup row like a primary read. The
junctions band already excludes secondaries from its gap deletions
([ADR-288](../../architecture-decision-records/adr-288-the-junctions-band-counts-a-deletion-the-reads-carry-as-a-gap.md)).
**Filter by** offers dropping them, so a reader who knows to look can.

## The measurement

HG002 ONT at chr17:43,250,000-43,266,000, the RNU2 tandem repeat: 972 of the
1,292 alignments in the window are secondary. The coverage read about 800
where the primary and supplementary records give about 260, and the
secondaries filled the visible rows, so the reads carrying the repeat's 8 kb
deletion as gaps lay below them, out of view at the default track height.

## The call

Which default draws a repeat truthfully without hiding what a secondary says
(that the read also aligns here)?

- **Hide them by default**: add `flags.SECONDARY` `equal: false` to the default
  filter, so coverage and the pileup count primary and supplementary records
  only. A reader asks for them back through **Filter by**.
- **Stack them below primary reads**: keep them drawn but laid out after every
  primary and supplementary record, so the rows a reader sees first are the
  reads' best placements. Whether coverage counts them is then a second call.

Unmeasured: how often a default view outside repeats carries secondaries at
all, on ONT, HiFi and short reads, which says how many views either default
changes.
