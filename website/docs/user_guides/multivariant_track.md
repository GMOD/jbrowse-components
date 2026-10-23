---
title: Multi-sample variant display
description: Population-level variant views
guide_category: Track types
---

A VCF can hold genotypes for many samples. The multi-sample variant display
draws one row per sample, and **Layout → Genotype matrix** in the track menu
chooses how the variants run across it:

- **At genomic positions**, the default: each variant drawn across the bases it
  covers
- **Equal-width columns** with it checked, one column per variant in view, like
  a heatmap

## At genomic positions: structural variants at their real span {#regular-best-for-full-sv-detail}

Each variant is drawn at its real genomic position. This is the layout that
renders structural variants at the right scale, and overlapping calls use slight
transparency so you can still tell them apart.

If overlaps overwhelm the view, use "Edit filters" in the track menu to hide
variants by size, name, or any Jexl expression.

<Figure caption="The 1000 Genomes SV callset across 5 Mb of chr19, one row per sample, sorted by genotype at an inversion." src="/img/multisv.png" />

## Equal-width columns: SNP and indel patterns {#matrix-best-for-snpindel-patterns}

Each visible variant gets one column and each sample gets one row, regardless of
how far apart the variants are on the genome. A thin black line connects each
column to its real genomic position.

Sparse small variants that would be only 1–2px wide at their true positions each
get a full readable column. Patterns like shared haplotypes, runs of
homozygosity, and population structure become visible at a glance.

<Figure caption="A phased trio as a matrix, one column per variant and one row per haplotype." src="/img/trio-matrix-phased-clean.png" />

## Filtering by allele frequency and missingness

Two inline sliders in the track menu thin a dense callset down to the variants
worth looking at. Both are under **Track menu → Filter by...** and re-fetch as
you release the slider:

- **Minor allele frequency** hides variants whose minor allele frequency falls
  below the threshold, so singletons and near-monomorphic sites drop out and the
  common, population-informative variants remain.
