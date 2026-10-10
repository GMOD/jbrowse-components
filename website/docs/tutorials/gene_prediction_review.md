---
title: Reviewing a gene prediction (Tiberius)
sidebar_label: Gene prediction review
description:
  Compare gene predictions with an existing annotation, sort the disagreements
  into four classes, and build a static review page that links each one back
  into JBrowse
guide_category: Tutorials
tutorial_category: Genes & annotation
---

We compare gene predictions from Tiberius, a deep-learning gene finder, on human
chr22 with the GENCODE annotation, and:

- sort the models that disagree into four classes
- build a static review page with one card per model, each linking back into
  JBrowse

The pipeline is
[cmdcolin/gene-review-portal](https://github.com/cmdcolin/gene-review-portal),
and its README documents every option.

## Prerequisites

- an existing annotation of the genome, to compare the predictions against
- to build a portal over your own genome: Node 23+, pnpm, htslib for `tabix`,
  and the JBrowse CLI

## Where the data comes from

Tiberius predictions over GRCh38
([Gabriel et al. 2024](https://doi.org/10.1093/bioinformatics/btae685)), read
against GENCODE 47 and the hg38 reference.

Nothing to download: the track configs and commands below read these files by
URL.

<details>
<summary>The files</summary>

- Tiberius gene predictions:
  https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz
- GENCODE 47 comprehensive annotation:
  https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz
- hg38 reference sequence:
  https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz

</details>

## A Tiberius model that merges IL17REL and TTLL8

We'll load the GRCh38 sequence the predictions were made on, then the two
annotations. Each annotation is a GFF3 that is bgzipped, sorted and
tabix-indexed with its `.tbi` beside it ([prep](/docs/quickstart_web)), and uses
the assembly's refNames.

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

```json addtrack loc=chr22:49,987,402-50,067,759
{
  "type": "FeatureTrack",
  "trackId": "tiberius",
  "name": "Tiberius predictions",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz"
  }
}
```

```json addtrack loc=chr22:49,987,402-50,067,759
{
  "type": "FeatureTrack",
  "trackId": "gencode_v47",
  "name": "GENCODE 47",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz"
  }
}
```

Open the two annotations together at `chr22:49,987,402-50,067,759`. Tiberius
draws one model, `g14001.t1`, across most of the window, where GENCODE has two
genes with a gap between them. GENCODE's gene features have `gene_name` and no
`Name`, so the track labels them by accession, `ENSG00000188263` for _IL17REL_
and `ENSG00000138892` for _TTLL8_.

<Figure src="/img/gene_prediction_merge.png" caption="One Tiberius model spans IL17REL (ENSG00000188263) and TTLL8 (ENSG00000138892), which GENCODE annotates as separate genes. MLC1 on the right gets a separate prediction." />

## Sorting Tiberius models into five classes against GENCODE

The portal compares each Tiberius model on chr22 with GENCODE and puts it in one
of five classes: Agrees and four classes of disagreement. Only the four
disagreement classes get a card.

| Class              | What it means                                                     | On chr22                                                   | What an annotator does   |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| Agrees             | shares splice junctions with a reference gene                     | 424<!--m:tiberius-chr22-classes.agrees.models-->           | nothing                  |
| Merged model       | one prediction covers two separate reference genes                | 1<!--m:tiberius-chr22-classes.merged-model.models-->       | split into two models    |
| Structure conflict | covers one gene but shares none of its splice junctions           | 3<!--m:tiberius-chr22-classes.structure-conflict.models--> | check the exon structure |
| Novel locus        | predicted where the reference annotates nothing                   | 12<!--m:tiberius-chr22-classes.novel-locus.models-->       | assess, then create      |
| Novel coding       | predicted coding where the reference has only non-coding features | 119<!--m:tiberius-chr22-classes.novel-coding.models-->     | assess coding potential  |

The portal applies these rules, and the _PI4KA_ control exercises them:

- **A shared junction** is an intron of one of the gene's transcripts.
- **Exons are compared** with genes on the same strand.
- **A merge** counts only when the genes it joins do not overlap each other.
  _PI4KA_ spans 152 kb on the minus strand with _SERPIND1_ inside one of its
  introns on the plus strand; Tiberius predicts _PI4KA_ correctly, and the
  portal leaves it off the list.
- **GENCODE readthrough genes** (one transcript spanning two neighbours) such as
  `CHKB-CPT1B` overlap the genes they join, so the portal skips them.

## Building the review portal with make-portal.mjs

Clone the pipeline and install it:

```bash
git clone https://github.com/cmdcolin/gene-review-portal
cd gene-review-portal
pnpm install
```

`make-portal.mjs` reads the two annotations, classifies every model, captures a
JBrowse view at each candidate and writes the page:

```bash
# --region: scan one chromosome, fetching the annotations with tabix
# --max: candidates kept per class
# --with-app: bundle JBrowse, so the output needs no network
node bin/make-portal.mjs \
  --prediction https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz \
  --reference https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  --fasta https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --assembly hg38 --region chr22 --max 3 \
  --with-app --out ./portal
```

The output directory holds the page, a JBrowse config, one PNG per candidate
and, with `--with-app`, a copy of JBrowse. Copy it to any web server to publish.

`--rnaseq reads.bam` adds an alignment track under every model, in the captures
and in the links; repeat it for more BAMs, and label each with `--rnaseq-name`.
Reads across the exons of a novel locus support it as a gene.

The [example portal](https://jbrowse.org/demos/tiberius_review/) is this build
with `--rnaseq` run on Human Brain Reference and Universal Human Reference BAMs
from the
[Griffith lab's RNA-seq course data](https://genomedata.org/rnaseq-tutorial/results/alignments/hisat/).

## Using the review page: cards, filters and verdicts

The [example portal](https://jbrowse.org/demos/tiberius_review/) covers chr22,
with one card per model:

- **Card** shows the class, the reference genes, the locus and a capture of the
  two annotations
- **Filter chips** narrow the list to one class
- **Verdict buttons** record what you decide
- **Open in JBrowse** opens the same view live

Verdicts stay in your browser, and **Export decisions** writes them out as TSV.
Building with `--apollo <url>` adds a second link to every card that opens the
same window in [Apollo](https://github.com/GMOD/Apollo3), the annotation editor,
and an `apollo_url` column to the exported TSV.

## The Disagreements track: junctions that differ from GENCODE

Every capture and live link has a **Disagreements** track under the prediction,
with one box per junction that differs from the reference, labelled with what
moved:

```text
g13605.t1:donor-1048
```

`g13605.t1` covers _CCDC116_ with two exons. Its acceptor matches GENCODE, and
its donor is 1,048 bp from any _CCDC116_ donor.

The track reads `data/conflicts.bed`, plain BED6 that `bedtools` also reads. The
file also lists junction edits in models filed as Agrees (a model sharing four
of its five junctions, say), which get no card.

```text
chr22  21636314  21636431  g13605.t1:donor-1048     0  +
chr22  23977067  23977386  g13682.t1:donor+3025     0  -
chr22  50012765  50018574  g14001.t1:split          0  -
```

## Checking the IL17REL and TTLL8 merge against GENCODE

Query GENCODE for the two genes the Tiberius model merges:

```bash
tabix https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  chr22:49,987,402-50,067,759 |
  awk -F'\t' '$3=="gene"' |
  grep -E 'IL17REL|TTLL8' |
  cut -f1,4,5,7
```

`IL17REL` ends at 50,012,765 and `TTLL8` starts at 50,018,575, both on the minus
strand, and the Tiberius model runs through the gap between them. The same query
at _PI4KA_ returns two genes on opposite strands.

## See also

- [](/docs/agents_capture)
- [](/docs/config_guides/file_types)
- [](/docs/tutorials/rnaseq)

## Citations

- Gabriel L, Becker F, Hoff KJ, Stanke M. Tiberius: end-to-end deep learning
  with an HMM for gene prediction. _Bioinformatics_ 40(12) (2024).
  https://doi.org/10.1093/bioinformatics/btae685
- Frankish A, et al. GENCODE: reference annotation for the human and mouse
  genomes at single nucleotide resolution. _Nucleic Acids Research_ (2023).
  https://doi.org/10.1093/nar/gkac1071
