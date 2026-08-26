---
name: produce-and-host-the-hprc-summary-tier
description: built and hosted; report the overlap collapse upstream, then decide span vs cost
metadata:
  area: MAF, pangenome
  category: ready
---

# Produce and host the HPRC summary tier

**Done, whole genome, hosted** —
`jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.summary.bed.gz` (1.63 MB, 375,888
rows, 464 haplotypes, 152 of 195 contigs, every primary present), wired by
`test_data/hprc_maf_summary.json` and rebuilt by
`scripts/build_hprc_maf_summary.sh`. Worth 354 Mb refused against 250 kB drawn on
whole chr6, and a whole-chromosome read costs 828 bytes to 127 kB against a 5 MB
budget ([reference/HPRC_RELEASE2.md](../reference/HPRC_RELEASE2.md) §"What the
zoom-out tier is worth"). What is left is one decision and one upstream report.

**Report the overlap collapse to `maf2bed`.** `--summary` emits a haplotype's
overlapping runs separately, and `--merge-gap` structurally cannot reach them —
measured, 500 to 50,000 removes 0.04% of the rows. Collapsing them into their
union is a 13x reduction genome-wide and 69x on chr14, losslessly for what the
slot feeds. The build script carries the workaround; the producer should do it.

**Decide whether `showSummary` swaps on span or on cost**, which is what stops
the tier being switched on for `hprc_maf.json` itself. It swaps at 20 kb, and the
tutorial's own figure is drawn at 83 kb, so wiring the summary there silently
replaces the per-haplotype base rows the figure exists to show — for a detail
read of ~1.2 MB against a 5 Mb budget. The gap is the one
[reference/MAF_LARGE_BLOCKS.md](../reference/MAF_LARGE_BLOCKS.md) §"What the LOD
lesson actually points at" predicted; HPRC_RELEASE2.md says why it is a design
question rather than a one-liner.
