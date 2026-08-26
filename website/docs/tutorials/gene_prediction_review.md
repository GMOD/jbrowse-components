---
title: Reviewing a gene prediction (Tiberius)
sidebar_label: Gene prediction review
description:
  Sort the models a gene finder disagrees with an existing annotation about into
  four kinds, and build a static review page that links each one back into
  JBrowse
guide_category: Tutorials
tutorial_category: Genes & annotation
data: hosted
---

**TL;DR:** a gene finder hands back tens of thousands of models and no way to
tell which ones are wrong. Comparing them against an annotation that already
exists sorts the disagreements into four kinds, and only those need a person.
Tiberius is the predictor here and GENCODE the reference, both hosted for hg38,
and the page ends with a review portal you can open.

## Prerequisites

- nothing to install to read along: the
  [example portal](https://jbrowse.org/demos/tiberius_review/) is a link, and so
  is every view inside it
- to build one over your own genome: Node 23+, htslib for `tabix`, and the
  JBrowse CLI

## Where the data comes from

Tiberius predictions over GRCh38
([Gabriel et al. 2024](https://doi.org/10.1093/bioinformatics/btae685)), read
against GENCODE 47 and the hg38 reference.

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

<Figure src="/img/gene_prediction_merge.png" caption="One Tiberius model spans IL17REL (ENSG00000188263) and TTLL8 (ENSG00000138892), which GENCODE annotates as separate genes. MLC1 on the right gets its own prediction." />

The third gene on the right, _MLC1_, is the control sitting in the same frame:
Tiberius gives it a model of its own, so whatever went wrong to the left is not
a property of the locus.

That is a merged model: the predictor ran two neighbouring genes together into
one. An annotator fixes it by splitting the model in two, which is an edit, not
a viewing decision. What the browser can do is find every locus that needs one.

## Sorting the models

Tiberius predicts 559 models on chr22. Most of them share splice junctions with
a GENCODE gene and need no attention; the rest disagree in one of four ways, and
only those reach the portal.

A junction is shared with a gene when it is an intron of one of that gene's
transcripts. Reading the gene's exons as one list instead — cheaper, and wrong —
manufactures junctions no transcript has, which is worth stating because it is
what the first version of this comparison did. Against RANBP1's 13 isoforms it
matched none of Tiberius's five correct junctions, and 18 of the 21 structure
conflicts it reported were that arithmetic rather than the prediction.

| Class              | What it means                                                     | On chr22 | What an annotator does   |
| ------------------ | ----------------------------------------------------------------- | -------- | ------------------------ |
| Agrees             | shares splice junctions with a reference gene                     | 424      | nothing                  |
| Merged model       | one prediction covers two separate reference genes                | 1        | split into two models    |
| Structure conflict | covers one gene but shares none of its splice junctions           | 3        | check the exon structure |
| Novel locus        | predicted where the reference annotates nothing                   | 12       | assess, then create      |
| Novel coding       | predicted coding where the reference has only non-coding features | 119      | assess coding potential  |

Two rules keep merged models down to one entry. The comparison runs at exon
level against genes on the same strand, and a fusion counts only when the genes
it joins do not overlap each other.

_PI4KA_ is the control for both. It spans 152 kb on the minus strand of chr22,
and _SERPIND1_ sits inside one of its introns on the plus strand, so the two
genes share every base of _PI4KA_'s span and not one exon. Tiberius predicts
_PI4KA_ correctly, and the model stays off the list: overlapping genes are a
fact about GENCODE rather than a mistake by the predictor. Reading exons rather
than spans is what stops the card naming _SERPIND1_ alongside it. A readthrough
gene such as `CHKB-CPT1B` is excluded for the same reason, being GENCODE's own
fused model.

## Building the portal

One command reads the two annotations, classifies every model, captures a
JBrowse view at each candidate and writes the page:

```bash
# --region keeps the scan to one chromosome, so the remote annotations are
# fetched by tabix rather than downloaded whole
# --with-app bundles JBrowse itself, so the output directory needs no network.
# `jbrowse create` installs the latest RELEASE; --app-branch main bundles the
# development build instead, which is what a portal showing unreleased work needs
# --max caps how many candidates of each class are kept
node demo/tiberius-portal/bin/make-portal.mjs \
  --prediction https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz \
  --reference https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  --fasta https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --assembly hg38 --region chr22 --max 3 \
  --with-app --out ./portal
```

Everything it writes is a file: the page, a JBrowse config naming the data, one
PNG per candidate, and with `--with-app` a copy of JBrowse. Copying the
directory to a web server is the whole deployment.

Adding `--rnaseq reads.bam` puts an alignment track under every model, in the
captures and in the links both, which is what settles a novel locus that no
reference gene supports: exons with reads across them are a candidate gene, and
exons without them are a candidate false positive. Repeat the flag for more than
one, and name each with `--rnaseq-name` — two unlabelled tracks are "RNA-seq 1"
and "RNA-seq 2", which says nothing about which tissue is which.

The example portal carries two, both from the
[Griffith lab's RNA-seq course data](https://genomedata.org/rnaseq-tutorial/results/alignments/hisat/):
Human Brain Reference and Universal Human Reference, a pool of ten cell lines.
Two, because coverage splits both ways — the merged `IL17REL`/`TTLL8` model has
1,350 brain reads against 178 UHR, and `g13664.t1`, predicted coding over the
lncRNA `FAM230I`, has 165 UHR against 12 brain. A model with reads in neither is
the one worth doubting.

Tiberius has an evidence mode of its own — Nextflow, taking proteins, RNA-Seq
and Iso-Seq — that folds evidence into the prediction. The released human
annotation read here was made with default weights instead, so these tracks are
evidence the reviewer judges the call against rather than an input the call was
made from.

## Reading it

The [example portal](https://jbrowse.org/demos/tiberius_review/) covers chr22.
Each card carries the class, the reference genes involved, the locus, and a
picture of the two annotations at that locus. The filter chips narrow to one
class, and the verdict buttons record what you decided.

**Open in JBrowse** on any card opens that same view live, at the same locus
with the same tracks, so a card that needs more than a picture is one click from
the real thing. Verdicts stay in your browser, and **Export decisions** writes
them out as TSV to carry back to whatever produced the models.

The triage ends there, because the fix does not belong in a viewer: splitting a
merged model is an edit. Building with `--apollo <url>` gives every card a
second link that opens the same window in
[Apollo](https://github.com/GMOD/Apollo3), the annotation editor, and adds an
`apollo_url` column to the exported TSV — so a triaged queue hands over as a
spreadsheet of links.

## Which junction is the one in dispute

A picture of a structure conflict is a plausible-looking model drawn over a
stack of reference isoforms, and nothing in it says where the two disagree. So
the classifier writes down where it looked. Every capture and every live link
carries a **Disagreements** track directly under the prediction, one short box
per junction that differs, labelled with what moved:

```
g13605.t1:donor-1048
```

`g13605.t1` covers _CCDC116_ with two exons. Its acceptor is GENCODE's; its
donor sits 1,048 bp away from any donor _CCDC116_ has. That is the sentence the
box makes readable at a glance, and the card repeats it in words.

The track reads `data/conflicts.bed`, which the portal writes alongside the
captures — plain BED6, so it opens in any browser and intersects with `bedtools`
without going through the page at all:

```
chr22  21636314  21636431  g13605.t1:donor-1048     0  +
chr22  23977067  23977386  g13682.t1:acceptor+3025  0  -
chr22  50012765  50018574  g14001.t1:split          0  -
```

**The BED reaches further than the page does.** Cards exist only for the four
flagged classes, so a model that shares four junctions out of five is filed as
`agrees` and never gets one — while the fifth is still a real splice-site edit.
On chr22 that is 64 models the page cannot show and the file lists.

## Checking the merge against the raw data

The claim was that _IL17REL_ and _TTLL8_ are separate genes with a gap. Read it
out of GENCODE rather than off the picture:

```bash
tabix https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  chr22:49,987,402-50,067,759 |
  awk -F'\t' '$3=="gene"' |
  grep -E 'IL17REL|TTLL8' |
  cut -f1,4,5,7
```

`IL17REL` ends at 50,012,765 and `TTLL8` starts at 50,018,575, both on the minus
strand: 5,809 bp apart, with the Tiberius model running straight through the
gap. The same query at _PI4KA_ returns two genes on opposite strands, which is
why that one is not on the list.

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
