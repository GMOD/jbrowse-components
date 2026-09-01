---
title: Variant track
description:
  VCF variant track config, SVTYPE coloring, and multi-sample displays
guide_category: Track types
---

**TL;DR:** a `VariantTrack` with a `VcfTabixAdapter` handles single- and
multi-sample VCFs. Color variants with a `jexl:` expression on the display's
`color` slot, and reach for the multi-sample or LD displays for cohort data.

Example config:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "my_track",
  "name": "My Variants",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/file.vcf.gz"
  }
}
```

## VcfTabixAdapter configuration options

The `uri` shorthand above resolves a sibling `<uri>.tbi`; adding `"csi": true`
resolves `<uri>.csi` instead. See
[the `uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand) for when
CSI is required, and the
[VcfTabixAdapter config docs](/docs/config/vcftabixadapter) for the full slot
form.

## Coloring variants by type

Use a jexl expression on the display's `color` slot to color variants by their
`SVTYPE` INFO field (or any other VCF field). The expression reads the INFO
field via `feature.INFO.SVTYPE` and maps it to a color:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "my_sv_track",
  "name": "SVs colored by type",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/svs.vcf.gz"
  },
  "displayDefaults": {
    "color": "jexl:{'DEL':'red','INS':'blue','DUP':'green','INV':'orange','BND':'purple','TRA':'purple'}[feature.INFO.SVTYPE[0]] || 'gray'"
  }
}
```

The
[`displayDefaults` shorthand](/docs/config_guides/tracks/#configuring-displays)
applies the `color` to the variant display for you.

The `|| 'gray'` fallback colors any SVTYPE not in the map (or variants without
an SVTYPE field) gray. INFO fields are parsed as arrays, so index the first
value (`[0]`) as shown above. You can use the same pattern for SNP/INDEL VCFs by
reading `feature.INFO.CLNSIG[0]` or any other INFO key. See
[customizing feature colors](/docs/config_guides/customizing_feature_colors) for
more jexl color examples.

### Helper functions for jexl color expressions

The variants plugin registers several helper functions for use in a jexl `color`
expression:

<!-- JEXL_CATEGORY variant-functions START -->

```js
jexl: maf(feature) // minor allele frequency over the called alleles
jexl: missingness(feature) // fraction of samples with no call
jexl: impact(feature) // HIGH, MODERATE, LOW or MODIFIER, from SnpEff ANN / VEP CSQ
jexl: consequence(feature) // e.g. missense_variant, from the same annotation — the MOST SEVERE one alone
jexl: 'missense_variant' in consequences(feature) // every consequence term on the record, across all transcripts (bcftools INFO/CSQ ~ "missense_variant")
jexl: impactColor(feature) // the color the "Color by consequence impact" menu item uses
jexl: svTypeColor(feature) // the color "Color by SV type" uses
jexl: alleleLength(feature) >= 50 // longest allele in bp, so an insertion is not measured by its reference span
jexl: svType(feature) == 'DEL' // SV class, read off a symbolic ALT before falling back to INFO/SVTYPE (bcftools INFO/SVTYPE)
jexl: nAlt(feature) == 1 // ALT alleles the record declares, i.e. biallelic-only (bcftools N_ALT)
jexl: genotypeCount(feature, 'het') > 0 // samples in a genotype class — ref, alt, hom, het or mis (bcftools N_PASS(GT="het"))
```

<!-- JEXL_CATEGORY variant-functions END -->

So a track can be colored by allele frequency without any preprocessing:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "my_maf_track",
  "name": "Variants colored by allele frequency",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/file.vcf.gz"
  },
  "displayDefaults": {
    "color": "jexl:maf(feature)<0.01?'#ccc':maf(feature)<0.05?'#74a9cf':'#045a8d'"
  }
}
```

`maf` and `missingness` also work in filter expressions, which is how the
multi-sample displays' allele-frequency and missingness sliders are expressed.

If your config must run on older JBrowse releases, use the equivalent
`get(feature,'INFO').SVTYPE[0]` function form instead of property access. See
[property access vs `get()`](/docs/config_guides/jexl#property-access-vs-get).

## MultiVariant display configuration

The MultiVariant displays (`LinearMultiSampleVariantDisplay` and
`LinearMultiSampleVariantMatrixDisplay`) visualize multi-sample VCFs, showing
genotypes across many samples as a heatmap.

### Configuring default display settings

Preset these slots so the options are on when the track loads. The most commonly
preset ones:

- `showReferenceAlleles` - draw reference alleles in color. Off by default,
  where the row background is filled solid gray and only ALT alleles are painted
  on top, which makes overlapping variants easier to see
- `renderingMode` - `alleleCount` (dosage, darker for homozygous) or `phased`
  (one row per haplotype)
- `minorAlleleFrequencyFilter` - hide variants below a minor-allele-frequency
  threshold
- `maxMissingnessFilter` - hide variants whose fraction of no-call genotypes
  rises above the threshold
- `featureColor` - color each cell by the variant rather than by genotype
  (covered below)
- `showRowLabels` - show the per-sample row labels in the sidebar
- `colorBy` - auto-color samples by a sample-metadata attribute on load (covered
  below)

Both displays share these slots through `SharedVariantDisplay`. See the
autogenerated [](/docs/config/sharedvariantdisplay),
[](/docs/config/linearmultisamplevariantdisplay), and
[](/docs/config/linearmultisamplevariantmatrixdisplay) docs for every slot.

These displays are not a track's default, so name them in a `displays` array
rather than using `displayDefaults`. Each display type has its own block, so to
preset both the linear and matrix displays, set the slot on each:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "diversity_panel",
  "name": "Diversity Panel",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/diversity.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "showReferenceAlleles": true,
      "minorAlleleFrequencyFilter": 0.05,
      "showRowLabels": true,
      "renderingMode": "alleleCount"
    },
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "showReferenceAlleles": true
    }
  ]
}
```

These are initial defaults. Users can change them at runtime, and their choice
is stored for that session only.

### Coloring cells by the variant instead of the genotype

`featureColor` overrides the per-genotype shading, painting every alt-carrying
cell with a color derived from the variant itself. Two built-ins match the track
menu's **Color by...** presets, described in
[coloring by consequence impact](/docs/user_guides/multivariant_track#coloring-by-consequence-impact-snpeffvep-annotations)
and
[coloring by SV type](/docs/user_guides/multivariant_track#coloring-by-sv-type).

Consequence impact, via the `impactColor` helper:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "diversity_panel",
  "name": "Diversity Panel",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/diversity.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "featureColor": "jexl:impactColor(feature)"
    }
  ]
}
```

