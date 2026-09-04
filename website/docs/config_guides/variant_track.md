---
title: Variant track
description:
  VCF variant track config, SVTYPE coloring, and multi-sample displays
guide_category: Track types
---

**TL;DR:** a `VariantTrack` with a `VcfTabixAdapter` handles single- and
multi-sample VCFs. Color variants with a `jexl:` expression on the display's
`color` slot, and reach for the multi-sample or LD displays for cohort data.

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

The `uri` shorthand resolves a sibling `.tbi`; add `"csi": true` for a `.csi`
([the `uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand)).

## Coloring variants

`color` takes a `jexl:` expression over the record. INFO fields parse as arrays,
so `feature.INFO.SVTYPE[0]` is the first value; the
[cookbook](/docs/cookbook#variant-tracks) has the SV-type lookup table and a
`jexlFilters` example.

### Helper functions for jexl color expressions

The variants plugin registers these for `color` and `jexlFilters`:

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

So a track colors by allele frequency with no preprocessing:

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

## MultiVariant display configuration

`LinearMultiSampleVariantDisplay` and `LinearMultiSampleVariantMatrixDisplay`
draw a multi-sample VCF as a genotype heatmap, one row per sample. Neither is
the track's default display, so preset their slots in a `displays` array, one
block per display type. The slots both share are on
[](/docs/config/sharedvariantdisplay).

### Configuring default display settings

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
      "referenceDrawingMode": "draw",
      "minorAlleleFrequencyFilter": 0.05,
      "showRowLabels": true,
      "renderingMode": "alleleCount"
    },
    {
      "type": "LinearMultiSampleVariantMatrixDisplay"
    }
  ]
}
```

- **`referenceDrawingMode`** is `draw` to paint reference alleles too, or `skip`
  (the default) to leave the row solid gray with only ALT alleles on top, which
  keeps overlapping variants readable
- **`renderingMode`** is `alleleCount` (dosage, darker for homozygous) or
  `phased` (one row per haplotype)
- **`minorAlleleFrequencyFilter`** and **`maxMissingnessFilter`** hide variants
  below an allele-frequency floor or above a no-call ceiling

### Coloring cells by the variant instead of the genotype

`featureColor` overrides the per-genotype shading, painting every alt-carrying
cell by the variant itself. It takes any per-feature jexl expression, the
[helper functions](#helper-functions-for-jexl-color-expressions) included, and
two values match the track menu's **Color by...** presets:
`"jexl:impactColor(feature)"` for
[consequence impact](/docs/user_guides/multivariant_track#coloring-by-consequence-impact-snpeffvep-annotations)
and the literal `"svType"` for
[SV type](/docs/user_guides/multivariant_track#coloring-by-sv-type).

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

### Auto-coloring samples by metadata

Point the adapter's `samplesTsvLocation` at a TSV whose first column is `name`,
matching the VCF sample names, with any further columns as metadata:

```tsv
name	population	region	phenotype
SAMPLE001	EUR	Western	case
SAMPLE002	AFR	Eastern	control
SAMPLE003	EUR	Western	control
SAMPLE004	EAS	Pacific	case
```

`colorBy` on the display names one of those columns, and each distinct value
gets its own palette color:

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

- **A column `colorBy` names that the TSV lacks** logs a console warning and
  skips the coloring
- **Sample names match exactly.** A TSV matching some of the VCF's samples draws
  those and reports the ones it dropped; one matching none fails the track. The
  usual cause is a prefixed or suffixed id, `1000GP_HG00096` against a header
  naming `HG00096`

## Linkage disequilibrium (LD) display

JBrowse draws a triangular heatmap of pairwise r² (or D') between variants,
computed live from a VCF's genotypes or read from a PLINK file. Point it at a
single population panel: r² is a correlation across the samples in the file, so
a pooled multi-population callset averages the block away.

<Figure src="/img/ld/lct_haploblock.png" caption="An LD triangle of pairwise r² at the human lactase locus (LCT/MCM6), over the haplotype matrix it summarises. Red is a pair of SNPs almost always inherited together, and the block over the highlighted gene is one long haplotype."/>

**Computed from a VCF.** Add an `LDDisplay` to a normal `VariantTrack`. The raw
genotypes are present, so the filters (minor allele frequency, HWE, call rate,
jexl) and signed LD are available:

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

**Pre-computed with PLINK.** A standalone `LDTrack` serves a cohort too large to
compute in the browser, or a fixed matrix to publish. `PlinkLDAdapter` reads a
plain `.ld`; `PlinkLDTabixAdapter` reads a bgzipped, tabix-indexed `.ld.gz` and
fetches only the visible region. PLINK data carries only the final r²/D' values,
so the filters and signed LD are absent here. The
[GWAS track guide](/docs/config_guides/gwas_track#preparing-the-ld-file) has the
`plink` command, and the same file drives LD coloring on a GWAS track.

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

### Which metric, and how far to thin

[`ldMetric`](/docs/config/sharedlddisplay/#slot-ldmetric) switches between two
reads of the same block:

- **D'** asks whether recombination has been seen between two markers, so it
  saturates near 1 wherever no recombinant haplotype has turned up. It recovers
  where crossing over stops, which is what finds an inversion's breakpoints
- **r²** asks how well one marker predicts the other, which also requires the
  two to be at similar frequency, so it draws the sharper boundary. It says
  whether one marker can stand in for another

[`minorAlleleFrequencyFilter`](/docs/config/sharedlddisplay/#slot-minorallelefrequencyfilter)
thins a dense callset to the common, block-tagging variants. High enough it
reaches the tagging variants themselves, and the block fades. Several haplotypes
at one locus fragment the block too, since no single pair of biallelic markers
tags them all, so a soft sweep reads patchier than its strength suggests.

## See also

- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/multivariant_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
