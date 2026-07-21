---
title: Multi-sample variant display
description: Population-level variant views
guide_category: Track types
---

A VCF can contain genotypes for many samples. JBrowse shows them with one of two
displays, switchable from the track menu:

- Multi-sample variant display (regular) - variants drawn at their true genomic
  positions, one row per sample
- Multi-sample variant display (matrix) - variants laid out as a heatmap, one
  row per sample and one column per variant

## Regular: best for full SV detail

Each variant is drawn at its real genomic position. This is the only
multi-sample display that renders structural variants at the right scale;
overlapping calls use slight transparency so you can still tell them apart.

If overlaps overwhelm the view, use "Edit filters" in the track menu to hide
variants by size, name, or any Jexl expression.

## Matrix: best for SNP/indel patterns

Each visible variant gets one column and each sample gets one row, regardless of
how far apart the variants are on the genome. A thin black line connects each
column to its real genomic position.

Sparse small variants that would be only 1–2px wide at their true positions each
get a full readable column instead. Patterns like shared haplotypes, runs of
homozygosity, and population structure become visible at a glance.

<Figure caption="A phased trio as a matrix display: one column per variant, one row per haplotype (two per sample), each cell shaded reference vs alt allele. Inherited haplotype blocks read as contiguous vertical bands shared across parent and child rows." src="/img/trio-matrix-phased-clean.png" />

## Filtering by allele frequency and missingness

Two inline sliders in the track menu thin a dense callset down to the variants
worth looking at, with no Jexl expression to write. Both live under **Track menu
→ Filter by...** and re-fetch as you release the slider:

- **Minor allele frequency** hides variants whose minor allele frequency falls
  below the threshold, so singletons and near-monomorphic sites drop out and the
  common, population-informative variants remain.
- **Missingness** hides variants whose fraction of no-call genotypes rises above
  the threshold. Its
  [default](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-maxmissingnessfilter)
  keeps every variant; lowering it drops the poorly-genotyped columns that are
  mostly missing data.

Missingness is especially useful on a matrix display, where each variant takes a
full column no matter how many of its genotypes are no-calls. The tetraploid
potato callset below is dominated by no-call (yellow) columns until the ceiling
is lowered to 0.1, which drops every variant with more than 10% missing
genotypes and leaves the well-genotyped sites.

<Figure src="/img/variants/potato_missingness.png" links="No filter=variants/potato_missingness_before,Max missingness 0.1=variants/potato_missingness_after" caption="Tetraploid potato multi-sample VCF as a genotype matrix. Top: the default missingness ceiling keeps every variant, and no-call (yellow) columns dominate. Bottom: a 0.1 ceiling drops variants with more than 10% no-call genotypes, so the remaining columns are the well-genotyped homozygous-reference, heterozygous, and homozygous-alt sites." />

Set either filter declaratively with the
[`minorAlleleFrequencyFilter`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-minorallelefrequencyfilter)
and
[`maxMissingnessFilter`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-maxmissingnessfilter)
display slots:

```json
{
  "displays": [
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "maxMissingnessFilter": 0.1
    }
  ]
}
```

## Genotype coloring: allele dosage vs phased

Both the regular and matrix displays color each genotype cell, and how they
color it is set by the
[`renderingMode`](/docs/config/linearmultisamplevariantdisplay/#slot-renderingmode)
display option.

In **allele-dosage** mode (`'alleleCount'`), one cell is drawn per sample and
shaded by how many alternate alleles the call carries:

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
track detects real annotations in the loaded data, it's hidden, not just
disabled, for unannotated VCFs).

Every annotation is bucketed into one of four impact tiers and painted with a
fixed color, so the legend is the same across tracks:

- HIGH (red) - e.g. `stop_gained`, `frameshift_variant`, `exon_loss_variant`
- MODERATE (orange) - e.g. `missense_variant`, `inframe_deletion`
- LOW (yellow) - e.g. `synonymous_variant`, `splice_region_variant`
- MODIFIER (grey) - e.g. `intron_variant`, `intergenic_region`

This works for both SNVs/indels and structural variants. SnpEff's SV-specific
consequence terms (`exon_loss_variant`, `transcript_ablation`, `gene_fusion`,
...) map onto the same four tiers, so a deletion that removes an exon reads as
HIGH the same way a stop-gained SNV does.

