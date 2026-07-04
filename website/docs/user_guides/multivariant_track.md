---
title: Multi-sample variant display
description: Population-level variant views
guide_category: Track types
---

A VCF can contain genotypes for many samples. JBrowse shows them with one of two
displays, switchable from the track menu:

- **Multi-sample variant display (regular)** — variants drawn at their true
  genomic positions, one row per sample
- **Multi-sample variant display (matrix)** — variants laid out as a heatmap,
  one row per sample and one column per variant

## Regular — best for full SV detail

Each variant is drawn at its real genomic position. This is the only
multi-sample display that renders structural variants at the right scale;
overlapping calls use slight transparency so you can still tell them apart.

If overlaps overwhelm the view, use "Edit filters" in the track menu to hide
variants by size, name, or any Jexl expression.

## Matrix — best for SNP/indel patterns

Each visible variant gets one column and each sample gets one row, regardless of
how far apart the variants are on the genome. A thin black line connects each
column to its real genomic position.

Sparse small variants that would be only 1–2px wide at their true positions each
get a full readable column instead. Patterns like shared haplotypes, runs of
homozygosity, and population structure become visible at a glance.

<Figure caption="A phased trio as a matrix display: one column per variant, one row per haplotype (two per sample), each cell shaded reference vs alt allele. Inherited haplotype blocks read as contiguous vertical bands shared across parent and child rows." src="/img/trio-matrix-phased-clean.png" />

## Genotype coloring — allele dosage vs phased

Both the regular and matrix displays color each genotype cell, and how they
color it is set by the `renderingMode` display option.

In the default **allele-dosage** mode (`renderingMode: 'alleleCount'`), one cell
is drawn per sample and shaded by how many alternate alleles the call carries:

- homozygous reference (`0/0`) → light grey
- heterozygous (`0/1`) → a medium shade
- homozygous alternate (`1/1`) → the darkest shade

so the cell color reads directly as allele dosage (0, 1, or 2 alt alleles) and
runs of homozygous-alt samples stand out as the darkest blocks. Genotypes mixing
two _different_ non-reference alleles (e.g. `1/2`) get a distinct color so they
aren't confused with a simple homozygous-alt call, and uncalled genotypes
(`./.`) are left blank.

In **phased** mode (`renderingMode: 'phased'`), each sample is split into one
row per haplotype and every haplotype cell is colored reference vs alt on its
own, rather than collapsed to a dosage. This is what makes inherited haplotype
blocks line up as the contiguous vertical bands in the trio matrix above. Phased
mode requires phased genotypes (`|`-separated) in the VCF.

You can switch modes from the track menu, or set `renderingMode` in the display
configuration.

## Coloring by consequence impact (SnpEff/VEP annotations)

If the VCF's `INFO` field carries SnpEff `ANN` or VEP `CSQ` annotations, each
variant's alt-carrying cells can be colored by the severity of its most severe
predicted consequence instead of by genotype. From the track menu, open **Color
cells by** and choose **Consequence impact** (this option only appears once the
track detects real annotations in the loaded data — it's hidden, not just
disabled, for unannotated VCFs).

Every annotation is bucketed into one of four impact tiers and painted with a
fixed color, so the legend is the same across tracks:

- **HIGH** (red) — e.g. `stop_gained`, `frameshift_variant`, `exon_loss_variant`
- **MODERATE** (orange) — e.g. `missense_variant`, `inframe_deletion`
- **LOW** (yellow) — e.g. `synonymous_variant`, `splice_region_variant`
- **MODIFIER** (grey) — e.g. `intron_variant`, `intergenic_region`

This works for both SNVs/indels and structural variants — SnpEff's SV-specific
consequence terms (`exon_loss_variant`, `transcript_ablation`, `gene_fusion`,
...) map onto the same four tiers, so a deletion that removes an exon reads as
HIGH the same way a stop-gained SNV does.

<Figure caption="1000 Genomes phase 3 chr1 genotypes (2,504 samples) colored by consequence impact. Real SnpEff annotations against a real Ensembl database — red columns are stop-gained/splice-site variants, orange missense, yellow synonymous/splice-region, and grey (the majority) intronic or intergenic." src="/img/variants/consequence_impact_1000g.png" />

The effect is even more visible on structural variants, since each call renders
as a wide bar rather than a thin line:

<Figure caption="Real HGSVC structural variant calls on chr1, colored by consequence impact. This window lands on NBPF20, a well-documented structural-variation hotspot — the dense red bars are real exon-disrupting deletions predicted HIGH impact by SnpEff." src="/img/variants/consequence_impact_sv.png" />

Set it declaratively in the display configuration with the built-in
`impactColor` Jexl function:

```json
{
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "featureColor": "jexl:impactColor(feature)"
    }
  ]
}
```

`featureColor` accepts any per-feature Jexl expression, not just this preset —
the same slot backs a plain CSS color or a custom expression referencing
`feature` attributes, same as the single-sample `color` slot.

## Coloring and grouping by sample metadata

Samples can be grouped and colored by metadata — population, phenotype, sex, or
any attribute you supply. Add a samples TSV to the adapter with
`samplesTsvLocation`: its first column is the sample name (matching the VCF
header) and each remaining column is a metadata attribute. Setting `colorBy` on
the display configuration to one of those columns groups and colors the
per-sample rows by that attribute the first time the track loads.

The JBrowse demo wires up the 1000 Genomes phase 3 chr1 callset — 2,504 samples
across 26 population codes — this way:

```json
{
  "type": "VariantTrack",
  "trackId": "1kGP_high_coverage_Illumina.chr1...phased_panel.vcf",
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": { "uri": ".../ALL.chr1.phase3...genotypes.vcf.gz" },
    "index": {
      "location": { "uri": ".../ALL.chr1.phase3...genotypes.vcf.gz.tbi" }
    },
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/genomes/hg19/1000g.sorted.csv.gz"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "colorBy": "population"
    }
  ]
}
```

The samples file is a tab-separated table whose first column matches the VCF
sample names; each additional column is a groupable attribute:

```
name	population
HG01879	ACB
HG01880	ACB
NA20525	TSI
```

<Figure caption="The 1000 Genomes phase 3 chr1 callset as a multi-sample variant display. All 2,504 samples are sorted and colored by their population code — the colored strip down the left edge resolves into contiguous population blocks — while each genotype cell is shaded by allele dosage." src="/img/variants/population_1000genomes.png" />

You can also change the grouping attribute and colors interactively after the
track is open.

## Clustering samples by genotype

Samples can be reordered by genotype similarity using hierarchical clustering.
From the track menu, select **Cluster by genotype**. A dialog opens with two
modes:

- **Auto** — runs hierarchical clustering (hclust via JavaScript) directly in
  the browser. Works well for a few hundred samples; larger cohorts may be slow.
- **Manual** — downloads an R script that builds the genotype matrix and runs
  `hclust`. Run the script in R, then paste the resulting sample ordering back
  into the dialog and click **Apply clustering**.

After clustering, a dendrogram appears on the left side of the track and rows
are reordered so genotypically similar samples sit next to each other.

<Figure caption="Clustering a multi-sample variant track. Top: the 'Cluster by genotype' dialog with its auto/manual mode options. Bottom: after clustering, samples are reordered by genotype similarity with a dendrogram on the left." src="/img/variants/cluster_dialog.png" />

Click any internal node in the dendrogram to collapse the view to that clade
(subtree filter). Click the same node again to clear the filter and restore all
rows.

In phased mode, clustering treats each haplotype as a separate row, so the
dendrogram shows haplotype-level relationships rather than sample-level ones.

The clustering uses only the variants currently visible in the view; navigate to
a region with informative variants for the best separation.

### Encoding a clustering result in a session URL

A clustering result can be embedded directly in a session snapshot — useful for
sharing a pre-computed clustering via URL. Set `layout` and `clusterTree` (and
optionally `treeAreaWidth` / `subtreeFilter`) in the display's `displaySnapshot`
(see
[URL parameters → advanced track configuration](/docs/urlparams#advanced-track-configuration)).
The [MultiSampleVariantBaseModel](/docs/models/multisamplevariantbasemodel) docs
have the full field reference.

## See also

- [Variant track](/docs/user_guides/variant_track) — single-sample VCF display
  and the per-sample genotype table
- [Phased trio analysis](/docs/tutorials/analyze_trio) — matrix display with a
  phased SNP trio
- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples) — regular
  display across a large SV cohort
- [Variant track configuration](/docs/config_guides/variant_track) — config-file
  options
