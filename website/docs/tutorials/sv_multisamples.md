---
title: Structural variants (1000 Genomes)
sidebar_label: SVs (1000 Genomes)
description:
  Read one whole-gene deletion across the 1000 Genomes cohort, then check the
  genotypes against the reads that produced them
guide_category: Tutorials
tutorial_category: Structural variation
---

A structural variant (SV) callset for a cohort gives every person a genotype at
every call, and each genotype rests on that person's reads. We take one call
from the 1000 Genomes ensemble SV callset, a deletion spanning the whole of
_RHD_, the RhD blood group gene, whose loss is the usual cause of the
RhD-negative blood type. The call is common enough to fill all three genotype
classes, which read depth separates into two copies of the gene, one, or none. A
complex call in sample HG02768 on the same chromosome follows. We:

- load the callset as a multi-sample variant track, with a sample's CRAM and a
  copy-number Zarr store
- sort the rows by genotype from the deletion's right-click menu
- open three samples' reads at _RHD_ and share one coverage axis between them
- split HG02768's reads into SV channels at the complex call

## Prerequisites

- a JBrowse instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))
- a multi-sample SV VCF, bgzip-compressed and tabix-indexed, with a `.tbi` or
  `.csi` beside it
- CRAMs aligned to the same assembly, each with its `.crai` beside it

## The data

The page reads the 1000 Genomes 2022 high-coverage ensemble SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004))
against CRAMs from three of the cohort's samples and QuicK-mer2 copy number for
the whole cohort.

