---
title: Variant sample rows
description: Population-level variant views
guide_category: Track types
---

A VCF can hold genotypes for many samples. The variant display draws one row per
sample under its records, and **Layout → Genotype matrix** in the track menu
chooses how the variants run across it:

- **At genomic positions**, the default: each variant drawn across the bases it
  covers
- **Equal-width columns** with it checked, one column per variant in view, like
  a heatmap

A VCF with one sample, such as a call set, opens as its records alone; **Show →
Show genotype rows** in the track menu draws its row. With genotype rows off,
the display reads no genotypes.

At genomic positions, **Show → Show records** draws the records above the
genotype rows, stacked as on a variant track, colored by SV type and labelled
with the share of samples that have each one.

- **Height:** the band opens as tall as its records need, up to a share of the
  track, and keeps that height as you pan. Drag its lower edge to trade height
  with the rows.
- **Hidden records:** records that do not fit are hidden and counted beside the
  band. Clicking the count grows the band and the track to show them.

## At genomic positions: structural variants at their real span {#regular-best-for-full-sv-detail}

Each variant is drawn at its real position and scale, and overlapping calls are
slightly transparent so they stay apart. Where overlaps crowd the view, **Filter
by → Edit filters...** in the track menu hides variants by size, name or any
jexl expression. The
[1000 Genomes SV tutorial](/docs/tutorials/sv_multisamples#sorting-the-cohort-by-genotype-at-the-rhd-deletion)
sorts this layout by genotype at a deletion.

<Figure caption="The 1000 Genomes SV callset across 5 Mb of chr19, one row per sample, sorted by genotype at an inversion." src="/img/multisv.png" />

## Equal-width columns: SNP and indel patterns {#matrix-best-for-snpindel-patterns}

Each visible variant gets one column and each sample one row, however far apart
the variants are, and a thin black line ties each column to its genomic
position. Small variants that would be 1–2px wide at their true positions get a
full column, so shared haplotypes, runs of homozygosity and population structure
become visible. The
[phased trio tutorial](/docs/tutorials/analyze_trio#showing-the-trio-vcf-as-a-genotype-matrix)
works this layout with per-haplotype rows.

<Figure caption="A phased trio as a matrix, one column per variant and one row per haplotype." src="/img/trio-matrix-phased-clean.png" />

## Filtering by allele frequency and missingness

Two sliders under **Filter by** in the track menu thin a dense callset. **MAF**
hides variants whose minor allele frequency is below it, and **Max missingness**
hides variants whose fraction of uncalled alleles is above it, which matters
most in equal-width columns.

<Figure src="/img/variants/filter_sliders.png" caption="The 1000 Genomes track's Filter by submenu, with MAF raised and Max missingness off." />

<Figure src="/img/variants/potato_missingness.png" caption="One tetraploid VCF twice as a genotype matrix. Top: the default missingness ceiling. Bottom: a 0.1 ceiling." />

To load the track already filtered, add
`{ "field": "minorAlleleFrequency", "gte": … }` and
`{ "field": "missingness", "lte": … }` entries to the display's
[`filter`](/docs/config/linearvariantdisplay/#slot-filter) list, each a
[field predicate](/docs/config/fieldpredicate). See
[configuring default display settings](/docs/config_guides/variant_track#configuring-default-display-settings).

## Rows: per sample or per haplotype

The track menu's **Rows** item sets the display's
[`rows.field`](/docs/config/variantrows/#slot-field): what one row stands for
and how each genotype cell is colored.

- **Rows → Per sample** (`rows.field: 'sample'`): one cell per sample, shaded by
  allele dosage. Homozygous reference (`0/0`) is light grey, heterozygous
  (`0/1`) a medium shade and homozygous alternate (`1/1`) the darkest. Every
  non-reference allele counts, so `1/2` draws as dark as `1/1`, and an uncalled
  genotype (`./.`) takes the no-call color.
- **Rows → Per haplotype** (`rows.field: 'haplotype'`): one row per haplotype,
  each cell colored reference or alt with no dosage shading, so inherited
  haplotype blocks line up as the vertical bands in the trio matrix above. The
  site's most frequent alt takes the blue of a homozygous-alt cell in per-sample
  rows. At a multiallelic site the other alts take a color each in order of
  frequency: red for the second, then dark green, lavender, salmon, mint, maroon
  and navy, which the rarest share past eight. A color means the same rank only
  within one site of one file. Where one multiallelic site paints every color
  past blue on screen, the legend names each allele: a sequence allele by its
  ALT index and length, such as `ALT 17, 2,391 bp (-28 bp)`, a symbolic one with
  its `ALEN` path length where the VCF states one. Otherwise the legend shows
  those colors in one row, "Other alt alleles, by frequency", since each stands
  for a different allele at each site.

Per-haplotype rows draw what the VCF phases:

- **Phased and haploid calls:** `|`-separated genotypes and haploid calls draw
  per haplotype. The menu item stays disabled until the view holds one.
- **Unphased calls:** a genotype written with `/` fills every haplotype row of
  its sample black, homozygous ones included. Read-backed phasers such as
  WhatsHap leave homozygous calls unphased, so on their output black marks those
  too.
- **Row names:** `<sample> HP1`, `<sample> HP2`, and so on number the sample's
  alleles from 1; they are not the VCF's `HP` tag.
- **Sample settings:** an order, label, color, tree or kept row written against
  a sample applies to its haplotype rows (`Mother HP1`, `Mother HP2`), and a
  tree clustered per sample forks over each sample's haplotype rows.
- **Haplotype settings:** settings written against a haplotype row are kept but
  hidden in per-sample rows. Each sample sits where its first haplotype was, and
  a tree clustered per haplotype is hidden, with the sidebar saying why, until
  you switch back to **Per haplotype**.

## Coloring by consequence impact (SnpEff/VEP annotations)

When the VCF's `INFO` field has SnpEff `ANN` or VEP `CSQ` annotations, **Color
by → Consequence impact** (under **Cells**) colors each variant's alt-allele
cells by its most severe predicted consequence. Where no variant in view is
annotated, the entry is greyed out with the reason beside it.

Each annotation falls in one of four impact tiers with a fixed color, so the
legend is the same across tracks:

- **HIGH (red):** e.g. `stop_gained`, `frameshift_variant`, `exon_loss_variant`
- **MODERATE (orange):** e.g. `missense_variant`, `inframe_deletion`
- **LOW (yellow):** e.g. `synonymous_variant`, `splice_region_variant`
- **MODIFIER (grey):** e.g. `intron_variant`, `intergenic_region`

SnpEff's SV consequence terms (`exon_loss_variant`, `transcript_ablation`,
`gene_fusion`, ...) map onto the same tiers, so a deletion that removes an exon
reads as HIGH, as a stop-gained SNV does.

<Figure caption="1000 Genomes genotypes colored by SnpEff consequence impact." src="/img/variants/consequence_impact_1000g.png" />

To have the track load already colored this way, set the display's
`encoding.color` to `"impact"`: see
[coloring cells by the variant](/docs/config_guides/variant_track#coloring-cells-by-the-variant).

## Coloring by SV type

**Color by → SV type** (under **Cells**) colors each alt-allele cell by its
variant's structural class, and is greyed out where the view holds no structural
variants. Each class has one color on every display that paints SV type,
including the single-variant display, a mark display and the SV inspector's
chords: deletion (red), duplication (blue), insertion (purple), inversion
(orange), copy-number variable (dark brown), tandem repeat (pink), breakend
(cyan), complex (green), and other / mixed (black) for a type token outside
these classes or a record whose alleles disagree.

- **Het cells** draw the class color paler, as in the default coloring, and the
  legend shows both shades.
- **The legend** lists only the classes present in the loaded region.
- **No class:** a record with no structural class keeps the default alt color.
- **Where the class comes from:** the ALT allele first (`<DEL>`, `<DUP:TANDEM>`,
  breakend notation, and 1000 Genomes' `<CN0>` as a deletion, `<CN1>` as
  copy-number variable and `<CN2>` and up as a duplication), then
  `INFO/EVENTTYPE` or `INFO/SVTYPE`, then a sequence allele 50 bp or more longer
  or shorter than REF. JBrowse stores the result as each VCF record's `svType`
  field.

<Figure caption="The SV callset colored by SV type, pale for a het and full for a hom." src="/img/multisv_svtype.png" />

A track loads already colored by SV type with `encoding.color` set to
`"svType"`: see
[coloring cells by the variant](/docs/config_guides/variant_track#coloring-cells-by-the-variant).

## Coloring by any field

**Color by → Field...** colors each alt-allele cell by a field of its record.
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
any attribute you supply. These slots configure it:

- `samplesTsvLocation` on the adapter takes a samples TSV whose first column is
  the sample name (matching the VCF header) and whose other columns are metadata
  attributes.
- `rows.color` on the display takes one of those column names and tints the
  per-sample rows by that attribute, over any color the TSV gives a row. A
  sample's swatch in the arrangement editor pins that row's color
  (`rows.colors`) over both. **Color rows by → None** clears the attribute and
  restores the TSV's colors, keeping pinned colors; **Reset row order** clears
  the pins.
- `facet` bands the rows so each value of a column is contiguous: the column's
  name, or `{ "field": …, "sort": [...] }` with the band order. Each band's name
  runs up a strip beside the dendrogram. The bands override your arranged order,
  so a sample dragged into another band snaps back, and clustering clusters each
  band separately, with a dendrogram per band.
- [`rows.sort`](/docs/config/rowarrangement/#slot-sort) names the samples that
  lead the rows; the rest keep the file's order, and a grouping attribute bands
  within that order.

The JBrowse demo configures the 1000 Genomes phase 3 chr1 callset (2,504 samples
across 26 population codes) this way. For the TSV layout and the adapter and
display slots, see
[auto-coloring samples by metadata](/docs/config_guides/variant_track#auto-coloring-samples-by-metadata).
The
[TCGA mutation cohort tutorial](/docs/tutorials/tcga_cohort_mutations#facet-the-rows-by-clinical-annotation)
facets a cohort's rows by clinical annotation.

<Figure caption="All 2,504 1000 Genomes samples sorted and colored by population code." src="/img/variants/population_1000genomes.png" />

**Group by** and the **Samples** entries under **Color by** in the track menu
change the grouping and colors after the track is open.

## Families and pedigrees

A VCF adapter's
[`pedigreeLocation`](/docs/config/vcftabixadapter/#slot-pedigreelocation) reads
a pedigree of the VCF's samples, naming each one's family, parents, sex and
phenotype. JBrowse reads the format from the columns:

- **A header row** naming `SampleID` or `IID`, `FatherID` or `PAT`, `MotherID`
  or `MAT`, `FamilyID` or `FID`, `Sex` and `Phenotype`, in any case and order,
  as the 1000 Genomes `20130606_g1k_3202_samples_ped_population.txt` has.
- **No header:** a PLINK `.fam` or `.ped`, whose first six columns are family,
  sample, father, mother, sex and phenotype.

Each sample gains `family`, `father`, `mother`, `sex` and `phenotype`
attributes, which group, sort, color and label rows as a samples TSV's columns
do.

- **Codes:** `0`, `-9`, `NA`, `unknown` or an empty cell is no value, for a
  parent, sex or phenotype alike; sex `1` is `male`, `2` is `female` and any
  other code is `other`; phenotype `2` is `affected` and `1` is `unaffected`.
- **Separators:** a line holding a tab is split on tabs, so an empty cell keeps
  its column; any other line is split on runs of spaces.
- **Sample names:** a sample ID that matches no VCF sample is tried as
  `FID_IID`, the name `plink --recode vcf` writes.
- **Precedence:** a `samplesTsvLocation` column of the same name wins over the
  pedigree's unless it holds one of those missing codes, and the pedigree never
  removes a row: its lines naming no VCF sample are skipped.

A sample related to another in the VCF also gains a `relationship`, such as
`daughter`, `father` or `daughter, mother`, which the row label shows after the
name in a muted color, as `HG02024 (daughter)`. The display's
[`rows.subtitle`](/docs/config/variantrows/#slot-subtitle) names that attribute,
and `"subtitle": ""` turns it off.

The config below loads the 1000 Genomes KHV trio with its pedigree and bands the
rows by `facet: "family"`:

```json addtrack loc=chr1:196,745,000-196,850,000
{
  "type": "VariantTrack",
  "trackId": "khv_trio_vcf",
  "name": "KHV trio phased calls (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/kgp-trio/HG02024_VN049_KHVTrio.chr1.merr.vcf.gz",
    "pedigreeLocation": {
      "uri": "https://jbrowse.org/demos/kgp-trio/20130606_g1k_3202_samples_ped_population.txt"
    }
  },
  "displayDefaults": { "facet": "family" }
}
```

JBrowse does not check genotypes against the pedigree. bcftools'
[`+mendelian2`](https://samtools.github.io/bcftools/bcftools.html#plugin) plugin
does, with built-in rules for the sex chromosomes, the pseudoautosomal regions
and chrM, and `-m a` writes `INFO/MERR`, the number of trios with a Mendelian
error at each site. This VCF has it, so coloring by `INFO.MERR` with a
`threshold` scale cut at 1 marks the error sites, as the
[phased trio tutorial](/docs/tutorials/analyze_trio#coloring-the-trios-calls-by-mendelian-errors)
does.

## Clustering samples by genotype

**Clustering → Cluster rows by genotype...** in the track menu reorders samples
by genotype similarity. See [](/docs/user_guides/clustering) for the modes, the
dendrogram, and how to share a result in a session URL.

<Figure caption="The Cluster rows by genotype dialog (top), and the rows reordered with a dendrogram (bottom)." src="/img/variants/cluster_dialog.png" />

With per-haplotype rows, clustering treats each haplotype as a separate row, so
the dendrogram shows haplotype-level relationships. The
[LD tutorial](/docs/tutorials/ld_human#clustering-lct-haplotypes-by-genotype)
clusters haplotypes across the LCT block.

## See also

- [](/docs/user_guides/variant_track)
- [](/docs/tutorials/analyze_trio)
- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/ld_human)
- [Variant track configuration](/docs/config_guides/variant_track)
- [](/docs/config_guides/customizing_feature_colors)
