---
title: Structural variants (1000 Genomes)
sidebar_label: SVs (1000 Genomes)
description:
  Read one whole-gene deletion across the 1000 Genomes cohort, then check the
  genotypes against the reads that produced them
guide_category: Tutorials
tutorial_category: Structural variation
---

Take the deletion of _RHD_, the RhD blood group gene, out of the 1000 Genomes
ensemble SV callset, sort the cohort's genotypes at it, then open three of those
samples' reads and watch the coverage go to zero, halve, and stay flat. The page
ends on a complex call from the same cohort whose coverage does none of that.

## Prerequisites

- a JBrowse instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))
- a multi-sample SV VCF, bgzip-compressed and tabix-indexed, with a `.tbi` or
  `.csi` beside it
- CRAMs aligned to the same assembly, each with its `.crai` beside it

## Where the data comes from

The page reads the 1000 Genomes 2022 high-coverage ensemble SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004))
against CRAMs from three of the cohort's samples and QuicK-mer2 copy number for
the whole cohort.

- the ensemble SV callset, 3202 samples. EBI publishes it with no mirror, so the
  demo reads a byte-for-byte copy on jbrowse.org[^ebi]:
  https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz
- HG00113 (homozygous alt) high-coverage CRAM:
  https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240129/HG00113.final.cram
- HG00096 (heterozygous) high-coverage CRAM:
  https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240114/HG00096.final.cram
- HG00097 (homozygous reference) high-coverage CRAM:
  https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240115/HG00097.final.cram
- HG02768 high-coverage CRAM, for the complex call:
  https://ftp-trace.ncbi.nlm.nih.gov/1000genomes/ftp/1000G_2504_high_coverage/data/ERR3242423/HG02768.final.cram
- QuicK-mer2 copy number for the cohort, the store the
  [copy-number tutorial](/docs/tutorials/population_cnv) also reads. A directory
  of chunks that 404s at its root, and the adapter takes it as its `uri`:
  https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr

## The RHD deletion in the 1000 Genomes SV callset

The [1000 Genomes Project](https://www.internationalgenome.org/) sequenced 2,504
individuals across 26 populations. The 2022 high-coverage re-analysis
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004))
called deletions, insertions, inversions and translocations with per-sample
genotypes across all 3,202 individuals.

`HGSV_1821` is a deletion on chr1 spanning the whole of _RHD_, so samples called
homozygous have no copy of that gene. Deleting _RHD_ is the most common cause of
the RhD-negative blood type. The call is `PASS` and common enough to fill all
three genotype classes, which read depth separates into two copies of the gene,
one, or none.

## Loading the callset, the reads and the copy-number store

The CRAMs decode against the assembly's sequence, so the assembly must be the
GRCh38 sequence the reads were aligned to, with the chromosome names the VCF
uses.

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

We'll add the callset as a variant track. Swap `uri` for your own VCF, which
needs per-sample genotype columns and an index beside it:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "kgp_ensemble_sv",
  "name": "1KGP ensemble SV calls, 3202 samples",
  "assemblyNames": ["hg38"],
  "uri": "https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz"
}
```

One alignments track per sample comes next, here HG00113, the homozygous alt.
Swap `uri` for your own CRAM, with its `.crai` beside it. The other two samples
differ only in the file:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "hg00113_cram",
  "name": "HG00113 high coverage",
  "assemblyNames": ["hg38"],
  "uri": "https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240129/HG00113.final.cram"
}
```

