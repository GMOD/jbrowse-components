---
title: Phased trio analysis
description: Examine inheritance patterns and variant phasing in a trio dataset
guide_category: Tutorials
---

A **trio** is sequencing data from a mother, father, and child together. A
**phased** VCF assigns each variant to one of the two haplotypes (`0|1` vs
`1|0`), so you can trace which copy of the genome each variant came from.

This tutorial uses a pre-built phased VCF from the 1000 Genomes Project — the
Kinh-Vietnamese trio HG02024 (chr1 only):

- [VCF](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
- [Index (.tbi)](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz.tbi)

Add the VCF to JBrowse via the CLI (`jbrowse add-track`) or the in-app "Add
track" workflow (see the
[variant track guide](/docs/config_guides/variant_track)). Once loaded:

<Figure caption="Initial load of the VCF file, showing the default display mode with simple orange boxes for each variant" src="/img/trio-basic.png"/>

## Enabling the matrix view

Switch the track to the
[Multi-sample variant display (matrix)](/docs/user_guides/multivariant_track)
display. Each sample becomes a row, each variant a column, with black lines
connecting columns back to their genomic positions.

<Figure caption="Multi-sample variant display (matrix). Each sample is a row and each variant is a column, and black lines connect columns to their genome positions." src="/img/trio-matrix.png"/>

## Enabling the phased mode

The matrix display has a "phased" rendering mode, available when the genotypes
use the `0|1` (phased) separator instead of `0/1` (unphased).

Ideally your variants are fully phased, which often requires a dedicated phasing
program such as SHAPEIT.

<Figure caption="Screenshot showing the phased rendering mode along with the menu item used to select it 'Rendering mode'->'Phased'" src="/img/trio-matrix-phased.png"/>

## Reading matching haplotypes off the matrix

In the phased display each row reads like a barcode, so matching stretches
between rows stand out by eye: the child's two haplotypes match the mother's in
some blocks and the father's in others. The rest of this tutorial turns that
by-eye pattern into a painted track.

<Figure caption="Screenshot showing the phased rendering mode without any added markup. You can look at this figure and see various areas where rows match one another. The first two rows are the two haplotypes of the child, next two rows are the two haplotypes of the mom, and next two rows are the two haplotypes of the father" src="/img/trio-matrix-phased-clean.png"/>

## Using a program to help find phased blocks

