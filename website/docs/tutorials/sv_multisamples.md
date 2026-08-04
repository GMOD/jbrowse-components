---
title: Structural variants (1000 Genomes)
sidebar_label: SVs (1000 Genomes)
description:
  Read one whole-gene deletion across 3,202 samples, then check every genotype
  against the reads that produced it
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** take one 70 kb deletion out of the 1000 Genomes ensemble SV callset,
sort its genotypes across 3,202 samples, then open three of those samples' reads
and watch the coverage go to zero, halve, and stay flat. Everything runs on a
hosted demo, so no data download is needed.

## Prerequisites

- nothing to install: the demo instance already carries the callset and the
  alignments

## The dataset and the call

The [1000 Genomes Project](https://www.internationalgenome.org/) sequenced
genomes from 2,504 individuals across 26 populations. The 2022 high-coverage
re-analysis produced a comprehensive SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004)) that
includes deletions, insertions, inversions, and translocations with per-sample
genotypes across all 3,202 individuals.

`HGSV_1821` is a 70 kb deletion spanning chr1:25,265,081-25,335,163. What makes
it worth following is what it removes: the deleted span contains the whole of
_RHD_, so the samples called homozygous here carry no copy of that gene at all.
Deleting _RHD_ is the most common cause of the RhD-negative blood type, though
not the only one, since inactivating variants and RHD-CE hybrid genes produce it
too.

The call is a good one to check by eye because its genotypes are not close: it
is `PASS`, `AC=1167` of `AN=6404`, and the three genotype classes are all well
populated at 2234 homozygous reference, 771 heterozygous and 198 homozygous alt.
A gene present twice, once, or not at all is something read depth can settle on
its own.

The tracks are added with the usual `jbrowse add-track` workflow. The callset is
bgzip-compressed and tabix-indexed, and the alignment tracks stream the
published high-coverage CRAMs directly from the 1000 Genomes FTP.

In the track selector, enable the 1KGP 2022 Illumina ensemble SV callset under
**1000 Genomes → SV callsets**, listed by its file name
**1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf**, then navigate to
`chr1:25,200,000-25,400,000`, the window the figures below use.

Everything below works the same in [JBrowse Desktop](/docs/quickstart_desktop),
which is the better fit for your own VCF and BAM files.

## Genotypes across the cohort

Switch the track to the **Multi-sample variant display (regular)** from the
track menu. Each sample becomes a row, drawn at the variant's real genomic span,
so the deletion is a 70 kb block rather than a tick. Clicking it opens the
feature details panel, whose **SAMPLES** section lists every sample with its
genotype, read depth, and other per-sample fields.

Rows arrive in the callset's own order, which encodes nothing. Right-click the
deletion and pick **Sort by genotype**: rows order by their genotype at that
call first, then by how far each row keeps matching the rows to either side of
it. The three classes separate into three contiguous bands. The track menu's
**Clustering → Cluster rows by genotype...** is the other arrangement, keying
every row on the whole window rather than on one call and drawing the dendrogram
it built.

Dark blue is a sample with no copy of _RHD_, light blue one copy, grey two, and
the olive stripe running through the block is a separate nested call rather than
part of the deletion.

Setting the display's cell coloring to **SV type** paints each alt-carrying cell
by its variant's structural-variant class instead, so the same window becomes a
map of what kind of SV sits where and the legend names each class present. The
figure below is the callset loaded twice in one view, once each way, on one
ruler and over one gene track.

<Figure caption="The 1KGP ensemble SV callset across 200 kb of chr1, one row per sample, both lanes sorted by genotype at the RHD deletion, over the NCBI RefSeq genes. Top, colored by genotype: each call is drawn at its real span, so the deletion is a 70 kb block splitting the cohort into three bands. Bottom, the same rows colored by SV type, where the legend names the five classes present: the deletion is the wide red block, and the duplications and inversions to the right of it fall over RHCE." src="/img/multisv_rhd.png" />

