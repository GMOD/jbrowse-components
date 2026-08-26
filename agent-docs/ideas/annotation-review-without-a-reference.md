---
name: annotation-review-without-a-reference
description: On the reference genome, a gene prediction disagreeing with GENCODE is nearly always the predictor being wrong — 3 real structure conflicts in 559 models on chr22. The review only becomes interesting on sequence the reference does not describe, and there the sort key has to be evidence (MAKER's AED, or per-junction read support) rather than a reference annotation that no longer applies.
---

# Reviewing an annotation with no reference to review it against

`demo/tiberius-portal` sorts predicted gene models by how they disagree with a
reference annotation. That works, and it has a ceiling: on GRCh38 chr22,
Tiberius produces 559 models, 424 of which share junctions with a GENCODE gene,
and exactly **3** disagree at every junction. One merged model. Twelve novel
loci. The signal is thin because the predictor and the reference are describing
the same sequence, and the predictor is good.

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

The check that keeps it honest is the same one the reference comparison needed:
CCDC116, the one clean structure conflict left on chr22, has almost no reads in
either HBR or UHR because it is testis-specific. Absence of support is not
evidence against a model unless the locus is expressed at all, so the score has
to carry the depth it was measured at.

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

Related: `reference/REJECTED_IDEAS.md` for what has been tried and declined,
`demo/tiberius-portal/README.md` for what the comparison does today.
