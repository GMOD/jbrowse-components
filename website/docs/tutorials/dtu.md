---
title: Differential transcript usage
sidebar_label: Transcript usage
description:
  Test which isoform of a gene a tissue prefers, write the per-transcript
  statistic into a GFF3, and read the call against the reads that produced it
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
data: pipeline
---

**TL;DR:** transcript usage is a within-gene proportion, so it changes even
where a gene's total expression does not. The per-transcript statistic is
carried in the GFF3 attribute column and painted by a `jexl:` color callback, so
the call and the reads supporting it appear in one view.

## Prerequisites

- nothing to install to read along: the analysis is hosted at
  [jbrowse.org/demos/dtu](https://jbrowse.org/demos/dtu/), and every figure
  loads from it
- to run it yourself, the tools under
  [Reproduce it end to end](#reproduce-it-end-to-end)

## Usage against expression

A differential expression test asks whether a gene produced more RNA in one
condition than another. Transcript usage asks which isoform that RNA was. It is
a proportion within the gene, and can change while the gene's total remains
constant.

The data is ENCODE's ENTEx panel: skeletal muscle and liver, four donors each,
quantified per transcript with RSEM against GENCODE v29.
[satuRn](https://doi.org/10.12688/f1000research.51749.1) fits a quasi-binomial
model to each transcript's share of its gene's reads and tests that share
between the two tissues.

## The locus

_ATP5F1C_ encodes the gamma subunit of ATP synthase. Its two tissue-specific
isoforms share every internal exon but one, a 37 bp cassette exon.

GENCODE annotates ten transcripts at this locus. The test separated two:
ATP5F1C-201 has the larger share in muscle, ATP5F1C-202 the larger share in
liver. Those two are colored and the remaining eight are gray.

<Figure caption="ATP5F1C on hg38. ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the isoform-fraction change satuRn measured between the two tissues. The marked column is the cassette exon, where the muscle lane is flat and the liver lane peaks." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

## Reading the color

The fill encodes ΔIF, the change in isoform fraction: red for a larger share in
muscle, blue for a larger share in liver, darkening with the size of the change.
A tooltip reports the two isoform fractions and the FDR.

The
[gene track guide](/docs/user_guides/gene_track#color-transcripts-by-a-value-in-the-file)
has the `jexl:` expression that paints it, and the two ways it can fail without
an error.

## Transcripts with no call

The eight gray transcripts are the control. They come from the same model, on
the same reads, in the same figure. Coloring all ten by effect size would also
color transcripts the test could not separate, where a proportion between two
lowly expressed isoforms varies substantially on few reads.

The expression therefore tests the significance flag before reading the effect
size. Two filters stand behind that flag: an FDR threshold, and a minimum
gene-level expression.

## Checking the call against the reads

RSEM and satuRn operate on transcript-level quantifications and use no genomic
coordinates. The coverage tracks are an independent check: if liver prefers the
exon-containing isoform, liver reads should cover that exon and muscle reads
should not.

This is the marked column. Several annotated transcripts contain the cassette
exon, but among the two the test separated, only the liver-preferred one does.

Both coverage tracks use a common scale, so the bands are comparable in height
as well as in shape. Each is a single donor, while the statistic uses all eight.

## Loading your own analysis

Any per-transcript statistic can drive the color once it is present in the
attribute column. A transcript row from the hosted file, wrapped:

```
chr10  HAVANA  transcript  7788129  7807815  .  +  .
  Name=ATP5F1C-202;ID=ENST00000356708.11;Parent=ENSG00000165629.19;...;
  dif=-0.299;fdr=0.0022;if_muscle=0.075;if_liver=0.375;
  tpm_muscle=10.03;tpm_liver=28.88;dtu=liver
```

Four properties of that line, each of which fails without an error:

- **keys are lowercase**: the GFF parser lowercases them, so `dIF=` read back as
  `feature.dIF` is undefined, and an undefined branch returns the default color
- **values are strings**, so numeric comparison requires `parseFloat`
- **every attribute is repeated on the exon, CDS and UTR children**: the glyph
  evaluates the color against the box being painted, not against the transcript
- **`Name=` is added by the pipeline**: GENCODE provides only `gene_name` and
  `transcript_name`, so an unmodified subset labels each row with its Ensembl
  accession

The track config that reads them is in the
[gene track guide](/docs/user_guides/gene_track#color-transcripts-by-a-value-in-the-file).

## Reproduce it end to end

`scripts/build_dtu_demo.sh` fetches the eight ENTEx quantifications and four
coverage bigWigs from ENCODE, builds the count and TPM matrices, runs satuRn,
and writes the statistics into a GENCODE v29 subset:

```bash
bash scripts/build_dtu_demo.sh dtu_build
```

It needs the tools in [Prerequisites](#prerequisites): `curl`, `python3`,
`bgzip`, `tabix`, and R with satuRn, SummarizedExperiment, edgeR and limma.

**Effect size from TPM, test from counts.** Isoform fraction is a molar
quantity, and read counts scale with abundance times effective length, so a
count-based fraction is biased toward long isoforms. The model is fit on counts.

**The gate is satuRn's regular FDR, not its empirical FDR.** The empirical null
assumes most tests are null, which does not hold for this contrast: `locfdr`
reports a misfit, and no transcript passes the empirical FDR. The script prints
the minimum empirical FDR beside its count, on the same threshold the track
uses.

## See also

- [](/docs/tutorials/rnaseq)
- [](/docs/user_guides/gene_track)
- [](/docs/config_guides/jexl)
- [](/docs/tutorials/scrna_pseudobulk)

## References

- Gilis J, Vitting-Seerup K, Van den Berge K, Clement L.
  [satuRn: Scalable analysis of differential transcript usage for bulk and single-cell RNA-sequencing applications](https://doi.org/10.12688/f1000research.51749.1).
  _F1000Research_ 10:374 (2021), the method behind the statistic drawn here.
- Vitting-Seerup K, Sandelin A.
  [The landscape of isoform switches in human cancers](https://doi.org/10.1158/1541-7786.MCR-16-0459).
  _Molecular Cancer Research_ 15:1206-1220 (2017), which introduced isoform
  fraction and its difference as the effect size for usage.
- Li B, Dewey CN.
  [RSEM: accurate transcript quantification from RNA-Seq data with or without a reference genome](https://doi.org/10.1186/1471-2105-12-323).
  _BMC Bioinformatics_ 12:323 (2011), the quantifier ENCODE ran.
- The ENCODE Project Consortium.
  [An integrated encyclopedia of DNA elements in the human genome](https://doi.org/10.1038/nature11247).
  _Nature_ 489:57-74 (2012). The ENTEx tissue panel used here is described at
  [encodeproject.org/entex](https://www.encodeproject.org/entex-matrix/?type=Experiment&status=released&internal_tags=ENTEx).
