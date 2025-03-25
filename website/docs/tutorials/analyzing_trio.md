---
id: analyzing_trio
title: Analyzing a phased trio
date: 2025-03-25
---

Trio datasets tell us data about a mom, dad, and child (parents and offspring)

In a VCF file, this data can additionally be "phased" which tells us information
about each "haplotype" of a VCF dataset

For this tutorial, we will use this file, a Kinh-Vietnamese trio from the 1000
genomes dataset
https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz

<Figure caption="Initial load of the VCF file, showing simple boxes for each variant" src="/img/trio-basic.png"/>

## Enabling the matrix view

<Figure caption="Navigating to the track menu, and selecting 'Multi-variant display (matrix) enables all the samples to be given their own row in the view. Each variant is a 'column' in this matrix, and each sample is a 'row'. Black lines connect the variants to their genome position" src="/img/trio-basic.png"/>

## Analyzing phase-blocks and crossing over

We can run a program such as hap-ibd, which can find "identical by descent"
blocks

In the trio dataset, this can be used to even find crossing over points

Crossing-over or recombination happens during the production of gametes via
meisos (production of eggs or sperm). This causes the haploid genome of the egg
or sperm to contain a mixture of the parents haplotypes

We can see this in the trio dataset where the child has a mixture of the dad's
haplotypes, and a mixture of mom's haplotypes

<Figure caption="Figure showing a crossing-over point in both the mother and the father, and how those are a continuous haplotype in the child" src="/img/crossing-over.png"/>
