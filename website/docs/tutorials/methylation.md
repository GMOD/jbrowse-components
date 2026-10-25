---
title: Methylation (long-read)
description:
  Per-read, aggregate, and allele-specific 5mC from HG002 nanopore reads
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

Nanopore and PacBio basecallers record each read's DNA methylation in
base-modification tags (`MM` and `ML`), and JBrowse draws those calls straight
from the BAM. At the _SNRPN_ imprinting center, one parent's copy is methylated
and the other's is not. In HG002 nanopore reads there we:

- color each read by its modification calls
- tally the calls into an aggregate track with modkit
- group the reads by haplotype to pull the two parental alleles apart
- smooth each allele into a moving average across the imprinted domain

## Prerequisites

- for your own data, long reads whose BAM or CRAM already has `MM`/`ML`
  modification tags, which modern ONT and PacBio basecallers write by default,
  plus a JBrowse instance to load them into (the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))
- [modkit](https://github.com/nanoporetech/modkit/releases) 0.6 or later, Oxford
  Nanopore's single-binary tool for tallying per-read calls into per-CpG
  methylation fractions, for the aggregate section only
- [WhatsHap](https://whatshap.readthedocs.io/), to haplotag reads of your own
  that have no `HP` tag

<!-- TUTORIAL_INSTALL whatshap START -->

```bash
pip install whatshap
```

<!-- TUTORIAL_INSTALL whatshap END -->

## The data

The files are region slices of public
[ONT open data](https://labs.epi2me.io/dataindex/) on the `ont-open-data` S3
bucket.

The track configs below load region slices we host, cut from these files, so no
download is needed. Reads of your own with `MM` and `ML` tags load by swapping
`uri`, as _Per-read methylation from the alignments_ shows.

<details>
<summary>The files</summary>

| What it is                                                                                                                                                                                                         | File                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The HP1 bedMethyl (per-CpG methylation fractions) from the `wf-human-variation` sup run on HG002, restricted to `m` (5mC) rows and cut to the SNRPN locus, and to chr15:22,000,000-27,000,000 for the last section | [SAMPLE.wf_mods.1.bedmethyl.gz](https://ont-open-data.s3.amazonaws.com/giab_2025.01/analysis/wf-human-variation/sup/HG002/PAW70337/output/SAMPLE.wf_mods.1.bedmethyl.gz) |
| The HP2 bedMethyl from that same run                                                                                                                                                                               | [SAMPLE.wf_mods.2.bedmethyl.gz](https://ont-open-data.s3.amazonaws.com/giab_2025.01/analysis/wf-human-variation/sup/HG002/PAW70337/output/SAMPLE.wf_mods.2.bedmethyl.gz) |
| The reads, from the HG002 sup basecalls, sliced to the same locus and haplotagged with `whatshap haplotag` against the phased SNP calls from that same `wf-human-variation` run                                    | [PAO83395.pass.cram](https://ont-open-data.s3.amazonaws.com/giab_2023.05/analysis/hg002/sup/PAO83395.pass.cram)                                                          |

</details>

## Two parental alleles at the SNRPN imprinting center

Every view below is at `chr15:24,948,000-24,962,000`, the _SNRPN_ imprinting
center; type it into the location box once the tracks are loaded. The reads and
the aggregate profile should agree on which allele is methylated.

## Loading GRCh38

The track's `assemblyNames` has to name the assembly the reads were aligned to,
GRCh38.

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
hg38 hub config, https://jbrowse.org/ucsc/hg38/config.json, has both:

- **CpG Islands** reads https://jbrowse.org/ucsc/hg38/cpgIslandExt.bed.gz with a
  CSI index
- **NCBI RefSeq - RefSeq All** reads
  https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz

## Per-read methylation from the alignments

Load the modBAM as an alignments track. For your own reads, swap `uri` for a
sorted modBAM or CRAM with the `.bai` or `.crai` beside it, aligned to the same
assembly:

```json addtrack loc=chr15:24,948,000-24,962,000
{
  "trackId": "HG002_snrpn_5mC_reads",
  "name": "HG002 ONT reads (5mC, haplotagged)",
  "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam",
  "assemblyNames": ["hg38"]
}
```

**File → Open track...** also opens the file by URL and infers the `.bai`.

**Color by... → Modifications** in the track menu paints each read with its 5mC
calls:

- On its own it paints the positions the MM tag reports as modified
- **Show unmodified in blue** (IGV's "2-color" scheme) also fills in every CpG
  the tag left implicit, so an unmethylated region is solid blue

The
[alignments track guide](/docs/user_guides/alignments_track#modifications-and-methylation)
covers both modes and the probability and cytosine-context filters.

<Video src="/media/methylation/open_modbam.mp4" caption="The modBAM opened by URL and colored from its track menu with Color by... → Modifications and Show unmodified in blue." />

<Figure caption="HG002 ONT reads over the SNRPN CpG island in both modification color modes. The bottom mode fills every unmarked CpG in blue." src="/img/methylation/hg002_snrpn_mod_modes.png" links="Modified only=methylation/hg002_snrpn_marked_only,Every CpG=methylation/hg002_snrpn_fill_unmarked" />

## Aggregate methylation with modkit bedMethyl

[modkit pileup](https://nanoporetech.github.io/modkit/) collapses the per-read
calls into a bedMethyl file with one row per CpG per modification type, each
holding the fraction of reads that were modified. The file is much smaller than
the reads.[^dmr]

```bash
# --cpg: count at CpG sites only
# --combine-strands: one row per CpG, the two strands summed
# --combine-mods with --modified-bases C: 5mC and 5hmC summed into one fraction
modkit pileup sample.bam output.bedmethyl --ref reference.fa \
  --cpg --combine-strands --combine-mods --modified-bases C
bgzip output.bedmethyl
tabix -p bed output.bedmethyl.gz
```

Two `modkit pileup` options shape the output:

- `--combine-mods` collapses 5mC and 5hmC into a single fraction
  (bisulfite-equivalent). Pass `--modified-bases 5mC 5hmC` without it to keep
  separate rows per modification type (`m` for 5mC, `h` for 5hmC)
- `--phased` writes one file per haplotype from the reads' `HP` tags, and this
  dataset uses it

With `--phased` the output argument is a directory, which gets `hp1.bedmethyl`,
`hp2.bedmethyl` and `combined.bedmethyl`:

```bash
modkit pileup sample.bam hp_bedmethyl/ --ref reference.fa \
  --cpg --combine-strands --combine-mods --modified-bases C --phased
```

bedMethyl is a BED file with a numeric score column, so it loads as a
`MultiQuantitativeTrack` (see the
[multi-quantitative track config guide](/docs/config_guides/quantitative_track)).
JBrowse reads the modification type from the `name` column and draws one
subtrack per type, with a vertical bar per CpG on a percent-methylation axis:

```json addtrack loc=chr15:24,948,000-24,962,000
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

Each long read is one DNA molecule, so reads with an `HP` haplotype tag (from
WhatsHap, HiPhase or ONT's `wf-human-variation`) separate by allele. In
[grammar-of-graphics](/docs/config_guides/mark_display) terms, **Group by...**
sets a `facet`, which splits the display into stacked sections, one per value of
a field.

Pick **Group by... → Tag...** in the track menu and enter `HP`. The pileup then
stacks into:

- one band per haplotype, one methylated over the island and the other
  unmethylated
- an `HP: none` band for the reads the haplotagging could not assign

The dialog also offers to color reads by the tag; with methylation coloring on,
that box starts unchecked, and leaving it unchecked keeps the coloring.
**Advanced → Edit plot...** shows the resulting `facet` as text.

<Video src="/media/methylation/group_by_hp.mp4" caption="Group by... → Tag... with HP, splitting the pileup by haplotype." />

<Figure caption="HG002 ONT reads over the SNRPN CpG island colored by 5mC. Top: file order. Bottom: grouped by the HP tag." src="/img/methylation/hg002_snrpn_group_by_hp.png" links="Ungrouped=methylation/hg002_snrpn_ungrouped,Grouped by HP=methylation/hg002_snrpn_grouped" />

The two per-haplotype bedMethyl files from `--phased` load as one track above
the reads, with a row per file. Pinning the axis at 0 to 100 puts both rows on
one scale, so an unmethylated row stays flat:

```json addtrack loc=chr15:24,948,000-24,962,000
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
    "encoding": {
      "y": {
        "scale": { "domainMin": 0, "domainMax": 100 },
        "axis": { "title": "% 5mC" }
      }
    }
  }
}
```

<Figure caption="The SNRPN CpG island: the per-haplotype profile on top, the reads grouped by HP below." src="/img/methylation/hg002_snrpn_combined.png" />

Reads of your own without an `HP` tag get one from `whatshap haplotag`, which
reads a phased VCF. The
[alignments track guide](/docs/user_guides/alignments_track#grouping-reads)
covers the Group-by dialog:

```bash
whatshap haplotag --reference reference.fa -o haplotagged.bam phased.vcf.gz reads.bam
samtools index haplotagged.bam
```

## Smoothing across the imprinted domain

A single CpG's fraction rests on the few reads covering it, so per-site values
scatter from 0 to 100 and a difference spread over many sites is hard to see. A
`window` step averages each CpG with a fixed number of neighbouring CpGs, so a
CpG island weighs as many sites as it holds. We'll load both haplotypes around
_SNRPN_, each in a row with its raw values under a moving average:

```json addtrack loc=chr15:24,800,000-25,200,000
{
  "type": "MultiQuantitativeTrack",
  "trackId": "HG002_imprinted_5mC_smoothed",
  "name": "HG002 5mC by haplotype, moving average",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BedTabixAdapter",
        "name": "HP1",
        "color": "#d62728",
        "uri": "https://jbrowse.org/demos/methylation/HG002_chr15_imprinted_hp1.modkit.bed.gz"
      },
      {
        "type": "BedTabixAdapter",
        "name": "HP2",
        "color": "#1f77b4",
        "uri": "https://jbrowse.org/demos/methylation/HG002_chr15_imprinted_hp2.modkit.bed.gz"
      }
    ]
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "HG002_imprinted_5mC_smoothed-LinearMarkDisplay",
      "rows": "source",
      "legend": { "show": false },
      "fetchSizeLimit": 5000000,
      "encoding": {
        "y": {
          "scale": { "domainMin": 0, "domainMax": 100 },
          "axis": { "title": "% 5mC" }
        }
      },
      "marks": [
        {
          "mark": "point",
          "encoding": {
            "y": "score",
            "color": { "value": "#bbbbbb" },
            "size": 2
          }
        },
        {
          "mark": { "type": "line", "interpolate": "linear" },
          "transform": [
            {
              "type": "window",
              "groupby": ["source"],
              "frame": [-50, 50],
              "ops": [
                {
                  "op": "mean",
                  "field": "score",
                  "weight": "n_valid_cov",
                  "as": "meth"
                }
              ]
            }
          ],
          "encoding": {
            "y": "meth",
            "color": {
              "field": "source",
              "scale": {
                "domain": ["HP1", "HP2"],
                "range": ["#d62728", "#1f77b4"]
              }
            },
            "strokeWidth": 2
          }
        }
      ]
    }
  ]
}
```

The display draws two marks over the same rows:

- **the `point` mark** plots each CpG's `score`, its percent methylated, in grey
- **the `line` mark** plots `meth`, which the `window` step writes: each CpG's
  mean over the 50 CpGs on either side, weighted by `n_valid_cov`, the read
  depth modkit counted there
- **with `groupby: ["source"]`** the step averages each haplotype over that
  haplotype's CpGs, and with `rows: "source"` the display gives each haplotype a
  row whose label names it, so `legend.show` is off
- **with `fetchSizeLimit`** raised, the track reads the whole slice when zoomed
  out

Type `chr15:24,800,000-25,200,000` into the location box to see the _SNRPN_
promoter and the stretch of _SNHG14_ downstream of it:

<Figure caption="HG002 5mC by haplotype over SNRPN and SNHG14, each CpG in grey under its moving average." src="/img/methylation/hg002_imprinted_smoothed.png" />

**Edit marks...** in the track menu opens the marks. In the line's `window`
step, set **rows before** and **rows after** to 500 for a 1,001-CpG average,
then type `chr15:22,200,000-26,900,000` to take in the whole imprinted domain:

<Figure caption="The same track across the Prader-Willi and Angelman domain with a wider moving average." src="/img/methylation/hg002_imprinted_domain.png" />

## See also

- [](/docs/user_guides/alignments_track#modifications-and-methylation)
- [](/docs/user_guides/alignments_track#grouping-reads)
- [](/docs/tutorials/bisulfite)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/giab_hg002_reads)
- [](/docs/tutorials/rnaseq)
- [](/docs/user_guides/quantitative_track)

## External links

- [modkit documentation](https://nanoporetech.github.io/modkit/)
- [Methylation (long-read) in R](https://github.com/GMOD/ggjbrowse/blob/main/docs/tutorials/methylation.md),
  the same analysis written for ggjbrowse

[^dmr]:
    To compare two samples, run `modkit dmr` on their per-sample pileups and
    load its BED output as a `FeatureTrack` beside the bedMethyl tracks, so the
    differentially-methylated regions line up with the positions driving them.
