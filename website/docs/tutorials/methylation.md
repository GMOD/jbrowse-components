---
title: Methylation (long-read)
description:
  Per-read, aggregate, and allele-specific 5mC from HG002 nanopore reads
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

Nanopore and PacBio basecallers record each read's DNA methylation in
base-modification tags (`MM` and `ML`), and JBrowse draws those calls straight
from the BAM. We follow one dataset, HG002 nanopore reads over the _SNRPN_
imprinting center, where one parent's copy is methylated and the other's is not,
from per-read calls to an aggregate profile to the two parental alleles pulled
apart.

## Prerequisites

- for your own data, long reads whose BAM or CRAM already has `MM`/`ML`
  modification tags, which modern ONT and PacBio basecallers write by default,
  plus a JBrowse instance to load them into (the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))
- [modkit](https://github.com/nanoporetech/modkit/releases), Oxford Nanopore's
  tool for tallying per-read calls into per-CpG methylation fractions, for the
  aggregate section only; a single-binary download
- [WhatsHap](https://whatshap.readthedocs.io/), to haplotag reads of your own
  that have no `HP` tag

## Where the data comes from

The files are region slices of public
[ONT open data](https://labs.epi2me.io/dataindex/) on the `ont-open-data` S3
bucket.

<details>
<summary>Source files (no download needed)</summary>

- the HP1 bedMethyl (per-CpG methylation fractions) from the
  `wf-human-variation` sup run on HG002, restricted to the SNRPN locus and to
  `m` (5mC) rows:
  https://ont-open-data.s3.amazonaws.com/giab_2025.01/analysis/wf-human-variation/sup/HG002/PAW70337/output/SAMPLE.wf_mods.1.bedmethyl.gz
- the HP2 bedMethyl from that same run:
  https://ont-open-data.s3.amazonaws.com/giab_2025.01/analysis/wf-human-variation/sup/HG002/PAW70337/output/SAMPLE.wf_mods.2.bedmethyl.gz
- the reads, from the HG002 sup basecalls, sliced to the same locus and
  haplotagged with `whatshap haplotag` against the phased SNP calls from that
  same `wf-human-variation` run:
  https://ont-open-data.s3.amazonaws.com/giab_2023.05/analysis/hg002/sup/PAO83395.pass.cram

</details>

## Two parental alleles at the SNRPN imprinting center

At the _SNRPN_ imprinting center on chr15, one parental allele is methylated and
the other is unmethylated. The reads should split into two populations, and the
reads and the aggregate profile should agree on which allele is which. Every
view below is at `chr15:24,948,000-24,962,000`; type it into the location box
once the tracks are loaded.

## Loading GRCh38

The reads are aligned to GRCh38, and the track's `assemblyNames` has to name the
assembly they were aligned to.

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

The figures also show UCSC's CpG islands and the NCBI RefSeq genes. The hosted
hg38 hub config, https://jbrowse.org/ucsc/hg38/config.json, has both: **CpG
Islands** reads https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz with a CSI
index, and **NCBI RefSeq - RefSeq All** reads
https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.

## Per-read methylation from the alignments

Load the modBAM as an alignments track. For your own reads, swap `uri` for a
sorted modBAM or CRAM with the `.bai` or `.crai` beside it, aligned to the same
assembly:

```json addtrack
{
  "trackId": "HG002_snrpn_5mC_reads",
  "name": "HG002 ONT reads (5mC, haplotagged)",
  "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam",
  "assemblyNames": ["hg38"]
}
```

**File → Open track...** also opens the file by URL and infers the `.bai`.

Set **Color by... → Modifications** from the track menu to paint each read with
its 5mC calls. **One color per modification type** paints the positions the MM
tag reports as modified. **One color per type, plus low-probability & unmodified
in blue** (IGV's "2-color" scheme) also fills in every CpG the tag left
implicit, so an unmethylated region is solid blue. The
[alignments track guide](/docs/user_guides/alignments_track#modifications-and-methylation)
covers both modes, the probability threshold, and the cytosine-context submenu.

<Video src="/media/methylation/open_modbam.mp4" caption="The modBAM opened by URL and colored from its new track menu: Color by..., Modifications, and the two-color mode painting methylated CpGs red and unmethylated ones blue." />

<Figure caption="HG002 ONT reads over the SNRPN CpG island in both modification color modes. Top, the MM tag's modified positions alone, red against bare read bodies. Bottom, the same reads with every unmarked CpG filled in, so a read with no methylation reads blue where it was blank." src="/img/methylation/hg002_snrpn_mod_modes.png" links="Modified only=methylation/hg002_snrpn_marked_only,Every CpG=methylation/hg002_snrpn_fill_unmarked" />

The pileup over the CpG island interleaves methylated and unmethylated reads.
[Splitting the alleles apart](#splitting-the-alleles-apart) groups them by their
`HP` haplotype tag.

## Aggregate methylation with modkit bedMethyl

[modkit pileup](https://nanoporetech.github.io/modkit/) collapses the per-read
calls into a bedMethyl file with one row per CpG per modification type, each
holding the fraction of reads that were modified. The file is much smaller than
the reads.[^dmr]

```bash
modkit pileup sample.bam output.bedmethyl --ref reference.fa --preset traditional
bgzip output.bedmethyl
tabix -p bed output.bedmethyl.gz
```

`--preset traditional` collapses 5mC and 5hmC into a single 5mC fraction
(bisulfite-equivalent). Omit it to keep separate rows per modification type (`m`
for 5mC, `h` for 5hmC). Passing `--partition-tag HP` writes one file per
haplotype, and this dataset uses it.

bedMethyl is a BED file with a numeric score column, so it loads as a
`MultiQuantitativeTrack` (see the
[multi-quantitative track config guide](/docs/config_guides/quantitative_track)).
JBrowse reads the modification type from the `name` column and draws one
subtrack per type, with a vertical bar per CpG on a percent-methylation axis:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "HG002_snrpn_modkit_hp1",
  "name": "HG002 methylation HP1 (modkit)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_hp1.modkit.bed.gz"
  }
}
```

## Splitting the alleles apart

Each long read is a single DNA molecule, so reads that have an `HP` haplotype
tag (from WhatsHap, HiPhase, or ONT's `wf-human-variation`) can be separated by
allele. Pick **Group by... → Tag...** from the track menu and enter `HP`. The
dialog scans the reads in view and reports the values it found. It also offers
to color reads by the same tag; with methylation coloring on, that box starts
unchecked and the coloring stays. The pileup then stacks into one band per
haplotype, one methylated over the island and the other unmethylated, and a
third band, `HP: none`, holds the reads the haplotagging could not assign.

<Video src="/media/methylation/group_by_hp.mp4" caption="The split as the menu does it: the interleaved pileup, the tag dialog finding HP values 1 and 2 in the reads themselves, and one methylated band resolving over one unmethylated." />

<Figure caption="HG002 ONT reads over the SNRPN CpG island, colored by 5mC with unmethylated CpGs in blue. Top: file order, with the track menu open at Group by... → Tag.... Bottom: the same reads grouped by the HP tag, one band per haplotype and one for untagged reads." src="/img/methylation/hg002_snrpn_group_by_hp.png" links="Ungrouped=methylation/hg002_snrpn_ungrouped,Grouped by HP=methylation/hg002_snrpn_grouped" />

The two per-haplotype bedMethyl files from `--partition-tag HP` load as one
track above the reads, with a row per file. Pinning the axis at 0 to 100 puts
both rows on one scale, so an unmethylated row stays flat:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "HG002_snrpn_modkit_multi",
  "name": "HG002 5mC by haplotype (modkit)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BedTabixAdapter",
        "name": "HP1",
        "color": "#d62728",
        "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_hp1.modkit.bed.gz"
      },
      {
        "type": "BedTabixAdapter",
        "name": "HP2",
        "color": "#1f77b4",
        "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_hp2.modkit.bed.gz"
      }
    ]
  },
  "displayDefaults": {
    "mark": "bar",
    "scales": { "y": { "domainMin": 0, "domainMax": 100, "title": "% 5mC" } }
  }
}
```

<Figure caption="Imprinting at the SNRPN / Prader-Willi center: one haplotype methylated, the other not. The per-haplotype profile on top, the reads grouped by HP below, with the same haplotype methylated in both." src="/img/methylation/hg002_snrpn_combined.png" />

Reads of your own without an `HP` tag get one from `whatshap haplotag`, which
reads a phased VCF. The
[alignments track guide](/docs/user_guides/alignments_track#grouping-reads)
covers the Group-by dialog:

```bash
whatshap haplotag --reference reference.fa -o haplotagged.bam phased.vcf.gz reads.bam
samtools index haplotagged.bam
```

## See also

- [](/docs/user_guides/alignments_track#modifications-and-methylation)
- [](/docs/user_guides/alignments_track#grouping-reads)
- [](/docs/tutorials/bisulfite)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/rnaseq)
- [](/docs/user_guides/quantitative_track)

## External links

- [modkit documentation](https://nanoporetech.github.io/modkit/)

[^dmr]:
    To compare two samples, run `modkit dmr` on their per-sample pileups and
    load its BED output as a `FeatureTrack` beside the bedMethyl tracks, so the
    differentially-methylated regions line up with the positions driving them.
