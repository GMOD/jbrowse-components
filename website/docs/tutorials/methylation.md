---
title: Methylation (long-read)
description:
  Per-read, aggregate, and allele-specific 5mC from HG002 nanopore reads
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

JBrowse reads DNA methylation straight from the MM/ML tags nanopore and PacBio
basecallers write. We follow one dataset, HG002 nanopore reads over an
imprinting center, from per-read calls to an aggregate profile to the two
parental alleles pulled apart.

## Prerequisites

- for your own data, long reads whose BAM or CRAM already carries `MM`/`ML`
  modification tags, which modern ONT and PacBio basecallers write by default,
  plus a JBrowse instance to load them into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop), which opens a local modBAM
  with no hosting step)
- [modkit](https://github.com/nanoporetech/modkit/releases) for the aggregate
  section only, a single-binary download from its releases page

## Where the data comes from

The files are region slices of public
[ONT open data](https://labs.epi2me.io/dataindex/) on the `ont-open-data` S3
bucket.

- the HP1 bedMethyl from the `wf-human-variation` sup run on HG002, restricted
  to the SNRPN locus and to `m` (5mC) rows:
  https://ont-open-data.s3.amazonaws.com/giab_2025.01/analysis/wf-human-variation/sup/HG002/PAW70337/output/SAMPLE.wf_mods.1.bedmethyl.gz
- the HP2 bedMethyl from that same run:
  https://ont-open-data.s3.amazonaws.com/giab_2025.01/analysis/wf-human-variation/sup/HG002/PAW70337/output/SAMPLE.wf_mods.2.bedmethyl.gz
- the reads, from the HG002 sup basecalls, sliced to the same locus and
  haplotagged with `whatshap haplotag` against the phased SNP calls from that
  same `wf-human-variation` run:
  https://ont-open-data.s3.amazonaws.com/giab_2023.05/analysis/hg002/sup/PAO83395.pass.cram
- the HP1 slice the figures load, rehosted on jbrowse.org:
  https://jbrowse.org/demos/methylation/HG002_SNRPN_hp1.modkit.bed.gz
- the haplotagged read slice beside it:
  https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam

## The SNRPN imprinting center

At this locus on chr15, one parental allele is methylated and the other is
unmethylated. The reads should split into two populations, and the reads and the
aggregate profile should agree on which allele is which.

## Per-read methylation from the alignments

Load the modBAM as an alignments track. Its `assemblyNames` must match an
assembly already configured in JBrowse (see the
[assemblies configuration guide](/docs/config_guides/assemblies)), and JBrowse
finds the `.bai` index beside the file:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "HG002_snrpn_5mC_reads",
  "name": "HG002 ONT reads (5mC, haplotagged)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam"
  }
}
```

**File → Open track...** also opens the file by URL and infers the `.bai`.

Set **Color by... → Modifications** from the track menu to paint each read with
its 5mC calls. The first mode paints the positions the MM tag reports as
modified. The second (IGV's "2-color" scheme) also fills in every CpG the tag
left implicit, so an unmethylated region is solid blue. The
[alignments track guide](/docs/user_guides/alignments_track#modifications-and-methylation)
covers both modes, the probability threshold, and the cytosine-context submenu.

<Video src="/media/methylation/open_modbam.mp4" caption="The modBAM opened by URL and colored from its new track menu: Color by..., Modifications, and the two-color mode painting methylated CpGs red and unmethylated ones blue." />

<Figure caption="HG002 ONT reads over the SNRPN CpG island in both modification color modes. Top, the MM tag's modified positions alone, red against bare read bodies. Bottom, the same reads with every unmarked CpG filled in, so a read carrying no methylation reads blue where it was blank." src="/img/methylation/hg002_snrpn_mod_modes.png" links="Modified only=methylation/hg002_snrpn_marked_only,Every CpG=methylation/hg002_snrpn_fill_unmarked" />

The pileup over the CpG island interleaves methylated and unmethylated reads.
Grouping the reads by their `HP` haplotype tag separates them, in
[Splitting the alleles apart](#splitting-the-alleles-apart).

## Aggregate methylation with modkit bedMethyl

[modkit pileup](https://nanoporetech.github.io/modkit/) collapses the per-read
calls into a bedMethyl file with one row per CpG per modification type, each
holding the fraction of reads that were modified. The file is much smaller than
the reads and draws quickly at whole-genome zoom.

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

Each long read is a single DNA molecule, so reads that carry an `HP` haplotype
tag (from WhatsHap, HiPhase, or ONT's `wf-human-variation`) can be separated by
allele. Pick **Group by... → Tag...** from the track menu and enter `HP`. The
dialog scans the reads in view, reports the values it found, and offers to color
reads by the same tag; with methylation coloring on, that box starts unchecked
and the coloring stays. The pileup then stacks into one band per haplotype, one
methylated over the island and the other unmethylated.

<Video src="/media/methylation/group_by_hp.mp4" caption="The split as the menu does it: the interleaved pileup, the tag dialog finding HP values 1 and 2 in the reads themselves, and one methylated band resolving over one unmethylated." />

<Figure caption="HG002 ONT reads over the SNRPN CpG island, colored by 5mC with unmethylated CpGs in blue. Top: file order. Bottom: the same reads grouped by the HP tag, one band per haplotype. Only the grouping differs." src="/img/methylation/hg002_snrpn_group_by_hp.png" links="Ungrouped=methylation/hg002_snrpn_ungrouped,Grouped by HP=methylation/hg002_snrpn_grouped" />

Next, load the two per-haplotype bedMethyl files above the reads as one track
with a row per file. Pinning the axis at 0 to 100 puts both rows on one scale,
so an unmethylated row stays flat:

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

<Figure caption="Imprinting at the SNRPN / Prader-Willi center: one haplotype methylated, the other not. The per-haplotype profile on top, the reads grouped by HP below." src="/img/methylation/hg002_snrpn_combined.png" />

The aggregate profile and the reads split the same way, with the same haplotype
methylated in both.

See the
[alignments track guide](/docs/user_guides/alignments_track#grouping-reads) for
the Group-by dialog. `whatshap haplotag` writes the `HP` tag onto your own reads
from a phased VCF.

### Declaring the split in a config

The menu writes the split into the track's settings. The same split can be
declared up front on a [mark display](/docs/config_guides/mark_display), which
draws the reads as a plot from a config rather than through the alignments
track's menus, and takes any tag as the field to split on. We'll declare it
twice over the same BAM:

- **one band per haplotype**, the reads packed into a pileup under a chip that
  names the tag's value, with `facet` on the `HP` tag:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "HG002_snrpn_reads_by_hp",
  "name": "HG002 reads by haplotype",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "HG002_snrpn_reads_by_hp-LinearMarkDisplay",
      "facet": "tags.HP",
      "marks": [
        {
          "mark": "span",
          "transform": [{ "type": "pileup" }],
          "encoding": { "color": { "field": "tags.HP", "title": "Haplotype" } }
        }
      ]
    }
  ]
}
```

