---
title: Structural variants (1000 Genomes)
sidebar_label: SVs (1000 Genomes)
description:
  Read one whole-gene deletion across the 1000 Genomes cohort, then check the
  genotypes against the reads that produced them
guide_category: Tutorials
tutorial_category: Structural variation
---

Take one whole-gene deletion out of the 1000 Genomes ensemble SV callset, sort
the cohort's genotypes at it, then open three of those samples' reads and watch
the coverage go to zero, halve, and stay flat. The page ends on a call from the
same cohort whose coverage does none of that.

## Prerequisites

- the JBrowse demo instance, which carries the callset and the alignments

## Where the data comes from

The 1000 Genomes 2022 high-coverage ensemble SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004)), read
against three of the cohort's samples' CRAMs and QuicK-mer2 copy number for the
whole cohort.

- the ensemble SV callset, 3202 samples. EBI publishes it with no mirror, so the
  demo reads a byte-for-byte copy on jbrowse.org[^ebi]:
  https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz
- HG00113 (homozygous alt) high-coverage CRAM:
  https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240129/HG00113.final.cram
- HG00096 (heterozygous) high-coverage CRAM:
  https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240114/HG00096.final.cram
- HG00097 (homozygous reference) high-coverage CRAM:
  https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240115/HG00097.final.cram
- QuicK-mer2 copy number for the cohort, the store the
  [copy-number tutorial](/docs/tutorials/population_cnv) also reads. A directory
  of chunks that 404s at its root, and the adapter takes it as its `uri`:
  https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr

## The 1000 Genomes SV callset

The [1000 Genomes Project](https://www.internationalgenome.org/) sequenced 2,504
individuals across 26 populations. The 2022 high-coverage re-analysis
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004))
called deletions, insertions, inversions and translocations with per-sample
genotypes across all 3,202 individuals.

`HGSV_1821` is a deletion on chr1 spanning the whole of _RHD_, so samples called
homozygous carry no copy of that gene. Deleting _RHD_ is the most common cause
of the RhD-negative blood type. The call is `PASS` and common enough to fill all
three genotype classes, and read depth shows whether a gene is present twice,
once, or not at all.

The demo config adds the tracks with `jbrowse add-track`. The callset is
bgzip-compressed and tabix-indexed, and the alignment tracks stream the CRAMs
from the urls above.

In the track selector, enable the 1KGP 2022 Illumina ensemble SV callset under
**1000 Genomes → SV callsets**, <!-- menu-path-ok --> listed by its file name
**1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf**, then navigate to
`chr1:25,200,000-25,400,000`, the window the figures below use.

Everything below works the same in [JBrowse Desktop](/docs/quickstart_desktop),
which opens your own VCF and BAM files from disk.

## Genotypes across the cohort

Switch the track to the **Multi-sample variant display** from the track menu.
Each sample becomes a row drawn at the variant's genomic span, so the deletion
is a wide block. Clicking it opens the feature details panel, whose **SAMPLES**
section lists every sample's genotype, read depth and other per-sample fields.

Rows start in the callset's order. Right-click the deletion and pick **Sort by
genotype** to order rows by genotype at that call, then by how far each keeps
matching its neighbours. **Clustering → Cluster rows by genotype...** in the
track menu keys every row on the whole window and draws the dendrogram.

Dark blue is no copy of _RHD_, light blue one, grey two, and the olive stripe is
a separate nested call.

A matrix cell marks that a sample carries some call at that column. To see which
call, load the same VCF again in the ordinary variant display, which draws each
record on a separate row with its id, class and size. Colouring cells by **SV
type** also tells the calls apart, as the
[multi-variant track guide](/docs/user_guides/multivariant_track) shows.

The figure has three lanes over NCBI RefSeq genes:

- the callset as a genotype matrix, one row per sample, sorted by genotype at
  the _RHD_ deletion
- the same records in the ordinary variant display, colored by SV class, so each
  band in the matrix lines up with a named record
