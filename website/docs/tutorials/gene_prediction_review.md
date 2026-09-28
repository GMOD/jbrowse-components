---
title: Reviewing a gene prediction (Tiberius)
sidebar_label: Gene prediction review
description:
  Sort the models a gene finder disagrees with an existing annotation about into
  four kinds, and build a static review page that links each one back into
  JBrowse
guide_category: Tutorials
tutorial_category: Genes & annotation
---

Tiberius predicts genes from sequence alone, and GENCODE annotates the same
human genome. We compare the two on chr22, sort the models that disagree into
four classes, and build a review portal that links each disagreement back into
JBrowse. The reference only checks the prediction, so the method suits
re-annotating a genome that already has an annotation or benchmarking a new
predictor.

## Prerequisites

- to build a portal over your own genome: Node 23+, htslib for `tabix`, and the
  JBrowse CLI

## Where the data comes from

Tiberius predictions over GRCh38
([Gabriel et al. 2024](https://doi.org/10.1093/bioinformatics/btae685)), read
against GENCODE 47.

- Tiberius gene predictions:
  https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz
- GENCODE 47 comprehensive annotation:
  https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz
- hg38 reference sequence:
  https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz

## One model, to see what is at stake

Open the two annotations together at `chr22:49,987,402-50,067,759`. Tiberius
draws one model, `g14001.t1`, across most of the window. GENCODE draws two genes
under it, _IL17REL_ and _TTLL8_, with a gap between them. GENCODE's gene
features carry `gene_name` but no `Name`, so the track labels them by accession:
_IL17REL_ is `ENSG00000188263` and _TTLL8_ is `ENSG00000138892`.

<Figure src="/img/gene_prediction_merge.png" caption="One Tiberius model spans IL17REL (ENSG00000188263) and TTLL8 (ENSG00000138892), which GENCODE annotates as separate genes. MLC1 on the right gets a separate prediction." />

_MLC1_ on the right is the control: Tiberius gives it a model of its own. The
merged model is two neighbouring genes run together, and an annotator fixes it
by splitting the model in two.

## Sorting the models

Tiberius predicts 559<!--m:tiberius-chr22-run.models-predicted.count--> models
on chr22. Most of them share splice junctions with a GENCODE gene and need no
attention; the rest disagree in one of four ways, and only those reach the
portal.

| Class              | What it means                                                     | On chr22                                                   | What an annotator does   |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| Agrees             | shares splice junctions with a reference gene                     | 424<!--m:tiberius-chr22-classes.agrees.models-->           | nothing                  |
| Merged model       | one prediction covers two separate reference genes                | 1<!--m:tiberius-chr22-classes.merged-model.models-->       | split into two models    |
| Structure conflict | covers one gene but shares none of its splice junctions           | 3<!--m:tiberius-chr22-classes.structure-conflict.models--> | check the exon structure |
| Novel locus        | predicted where the reference annotates nothing                   | 12<!--m:tiberius-chr22-classes.novel-locus.models-->       | assess, then create      |
| Novel coding       | predicted coding where the reference has only non-coding features | 119<!--m:tiberius-chr22-classes.novel-coding.models-->     | assess coding potential  |

A junction counts as shared when it is an intron of one of the gene's
transcripts. A merged model counts only when the genes it joins do not overlap
each other, so _PI4KA_, which has _SERPIND1_ inside one of its introns on the
opposite strand, stays off the list.

## Building the portal

The pipeline is
[cmdcolin/gene-review-portal](https://github.com/cmdcolin/gene-review-portal).
Its README covers the options, including RNA-seq tracks under every model and
Apollo links on every card. One command builds the portal for chr22:

```bash
node bin/make-portal.mjs \
  --prediction https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz \
  --reference https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  --fasta https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --assembly hg38 --region chr22 --max 3 \
  --with-app --out ./portal
```

The output directory holds the page, a JBrowse config, one PNG per candidate and
a copy of JBrowse, so copying it to a web server deploys it.

## Reading the portal

The [example portal](https://jbrowse.org/demos/tiberius_review/) has one card
per disagreement, showing the class, the reference genes and a picture of the
two annotations. **Open in JBrowse** on a card opens the same locus live with
the same tracks. The verdict buttons record a decision, and **Export decisions**
writes them as TSV.

Under the prediction, each card's view carries a **Disagreements** track with
one box per differing junction, labelled with what moved, such as
`g13605.t1:donor-1048`: a donor 1,048 bp from any donor _CCDC116_ has. The track
reads `data/conflicts.bed`, plain BED6 that intersects with `bedtools`.

## Checking the merge against the raw data

The claim was that _IL17REL_ and _TTLL8_ are separate genes with a gap. Read it
out of GENCODE:

```bash
tabix https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  chr22:49,987,402-50,067,759 |
  awk -F'\t' '$3=="gene"' |
  grep -E 'IL17REL|TTLL8' |
  cut -f1,4,5,7
```

`IL17REL` ends at 50,012,765 and `TTLL8` starts at 50,018,575, both on the minus
strand:
5,809<!--m:tiberius-chr22-run.widest-gap-inside-a-merged-model-bp.count--> bp
apart, with the Tiberius model running straight through the gap. The same query
at _PI4KA_ returns two genes on opposite strands, so that one stays off the
list.

## See also

- [](/docs/agents_capture)
- [](/docs/config_guides/file_types)
- [](/docs/tutorials/rnaseq)

## References

- Gabriel L, Becker F, Hoff KJ, Stanke M. Tiberius: end-to-end deep learning
  with an HMM for gene prediction. _Bioinformatics_ 40(12) (2024).
  https://doi.org/10.1093/bioinformatics/btae685
- Frankish A, et al. GENCODE: reference annotation for the human and mouse
  genomes at single nucleotide resolution. _Nucleic Acids Research_ (2023).
  https://doi.org/10.1093/nar/gkac1071
