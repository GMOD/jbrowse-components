---
name: produce-and-host-the-hprc-summary-tier
description: the tier is built and hosted and worth 3.19 GB refused against 150 kB drawn; what is left is an upstream report to `maf2bed` about the overlap collapse, and the decision that stops it being switched on for `hprc_maf.json` — whether the summary tier swaps on span or on cost
---

# Produce and host the HPRC summary tier

Moved out of [TODO.md](../../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The build and the hosting shipped; the remainder is an
upstream report and a design question.

**Done, whole genome, hosted** —
`jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.summary.bed.gz` (1.72 MB, 396,363
rows, 464 haplotypes, all 195 contigs), rebuilt from the v2.1 MAF on 2026-09-16,
wired by `test_data/hprc_maf_summary.json` and rebuilt by
`scripts/build_hprc_maf_summary.sh`. Worth 3.19 GB refused against 150 kB drawn
on whole chr6, and a whole-chromosome read costs 73 kB to 212 kB against a 5 MB
budget ([reference/HPRC_RELEASE2.md](../../reference/HPRC_RELEASE2.md) §"What the
zoom-out tier is worth"). What is left is one decision and one upstream report.

**Report the overlap collapse to `maf2bed`.** `--summary` emits a haplotype's
overlapping runs separately, and `--merge-gap` structurally cannot reach them —
measured, 500 to 50,000 removes 0.04% of the rows. Collapsing them into their
union is a 28x reduction genome-wide and 69x on chr14, losslessly for what the
slot feeds. The build script carries the workaround; the producer should do it.

**Decide whether the summary tier swaps on span or on cost**, which is what stops
the tier being switched on for `hprc_maf.json` itself. It swaps at 20 kb, and the
tutorial's own figure is drawn at 83 kb, so wiring the summary there silently
replaces the per-haplotype base rows the figure exists to show — for a detail
read of 3.50 MB against a 5 MB budget. The gap is the one
[reference/MAF_LARGE_BLOCKS.md](../../reference/MAF_LARGE_BLOCKS.md) §"What the LOD
lesson actually points at" predicted; HPRC_RELEASE2.md says why it is a design
question rather than a one-liner.
