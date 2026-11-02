---
title: Inspecting phased reads (GIAB HG002)
sidebar_label: Phased reads (GIAB HG002)
description:
  Open GIAB HG002 nanopore, PacBio and Illumina reads on hg19, group and color
  them by the HP haplotype tag, compare one insertion across three platforms,
  and split coverage by strand to tell a variant from an artifact
guide_category: Tutorials
tutorial_category: Getting started
---

HG002 is the Genome in a Bottle (GIAB) Ashkenazi son, a human benchmark sample.
GIAB publishes reads of HG002 from every major platform, and each long read has
an `HP` tag, written by WhatsHap, that records which parental haplotype the read
came from. We:

- open HG002 Oxford Nanopore, PacBio and Illumina reads beside the GIAB SV
  benchmark
- group and color the nanopore reads by `HP`, so a heterozygous deletion sits in
  one haplotype's section
- compare one insertion across the three platforms
- split coverage by strand to separate a real variant from a basecalling
  artifact
- color reads by 5mC and group them by `HP` at an imprinted CpG island

## Prerequisites

- the
  [JBrowse demo](https://jbrowse.org/code/jb2/main/?config=test_data/config_demo.json&assembly=hg19),
  whose **GIAB** category in the track selector holds the hg19 tracks below, or
  your own instance with hg19 loaded
  ([assemblies guide](/docs/config_guides/assemblies))
- for your own reads, [WhatsHap](https://whatshap.readthedocs.io/) and samtools,
  to add the `HP` tag

<!-- TUTORIAL_INSTALL samtools,whatshap START -->

```bash
# Debian/Ubuntu
sudo apt install samtools
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools
# any platform
pip install whatshap
```

<!-- TUTORIAL_INSTALL samtools,whatshap END -->

## The data

GIAB's HG002 reads over two hg19 chr1 windows (`1:55.69-55.72Mb` and
`1:62.99-63.02Mb`), plus the GIAB Tier 1 SV benchmark.

Nothing to download: the demo tracks read slices of these files by URL. Reads of
your own get their `HP` tags and load as _Loading phased reads_ shows.

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                             | File                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| HG002 reads from every GIAB platform, the full genomes | [HG002_NA24385_son/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data/AshkenazimTrio/HG002_NA24385_son/) |
| GIAB Tier 1 SV benchmark v0.6, read by the SV track    | [HG002_SVs_Tier1_v0.6.vcf.gz](https://jbrowse.org/genomes/hg19/giab/HG002_SVs_Tier1_v0.6.vcf.gz)                      |

</details>

## Loading phased reads

A haplotagged BAM loads like any other alignments track. For reads of your own,
`whatshap haplotag` writes the `HP` tag from a phased VCF of the same sample on
the same reference:

```bash
whatshap haplotag --reference reference.fa -o haplotagged.bam phased.vcf.gz reads.bam
samtools index haplotagged.bam
```

The track config below loads the demo's nanopore reads. Swap `uri` for your
`haplotagged.bam`, with its `.bai` beside it. The `facet` setting opens the
track already split by `HP`, and `encoding.color` colors each read by the same
tag:

```json addtrack
{
  "trackId": "hg002_nanopore_hp",
  "name": "HG002 ONT",
  "uri": "https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam",
  "assemblyNames": ["hg19"],
  "displayDefaults": {
    "facet": { "field": "tags.HP" },
    "encoding": { "color": "tags.HP" }
  }
}
```

## A heterozygous deletion in one haplotype

We'll start at a deletion from the GIAB SV benchmark. Navigate to
`1:63,005,000-63,008,000` and open the demo's **HG002 BAM ultralong
nanopore+whatshap**, the same reads as **HG002 ONT**, beside **HG002 GIAB
consensus SV (VCF)**. From the track menu, **Group by → Tag...** asks for the
tag name and lists the values it finds in view:

<Figure caption="Group by → Tag... with HP typed as the tag." src="/img/alignments/haplotype_groupby.png" />

Grouped by `HP` and colored by the same tag, the pileup splits into one section
per haplotype, plus a section for untagged reads. The deletion from the SV track
shows as a gap in one section only:

<Figure caption="HG002 nanopore reads grouped by HP tag under the GIAB SV benchmark track." src="/img/smalldel.png" />

The [alignments guide](/docs/user_guides/alignments_track#grouping-reads) covers
grouping by any tag, collapsing sections, and the matching sort and filter
options.

## One insertion across three platforms

JBrowse draws an insertion differently on each platform's reads, because a long
read spans it and a short read stops at its edge. The PacBio reads are a slice
of the GIAB Sequel run, hosted beside the demo:

```json addtrack
{
  "trackId": "hg002_pacbio_chr1_insertion_slice",
  "name": "HG002 PacBio Sequel 15kb (chr1 slice)",
  "uri": "https://jbrowse.org/demos/hg002/HG002.Sequel.15kb.chr1_insertion.bam",
  "assemblyNames": ["hg19"]
}
```

Navigate to `1:55,705,770-55,706,090` and open it with the demo's **HG002 dbVar
variant calls**, **HG002 BAM ultralong nanopore+whatshap** and **HG002 Illumina
hs37d5.2x250**. JBrowse draws the insertion inside each long read as a purple
mark. The 250 bp Illumina reads stop at its edges, and **Show → Soft clipping**
in the Illumina track menu draws each read's bases past the edge, the ones the
aligner left unaligned:

<Figure caption="Show → Soft clipping in the HG002 Illumina track menu." src="/img/alignments/insertion_soft_clipping_menu.png" />

<Figure caption="HG002 nanopore, PacBio and Illumina reads over one insertion, soft clipping shown on the Illumina track." src="/img/insertion.png" />

## Strand-split coverage

A column of mismatches in a pileup is either a variant or a basecalling error,
and basecalling errors often show on one strand only. **Group by → Strand** on
the nanopore track splits the reads into a forward and a reverse section, each
with a coverage band drawn from that section's reads:

<Figure caption="HG002 nanopore reads grouped by strand. The left box disagrees in the reverse band only, the right box in both." src="/img/alignments/strand_split_coverage.png" />

## Methylation by haplotype

HG002's nanopore reads also have 5mC calls in their `MM`/`ML` tags, and the same
grouping by `HP` separates the two parental alleles at an imprinted locus. These
reads are aligned to hg38, so open the
[demo on hg38](https://jbrowse.org/code/jb2/main/?config=test_data/config_demo.json&assembly=hg38),
navigate to the _SNRPN_ imprinting center at `chr15:24,948,000-24,962,000` and
open **HG002 ONT reads (5mC, haplotagged)** from the **Methylation** category,
under **UCSC CpG islands** and **NCBI RefSeq (GFF3Tabix)** from **Annotation**.
In the reads' track menu, **Color by → Modifications** paints each CpG red where
the read's 5mC call is methylated, and **Color by → Show unmodified in blue**
adds blue where the call is unmethylated:

<Figure caption="Color by → Modifications in the HG002 ONT track menu." src="/img/methylation/hg002_snrpn_color_menu.png" />

**Group by → Tag...** with `HP` then puts the methylated parental allele in one
section and the unmethylated one in the other:

<Figure caption="HG002 ONT reads over the SNRPN CpG island colored by 5mC. Top: file order. Bottom: grouped by the HP tag." src="/img/methylation/hg002_snrpn_group_by_hp.png" links="Ungrouped=methylation/hg002_snrpn_ungrouped,Grouped by HP=methylation/hg002_snrpn_grouped" />

## See also

- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/sv_visualization)
- [](/docs/tutorials/methylation)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/analyze_trio)