- **Missingness** hides variants whose fraction of uncalled alleles rises above
  the threshold. Its [default](/docs/config/variantfilter/#slot-maxmissingness)
  keeps every variant; lowering it drops the poorly-genotyped columns that are
  mostly missing data.

Missingness is especially useful in equal-width columns, where each variant
takes a full column no matter how many of its genotypes are no-calls.

<Figure src="/img/variants/potato_missingness.png" caption="One tetraploid VCF twice as a genotype matrix. Top: the default missingness ceiling. Bottom: a 0.1 ceiling." />

The two filters can be preset so the track loads already filtered, with
`{ "field": "minorAlleleFrequency", "gte": … }` and
`{ "field": "missingness", "lte": … }` entries in the display's
[`filter`](/docs/config/fieldpredicate) list. See
[configuring default display settings](/docs/config_guides/variant_track#configuring-default-display-settings).

## Rows: per sample or per haplotype

The [`unit`](/docs/config/linearmultisamplevariantdisplay/#slot-unit) display
option, which the track menu's **Rows** item sets, decides what one row stands
for and how each genotype cell is colored.

With **Rows → Per sample** (`unit: 'sample'`), one cell is drawn per sample and
shaded by how many alternate alleles the call has:

- homozygous reference (`0/0`) → light grey
- heterozygous (`0/1`) → a medium shade
- homozygous alternate (`1/1`) → the darkest shade

so the cell color reads directly as allele dosage (0, 1, or 2 alt alleles) and
runs of homozygous-alt samples stand out as the darkest blocks. The dosage
counts every non-reference allele, so `1/2` draws as dark as `1/1`, and an
uncalled genotype (`./.`) takes the no-call color.

With **Rows → Per haplotype** (`unit: 'haplotype'`), each sample is split into
one row per haplotype and every haplotype cell is colored reference vs alt
individually, with no dosage shading, so inherited haplotype blocks line up as
the contiguous vertical bands in the trio matrix above. A haplotype with the
site's most frequent alt takes the same blue as a homozygous-alt cell in
per-sample rows, and any other alt draws red.

Per-haplotype rows draw only what the VCF phases: `|`-separated genotypes, and
haploid calls, which have nothing to phase. A genotype written with `/` fills
every haplotype row of its sample black, homozygous ones included, since the
file does not assign its alleles to haplotypes. Read-backed phasers such as
WhatsHap leave homozygous calls unphased, so on their output the black marks
every call the phaser left alone, homozygous ones among them. The menu item
stays disabled until the view holds phased or haploid genotypes.

## Coloring by consequence impact (SnpEff/VEP annotations)

If the VCF's `INFO` field has SnpEff `ANN` or VEP `CSQ` annotations, each
variant's alt-allele cells can be colored by the severity of its most severe
predicted consequence. From the track menu, open **Color by...** and choose
**Consequence impact** under **Cells**. The entry stays visible where no variant
in view is annotated, but is greyed out and names why: _(checking for SnpEff/VEP
annotations...)_ while the variants load, then _(no SnpEff/VEP annotations in
view)_.

Every annotation is bucketed into one of four impact tiers and painted with a
fixed color, so the legend is the same across tracks:

- HIGH (red) - e.g. `stop_gained`, `frameshift_variant`, `exon_loss_variant`
- MODERATE (orange) - e.g. `missense_variant`, `inframe_deletion`
- LOW (yellow) - e.g. `synonymous_variant`, `splice_region_variant`
- MODIFIER (grey) - e.g. `intron_variant`, `intergenic_region`

Consequence coloring works for both SNVs/indels and structural variants.
SnpEff's SV-specific consequence terms (`exon_loss_variant`,
`transcript_ablation`, `gene_fusion`, ...) map onto the same four tiers, so a
deletion that removes an exon reads as HIGH the same way a stop-gained SNV does.

<Figure caption="1000 Genomes genotypes colored by SnpEff consequence impact." src="/img/variants/consequence_impact_1000g.png" />

To have the track load already colored this way, set the display's `color` to
`{ "field": "impact" }`: see
[coloring cells by the variant](/docs/config_guides/variant_track#coloring-cells-by-the-variant).

## Coloring by SV type

Structural variants can be colored by their class: each alt-allele cell takes
the color of its variant's structural-variant type. From the track menu, open
**Color by...** and choose **SV type** under **Cells**. Like the consequence
option it greys out rather than disappearing, reading _(no structural variants
in view)_ where the variants in view hold none.

Each class has one fixed color, the same on every display that paints SV type,
so a deletion is the same red here, on the single-variant display, on a mark
display and on the SV inspector's chords: deletion (red), duplication (blue),
insertion (purple), inversion (orange), copy-number variable (dark brown),
tandem repeat (pink), breakend (cyan), complex (green), and other / mixed
(black) for a token no class names or a record whose alleles disagree. A het
cell draws its class color paler, as in the default coloring, and the legend
shows both shades. The legend lists only the classes present in the loaded
region, and a record with no structural class keeps the default alt color.

The class is read from the ALT allele first: `<DEL>`, `<DUP:TANDEM>`, breakend
notation, and 1000 Genomes' `<CN0>` (a deletion) and `<CN2>` and up (a
duplication). Otherwise it comes from `INFO/EVENTTYPE` or `INFO/SVTYPE`, or from
a sequence allele 50 bp or more longer or shorter than REF. JBrowse stores the
result as each VCF record's `svType` field.

<Figure caption="The SV callset colored by SV type, pale for a het and full for a hom." src="/img/multisv_svtype.png" />

A track loads already colored by SV type with `color` set to
`{ "field": "svType" }`: see
[coloring cells by the variant](/docs/config_guides/variant_track#coloring-cells-by-the-variant).

## Coloring by any field

**Color by... → Field...** colors each alt-allele cell by a field of its record.
The dialog lists the file's columns (QUAL, FILTER, ID, ALT), every INFO field
its header declares, with the header's description, and the computed values such
as `maf` and `missingness`; any other field name or a `jexl:` expression can be
typed in.

- Left as it is, each value of the field takes a separate color, as
  `INFO.CLNSIG` gives Pathogenic, Benign and Uncertain_significance one each.
- **Cut points** turn a number into ranges: `0.001, 0.01` over `INFO.AF` makes
  ultra-rare, rare and common bands.

The legend names the field and lists each value or range, and a variant with no
value for the field keeps the default alt color. A het cell draws paler than a
hom, as in every other coloring.

## Coloring and grouping by sample metadata

Samples can be grouped and colored by metadata: population, phenotype, sex, or
any attribute you supply. Two slots wire it up:

- `samplesTsvLocation` on the adapter takes a samples TSV whose first column is
  the sample name (matching the VCF header) and whose every remaining column is
  a metadata attribute.
- `rowColor` on the display takes the name of one of those columns, and while it
  is set the per-sample rows are tinted by that attribute, over any color the
  TSV gives a row. Set it back to None to restore the TSV's colors; the
  arrangement editor's **Each row** picks a color per sample instead.
- `facet` bands the rows so each value of a column is contiguous: the column's
  name, or `{ "field": …, "sort": [...] }` with the band order. Each band's name
  runs up a strip beside the dendrogram where the band is tall enough to hold
  it. The bands override whatever order you have arranged, so dragging a sample
  into another band snaps it back, and clustering under bands clusters each band
  separately, with a dendrogram per band.
- [`rows.sort`](/docs/config/rowarrangement/#slot-sort) names the samples that
  lead the rows; the rest keep the file's order, and a grouping attribute bands
  within that order.

The JBrowse demo wires up the 1000 Genomes phase 3 chr1 callset (2,504 samples
across 26 population codes) this way. For the TSV layout and the adapter and
display slots, see
[auto-coloring samples by metadata](/docs/config_guides/variant_track#auto-coloring-samples-by-metadata).

<Figure caption="All 2,504 1000 Genomes samples sorted and colored by population code." src="/img/variants/population_1000genomes.png" />

You can also change the grouping attribute and colors interactively after the
track is open.

## Clustering samples by genotype

Samples can be reordered by genotype similarity, via **Clustering → Cluster rows
by genotype...** in the track menu. See [](/docs/user_guides/clustering) for the
modes, the dendrogram, and how to share a result in a session URL.

<Figure caption="The Cluster rows by genotype dialog (top), and the rows reordered with a dendrogram (bottom)." src="/img/variants/cluster_dialog.png" />

With per-haplotype rows, clustering treats each haplotype as a separate row, so
the dendrogram shows haplotype-level relationships.

## See also

- [](/docs/user_guides/variant_track)
- [](/docs/tutorials/analyze_trio)
- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/ld_human)
- [Variant track configuration](/docs/config_guides/variant_track)
- [](/docs/config_guides/customizing_feature_colors)
