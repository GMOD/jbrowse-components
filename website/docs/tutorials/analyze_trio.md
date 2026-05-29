---
title: Phased trio analysis
description: Examine inheritance patterns and variant phasing in a trio dataset
guide_category: Tutorials
---

A **trio** is sequencing data from a mother, father, and child together. A
**phased** VCF assigns each variant to one of the two haplotypes (`0|1` vs
`1|0`), so you can trace which copy of the genome each variant came from.

This tutorial uses a pre-built phased VCF from the 1000 Genomes Project — the
Kinh-Vietnamese trio HG02024 (chr1 only):

- [VCF](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
- [Index (.tbi)](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz.tbi)

Add the VCF to JBrowse via the CLI or the GUI. Once loaded:

<Figure caption="Initial load of the VCF file, showing the default display mode with simple orange boxes for each variant" src="/img/trio-basic.png"/>

## Enabling the matrix view

Switch the track to the **Multi-sample variant display (matrix)** display. Each
sample becomes a row, each variant a column, with black lines connecting columns
back to their genomic positions.

<Figure caption="Multi-sample variant display (matrix). Each sample is a row and each variant is a column; black lines connect columns to their genome positions." src="/img/trio-matrix.png"/>

## Enabling the phased mode

The matrix display has a "phased" rendering mode, available when the genotypes
use the `0|1` (phased) separator instead of `0/1` (unphased).

The ideal is that your variants will be "completely phased". This sometimes
requires specialized programs like SHAPEIT.

<Figure caption="Screenshot showing the phased rendering mode along with the menu item used to select it 'Rendering mode'->'Phased'" src="/img/trio-matrix-phased.png"/>

## Finding matching haplotypes with "visual phasing"

The term "visual phasing" comes from the genetic genealogy subfield. I am
borrowing it here, but the idea is simple: you can look at the genotype matrix
here, and see areas where different rows are matching. You would expect that the
child would match the mom in some places, and the dad in other places. And
indeed, each row looks somewhat like a barcode, so you can find matching pieces
like this

<Figure caption="Screenshot showing the phased rendering mode without any added markup. You can look at this figure and see various areas where rows match one another. The first two rows are the two haplotypes of the child, next two rows are the two haplotypes of the mom, and next two rows are the two haplotypes of the father" src="/img/trio-matrix-phased-clean.png"/>

## Using a program to help find phased blocks

In the above section, we could see matching blocks with our eyes, but can a
program help?

There are indeed options for this. The program
[hap-ibd](https://github.com/browning-lab/hap-ibd) can find "identical by
descent" blocks. It is actually capable of finding such blocks in massive
population-scale datasets, but we are applying it here to a smaller trio VCF.
The hap-ibd program takes as input:

- a phased VCF like the
  [trio dataset](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
- a genetic map in PLINK format (the README of hap-ibd provides these for
  GRCh38)

## Converting hap-ibd data into a format for JBrowse

By loading the hap-ibd data in JBrowse, hap-ibd can tell us which blocks of the
chromosome are matches

```bash
#!/bin/bash
# hap-ibd .ibd columns are: sample1, hap1, sample2, hap2, chr, start, end
# we rearrange them into a BED file with columns: chr, start, end, sample1, hap1, sample2, hap2
# add this config to jbrowse: get(feature,'sample1')+':HP'+get(feature,'hap1')+'     '+get(feature,'sample2')+':HP'+get(feature,'hap2')
zcat result.ibd.gz | cut -f 5,6,7 > coords.bed
zcat result.ibd.gz | cut -f 1,2,3,4 > samples.txt
printf '#chr\tstart\tend\tsample1\thap1\tsample2\thap2\n' > out.bed
paste coords.bed samples.txt >> out.bed
```

After this conversion, we can load this simple BED file into JBrowse via the GUI
or the CLI. It is probably small enough that it doesn't even need tabix
conversion.

## Background: relationship between phased blocks, and the biology of recombination

Many people have heard of the term "recombination" or "crossing over" with
regards to DNA, but what is it?

The
[NHGRI genetics glossary](https://www.genome.gov/genetics-glossary/Crossing-Over)
defines it as "the exchange of DNA between paired homologous chromosomes (one
from each parent) that occurs during the development of egg and sperm cells
(meiosis)."

![](/img/crossing_over.jpg) Figure from the
[NHGRI genetics glossary](https://www.genome.gov/genetics-glossary/Crossing-Over)

But there is a subtle but important point here: Your parents' genomes don't
recombine during fertilization. Recombination happens during the production of
their gametes. Therefore, your grandparents' genomes recombine during the
production your parents sperm/eggs. We will see this visually below

## Visualizing phased blocks and crossing over points in phased VCF files in JBrowse

After loading the hap-ibd track, we can see the blocks that hap-ibd calculated.
We can additionally connect the lines onto the matrix view (which admittedly
isn't straightforward, we have to follow the lines from the genomic position to
the matrix position),

We can see this in the trio dataset where the child has a mixture of the dad's
haplotypes and a mixture of the mom's haplotypes

<Figure caption="Screenshot showing the connection between hap-ibd annotations (orange) and the phased VCF matrix view. The colored blocks are marked-up using Google Slides. As a result of this visualization, we can see a crossing-over point that occurred (independently) in both the mom and dad at almost the same position, which form continuous blocks in the child." src="/img/trio-crossing-over.png"/>

In the above screenshot, you can look at the 'barcode-like' patterns to see the
matches between MOM A1 (allele 1) in mom and the child, MOM A2 (allele 2) in mom
and child, DAD A1 (allele 1) in dad and child, DAD A2 (allele 2) in dad and
child

You can see why we mentioned the grandparents above: for instance, the DAD A1
and DAD A2 alleles come from the crossing over of his two copies of his
chromosomes that he got from his parents, which then recombine into a single
chromosome in his child

## See also

For structural variant analysis with the 1000 Genomes dataset — multi-sample
genotypes, trio inheritance of SVs, and a large chromosomal inversion — see the
[Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples) tutorial.

## Live demo

[Open this session](https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-4gbEzsiqFe&password=Q2O2L)
to explore the trio dataset described above.

Note: the final visualization with marked-up crossing-over blocks was produced
manually in an image editor. Automated detection of crossing-over points is not
currently built into JBrowse.
