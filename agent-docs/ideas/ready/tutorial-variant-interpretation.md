---
name: tutorial-variant-interpretation
description: A variant-interpretation tutorial off the hosted hg38 hub (ClinVar, ClinGen, MANE, cCREs, dbVar, gnomAD v4.1) — every track already resolves, so the work is picking one uncontroversial variant readable off the tracks, with a benign or unconstrained negative control. Zero support demand, so judge it on the figure.
---

# Tutorial: variant interpretation

Split out of the tutorial-ideas audit on 2026-09-27, which listed it twice.

High value if the example is good, which is the hard part rather than the
JBrowse part. **Build it on the hub**, `jbrowse.org/ucsc/hg38/config.json`: it
carries ClinVar, ClinGen haplo/triplo and gene-disease, MANE, cCREs, dbVar's
curated SV sets and gnomAD v4.1. `config_demo.json` has most of the same, but
its gnomAD tracks (`missenseConstrained`, `pliByGene`, `gnomad_v2.1_sv.sites`)
are hg19 only, so the constraint half and the ClinVar half cannot sit in one
hg38 view off it. `tutorials/mappability_qc.md` is the worked example of a
hub-backed page, and `specs/ld.ts`, `specs/popgen.ts` and `specs/qc.ts` show
the spec form. Consequence-impact colouring already has specs
(`variants/consequence_impact_1000g`).

Pick one variant whose interpretation is uncontroversial and readable off the
tracks, with a negative control: a benign neighbour, or the same class of
variant in a constrained versus an unconstrained gene. The UniProt domain tracks
on the same hub (`hg38-unipDomain` and fourteen more) let a variant land in a
named domain, with a variant in an unannotated loop as its control.

Variant interpretation has zero support demand
([TUTORIAL_DEMAND.md](../../reference/TUTORIAL_DEMAND.md)), which makes it a
capability play rather than a support fix; AlphaGenome is what would make it
one. Judge it on whether the figure is compelling.
