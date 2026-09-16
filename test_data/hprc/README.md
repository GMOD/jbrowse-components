# HPRC release 2 zoom-out tier

The `summaryAdapter` file for the HPRC release 2 pangenome alignment — one row
per haplotype per aligned run, with a percent-identity score and no sequence. It
is what makes a zoomed-out view of the alignment possible at all: without it the
track has only the too-large prompt past a gene.

**Hosted, not committed** —
`https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.summary.bed.gz` and its
`.tbi`, which `test_data/hprc_maf_summary.json` points at. 1.72 MB, 396,363
rows, 464 haplotypes, whole genome. Rebuild it with
`scripts/build_hprc_maf_summary.sh`, whose header carries the failure mode worth
knowing before touching it.

What it is worth (`agent-docs/reference/HPRC_RELEASE2.md` § "What the zoom-out
tier is worth"): whole chr6 goes from 3.19 GB refused to 464 rows drawn from a
150 kB read. A whole-chromosome read costs 73 kB (chrM) to 212 kB (chr1) against
a 5 MB budget.

All 195 contigs. The v2.0 build of this file had 152: the 43 missing were
`chrUn_*` unplaced scaffolds of 970 bp - 15 kb, each with a single `.tai` entry,
which taffy could not extract by region. The build reads sequentially now and
addresses nothing, so they come through.