- QuicK-mer2 copy number for 2504 individuals, one row each and clustered on
  this window, where blue is a copy lost against the diploid white and red a
  copy gained

<Figure caption="The 1KGP ensemble SV callset over the RHD locus on chr1, with the panel's copy-number calls under it. The deletion draws as a wide block, splitting the cohort into three bands in the matrix and three levels of copy number." src="/img/multisv_rhd.png" />

<Video src="/media/sv/multisample_sort.mp4" caption="On the callset shown in the figure above, a right-click on the deletion sorts the cohort by genotype there, resolving the callset order into three bands: both copies of RHD deleted, one, then neither." />

The olive stripe is `HGSV_1823`, a small copy-number record inside the deletion
that the callset leaves as a no-call in most of the cohort. QuicK-mer2 measures
copy number per bin from the reads, so the column that is an olive no-call in
the matrix is a red gain in the copy-number lane. The
[copy-number tutorial](/docs/tutorials/population_cnv) reads the same store.

## Reading the genotypes off the reads

Open three samples' alignments from **1000 Genomes → Alignments**, one per
genotype: HG00113 homozygous alt, HG00096 heterozygous, HG00097 homozygous
reference. Two settings make them comparable:

- Turn the pileup off from the track menu's **Show...** submenu, since at this
  width the coverage curve shows the difference
- Put the three lanes on one axis from **Coverage → Autoscale with other
  tracks...**, ticking the other two, so they compare by height

<Figure caption="The RHD deletion across three genotypes, coverage on one shared axis, the banded span RHD itself. Top, HG00113 with no copy; middle, HG00096 with one; bottom, HG00097 with two." src="/img/multisv_rhd_dosage.png" />

## A closer look at the empty span

Coverage over the deleted span in the top row sits just above zero. _RHCE_ sits
just to the right of _RHD_ and is nearly identical, so with no _RHD_ to come
from, some _RHCE_ reads land in the empty footprint, and the aligner records its
uncertainty in their mapping quality.

Open HG00113's pileup inside the deleted span and set **Color by... → Mapping
quality**: the ramp runs dark blue at MAPQ 0 through grey to yellow at MAPQ 60,
so reads the aligner could not place come out dark blue. Raising the track's
mapping quality filter empties the span the same way. Residual coverage inside a
called deletion turns up wherever the deleted sequence has a close paralog.

## A complex call read off the pair orientations

Most structural variants leave the coverage unchanged. The demo carries a
complex call on chromosome 1 in HG02768 whose coverage matches the rest of the
arm.

Put `1:39,658,200-39,661,800` in the location box and open HG02768's alignments
from **1000 Genomes → Alignments**. Turn on **Track menu → Read connections → SV
channels (pairs by orientation)**: the reads split into one band per orientation
class, each with a separate coverage curve and arcs.

- The normal band holds the flat profile
- The two same-strand bands each draw a bundle of arcs on one pair of
  breakpoints, the inversion signature
- The outward-pointing band, where a tandem duplication would go, stays near
  empty

<Figure caption="HG02768's reads at the complex call, split into one band per pair orientation. The two same-strand bands hold arc bundles ending on one pair of breakpoints, the normal band carries the ordinary coverage, and the outward-pointing band is near empty. The last band holds reads whose mate is unmapped or on another chromosome, drawn as inter-chromosomal ticks." src="/img/sv_channels.png" />

The call also lists a duplicated copy in `INFO.CPX_INTERVALS`, which no band
shows. A copy inserted beside its origin leaves pair orientation unchanged, so
that half of the call rests on coverage. At this size the coverage noise makes
bumps as wide as the duplication, so its step cannot be picked out from them.

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

[^ebi]:
    The file EBI publishes is at
    https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz
    and the jbrowse.org copy is byte-for-byte that. The CRAM urls above are the
    Registry of Open Data mirror of the same 1000 Genomes ftp tree, which
    answers a range request in a fraction of the time EBI takes.
