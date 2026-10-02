---
name: impg-locus-pangenome-tutorial
description: A tutorial that builds a one-locus pangenome from pairwise alignments with impg (no graph build) and opens its MAF or GFA beside the Minigraph-Cactus graph at the same window.
---

# A one-locus pangenome from impg

A reader with assemblies and their pairwise alignments, but no pangenome graph,
can still get a multiple alignment or a graph of one locus: `impg query` walks
the alignments transitively (`-x`) from a reference interval and writes the
haplotypes it reaches as `-o maf` or `-o gfa`. JBrowse opens both, so the page
would open the result at the CFH deletion beside the HPRC v2.1 graph's gbz-base
lanes, the same window from two independent routes.

The input is HPRC's own alignment set: `hprc25272.aln.paf.gz` (all-vs-all) or
the per-target `impg/pafs/all-vs-1/` split.

What the page must not show is `-o paf`. It returns projections onto the queried
sequence, so on a star alignment a query pairs no two non-reference haplotypes
([HPRC_RELEASE2.md](../../reference/HPRC_RELEASE2.md) §"Measured findings").
Slicing the vs-GRCh38 PAF for a panel of haplotypes was
`build_hprc_cfhr_synteny.sh`, retired because the gbz-base lanes draw the same
window from the graph with no build step.

First move: run `impg query -x -o maf` and `-o gfa` on chr1:196,600,000-197,000,000
against the all-vs-all set, and check that `BgzipMafAdapter` and the graph
plugin open the outputs as written. The all-vs-all holds a direct alignment for
about one pair in five, which is the case `-x` exists for and the thing to
measure: how many haplotypes the transitive query reaches against how many the
graph holds there.