SV type, via the literal value `svType`, on the same track:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "diversity_panel",
  "name": "Diversity Panel",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/diversity.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "featureColor": "svType"
    }
  ]
}
```

`featureColor` accepts any per-feature jexl expression: a plain CSS color, or an
expression over `feature` attributes and the
[helper functions](#helper-functions-for-jexl-color-expressions) above, the same
as the single-sample `color` slot.

### Auto-coloring samples by metadata

Point the adapter's `samplesTsvLocation` at a TSV whose first column is `name`
(matching the VCF sample names), with any further columns as metadata:

```tsv
name	population	region	phenotype
SAMPLE001	EUR	Western	case
SAMPLE002	AFR	Eastern	control
SAMPLE003	EUR	Western	control
SAMPLE004	EAS	Pacific	case
```

Then set `colorBy` on the display to one of those column names. Each distinct
value gets its own color from the palette:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "population_vcf",
  "name": "Population VCF",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/samples.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://yourhost/sample_metadata.tsv"
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

If the named attribute isn't in the TSV, JBrowse logs a console warning and
skips the coloring.

The first column has to match the VCF's sample names exactly. A file that
matches only some of them draws the samples it matched and notifies you about
the ones it dropped; a file that matches none of them is a configuration error
and the track says so, rather than drawing an empty band. The usual cause is a
prefixed or suffixed ID — `1000GP_HG00096` against a header naming `HG00096`.

## Linkage disequilibrium (LD) display

JBrowse renders a triangular heatmap of pairwise r² (or D') between variants,
from either of two sources. The figure below is computed live from phased 1000
Genomes genotypes.

Point an LD track at a single population panel: r² is a correlation across the
samples in the file, so a pooled multi-population callset averages the block
away.

<Figure src="/img/ld/lct_haploblock.png" caption="An LD triangle of pairwise r² at the human lactase locus (LCT/MCM6), over the haplotype matrix it summarises. Red is a pair of SNPs almost always inherited together, and the block over the highlighted gene is one long haplotype."/>

**Computed from a VCF.** Add an `LDDisplay` to a normal `VariantTrack`. No extra
files are needed, and because the raw genotypes are present, the filtering
(minor allele frequency, HWE, call rate, jexl) and signed-LD options are
available:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "variants_ld",
  "name": "Variants with LD",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://yourhost/variants.vcf.gz"
  },
  "displays": [{ "type": "LDDisplay" }]
}
```

**Pre-computed with PLINK.** Use a standalone `LDTrack` when the cohort is too
large to compute in the browser, or when you want to publish a fixed matrix. Its
adapter is `PlinkLDAdapter` for a plain `.ld` or `PlinkLDTabixAdapter` for a
bgzipped, tabix-indexed `.ld.gz` (which fetches only the visible region):

```json addtrack
{
  "type": "LDTrack",
  "trackId": "ld_plink",
  "name": "Linkage disequilibrium",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "PlinkLDTabixAdapter",
    "uri": "https://yourhost/study.ld.gz"
  }
}
```

The `.ld` file is PLINK's `--r2` report. The
[GWAS track guide](/docs/config_guides/gwas_track#preparing-the-ld-file) has the
`plink`/`bgzip`/`tabix` commands; the same file also drives LD coloring on a
GWAS track.

Both displays share the same track-menu controls (LD metric, legend,
fit-to-height). Only the VCF-computed one offers filtering and signed LD, since
PLINK data carries only the final r²/D' values.

### Which metric, and how far to thin

Two metrics read the same block differently, switched with
[`ldMetric`](/docs/config/sharedlddisplay/#slot-ldmetric):

- **D'** asks whether recombination has been seen between two markers, so it
  saturates near 1 wherever no recombinant haplotype has turned up. It is the
  read on where crossing over stops, which is what recovers an inversion's
  breakpoints.
- **r²** asks how well one marker predicts the other, which also requires the
  two to be at similar frequency, so it draws the sharper boundary. It is the
  read on whether one marker can stand in for another.

[`minorAlleleFrequencyFilter`](/docs/config/sharedlddisplay/#slot-minorallelefrequencyfilter)
thins a dense callset to the common, block-tagging variants. High enough it
reaches the tagging variants themselves, and the block fades.

r² is a correlation between two biallelic markers, so several haplotypes at one
locus fragment the block: each carries a different background and no single pair
of markers tags them all. A soft sweep reads patchier than its strength
suggests.

## See also

- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/multivariant_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
