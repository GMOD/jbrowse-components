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
GIAB publishes reads of HG002 from every major platform, and the long reads
carry an `HP` tag from WhatsHap saying which parental haplotype each read came
from. We:

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
  whose **GIAB** category in the track selector holds every track below, or your
  own instance with hg19 loaded
  ([assemblies guide](/docs/config_guides/assemblies))

## The data

GIAB's HG002 reads over two hg19 chr1 windows (`1:55.69-55.72Mb` and
`1:62.99-63.02Mb`), plus the GIAB Tier 1 SV benchmark. Nothing to download: the
demo tracks read slices of these files by URL.

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                             | File                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| HG002 reads from every GIAB platform, the full genomes | [HG002_NA24385_son/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data/AshkenazimTrio/HG002_NA24385_son/) |
| GIAB Tier 1 SV benchmark v0.6, read by the SV track    | [HG002_SVs_Tier1_v0.6.vcf.gz](https://jbrowse.org/genomes/hg19/giab/HG002_SVs_Tier1_v0.6.vcf.gz)                      |

</details>

## Loading phased reads

On your own instance, a haplotagged BAM loads like any other alignments track.
The `facet` setting opens the track already split by `HP`:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "hg002_ont_hp",
  "name": "HG002 ONT, phased",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": {
      "uri": "https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/hg002/HG002.ONTrel2.HP.hs37d5.demo_slices.bam.bai"
      }
    }
  },
  "displayDefaults": {
    "facet": { "field": "tags.HP" },
    "encoding": { "color": "tags.HP" }
  }
}
```

## A heterozygous deletion in one haplotype

Navigate to `1:63,005,000-63,008,000` and open **HG002 BAM ultralong
nanopore+whatshap**. From the track menu, **Group by... → Tag...** asks for the
tag name and lists the values it finds in view:

<Figure caption="Group by... → Tag... with HP typed as the tag." src="/img/alignments/haplotype_groupby.png" />

Grouped by `HP` and colored by the same tag, the pileup splits into one section
per haplotype, plus a section for untagged reads. The deletion from the GIAB SV
track shows as a gap in one section only:

<Figure caption="HG002 nanopore reads grouped by HP tag under the GIAB SV benchmark track." src="/img/smalldel.png" />

The [alignments guide](/docs/user_guides/alignments_track#grouping-reads) covers
grouping by any tag, collapsing sections, and the matching sort and filter
options.

## One insertion across three platforms

Navigate to `1:55,705,770-55,706,090` and open the nanopore, PacBio and Illumina
tracks together. JBrowse draws the insertion inside each long read as a purple
mark. The 250 bp Illumina reads stop at its edges, and **Show... → Soft
clipping** draws the unaligned bases they carry past them:

<Figure caption="HG002 nanopore, PacBio and Illumina reads over one insertion, soft clipping shown on the Illumina track." src="/img/insertion.png" />

## Strand-split coverage

Mismatch columns that come from basecalling errors often show on one strand
only. **Group by... → Strand** on the nanopore track gives each section a
coverage band built from its own reads:

<Figure caption="HG002 nanopore reads grouped by strand. The left box disagrees in the reverse band only, the right box in both." src="/img/alignments/strand_split_coverage.png" />

## Methylation by haplotype

HG002's nanopore reads also carry 5mC calls in their `MM`/`ML` tags. On hg38,
navigate to the SNRPN imprinting center at `chr15:24,948,000-24,962,000` and
open **HG002 ONT reads (5mC, haplotagged)**. **Color by... → Per-base coloring →
Modifications** paints each CpG from its 5mC call, and **Group by... → Tag...**
with `HP` puts the methylated parental allele in one section and the
unmethylated one in the other:

<Figure caption="HG002 ONT reads over the SNRPN CpG island colored by 5mC. Top: file order. Bottom: grouped by the HP tag." src="/img/methylation/hg002_snrpn_group_by_hp.png" links="Ungrouped=methylation/hg002_snrpn_ungrouped,Grouped by HP=methylation/hg002_snrpn_grouped" />

## See also

- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/sv_visualization)
- [](/docs/tutorials/methylation)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/analyze_trio)
