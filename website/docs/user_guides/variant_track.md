---
id: variant_track
title: Variant tracks
description: VCF variant display
guide_category: Track types
---


A common workflow is to view a VCF variant track alongside the alignment track
that produced the calls:

<Figure caption="Variant track indicating a SNP alongside the alignment track evidence." src="/img/variant_with_pileup.png" />

### Variant widget

Clicking a variant opens a widget with a per-sample genotype table. Multi-sample
VCFs (like 1000 Genomes) can contain thousands of samples, all shown in the
table.

<Figure caption="Feature details panel for an SNV (C→T). The SAMPLES section lists every sample with its genotype (GT) and other per-sample fields. The 'Filter sample (regex)' field at the top of the SAMPLES section accepts a regex; typing '1' keeps only samples with the alt allele (1|0 or 0|1), hiding the many homozygous-reference rows." src="/img/variant_panel.png" />

[Live demo — example showing a deletion in a trio](https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-tzYolAQWOK&password=HGZA4)

The Variant widget can be used to filter or sort samples by genotype (GT=0 is
the REF allele; any non-zero value is an ALT allele).

## Multi-sample variant matrix display

The matrix display shows multi-sample VCFs as a dense heatmap where each row is
a sample and each column is a variant position. This makes genotype patterns —
shared variants, population structure, runs of homozygosity — visible at a
glance in ways that a per-position track cannot.

<Figure caption="Example screenshot of looking at a deletion structural variant, with alignment evidence from a mom, dad, and child (trio). The first two samples (mother, child) have complete (homozygous) deletion in this region, while the father has a heterozygous deletion. The blue markers show 'soft clipping' at the boundaries of the deletion. The right panel shows all the samples, sorted by their genotype" src="/img/multi-sv-trio.png" />
