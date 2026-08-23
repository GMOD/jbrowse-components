---
title: Structural variants (1000 Genomes)
sidebar_label: SVs (1000 Genomes)
description:
  Read one whole-gene deletion across the 1000 Genomes cohort, then check the
  genotypes against the reads that produced them
guide_category: Tutorials
tutorial_category: Structural variation
data: hosted
---

**TL;DR:** take one whole-gene deletion out of the 1000 Genomes ensemble SV
callset, sort the cohort's genotypes at it, then open three of those samples'
reads and watch the coverage go to zero, halve, and stay flat.

## Prerequisites

- nothing to install: the demo instance already carries the callset and the
  alignments

## The 1000 Genomes SV callset

The [1000 Genomes Project](https://www.internationalgenome.org/) sequenced
genomes from 2,504 individuals across 26 populations. The 2022 high-coverage
re-analysis produced a comprehensive SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004)) that
includes deletions, insertions, inversions, and translocations with per-sample
genotypes across all 3,202 individuals.

`HGSV_1821` is a deletion on chr1 whose span contains the whole of _RHD_, so the
samples called homozygous here carry no copy of that gene. Deleting _RHD_ is the
most common cause of the RhD-negative blood type; inactivating variants and
RHD-CE hybrid genes produce it too.

The call is `PASS` and common enough in the cohort to fill all three genotype
classes, and read depth settles whether a gene is present twice, once, or not at
all.

The tracks are added with the usual `jbrowse add-track` workflow. The callset is
bgzip-compressed and tabix-indexed, and the alignment tracks stream the
published high-coverage CRAMs directly from the 1000 Genomes FTP.

In the track selector, enable the 1KGP 2022 Illumina ensemble SV callset under
**1000 Genomes → SV callsets**, <!-- menu-path-ok --> listed by its file name
**1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf**, then navigate to
`chr1:25,200,000-25,400,000`, the window the figures below use.

Everything below works the same in [JBrowse Desktop](/docs/quickstart_desktop),
which opens your own VCF and BAM files from disk.

## Genotypes across the cohort

Switch the track to the **Multi-sample variant display (regular)** from the
track menu. Each sample becomes a row, drawn at the variant's real genomic span,
so the deletion is a wide block rather than a tick. Clicking it opens the
feature details panel, whose **SAMPLES** section lists every sample with its
genotype, read depth, and other per-sample fields.

Rows arrive in the callset's own order. Right-click the deletion and pick **Sort
by genotype**: rows order by their genotype at that call first, then by how far
each row keeps matching the rows to either side of it. The three classes
separate into three contiguous bands. The track menu's **Clustering → Cluster
rows by genotype...** keys every row on the whole window and draws the
dendrogram it built.

Dark blue is a sample with no copy of _RHD_, light blue one copy, grey two, and
the olive stripe running through the block is a separate nested call.

A matrix cell says a sample carries something at that column, not which call it
carries, and a good many records overlap in this window. Loading the same VCF a
second time in the ordinary variant display puts each of them on its own row
with its id, class and size, so a band in the matrix reads off a named record.
Cell coloring by **SV type** is the other way to ask that question, shown in the
[multi-variant track guide](/docs/user_guides/multivariant_track).

Three lanes read below, over NCBI RefSeq genes:

- the callset as a genotype matrix, one row per sample, sorted by genotype at
  the _RHD_ deletion
- the same records drawn ordinarily and colored by SV class, so a band in the
  matrix reads off a named record
- QuicK-mer2 copy number for 2504 individuals, one row each and clustered on
  this window, where blue is a copy lost against the diploid white and red a
  copy gained

The olive no-call column is a copy-number gain in the lane beneath it.

<Figure caption="The 1KGP ensemble SV callset over the RHD locus on chr1, with the panel's sequencing depth under it. The deletion draws as a wide block, splitting the cohort into three bands in the matrix and three levels in the depth." src="/img/multisv_rhd.png" />

<Video src="/media/sv/multisample_sort.mp4" caption="Both arrangements the section names, on the callset the figure above is of: a right-click on the deletion sorts the cohort by its genotype there and the callset order resolves into three bands, then the track menu's clustering re-keys the same rows on the whole window and draws the tree it built." />

The olive stripe is `HGSV_1823`, a small copy-number record sitting inside the
deletion, and most of the cohort is uncalled for it. The display gives a no-call
its own color, since a no-call is the caller declining to answer. In the record
lane the same column is a copy-number call.

A genotype is a caller's discrete verdict per record, so a record the caller
declined leaves a hole; copy number is one continuous quantity per bin per
individual, taken from the reads, so the column that is olive above is red
below. The [copy-number tutorial](/docs/tutorials/population_cnv) is where that
lane comes from, and it is the same store.

## Reading the genotypes off the reads

The genotypes are the caller's answer, and the reads it read are in the demo
too, so every row of the block above can be checked against them.

Open three samples' alignments from **1000 Genomes → Alignments**, one per
genotype: HG00113 called homozygous alt, HG00096 heterozygous, HG00097
homozygous reference. Two settings make them comparable:

- Turn the pileup off from the track menu's **Show...** submenu, since at this
  width the individual reads are a solid mass and it is the coverage curve that
  carries the comparison.
- Set an explicit **Set min/max score...** on each, so the three coverage lanes
  share one axis.

<Figure caption="The RHD deletion across three genotypes, coverage pinned to one shared axis, the banded span RHD itself. Top, HG00113 with no copy; middle, HG00096 with one; bottom, HG00097 with two." src="/img/multisv_rhd_dosage.png" />

## A closer look at the empty span

Look again at the top row and the deleted span is not quite at zero: reads are
there, in a sample that carries no _RHD_ at all.

They belong to the gene next door. _RHCE_ sits just to the right of _RHD_ and is
nearly identical to it, so when a sample has no _RHD_ for its reads to come
from, some _RHCE_ reads land in the empty footprint instead. An aligner with
nowhere better to put a read puts it somewhere, and records how sure it was in
the read's mapping quality.

A display setting separates that residue from real coverage. Open HG00113's
pileup inside the deleted span and set **Color by... → Mapping quality**: the
ramp runs red at MAPQ 0 through orange to yellow at MAPQ 60, so reads the
aligner could not confidently place come out red.

Residual coverage inside a called deletion turns up wherever the deleted
sequence has a close paralog. Raising the track's mapping quality filter empties
the span the same way.

## See also

- [](/docs/tutorials/mappability_qc)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/dog10k_svs)
- [](/docs/tutorials/population_cnv)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/jbrowse_anywidget)
