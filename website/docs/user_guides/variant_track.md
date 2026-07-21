---
title: Variant track
description: VCF variant display
guide_category: Track types
---

A common workflow is to view a VCF variant track alongside the alignment track
that produced the calls:

<Figure caption="Variant track indicating an SNV alongside the alignment track evidence." src="/img/variant_with_pileup.png" />

## Variant widget

Clicking a variant opens a widget with a per-sample genotype table. Multi-sample
VCFs (like 1000 Genomes) can contain thousands of samples.

<Figure caption="Feature details panel for an SNV (C→T), with a per-sample genotype table in the SAMPLES section." src="/img/variant_panel.png" />

[Live demo: example showing a deletion in a trio](https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-tzYolAQWOK&password=HGZA4)

The SAMPLES section lists every sample with its genotype (GT) and other
per-sample fields, and each column has its own filter box accepting plain text
or a regex. For example, typing '1' in the genotype filter keeps only samples
carrying the first alternate allele (0|1 or 1|1), hiding the many
homozygous-reference rows. GT=0 is the REF allele; any non-zero value is an ALT
allele.

## Multi-sample variant matrix display

For multi-sample VCFs, the matrix display renders genotypes as a dense heatmap
(each row a sample, each column a variant), making shared variants, population
structure, and runs of homozygosity visible at a glance. See
[Multi-sample variant displays](/docs/user_guides/multivariant_track) for the
full walkthrough of the regular and matrix multi-sample displays.

## See also

- [Multi-sample variant display](/docs/user_guides/multivariant_track)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [Alignments track](/docs/user_guides/alignments_track)
- [GWAS / Manhattan track](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)
