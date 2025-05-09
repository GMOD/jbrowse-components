---
id: variant_track
title: Variant tracks
---

import Figure from '../figure'

Visualizing variant tracks from the VCF format alongside the original alignment
evidence track is a common workflow for validating your results, shown below:

<Figure caption="Variant track indicating a SNP alongside the alignment track evidence." src="/img/variant_with_pileup.png" />

### Variant widget

The variant features have a specialized widget that contains a table indicating
all the calls that were made in a multi-sample VCF. Some VCF files, like the
1000 genomes VCF, can contain thousands of samples in a single file. This table
can display the details.

<Figure caption="Screenshot showing the variant feature sidebar with a filtered by genotype (with alternative allele '1'). Users can also filter by sample name or other attributes." src="/img/variant_panel.png" />

Example showing a deletion in a trio
https://jbrowse.org/code/jb2/v3.2.0/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-tzYolAQWOK&password=HGZA4

We can use the Variant widget to sort by samples that have the genotype (e.g. GT
being non-zero, zero is the REF allele, any non-zero value is one of the ALT
alleles)

## Multi-sample variant matrix display

The "matrix" style display allows users to visualize "population VCF" or
"multi-sample" VCFs in a way that puts all variants in a dense, matrix-style or
heatmap style view

This helps to show various patterns in the data that would be difficult to see
if the variants were only plotted at their specific genomic position

<Figure caption="Example screenshot of looking at a deletion structural variant, with alignment evidence from a mom, dad, and child (trio). The firs two samples (mother, child) have complete (homozygous) deletion in this region, while the father has a heterozygous deletion. The blue markers show 'soft clipping' at the boundaries of the deletion. The right panel shows all the samples, sorted by their genotype" src="/img/multi-sv-trio.png" />
