# HPRC release 2 zoom-out tier

The `summaryAdapter` file for the HPRC release 2 pangenome alignment — one row
per haplotype per aligned run, with a percent-identity score and no sequence. It
is what makes a zoomed-out view of the alignment possible at all: without it the
track has only the too-large prompt past a gene.

**Hosted, not committed** —
`https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.summary.bed.gz` and its
`.tbi`, which `test_data/hprc_maf_summary.json` points at. 1.63 MB, 375,888
rows, 464 haplotypes, whole genome. Rebuild it with
`scripts/build_hprc_maf_summary.sh`, whose header carries the three failure
modes worth knowing before touching it.

What it is worth, read off the live session model rather than inferred from a
picture (`agent-docs/reference/HPRC_RELEASE2.md` § "What the zoom-out tier is
worth"): whole chr6 goes from "Requested too much data (354 Mb)" and 0 rows, to
464 rows drawn from a 250 kB read. A whole-chromosome read costs 828 bytes
(chrM) to 127 kB (chr1) against a 5 MB budget.

152 of the index's 195 contigs. The 43 absent are all `chrUn_*` unplaced
scaffolds of 970 bp - 15 kb, each with a single `.tai` entry, which taffy cannot
extract by region; every primary chromosome is present.