Nothing to download: the track configs below read these files by URL. Your own
VCF and CRAM swap in by `uri`, as _Loading the callset, the reads and the
copy-number store_ shows.

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                                                                                                                                                                 | File                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| The ensemble SV callset, 3202 samples. EBI publishes it with no mirror, so the demo reads a byte-for-byte copy on jbrowse.org[^ebi]                                                                        | [1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz](https://jbrowse.org/demos/1000g/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz) |
| HG00113 (homozygous alt) high-coverage CRAM                                                                                                                                                                | [HG00113.final.cram](https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240129/HG00113.final.cram)                       |
| HG00096 (heterozygous) high-coverage CRAM                                                                                                                                                                  | [HG00096.final.cram](https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240114/HG00096.final.cram)                       |
| HG00097 (homozygous reference) high-coverage CRAM                                                                                                                                                          | [HG00097.final.cram](https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240115/HG00097.final.cram)                       |
| HG02768 high-coverage CRAM, for the complex call                                                                                                                                                           | [HG02768.final.cram](https://ftp-trace.ncbi.nlm.nih.gov/1000genomes/ftp/1000G_2504_high_coverage/data/ERR3242423/HG02768.final.cram)         |
| QuicK-mer2 copy number for the cohort, the store the [copy-number tutorial](/docs/tutorials/population_cnv) also reads. A directory of chunks that 404s at its root, and the adapter takes it as its `uri` | [qm2_cn_1kb.zarr](https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr)                                                                           |

</details>

## Loading the callset, the reads and the copy-number store

The CRAMs decode against the assembly's sequence, so it must be the GRCh38
sequence the reads were aligned to, with the chromosome names the VCF uses.

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

The figures also show NCBI's RefSeq genes as a track:

```json addtrack
{
  "trackId": "ncbi_refseq_109_hg38",
  "name": "NCBI RefSeq analysis set (GFF3Tabix)",
  "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz",
  "assemblyNames": ["hg38"]
}
```

We'll add the callset as a variant track. Swap `uri` for your own VCF, which
needs per-sample genotype columns and an index beside it:

```json addtrack loc=chr1:25,200,000-25,400,000
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

```json addtrack loc=chr1:25,200,000-25,400,000
{
  "type": "AlignmentsTrack",
  "trackId": "hg00113_cram",
  "name": "HG00113 high coverage",
  "assemblyNames": ["hg38"],
  "uri": "https://1000genomes.s3.amazonaws.com/1000G_2504_high_coverage/data/ERR3240129/HG00113.final.cram"
}
```

The copy-number track reads the Zarr store through
[`jbrowse-plugin-zarr`](https://github.com/cmdcolin/jbrowse-plugin-zarr), which
is not yet in the plugin store. Add its hosted bundle to the config's `plugins`:

```json
{
  "plugins": [
    {
      "name": "Zarr",
      "url": "https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js"
    }
  ]
}
```

The track below reads the store, drawing one heatmap row per individual with
white at two copies; the
[copy-number tutorial](/docs/tutorials/population_cnv#building-a-zarr-store-from-per-sample-bigwigs)
explains these settings and builds a store from your own BigWigs:

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
    "mark": "rect",
    "origin": 2,
    "encoding": {
      "y": { "scale": { "domainMin": 0, "domainMax": 4 } },
      "color": {
        "scale": { "range": ["#2166ac", "#b2182b"] },
        "legend": { "title": "Copy number" }
      }
    }
  }
}
```

## Sorting the cohort by genotype at the RHD deletion

Navigate to `chr1:25,200,000-25,400,000`. The callset track draws each sample as
a row at the variant's genomic span, so `HGSV_1821`, the _RHD_ deletion, is a
wide block, and rows start in the callset's order:

- Click the deletion to open the feature details panel, whose **SAMPLES**
  section lists every sample's genotype, read depth and other fields.
- Right-click the deletion and pick **Sort by genotype** to order rows by
  genotype at that call, then by how far each keeps matching its neighbours.
- **Clustering → Cluster rows by genotype...** in the track menu clusters rows
  by genotypes across the whole window instead, with a dendrogram.

In the matrix, dark blue is no copy of _RHD_, light blue one and grey two. The
olive stripe is `HGSV_1823`, a small copy-number record nested inside the
deletion. The callset gives most of the cohort a no-call there (no genotype
reported), while QuicK-mer2 measures copy number per bin from the reads, so the
olive column is a red gain in the copy-number track.

A matrix cell marks some call at that column. To see which call, load the same
VCF again in the ordinary variant display, which draws each record on a separate
row with its id, class and size, or color cells by **SV type**, as the
[multi-variant track guide](/docs/user_guides/multivariant_track) shows. The
figure has three tracks over NCBI RefSeq genes:

- the callset as a genotype matrix, one row per sample, sorted by genotype at
  the _RHD_ deletion
- QuicK-mer2 copy number for every individual, one row each and clustered on
  this window, where blue is a copy lost against the diploid white and red a
  copy gained
- the same records in the ordinary variant display, each labelled with its id

<Figure caption="The 1KGP SV callset over RHD with the panel's copy-number calls under it." src="/img/multisv_rhd.png" />

<Video src="/media/sv/multisample_sort.mp4" caption="Right-clicking the deletion sorts the cohort by its genotype there." />

## Checking the RHD genotypes against read coverage in three samples

Open three samples' alignments, one per genotype: HG00113 homozygous alt,
HG00096 heterozygous, HG00097 homozygous reference. Two settings make them
comparable:

- Turn the pileup off with **Show → Pileup** in the track menu, since at this
  width the coverage curve shows the difference.
- Share one axis from **Advanced → Coverage axis... → Share axis with**, ticking
  the other two tracks, so the samples compare by height.

<Figure caption="Coverage over RHD in samples of each genotype on one shared axis, the RHD span banded." src="/img/multisv_rhd_dosage.png" />

Coverage over the deleted span in the top row sits just above zero. The
neighbouring gene _RHCE_, just right of _RHD_, is nearly identical, so some
_RHCE_ reads map to the empty _RHD_ footprint.

## Reading a complex call in HG02768 from read-pair orientation

A balanced rearrangement such as an inversion leaves coverage unchanged but
changes read-pair orientation, meaning which strand each mate maps to. HG02768
has a complex call, an inversion with a duplicated copy, with coverage like the
rest of its arm.

Put `1:39,658,200-39,661,800` in the location box and add HG02768's CRAM as a
track the same way as HG00113's.

**Presets → SV channels** in the track menu splits the reads into one band per
kind of SV evidence, each with a separate coverage curve and arcs:

- The no-evidence band holds the flat coverage profile of the concordant pairs
- The inversion band draws two bundles of arcs, the same-strand pairs and split
  reads across each end of the inversion, green for one end and blue for the
  other
- The duplication-type band (mates facing away from each other), where a tandem
  duplication would go, stays near empty

<Figure caption="HG02768's reads at the complex call, one band per kind of SV evidence. Reads whose mate is on another chromosome draw as inter-chromosomal ticks." src="/img/sv_channels.png" />

The call also lists a duplicated copy in `INFO.CPX_INTERVALS`, which no band
shows. A copy inserted beside its origin leaves pair orientation unchanged, so
that half of the call rests on coverage, where noise at this size makes bumps as
wide as the duplication.

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
