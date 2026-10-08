---
title: Gene density and transposon density along a chromosome
sidebar_label: Gene density (RefSeq, RepeatMasker)
description:
  Whole-chromosome bands for 30,000 genes and 1.3 million Alu copies, from a
  features-per-kilobase sidecar the track draws where its features are too many
  to fetch
guide_category: Tutorials
tutorial_category: Genes & annotation
---

We look at where the genes sit along human chromosome 1 and which transposons
sit near them: Alu elements pile up where the genes are, and L1 elements spread
more evenly. A whole chromosome holds more genes, and far more repeat copies,
than a browser fetches at once, so each track points at a small bigWig of
feature counts per kilobase, built once with `jbrowse make-density`. The track
draws that bigWig as a band wherever its features are too many to fetch, and
swaps in the features once they fit.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [Node.js](https://nodejs.org/), which the JBrowse CLI runs on
- the [JBrowse CLI](/docs/cli), for `jbrowse make-density` and the track it
  attaches to
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), which
  `make-density` runs
- htslib (`bgzip`, `tabix`), for the counts at the end

## Where the data comes from

The figures read UCSC's hg38 annotation tables, rehosted by
[genomes.jbrowse.org's hg38](https://genomes.jbrowse.org/ucsc/hg38/) with a
density sidecar beside each file.

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- RefSeq curated genes, UCSC's `ncbiRefSeqCurated` table as GFF3:
  https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz
- RepeatMasker, UCSC's `rmsk` table as BED with a column header:
  https://jbrowse.org/ucsc/hg38/rmsk.bed.gz
- reference lengths, for the bigWig header:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes

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

## Building a features-per-kilobase density sidecar

The sidecar is one bigWig per track: the number of features starting in each 1
kb bin, counted once from the file. `jbrowse make-density` reads the GFF3 and
writes it beside the input, named for the file with `.density.bw` in place of
its `.gz`:

<!-- from: scripts/build_gene_density.sh -->

```bash
# --chrom-sizes gives the bigWig header its reference lengths;
#   --assembly hg38.fa reads them off the FASTA's .fai instead
# a GFF3 counts only lines with no Parent= attribute, so a gene is one
#   count however many transcripts and exons hang under it; a BED, GTF
#   or VCF counts every record
# every bin is written, empty ones included, so the zoomed-out levels of
#   the bigWig average over the whole span
jbrowse make-density genes.gff.gz --chrom-sizes hg38.chrom.sizes
```

`jbrowse add-track genes.gff.gz` finds `genes.gff.density.bw` beside the file
and attaches it; name a sidecar stored elsewhere, or a remote one, with
`--density`. The sidecar goes in the `densityAdapter` slot on the adapter of the
track:

```json addtrack loc=chr1:150,000,000-160,000,000
{
  "type": "FeatureTrack",
  "trackId": "hg38_genes",
  "name": "RefSeq curated genes",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/genes.gff.gz",
    "densityAdapter": {
      "type": "BigWigAdapter",
      "uri": "https://jbrowse.org/demos/gene_density/genes.gff.density.bw"
    }
  },
  "displayDefaults": { "densityTierBpPerPx": 50000 }
}
```

Because `densityAdapter` sits on the adapter, every display of the track draws
the band. The optional `densityTierBpPerPx` switches the gene track to the band
from 50 kb per pixel outward, since on the smaller chromosomes the band reads
more easily than a screen of genes. It has no menu entry, the **Density band**
choices below override it, and the repeat tracks leave it unset.

The three repeat tracks come from cutting the RepeatMasker table into one BED
per `repFamily`, so the Alu track and its sidecar hold only Alus. The same
`make-density` line over each family BED builds its sidecar.

The Alu track follows the same pattern:

```json addtrack loc=chr1:150,000,000-160,000,000
{
  "type": "FeatureTrack",
  "trackId": "hg38_Alu",
  "name": "RepeatMasker Alu",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz",
    "densityAdapter": {
      "type": "BigWigAdapter",
      "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.density.bw"
    }
  }
}
```

The L1 track and the simple-repeat control follow, with the file names swapped:

```json addtrack loc=chr1:150,000,000-160,000,000
{
  "type": "FeatureTrack",
  "trackId": "hg38_L1",
  "name": "RepeatMasker L1",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/L1.bed.gz",
    "densityAdapter": {
      "type": "BigWigAdapter",
      "uri": "https://jbrowse.org/demos/gene_density/L1.bed.density.bw"
    }
  }
}
```

```json addtrack loc=chr1:150,000,000-160,000,000
{
  "type": "FeatureTrack",
  "trackId": "hg38_Simple_repeat",
  "name": "RepeatMasker simple repeats",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Simple_repeat.bed.gz",
    "densityAdapter": {
      "type": "BigWigAdapter",
      "uri": "https://jbrowse.org/demos/gene_density/Simple_repeat.bed.density.bw"
    }
  }
}
```

To use your own BED, swap each `uri` for it and for the sidecar `make-density`
wrote. The BED needs bgzip and tabix (`.tbi` beside it), the same refNames as
the assembly, and the `.density.bw` beside it unless `densityAdapter` points
elsewhere.

## Gene and repeat density bands along chromosome 1

Add the four tracks above, then open chromosome 1 with all four. At this width
every track is over its fetch budget, so each draws its density sidecar.

<Figure src="/img/gene_density_chr1.png" caption="Chromosome 1 with the RefSeq curated genes, the Alu and L1 copies from RepeatMasker, and the simple repeats. Each band is that track's features per kilobase, scaled to its own peak. Genes cluster at the 1p36 tip and across 1q21 to 1q23, and Alu rises and falls with them. L1 and the simple repeats run close to level throughout." />

The gap in every band is the centromere and the 1q12 heterochromatin beside it.

## Zooming in to 1q21 draws the genes again

Type `chr1:150,000,000-160,000,000`, 10 Mb over 1q21 to 1q23. The gene track's
fetch now fits, so its genes are drawn, while the Alu and L1 tracks keep their
bands.

<Figure src="/img/gene_density_1q21.png" caption="Chromosome 1 from 150 to 160 Mb. The RefSeq genes are back as features; the Alu and L1 tracks, still over budget at this width, keep their bands. The Alu band peaks under the densest runs of genes, and the L1 band runs more evenly across them." />

The track menu of a track with a sidecar has a **Density band** entry:

- **Automatic**, **Features only** and **Density only** keep or drop the band by
  hand
- **Load features anyway** forces the fetch the band replaced

## Checking the bands against counts from the files

The bands are counts, so counting the files checks them. Each band prints its
peak in its corner, and hovering it shows the sidecar value under the cursor.
Take one megabase under the tallest run of the gene band, at 155 Mb, and one
under a trough, at 60 Mb, and count what falls in each. A gene's transcripts and
exons have `Parent=`, so the gene line drops them and counts each gene once:

```bash
tabix genes.gff.gz chr1:155,000,000-156,000,000 | grep -vc 'Parent='
tabix Alu.bed.gz chr1:155,000,000-156,000,000 | wc -l
tabix L1.bed.gz chr1:155,000,000-156,000,000 | wc -l
tabix Simple_repeat.bed.gz chr1:155,000,000-156,000,000 | wc -l
```

| window, chr1  | genes | Alu  | L1  | simple repeats |
| ------------- | ----- | ---- | --- | -------------- |
| 155 to 156 Mb | 49    | 1298 | 254 | 269            |
| 60 to 61 Mb   | 4     | 146  | 295 | 235            |

The gene count runs with the Alu count, while L1 and the simple repeats come out
about the same in both, the same pattern the four bands show.

## Reproduce it end to end

Every step above is wrapped in one script,
[`build_gene_density.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_gene_density.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_gene_density.sh
bash build_gene_density.sh                # builds ./gene_density_build/jbrowse2
npx --yes serve gene_density_build/jbrowse2 # then open the printed URL
```

The script fetches the two UCSC tables and the reference lengths, cuts the
RepeatMasker table into the three family BEDs, builds a sidecar for each of the
four files, and writes a JBrowse with the four tracks.

## See also

- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/tutorials/circular_synteny)
- [](/docs/tutorials/gene_prediction_review)
- [](/docs/cli)
- [](/docs/quickstart_web)

## Citations

- Lander et al. (2001).
  [Initial sequencing and analysis of the human genome](https://doi.org/10.1038/35057062)
- Smit, Hubley and Green (2013-2015).
  [RepeatMasker Open-4.0](https://www.repeatmasker.org)
