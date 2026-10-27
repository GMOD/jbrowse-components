---
title: Gene density and transposon density along a chromosome
sidebar_label: Gene density (RefSeq, RepeatMasker)
description:
  Whole-chromosome tracks of genes and Alu copies per kilobase, from a bigWig
  `jbrowse make-density` counts once from each annotation file
guide_category: Tutorials
tutorial_category: Genes & annotation
---

We look at where the genes sit along human chromosome 1 and which transposons
sit near them: Alu elements pile up where the genes are, and L1 elements spread
more evenly. A whole chromosome holds more genes, and far more repeat copies,
than a browser fetches at once. We:

- count each file's features per kilobase into a small bigWig with
  `jbrowse make-density`
- load the counts as gene and repeat density tracks along chromosome 1
- zoom in to 1q21, where the tracks give way to the features themselves

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [Node.js](https://nodejs.org/), which the JBrowse CLI runs on
- the [JBrowse CLI](/docs/cli), for `jbrowse make-density`
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), which
  `make-density` runs
- htslib (`bgzip`, `tabix`), for the build script

<!-- TUTORIAL_INSTALL htslib,node,jbrowse-cli,bedGraphToBigWig START -->

```bash
# Debian/Ubuntu
sudo apt install tabix nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib nodejs ucsc-bedgraphtobigwig
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bedGraphToBigWig
chmod +x ~/.local/bin/bedGraphToBigWig
# any platform
npm install -g @jbrowse/cli@next
```

<!-- TUTORIAL_INSTALL htslib,node,jbrowse-cli,bedGraphToBigWig END -->

## The data

The figures read UCSC's hg38 annotation tables, rehosted by
[genomes.jbrowse.org's hg38](https://genomes.jbrowse.org/ucsc/hg38/) with a
per-kilobase bigWig beside each file.

You don't need these files to follow the page: the track configs below read the
hosted results. The [build script](#reproduce-it-end-to-end) fetches them to
rebuild those results. The counting step takes any GFF3 or BED of your own.

| What it is                                                     | File                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| RefSeq curated genes, UCSC's `ncbiRefSeqCurated` table as GFF3 | [ncbiRefSeqCurated.gff.gz](https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz)           |
| RepeatMasker, UCSC's `rmsk` table as BED with a column header  | [rmsk.bed.gz](https://jbrowse.org/ucsc/hg38/rmsk.bed.gz)                                     |
| Reference lengths, for the bigWig header                       | [hg38.chrom.sizes](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes) |

## Loading hg38

We'll load hg38, the assembly the UCSC tables were cut from. Every track below
names it in `assemblyNames`.

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

## Counting features per kilobase into a bigWig

One bigWig per file holds the number of features starting in each 1 kb bin,
counted once. `jbrowse make-density` reads the GFF3 and writes it beside the
input, named for the file with `.density.bw` in place of its `.gz`:

<!-- from: scripts/build_gene_density.sh -->

```bash
# --chrom-sizes gives the bigWig header its reference lengths;
#   --assembly hg38.fa reads them off the FASTA's .fai instead
# a GFF3 counts only lines with no Parent= attribute, so a gene is one
#   count however many transcripts and exons hang under it; a BED or VCF
#   counts every record, and a GTF its transcript rows
# every bin is written, empty ones included, so the zoomed-out levels of
#   the bigWig average over the whole span
jbrowse make-density genes.gff.gz --chrom-sizes hg38.chrom.sizes
```

Add the bigWig as a track:

```json addtrack loc=chr1
{
  "trackId": "hg38_genes_density",
  "name": "RefSeq genes per kb",
  "assemblyNames": ["hg38"],
  "uri": "https://jbrowse.org/demos/gene_density/genes.gff.density.bw",
  "displayDefaults": { "mark": { "extent": "none" } }
}
```

`mark.extent: "none"` draws each bin's mean alone. Most kilobases hold no gene
or one, so the min-max band drawn around the mean would fill every zoomed-out
pixel to the same height.

The three repeat tracks come from cutting the RepeatMasker table into one BED
per `repFamily`, so the Alu bigWig counts only Alus. The same `make-density`
line over each family BED builds its bigWig:

```json addtrack loc=chr1
{
  "trackId": "hg38_Alu_density",
  "name": "Alu per kb",
  "assemblyNames": ["hg38"],
  "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.density.bw",
  "displayDefaults": { "mark": { "extent": "none" } }
}
```

The L1 track and the simple-repeat control follow, with the file names swapped:

```json addtrack loc=chr1
{
  "trackId": "hg38_L1_density",
  "name": "L1 per kb",
  "assemblyNames": ["hg38"],
  "uri": "https://jbrowse.org/demos/gene_density/L1.bed.density.bw",
  "displayDefaults": { "mark": { "extent": "none" } }
}
```

```json addtrack loc=chr1
{
  "trackId": "hg38_Simple_repeat_density",
  "name": "Simple repeats per kb",
  "assemblyNames": ["hg38"],
  "uri": "https://jbrowse.org/demos/gene_density/Simple_repeat.bed.density.bw",
  "displayDefaults": { "mark": { "extent": "none" } }
}
```

## Gene and repeat density along chromosome 1

Add the tracks above, then open chromosome 1 with all of them.

<Figure src="/img/gene_density_chr1.png" caption="Chromosome 1 with RefSeq genes, Alu, L1 and simple repeats, each as features per kilobase on its own scale." />

The gap in every track is the centromere and the 1q12 heterochromatin beside it.

## Zooming in to 1q21 with the genes as features

Add the gene file as a track, then type `chr1:150,000,000-160,000,000`, 10 Mb
over 1q21 to 1q23. At this width the gene track's fetch fits, so it draws each
gene:

```json addtrack loc=chr1:150,000,000-160,000,000
{
  "type": "FeatureTrack",
  "trackId": "hg38_genes",
  "name": "RefSeq curated genes",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/genes.gff.gz"
  }
}
```

<Figure src="/img/gene_density_1q21.png" caption="chr1 from 150 to 160 Mb, the RefSeq genes as features above Alu and L1 per kilobase." />

## Reproduce it end to end

[`build_gene_density.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_gene_density.sh)
wraps every step above. It:

1. fetches the two UCSC tables and the reference lengths
2. cuts the RepeatMasker table into the three family BEDs
3. counts each file per kilobase into a bigWig
4. writes a JBrowse with the files and their bigWigs as tracks

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_gene_density.sh
bash build_gene_density.sh                # builds ./gene_density_build/jbrowse2
npx --yes serve gene_density_build/jbrowse2 # then open the printed URL
```

## See also

- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/tutorials/circular_synteny)
- [](/docs/tutorials/organelle_map)
- [](/docs/tutorials/gene_prediction_review)
- [](/docs/cli)
- [](/docs/quickstart_web)

## Citations

- Lander et al. (2001).
  [Initial sequencing and analysis of the human genome](https://doi.org/10.1038/35057062)
- Smit, Hubley and Green (2013-2015).
  [RepeatMasker Open-4.0](https://www.repeatmasker.org)