The copy-number track reads the Zarr store through `jbrowse-plugin-zarr`, which
is not yet in the plugin store. Load its hosted bundle with a `plugins` entry,
`{ "name": "Zarr", "url": "https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js" }`;
the
[copy-number tutorial](/docs/tutorials/population_cnv#building-a-zarr-store-from-per-sample-bigwigs)
builds a store from your own BigWigs:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "cnv_1000g_zarr",
  "name": "1000 Genomes copy number, 2504 individuals",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleZarrAdapter",
    "uri": "https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr"
  },
  "displayDefaults": {
    "mark": "heatmap",
    "origin": 2,
    "scales": { "y": { "domainMin": 0, "domainMax": 4 } },
    "color": {
      "field": "score",
      "scale": "threshold",
      "range": ["#2166ac", "#b2182b"],
      "title": "Copy number"
    }
  }
}
```

Navigate to `chr1:25,200,000-25,400,000`, the window of the genotype figure
below.

## Sorting the cohort by genotype at the RHD deletion

Switch the callset track to **Display types → Multi-sample variant display**
from the track menu. Each sample becomes a row drawn at the variant's genomic
span, so the deletion is a wide block. Clicking it opens the feature details
panel, whose **SAMPLES** section lists every sample's genotype, read depth and
other per-sample fields.

Rows start in the callset's order. Right-click the deletion and pick **Sort by
genotype** to order rows by genotype at that call, then by how far each keeps
matching its neighbours. **Clustering → Cluster rows by genotype...** in the
track menu clusters rows by genotypes across the whole window, with a
dendrogram.

In the matrix, dark blue is no copy of _RHD_, light blue one, grey two, and the
olive stripe is a separate nested call.

A matrix cell marks that a sample has some call at that column. To see which
call, load the same VCF again in the ordinary variant display, which draws each
record on a separate row with its id, class and size. Colouring cells by **SV
type** also tells the calls apart, as the
[multi-variant track guide](/docs/user_guides/multivariant_track) shows.

The figure below has three tracks over NCBI RefSeq genes:

- the callset as a genotype matrix, one row per sample, sorted by genotype at
  the _RHD_ deletion
- QuicK-mer2 copy number for 2504 individuals, one row each and clustered on
  this window, where blue is a copy lost against the diploid white and red a
  copy gained
- the same records in the ordinary variant display, each labelled with its id

<Figure caption="The 1KGP ensemble SV callset over the RHD locus on chr1, with the panel's copy-number calls under it. The deletion draws as a wide block, splitting the cohort into three bands in the matrix and three levels of copy number." src="/img/multisv_rhd.png" />

<Video src="/media/sv/multisample_sort.mp4" caption="A right-click on the deletion sorts the cohort by genotype there, resolving the callset order into three bands: both copies of RHD deleted, one, then neither." />

The olive stripe is `HGSV_1823`, a small copy-number record inside the deletion.
The callset gives most of the cohort a no-call there (no genotype reported), but
QuicK-mer2 measures copy number per bin from the reads, so the column that is an
olive no-call in the matrix is a red gain in the copy-number track.

## Checking the RHD genotypes against read coverage in three samples

Open three samples' alignments, one per genotype: HG00113 homozygous alt,
HG00096 heterozygous, HG00097 homozygous reference. Two settings make them
comparable:

- Turn the pileup off with **Show... → Show pileup** in the track menu, since at
  this width the coverage curve shows the difference
- Put the three tracks on one axis from **Coverage axis... → Share axis with**,
  ticking the other two, so they compare by height

<Figure caption="Coverage over the RHD deletion in three samples on one shared axis, with the RHD span banded. Top, HG00113 with no copy; middle, HG00096 with one; bottom, HG00097 with two." src="/img/multisv_rhd_dosage.png" />

Coverage over the deleted span in the top row sits just above zero. The
neighbouring gene _RHCE_, just right of _RHD_, is nearly identical, so some
_RHCE_ reads land in the empty _RHD_ footprint, and the aligner records its
uncertainty in their mapping quality.

## Reading a complex call in HG02768 from read-pair orientation

Balanced rearrangements such as inversions leave coverage unchanged but change
read-pair orientation, meaning which strand each mate maps to. HG02768 has a
complex call, an inversion with a duplicated copy, with coverage like the rest
of its arm.

Put `1:39,658,200-39,661,800` in the location box and add HG02768's CRAM as a
track the same way as HG00113's. Turn on **Read connections → SV channels (pairs
by orientation)** from the track menu: the reads split into one band per
orientation class, each with a separate coverage curve and arcs.

- The normal-orientation band holds the flat coverage profile
- The two same-strand bands (both mates on one strand) each draw a bundle of
  arcs on one pair of breakpoints, the inversion signature
- The outward-pointing band (mates facing away from each other), where a tandem
  duplication would go, stays near empty

<Figure caption="HG02768's reads at the complex call, split into one band per pair orientation. The two same-strand bands hold arc bundles ending on one pair of breakpoints, the normal band shows the ordinary coverage, and the outward-pointing band is near empty. The last band holds reads whose mate is unmapped or on another chromosome, drawn as inter-chromosomal ticks." src="/img/sv_channels.png" />

The call also lists a duplicated copy in `INFO.CPX_INTERVALS`, which no band
shows: a copy inserted beside its origin leaves pair orientation unchanged, so
that half of the call rests on coverage. At this size coverage noise makes bumps
as wide as the duplication, so its step cannot be picked out.

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