- **one row per haplotype of read depth**, with `rows` on the same tag and a
  `coverage` step counting each row's reads:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "HG002_snrpn_depth_by_hp",
  "name": "HG002 depth by haplotype",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "HG002_snrpn_depth_by_hp-LinearMarkDisplay",
      "rows": "tags.HP",
      "marks": [
        {
          "mark": "bar",
          "transform": [{ "type": "coverage" }],
          "encoding": { "color": { "field": "tags.HP", "title": "Haplotype" } }
        }
      ]
    }
  ]
}
```

Reads carrying no `HP` tag take a band and a row of their own. The
[mark display guide](/docs/config_guides/mark_display#facets) covers the facet's
order, its chips and the other fields a facet or rows can split on.

<Figure caption="The haplotype split declared: read depth one row per HP value on top, the reads packed one band per value below, both over the same haplotagged BAM and the same window as the figures above." src="/img/methylation/hg002_snrpn_declared_by_hp.png" />

## Navigating with bedMethyl and comparing samples

The bedMethyl track draws quickly at any zoom, so it suits whole-genome
navigation and a tumor-versus-normal comparison. Add the per-read BAM or CRAM
below it once you narrow in, for single-molecule and
[allele-specific](#splitting-the-alleles-apart) detail.

To compare two samples, run `modkit dmr` on their per-sample pileups and load
its BED output as a `FeatureTrack` beside the bedMethyl tracks, so the
differentially-methylated regions line up with the positions driving them.

## See also

- [](/docs/user_guides/alignments_track#modifications-and-methylation)
- [](/docs/user_guides/alignments_track#grouping-reads)
- [](/docs/tutorials/bisulfite)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/rnaseq)
- [](/docs/user_guides/quantitative_track)
- [modkit documentation](https://nanoporetech.github.io/modkit/)
