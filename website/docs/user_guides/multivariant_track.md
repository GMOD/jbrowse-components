---
title: Multi-sample variant display
description: Population-level variant views
guide_category: Track types
---

**TL;DR:** A VCF can carry genotypes for many samples. JBrowse shows them with
one of two displays, switchable from the track menu:

- Multi-sample variant display (regular) - variants drawn at their true genomic
  positions, one row per sample
- Multi-sample variant display (matrix) - variants laid out as a heatmap, one
  row per sample and one column per variant

## Regular: best for full SV detail

Each variant is drawn at its real genomic position. This is the only
multi-sample display that renders structural variants at the right scale, and
overlapping calls use slight transparency so you can still tell them apart.

If overlaps overwhelm the view, use "Edit filters" in the track menu to hide
variants by size, name, or any Jexl expression.

<Figure caption="1000 Genomes SV ensemble callset (3202 samples) across 5 Mb of chr19, one row per sample, sorted by genotype at a 1.1 Mb inversion. Because each call is drawn at its real span, a megabase-scale variant is a band a fifth of the window wide, and the sort collects its carriers into a block against the rest of the cohort." src="/img/multisv.png" />

## Matrix: best for SNP/indel patterns

Each visible variant gets one column and each sample gets one row, regardless of
how far apart the variants are on the genome. A thin black line connects each
column to its real genomic position.

Sparse small variants that would be only 1–2px wide at their true positions each
get a full readable column instead. Patterns like shared haplotypes, runs of
homozygosity, and population structure become visible at a glance.

<Figure caption="A phased trio as a matrix display: one column per variant, one row per haplotype (two per sample), each cell shaded reference vs alt allele. Inherited haplotype blocks read as contiguous vertical bands shared across parent and child rows. The connector zone under the gene track ties each column back to its genomic position." src="/img/trio-matrix-phased-clean.png" />

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

<Figure src="/img/variants/potato_missingness.png" caption="One tetraploid potato multi-sample VCF opened twice in the same view as a genotype matrix, on one ruler. Top: the default missingness ceiling keeps every variant, and no-call (yellow) columns dominate. Bottom: a 0.1 ceiling drops variants with more than 10% no-call genotypes, so the remaining columns are the well-genotyped homozygous-reference, heterozygous, and homozygous-alt sites." />

Either filter can be preset so the track loads already filtered, with the
[`minorAlleleFrequencyFilter`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-minorallelefrequencyfilter)
and
[`maxMissingnessFilter`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-maxmissingnessfilter)
display slots. See
[configuring default display settings](/docs/config_guides/variant_track#configuring-default-display-settings).

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
by...** and choose **Consequence impact** under **Cells**. The entry stays
visible on a VCF that carries no annotations, but is greyed out and names why:
_(checking for annotations...)_ while the scan runs, then _(no SnpEff/VEP
annotations found)_.

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

To have the track load already colored this way, preset the display's
`featureColor` slot: see
[coloring cells by the variant instead of the genotype](/docs/config_guides/variant_track#coloring-cells-by-the-variant-instead-of-the-genotype).

## Coloring by SV type

Structural variants can be colored by their class instead of by genotype: each
alt-carrying cell takes the color of its variant's structural-variant type. From
the track menu, open **Color by...** and choose **SV type** under **Cells**.
Like the consequence option it greys out rather than disappearing, reading _(no
structural variants found)_ on a callset that carries none.

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

This preset also has a
[`featureColor` value](/docs/config_guides/variant_track#coloring-cells-by-the-variant-instead-of-the-genotype)
so a track can load already colored by SV type.

## Coloring and grouping by sample metadata

Samples can be grouped and colored by metadata: population, phenotype, sex, or
any attribute you supply. Add a samples TSV to the adapter with
`samplesTsvLocation`: its first column is the sample name (matching the VCF
header) and each remaining column is a metadata attribute. Set `colorBy` on the
display to one of those columns to group and color the per-sample rows by that
attribute the first time the track loads.

The JBrowse demo wires up the 1000 Genomes phase 3 chr1 callset (2,504 samples
across 26 population codes) this way. For the TSV layout and the adapter and
display slots, see
[auto-coloring samples by metadata](/docs/config_guides/variant_track#auto-coloring-samples-by-metadata).

<Figure caption="The 1000 Genomes phase 3 chr1 callset as a multi-sample variant display. All 2,504 samples are sorted and colored by their population code (the colored strip down the left edge resolves into contiguous population blocks), while each genotype cell is shaded by allele dosage (which for diploid humans is just heterozygous: light blue, homozygous: dark blue)." src="/img/variants/population_1000genomes.png" />

You can also change the grouping attribute and colors interactively after the
track is open.

## Clustering samples by genotype

Samples can be reordered by genotype similarity, via **Clustering → Cluster rows
by genotype...** in the track menu. See [](/docs/user_guides/clustering) for the
modes, the dendrogram, and how to share a result in a session URL.

<Figure caption="Clustering a multi-sample variant track. Top: the 'Cluster rows by genotype' dialog with its auto/manual mode options. Bottom: after clustering, samples are reordered by genotype similarity with a dendrogram on the left." src="/img/variants/cluster_dialog.png" />

In phased mode, clustering treats each haplotype as a separate row, so the
dendrogram shows haplotype-level relationships rather than sample-level ones.

## See also

- [](/docs/user_guides/variant_track)
- [](/docs/tutorials/analyze_trio)
- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/ld_human)
- [Variant track configuration](/docs/config_guides/variant_track)
- [](/docs/config_guides/customizing_feature_colors)
- [Gallery: variants and populations](/gallery/#variants)
