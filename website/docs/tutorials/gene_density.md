---
title: Gene density and transposon density along a chromosome
sidebar_label: Gene density (RefSeq, RepeatMasker)
description:
  Whole-chromosome bands for 30,000 genes and 1.3 million Alu copies, from a
  features-per-kilobase sidecar the track draws where its features are too many
  to fetch
guide_category: Tutorials
tutorial_category: Configuration & embedding
data: hosted
---

**TL;DR:** we look at where the genes sit along human chromosome 1 and which
transposons keep them company: Alu elements pile up where the genes are, and L1
elements where they are not. A whole chromosome holds more genes, and far more
repeat copies, than a browser fetches at once, so each track carries a small
bigWig of feature counts per kilobase, built once with `jbrowse make-density`,
that the track draws as a band wherever its features are too many to fetch and
drops the moment they fit.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)); every file here is a URL, so nothing
  needs hosting to read along
- the [JBrowse CLI](/docs/cli), for `jbrowse make-density` and the track it
  attaches to
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), which
  `make-density` runs
- htslib (`bgzip`, `tabix`), for the counts at the end
- `node`, for [Reproduce it end to end](#reproduce-it-end-to-end) only

## Where the data comes from

The figures read UCSC's hg38 annotation tables, rehosted on jbrowse.org with a
density sidecar beside each file.

- RefSeq curated genes, UCSC's `ncbiRefSeqCurated` table as GFF3:
  https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz
- RepeatMasker, UCSC's `rmsk` table as BED with a column header:
  https://jbrowse.org/ucsc/hg38/rmsk.bed.gz
- reference lengths, for the bigWig header:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
- the sequence:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit
- the genes the figures open, with `.tbi` and `.density.bw` beside it:
  https://jbrowse.org/demos/gene_density/genes.gff.gz
- the Alu copies cut from the RepeatMasker table, likewise:
  https://jbrowse.org/demos/gene_density/Alu.bed.gz
- the L1 copies: https://jbrowse.org/demos/gene_density/L1.bed.gz
- the simple repeats, the control:
  https://jbrowse.org/demos/gene_density/Simple_repeat.bed.gz

## A chromosome of genes

Open the session on chromosome 1 with the four tracks. None of them fetches its
features at this width: a track that would have to pull tens of thousands of
records to draw a screen stops at the estimate and, since each of these has a
density sidecar, draws that instead. Each band is the track's features per
kilobase along the chromosome, scaled to its own peak.

<Figure src="/img/gene_density_chr1.png" caption="Chromosome 1 with the RefSeq curated genes, the Alu and L1 copies from RepeatMasker, and the simple repeats. Each band is that track's features per kilobase, scaled to its own peak. Genes cluster at the 1p36 tip and across 1q21 to 1q23; Alu rises and falls with them, L1 fills the stretches between, and the simple repeats stay level throughout." />

The gene band and the Alu band share their peaks, the L1 band is close to their
negative, and the simple-repeat band, which has no reason to follow either, does
not. The gap in every band is the centromere.

## The band is a bigWig beside the file

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
# every bin is written, empty ones included, so the bigWig's zoomed-out
#   levels average over the whole span rather than over the bins with a hit
jbrowse make-density genes.gff.gz --chrom-sizes hg38.chrom.sizes
```

`jbrowse add-track genes.gff.gz` then finds `genes.gff.density.bw` beside the
file and attaches it on its own; a sidecar elsewhere, or a remote one, is named
with `--density`. What it writes is the `densityAdapter` slot on the track's
adapter, a BigWigAdapter over the sidecar:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg38_genes",
  "name": "RefSeq curated genes",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "gffGzLocation": {
      "uri": "https://jbrowse.org/demos/gene_density/genes.gff.gz"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/gene_density/genes.gff.gz.tbi"
      }
    },
    "densityAdapter": {
      "type": "BigWigAdapter",
      "bigWigLocation": {
        "uri": "https://jbrowse.org/demos/gene_density/genes.gff.density.bw"
      }
    }
  },
  "displayDefaults": { "densityTierBpPerPx": 50000 }
}
```

The slot is on the adapter rather than the display, so every display over the
file gets the band. `densityTierBpPerPx` is the one display setting here, and it
is optional: on the smaller chromosomes a screen of genes fits the fetch budget,
and the band is the point at that zoom, so the gene track asks for it from 50 kb
per pixel outward rather than leaving the swap to the budget alone. The repeat
tracks need no such nudge.

The three repeat tracks are the RepeatMasker table cut into one BED per family
on its `repFamily` column, so that the Alu track's features are Alus and its
sidecar counts Alus. The same `make-density` line over each family's BED gives
its sidecar.

## Zooming in gives the features back

Zoom to 10 Mb over 1q21 to 1q23. The gene track's fetch now fits, so its band is
gone and the genes are drawn. The Alu and L1 tracks would still each pull tens
of thousands of records for this window, so they keep their bands.

<Figure src="/img/gene_density_1q21.png" caption="10 Mb of chromosome 1 from 150 to 160 Mb. The RefSeq genes are back as features; the Alu and L1 tracks, still over budget at this width, keep their bands. The Alu band peaks under the densest run of genes, and the L1 band is fullest where the genes thin out." />

The swap is on what a fetch would cost, not on how wide the view is: the gene
track and the Alu track are the same width here and only one of them is over
budget. A track with a sidecar also carries a **Density tier** entry in its
track menu, with **Automatic**, **Features only** and **Density only**, so the
band can be held or dropped by hand.

## Checking the band against the file

The bands are counts, so the file answers the same question. Each band names its
peak in its corner, and hovering it reads the sidecar's value under the cursor.
Take one megabase under the tallest run of the gene band, at 155 Mb, and one
under a trough, at 60 Mb, and count what starts in each:

```bash
tabix Alu.bed.gz chr1:155,000,000-156,000,000 | wc -l
tabix L1.bed.gz chr1:155,000,000-156,000,000 | wc -l
```

| window, chr1  | genes | Alu  | L1  | simple repeats |
| ------------- | ----- | ---- | --- | -------------- |
| 155 to 156 Mb | 49    | 1298 | 254 | 269            |
| 60 to 61 Mb   | 4     | 146  | 295 | 235            |

The gene count runs with the Alu count and against the L1 count, and the simple
repeats come out about the same in both, which is the shape the four bands drew.

## Reproduce it end to end

Every step above is wrapped in one script,
[`build_gene_density.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_gene_density.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_gene_density.sh
bash build_gene_density.sh                # builds ./gene_density_build/jbrowse2
npx --yes serve gene_density_build/jbrowse2 # then open the printed URL
```

It fetches the two UCSC tables and the reference lengths, cuts the RepeatMasker
table into the three family BEDs, builds a sidecar for each of the four files,
and writes a JBrowse with the four tracks. The tools it needs are the ones under
[Prerequisites](#prerequisites).

## See also

- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/cli)
- [](/docs/quickstart_web)

## References

- Lander et al. (2001).
  [Initial sequencing and analysis of the human genome](https://doi.org/10.1038/35057062)
- Smit, Hubley and Green (2013-2015).
  [RepeatMasker Open-4.0](https://www.repeatmasker.org)
