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

**TL;DR:** transcript usage is a within-gene proportion, so it moves even where
a gene's total expression does not. Carrying the per-transcript statistic in the
GFF3 attribute column lets the gene glyph paint it through a `jexl:` color
callback, which puts the call and the reads behind it in one view.

## Prerequisites

- nothing to install to read along: the analysis is already hosted at
  [jbrowse.org/demos/dtu](https://jbrowse.org/demos/dtu/), and every figure
  loads from it
- to run the analysis yourself, the tools listed under
  [Reproduce it end to end](#reproduce-it-end-to-end)

## Usage against expression

A differential expression test asks whether a gene made more RNA in one
condition than another. Differential transcript usage asks a different question
of the same reads: of the RNA a gene did make, which isoform was it? That is a
proportion within the gene, so it can move while the gene's total stays flat,
and it is the half of the answer a genome browser is equipped to show. The
proportion is a claim about which exons were included, and the exons are drawn
right there with the reads over them.

The dataset here is ENCODE's ENTEx panel: skeletal muscle and liver, four donors
each, RNA-seq quantified per transcript with RSEM against GENCODE v29. One donor
contributed both tissues.
[satuRn](https://doi.org/10.12688/f1000research.51749.1) fits a quasi-binomial
model to each transcript's share of its gene's reads and tests that share
between the two tissues.

## The locus

_ATP5F1C_ encodes the gamma subunit of ATP synthase, and the tissue-specific
isoform pair it carries is old, well-described biology. It makes a good first
look for a reason that has nothing to do with being known, though: the two
isoforms differ at a single small internal exon, so the difference between them
is one column of the picture rather than a whole different gene model.

Of the ten transcripts GENCODE annotates here, the test separated two.
ATP5F1C-201 takes the larger share in muscle and ATP5F1C-202 the larger share in
liver, and those two carry the color while the remaining eight stay gray. The
marked column is the cassette exon that tells them apart.

<Figure caption="ATP5F1C on hg38. ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the isoform-fraction change satuRn measured between the two tissues. The marked column is the 37 bp cassette exon, where the muscle lane is flat and the liver lane peaks." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

## Reading the color

The fill is the change in isoform fraction, ΔIF, on a red-to-blue ramp: red
where a transcript takes a larger share of its gene in muscle, blue where it
takes a larger share in liver, and darker with the size of the shift. The recipe
that paints it is a `jexl:` expression over the GFF3 attributes, and the
[gene track guide](/docs/user_guides/gene_track#color-transcripts-by-a-value-in-the-file)
has the whole track config plus the two ways writing one silently does nothing.

Hovering a transcript reads back the numbers the color stands for, which is the
other half of the encoding: the ramp gives direction and rough size at a glance,
the tooltip gives the isoform fractions and the FDR.

## The transcripts that stay gray

The eight neutral transcripts are the page's control. They come out of the same
model, on the same reads, in the same figure, and they are what the encoding
looks like when there is no call to make. A ramp that colored all ten by effect
size alone would look like a much stronger result and would be reporting mostly
noise, since a proportion between two lowly-expressed isoforms will swing a long
way on a handful of reads.

The color therefore branches on the significance flag first and reads the effect
size only after it passes. Two filters stand behind that flag: an FDR cut, and a
floor on the gene's expression so a swing between two near-zero isoforms does
not qualify.

## Checking the call against the reads

The colors come from RSEM and satuRn. Neither ever looked at the genome, and
both work from transcript-level quantifications that were already assigned
before any of this was drawn. The coverage tracks are the independent check: if
the model is right that liver prefers the exon-containing isoform, the liver
reads have to pile up over that exon and the muscle reads have to not.

That is what the marked column shows, and it is worth being precise about what
carries it. Several of the annotated transcripts include the cassette exon, but
most of those are among the gray ones. Of the two the test actually separated,
only the liver-preferred one has it, so the coverage split is predicted by the
colors rather than restated by them.

Both coverage tracks are pinned to the same scale, so the two bands are
comparable by height and not only by shape. They are one donor per tissue, while
the statistic uses all eight, which is why the track names carry their ENCODE
accessions.

## Loading your own analysis

Any per-transcript statistic works the same way as long as it reaches the
attribute column of a GFF3. A transcript row from the hosted file, wrapped for
readability:

```
chr10  HAVANA  transcript  7788129  7807815  .  +  .
  Name=ATP5F1C-202;ID=ENST00000356708.11;Parent=ENSG00000165629.19;...;
  dif=-0.299;fdr=0.0022;if_muscle=0.075;if_liver=0.375;
  tpm_muscle=10.03;tpm_liver=28.88;dtu=liver
```

Three properties of that line are what make the color work, and each fails
quietly rather than loudly:

- **the keys are lowercase**, because the GFF parser lowercases them on the way
  in. Writing `dIF=` and reading `feature.dIF` yields undefined, and an
  undefined branch just takes the default color.
- **the values are strings**, so a numeric comparison needs `parseFloat`.
- **every attribute is repeated onto the transcript's exon, CDS and UTR
  children.** The glyph draws one box per subfeature and evaluates the color
  against that box, not against the transcript above it.

The `Name=` at the front is a fourth thing the pipeline adds. GENCODE carries
the readable name as `gene_name` and `transcript_name` and no `Name`, so a
subset loaded as it ships labels every row with its Ensembl accession.

The track config that consumes them is in the
[gene track guide](/docs/user_guides/gene_track#color-transcripts-by-a-value-in-the-file).

## Reproduce it end to end

`scripts/build_dtu_demo.sh` fetches the eight ENTEx quantifications and the four
coverage bigWigs from ENCODE, builds the count and TPM matrices, runs satuRn,
and writes the statistics into a GENCODE v29 subset:

```bash
bash scripts/build_dtu_demo.sh dtu_build
```

It needs the tools in [Prerequisites](#prerequisites): `curl`, `python3`,
`bgzip`, `tabix`, and R with satuRn, SummarizedExperiment, edgeR and limma.

Two choices in it are worth knowing about, because both look like details and
neither is:

**The effect size comes from TPM, the test from counts.** Isoform fraction is a
molar quantity, and read counts scale with abundance times effective length, so
a fraction computed from counts is biased toward long isoforms. The GLM still
runs on counts, which is what it wants.

**The significance gate is satuRn's regular FDR, not its empirical FDR.** The
empirical null assumes most tests are null. Muscle against liver is a contrast
where that does not hold, `locfdr` warns that the null misfits, and the
empirical FDR then swallows the whole result: nothing passes it, at any
threshold anyone would pick, while ordinary Benjamini-Hochberg leaves a
substantial set. The script reports its own count on the same gate the track
uses, so a run that disagrees with the hosted file says so instead of looking
like an empty result.

## See also

- [](/docs/tutorials/rnaseq)
- [](/docs/user_guides/gene_track)
- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/config_guides/jexl)
- [](/docs/user_guides/quantitative_track)

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