That olive stripe is worth naming, because it is the one thing in the frame that
is not what it looks like. It is `HGSV_1823`, a 6 kb copy-number record sitting
inside the deletion, and it is uncalled in 2,663 of the 3,202 samples. A no-call
is not a reference call and it is not a deletion call: it is the caller
declining to answer, which the display draws in its own color precisely so it
cannot be mistaken for either. The lower lane is where that reading is checked:
the same column is a copy-number call there, not a deletion.

## Reading the genotypes off the reads

The genotypes are the caller's answer. The reads are what it read, and they are
in the demo too, so every row of the block above can be checked rather than
accepted.

Open three samples' alignments from **1000 Genomes → Alignments**, one per
genotype: HG00113 called homozygous alt, HG00096 heterozygous, HG00097
homozygous reference. Two settings make them comparable. Turn the pileup off
from the track menu's **Show...** submenu, since at 100 kb a 30x pileup is a
solid mass and the coverage curve is the whole point here. Then set an explicit
**min/max score** on each rather than leaving the default autoscale, which fits
each row to its own maximum and draws three different depths at the same height.

<Figure caption="The RHD deletion across three genotypes, all three coverage tracks pinned to one 0-70 axis, with the banded span RHD itself. Top, HG00113 with no copy of RHD: coverage runs at the flanking depth either side and collapses across the gene. Middle, HG00096 with one copy: about half the flanking depth across the same span. Bottom, HG00097 with two: flat throughout." src="/img/multisv_rhd_dosage.png" />

That is the whole dosage series in one frame, and it needs no interpretation:
the gene is there twice, once, or not at all, and the coverage says which.

## The hole is not quite empty

Look again at the top row and the deleted span is not at zero. It is low, but
reads are there, in a sample that carries no _RHD_ at all.

They belong to the gene next door. _RHCE_ sits about 30 kb to the right at
roughly 97% identity to _RHD_, so when a sample has no _RHD_ for its reads to
come from, some _RHCE_ reads land in the empty footprint instead. An aligner
with nowhere better to put a read puts it somewhere, and records how sure it was
in the read's mapping quality.

So the residue is separable from real coverage, and separating it is a display
setting rather than a reprocessing step. Set **Color by → Mapping quality** on
the pileup:

<Figure caption="15 kb inside RHD in HG00113, which carries no copy of it. Top, the default read coloring: a sparse grey pileup that could be read as low coverage. Bottom, the same reads colored by mapping quality, where the ramp runs red at MAPQ 0 through to green at MAPQ 60. Almost every read in the frame is red, so the residue is not RHD coverage but reads the aligner could not confidently place." src="/img/multisv_rhd_mapq.png" />

This is the general habit worth taking from the page rather than the specific
locus. Residual coverage inside a called deletion is common wherever the deleted
sequence has a close paralog, and mapping quality is what tells a thin real
signal apart from reads that had nowhere else to go. Raising the track's mapping
quality filter empties the span the same way, and is the version to reach for
when the question is what the depth actually is.

## Breakpoint split view

Click the deletion bar in the variant track to open feature details. In the
**BREAKENDS** section, click the split view link. This opens both breakpoints
side-by-side in synchronized panels, with splines connecting supporting reads
across both panels and the variant call drawn as a colored line with directional
feet, so both junctions are on screen at once rather than one at a time.

For more on navigating it, see
[Breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view).

## Where to go next

- The whole callset rather than one call: the
  [SV inspector](/docs/user_guides/sv_inspector_view) pairs a filterable table
  of every SV with a circular whole-genome overview, and takes this callset's
  URL straight from the track's **About track** menu.
- The same cohort's inheritance patterns: [](/docs/tutorials/analyze_trio)
  follows phased genotypes and IBD blocks through a trio, and
  [SV inheritance in a trio](/docs/user_guides/sv_visualization) reads the same
  question off trio alignments.
- The [Jupyter multi-sample variants example](/docs/jbrowse_jupyter) renders the
  same per-sample and matrix displays from a VCF in a notebook.

## See also

- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [Multi-sample variant displays](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/dog10k_svs), the same reading on a canine panel, and
  [](/docs/tutorials/population_cnv) for copy number across the same 1000
  Genomes samples, where a deletion at another locus is read from k-mer depth
  rather than from a callset
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab)