The by-eye matching above can also be found programmatically.
[hap-ibd](https://github.com/browning-lab/hap-ibd) finds "identical by descent"
blocks — built for population-scale cohorts, but works on a single trio VCF too.
It takes as input:

- a phased VCF like the
  [trio dataset](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
- a genetic map in PLINK format (the README of hap-ibd provides these for
  GRCh38)

## What we're visualizing: crossover points

Each of the child's inherited chromosomes is a mosaic of the two copies its
parent carries, joined at crossover breakpoints. The painting below marks where
those joins fall — one row per parental haplotype, with the block stepping
between a parent's two rows at each crossover.

## Running hap-ibd

hap-ibd needs the phased VCF and a genetic map. The trio VCF labels its
chromosome `1` (no `chr` prefix), so use the `no_chr_in_chrom_field` variant of
the GRCh38 PLINK map:

```bash
java -jar hap-ibd.jar \
  gt=HG02024_VN049_KHVTrio.chr1.vcf.gz \
  map=plink.chr1.GRCh38.map \
  out=trio min-seed=1.0 min-output=1.0
```

This writes `trio.ibd.gz`, one row per shared segment, with columns: sample1,
hap1, sample2, hap2, chrom, start, end, cM-length. In a trio, every segment
pairs the child with one parent, and the child's two haplotypes split cleanly
between the parents:

| child haplotype | matches parent   | inherited copy |
| --------------- | ---------------- | -------------- |
| HG02024:1       | HG02026 (father) | paternal       |
| HG02024:2       | HG02025 (mother) | maternal       |

(The parent roles come from the 1000 Genomes pedigree line
`VN049 HG02024 HG02026 HG02025` — father HG02026, mother HG02025.) Within a
child haplotype the matching _parental_ copy flips between the parent's copy 1
and copy 2 at each recombination breakpoint — that flip is the crossing-over
event we want to see.

The raw segments are fragmented, though: hap-ibd only emits stretches that pass
its cM-length thresholds, so there are gaps, and statistically-phased data (see
[the caveat on the input data](#a-caveat-on-the-input-data) below) sprinkles in
short spurious flips. So we don't paint the raw segments — we first collapse
them into clean inheritance blocks.

## Converting hap-ibd data into painted inheritance blocks

We want **one row per parental haplotype** — father copy 1, father copy 2,
mother copy 1, mother copy 2 — with the child's inherited chromosome tiled
across each parent's pair of rows. A crossover then shows up as the painted
block stepping from one row to its partner.

A short post-processing step turns the raw hap-ibd segments into clean blocks.
Per child haplotype it:

- merges adjacent segments of the same parental copy into runs,
- drops short interior runs (the switch-error specks), and
- snaps each remaining crossover to the midpoint of the gap between runs, so the
  blocks abut (genuine large gaps, like the centromere, stay blank).

It writes one BED9 line per block plus a `parenthap` label, coloring the
father's two copies in blues and the mother's in reds via `itemRgb`.

`bgzip` and `tabix -p bed` the resulting BED so the `BedTabixAdapter` below can
read it. The finished track for this dataset is already loaded in the
[live demo](#live-demo) at the end of this page.

Load the result as a `FeatureTrack` whose display is a
`LinearMultiRowFeatureDisplay`: partition rows by the `parenthap` column, order
the four rows father-then-mother, and read each block's color from `itemRgb`.

```json
{
  "type": "FeatureTrack",
  "trackId": "khv_trio_hapibd",
  "name": "KHV trio hap-ibd haplotype blocks (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "thickStart",
      "thickEnd",
      "itemRgb",
      "parenthap"
    ],
    "bedGzLocation": { "uri": "trio.hapibd.bed.gz" },
    "index": { "location": { "uri": "trio.hapibd.bed.gz.tbi" } }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "khv_trio_hapibd-LinearMultiRowFeatureDisplay",
      "partitionField": "parenthap",
      "color": "jexl:'rgb('+get(feature,'itemRgb')+')'",
      "rowOrder": ["Father hap1", "Father hap2", "Mother hap1", "Mother hap2"]
    }
  ]
}
```

## Visualizing crossing-over points

The painting is now automatic — no manual markup needed. The four rows are the
two parental copies of each parent (blues for father HG02026, reds for mother
HG02025):

<Figure caption="hap-ibd inheritance blocks painted with the multi-row feature display. The top two rows (blue) are father HG02026's two haplotypes, and the bottom two (red) are mother HG02025's. The child's paternal chromosome is tiled across the two blue rows and its maternal chromosome across the two red rows, so each crossover is the boundary where a painted block steps from one row to its partner." src="/img/trio-hapibd-painting.png"/>

Read the two blue rows together as the child's single **paternal** chromosome:
at any position exactly one of them is filled, telling you which of the father's
two copies the child inherited there. Each place the block steps between the two
blue rows is a **crossing-over point**. The two red rows work the same way for
the **maternal** chromosome.

## Relating the painting back to the genotypes

Stacking the painting directly above the same VCF in the **phased multi-sample
variant display** shows where the blocks come from. That display draws the
genotypes at their genomic positions (use it rather than the _matrix_ mode,
whose evenly-spaced columns no longer line up with the painting). It has six
rows — the two haplotypes of each trio member — and the painting summarizes
which parental haplotype the child's haplotype matches at each position.

A crossover spans a single base, so the whole-chromosome view is too zoomed-out
to read it off the genotypes. At that scale the matrix is a solid block of
color. Zoom instead to a few hundred kb around one boundary, where the
painting's block-step is clear and the genotype columns resolve into individual
variants. The clearest crossover to start with is the **paternal** one near
chr1:29.7 Mb:

<Figure caption="Paternal crossover near chr1:29.7 Mb (~400 kb wide). In the painting (top) the child's paternal chromosome steps from Father hap2 (light blue) to Father hap1 (dark blue), and an arrow drops to the same breakpoint in the genotypes below. The tinted frames read the switch off the raw genotypes: left of the crossover the yellow frame ties Child hap1 to Father hap2, right of it the purple frame ties Child hap1 to Father hap1, and the yellow/purple blocks on the Child hap1 row abut exactly at the breakpoint." src="/img/trio-crossover-paternal.png"/>

The **maternal** chromosome does the same thing at its own boundaries. Near
chr1:55.8 Mb the child's maternal haplotype steps between the mother's two
copies:

<Figure caption="Maternal crossover near chr1:55.8 Mb (~400 kb wide), the cleanest maternal boundary on chr1. The child's maternal chromosome steps from Mother hap2 (pink) to Mother hap1 (red). Same idea as the paternal figure in its own palette: the green frame ties Child hap2 to Mother hap2 left of the crossover, the orange frame ties it to Mother hap1 right of it, and the green/orange blocks abut at the breakpoint on the Child hap2 row." src="/img/trio-crossover-maternal.png"/>

The painting is the clean summary. The genotype rows are the raw evidence behind
it, and that evidence is noisy. Read the inherited copy site-by-site off the
genotypes and it flickers between the two parental copies every few kb. Those
flickers are phasing switch errors, not crossovers, and hap-ibd's length
threshold filters most of them out — which is why we trust its block-step over
the raw genotypes. It doesn't catch all of them, so treat the two crossovers
above as the well-supported ones and the smaller boundaries as approximate. The
next section explains why.

## A caveat on the input data

This 1000 Genomes VCF is _statistically_ phased, not trio- or read-backed
phased, so its haplotypes carry **switch errors** roughly every megabase. Read
straight off the genotypes, those errors look like dozens of extra crossovers
per chromosome. hap-ibd's cM-length threshold acts as a switch-error filter,
which is why its post-processed blocks track the real boundaries more closely —
but it was built for distant relatives in large cohorts, not trios, so treat the
block boundaries as approximate. For an exact map, re-phase the trio with a
pedigree-aware or read-backed phaser (SHAPEIT with the pedigree, WhatsHap on
long reads) before painting.

## See also

- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples) —
  structural variant analysis with the 1000 Genomes dataset: multi-sample
  genotypes, trio inheritance of SVs, and a large chromosomal inversion.
- [Multi-sample variant display](/docs/user_guides/multivariant_track) — the
  matrix/phased display this tutorial builds on.
- [Variant track config](/docs/config_guides/variant_track) — loading the phased
  VCF used throughout.

## Live demo

[Open this session](https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg38","loc":"1:62,174,000-65,097,304","tracks":[{"trackId":"HG02024_VN049_KHVTrio.chr1.vcf","displaySnapshot":{"type":"LinearVariantMatrixDisplay","renderingMode":"phased","minorAlleleFrequencyFilter":0.1}}]}]})
to explore the trio dataset described above. The "Open this view in JBrowse"
link under the painting figure opens the hap-ibd track on its own.
