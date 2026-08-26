---
name: annotation-review-without-a-reference
description: On the reference genome, a gene prediction disagreeing with GENCODE is nearly always the predictor being wrong — 3 real structure conflicts in 559 models on chr22. The review only becomes interesting on sequence the reference does not describe, and there the sort key has to be evidence (MAKER's AED, or per-junction read support) rather than a reference annotation that no longer applies.
---

# Reviewing an annotation with no reference to review it against

`demo/tiberius-portal` sorts predicted gene models by how they disagree with a
reference annotation. That works, and it has a ceiling:

<!-- BEGIN GENERATED MEASUREMENT tiberius-chr22-classes -->

| Class              | What it means                                                       | On chr22 | What an annotator does  |
| ------------------ | ------------------------------------------------------------------- | -------: | ----------------------- |
| Agrees             | Shares splice junctions with a reference gene                       |      424 | nothing                 |
| Merged model       | One prediction covers two separate reference genes                  |        1 | split into two models   |
| Structure conflict | Covers one reference gene but shares none of its splice junctions   |        3 | check exon structure    |
| Novel locus        | Predicted where the reference annotates nothing at all              |       12 | assess, then create     |
| Novel coding       | Predicted coding where the reference has only non-coding annotation |      119 | assess coding potential |

<!-- END GENERATED MEASUREMENT tiberius-chr22-classes -->

Three models out of 559 disagree at every junction. The signal is thin because
the predictor and the reference are describing the same sequence, and the
predictor is good.

<!-- BEGIN GENERATED MEASUREMENT tiberius-chr22-run -->

| What the run reports                     | chr22 |
| ---------------------------------------- | ----: |
| Models predicted                         |   559 |
| Flagged for review                       |   135 |
| Records in conflicts.bed                 |   229 |
| Agreeing models carrying a junction edit |    64 |
| Widest gap inside a merged model, bp     | 5,809 |

<!-- END GENERATED MEASUREMENT tiberius-chr22-run -->

The interesting version is annotation of sequence the reference does not
describe: a de novo assembly, a non-reference haplotype, a tumour, another
strain. There the disagreement is the point rather than an error report — and
the reference annotation, which is the portal's whole sort key, is no longer in
the same coordinate space.

## Sorting by evidence rather than by reference

Colin's suggestion, and it is the right shape: MAKER computes **annotation edit
distance** (AED) between a model and the evidence supporting it, writes `_AED`,
`_eAED` and `_QI` onto every mRNA in its GFF, and that number is reference-free
by construction. Sort the queue by AED and the portal needs no GENCODE at all.

Two things to be careful of before building on it.

**AED is free only from MAKER.** Tiberius, AUGUSTUS, BRAKER and Helixer do not
emit it. Computing AED for one of those means having the evidence alignments in
the prediction's coordinate space, which means the portal grows an alignment
step. Reading an attribute is a one-line win; computing the attribute is a
project.

**AED scores a whole model, and the edit is a junction.** It also runs low
wherever evidence is dense and high wherever it is sparse, so a queue sorted by
AED leads with lowly-expressed genes rather than wrong ones. It is a good triage
sort and a poor correctness verdict.

## The cheaper thing at the resolution the review needs

The portal already takes `--rnaseq` BAMs, and `lib/classify.mjs` already
computes every predicted junction. `samtools view` over a locus plus the `N`
operations in each CIGAR gives, per junction, the number of spliced reads
crossing it. That is AED's good property — evidence-based, reference-free — at
the resolution an annotator edits at, using data the demo already ships, with no
alignment step and no MAKER.

A predicted junction with zero spliced reads in a tissue that expresses the gene
is a sharper finding than any whole-model score, and it slots straight into what
the conflict machinery already emits: the record in `conflicts.bed` and the read
count are the same object.

The check that keeps it honest is the same one the reference comparison needed.
Read depth over the candidate windows spans three orders of magnitude, and the
bottom of it is not weak evidence against a model — `g13682.t1` sits on `DDT`
and `g13605.t1` on the testis-specific `CCDC116`, neither of which either
tissue expresses:

<!-- BEGIN GENERATED MEASUREMENT tiberius-chr22-evidence -->

| Model     | Reference genes                | RNA-seq · brain (HBR) | RNA-seq · universal reference (UHR) |
| --------- | ------------------------------ | --------------------: | ----------------------------------: |
| g14001.t1 | IL17REL + TTLL8                |                 1,350 |                                 178 |
| g13516.t1 | MICAL3                         |                 2,936 |                               1,429 |
| g13682.t1 | DDT + GSTT3P + ENSG00000250470 |                     2 |                                  17 |
| g13494.t1 | —                              |                     4 |                                   9 |
| g13472.t1 | —                              |                     2 |                                   0 |
| g13566.t1 | ENSG00000290950 + USP41P       |                   120 |                                 306 |
| g13664.t1 | FAM230I + ENSG00000287864      |                    12 |                                 165 |

<!-- END GENERATED MEASUREMENT tiberius-chr22-evidence -->

So the score has to carry the depth it was measured at.

## Running several predictors

Agreement between predictors localises the hard loci, and the cell worth
surfacing is **tools agree with each other and disagree with the reference** —
that is the case where the reference is the thing to doubt. Weigh it knowing
that Tiberius and AUGUSTUS share a lineage and much of their training data, so
their agreeing is not two independent lines of evidence; Helixer is the
genuinely different one.

## The trap in the mutated case

For a non-reference assembly the obvious move is to project the reference
annotation across (Liftoff, CAT) and then run the existing comparison. The
projection is lossy **exactly where the sequence differs**, which is exactly
where you wanted to look, so a diff across it reports the projection's failures
as the sample's biology.

The way around it is not to diff the two annotations at all: score each
annotation against its own sample's evidence, and compare the two scores. A gene
whose junction support collapses in the sample and holds in the reference is the
finding, and no projection was involved in producing it.

Every figure above comes from `agent-docs/measurements/tiberius-chr22-*.json`,
which `make-portal.mjs --measurement` writes from the run itself. Nothing here
is typed in, which is the point: the first version of this doc would have said
21 structure conflicts.

Related: `reference/REJECTED_IDEAS.md` for what has been tried and declined,
`demo/tiberius-portal/README.md` for what the comparison does today.
