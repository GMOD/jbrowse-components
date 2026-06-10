---
title: Multi-sample variant displays
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

[**Explore this track in a live JBrowse instance →**](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%22chr1%3A1%2C000%2C000-1%2C020%2C000%22%2C%22tracks%22%3A%5B%7B%22trackId%22%3A%221kGP_high_coverage_Illumina.chr1.filtered.SNV_INDEL_SV_phased_panel.vcf%22%2C%22displaySnapshot%22%3A%7B%22type%22%3A%22LinearMultiSampleVariantDisplay%22%2C%22height%22%3A500%7D%7D%5D%7D%5D%7D&sessionName=Population%20coloring)

<Figure caption="The 1000 Genomes phase 3 chr1 callset as a multi-sample variant display. All 2,504 samples are sorted and colored by their population code — the colored strip down the left edge resolves into contiguous population blocks — while each genotype cell is shaded by allele dosage." src="/img/variants/population_1000genomes.png" />

You can also change the grouping attribute and colors interactively after the
track is open.

## Walkthroughs

- [Phased trio analysis](/docs/tutorials/analyze_trio) — matrix display with a
  phased SNP trio
- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples) — regular
  display across a large SV cohort