<Figure caption="1000 Genomes phase 3 chr1 genotypes (2,504 samples) colored by consequence impact from SnpEff annotations. Red columns are stop-gained/splice-site variants, orange missense, yellow synonymous/splice-region, and grey (the majority) intronic or intergenic." src="/img/variants/consequence_impact_1000g.png" />

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

`featureColor` accepts any per-feature Jexl expression, not just this preset.
The same slot backs a plain CSS color or a custom expression referencing
`feature` attributes, same as the single-sample `color` slot.

## Coloring by SV type

Structural variants can be colored by their class instead of by genotype: each
alt-carrying cell takes the color of its variant's structural-variant type. From
the track menu, open **Color cells by** and choose **SV type** (like the
consequence option, it only appears once the track detects structural variants
in the loaded data).

The common classes get fixed colors, so the legend reads the same across tracks:
deletion (red), duplication (blue), insertion (green), inversion (orange), copy
number (purple), and breakend (brown). Any other `SVTYPE` token gets an
auto-assigned color and shows its raw token in the legend, and a record whose
alleles span more than one class is flagged **Mixed** (grey). The legend lists
only the classes actually present in the loaded region.

Copy-number alleles written as `<CN0>`, `<CN1>`, `<CN3>`, ... are colored on an
absolute rainbow by copy number (low copy blue, ascending to red) rather than a
single flat color, so different copy states read apart. It is a plain ascending
spectrum, not centered on any assumed baseline copy number.

The class is read from the ALT allele (`<DEL>`, `<CN3>`, breakend notation),
falling back to `INFO/SVTYPE` when the ALT is a plain sequence.

<Figure caption="1000 Genomes SV ensemble callset (3202 samples) on chr19 colored by SV type. Each alt-carrying cell takes its variant's structural-variant class color; the large inversion is the orange band. The legend names every class present, including the callset's complex (CPX) events." src="/img/multisv_svtype.png" />

Set it declaratively with the `svType` value on `featureColor`:

```json
{
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "featureColor": "svType"
    }
  ]
}
```

## Coloring and grouping by sample metadata

Samples can be grouped and colored by metadata: population, phenotype, sex, or
any attribute you supply. Add a samples TSV to the adapter with
`samplesTsvLocation`: its first column is the sample name (matching the VCF
header) and each remaining column is a metadata attribute. Setting `colorBy` on
the display configuration to one of those columns groups and colors the
per-sample rows by that attribute the first time the track loads.

The JBrowse demo wires up the 1000 Genomes phase 3 chr1 callset (2,504 samples
across 26 population codes) this way:

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

<Figure caption="The 1000 Genomes phase 3 chr1 callset as a multi-sample variant display. All 2,504 samples are sorted and colored by their population code (the colored strip down the left edge resolves into contiguous population blocks), while each genotype cell is shaded by allele dosage (which for diploid humans is just heterozygous: light blue, homozygous: dark blue)." src="/img/variants/population_1000genomes.png" />

You can also change the grouping attribute and colors interactively after the
track is open.

## Clustering samples by genotype

Samples can be reordered by genotype similarity using hierarchical clustering.
From the track menu, select **Cluster by genotype**. A dialog opens with two
modes:

- Auto - runs hierarchical clustering (hclust via JavaScript) directly in the
  browser. Works well for a few hundred samples; larger cohorts may be slow.
- Manual - downloads an R script that builds the genotype matrix and runs
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

A clustering result can be embedded directly in a session snapshot, useful for
sharing a pre-computed clustering via URL. Set `layout` and `clusterTree` (and
optionally `treeAreaWidth` / `subtreeFilter`) in the display's `displaySnapshot`
(see
[URL parameters → advanced track configuration](/docs/urlparams#advanced-track-configuration)).
The [MultiSampleVariantBaseModel](/docs/models/multisamplevariantbasemodel) docs
have the full field reference.

## See also

- [Variant track](/docs/user_guides/variant_track)
- [Phased trio analysis](/docs/tutorials/analyze_trio)
- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples)
- [Variant track configuration](/docs/config_guides/variant_track)
- [Customizing feature colors](/docs/config_guides/customizing_feature_colors)
- [Gallery: variants and populations](/gallery/#variants)
