---
name: complex-sv-tutorials-from-published-results
description: Two public complex-SV datasets to build tutorials on now that JBrowse infers no alleles (ADR-137) — a MECP2 DUP-TRP/INV-DUP with ONT reads, arrays and a published structure, and a 1KGP GATK-SV complex record carrying the caller's own interpretation. Each teaches reading the evidence against a structure someone else resolved, which is the shape the removed picker could not take.
---

# Complex-SV tutorials from published results

[ADR-137](../../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)
moved complex-SV interpretation out of the app, so the teaching moves into
tutorials that reproduce a published structure and show the workflow that
resolved it. Both datasets below were found while measuring the picker, and
both are public. Either is a tutorial on its own; neither is started.

## MECP2 DUP-TRP/INV-DUP

Grochowski et al. 2024, *Cell Genomics*. Targeted ONT at SRA PRJNA953021 (31
runs; BAB14547 = SRR24098759, BAB14604 = SRR24098758) and Agilent arrays at GEO
GSE250451, hg19. Local copies under `/home/cdiesh/sv_scratch/mecp2/`.

The reads resolve the head-to-head junction joining the DUP start to the TRP
start — BAB14604 at hg19 153,188,684 ↔ 153,499,733 on 11 reads, BAB14547 at
153,131,085 ↔ 153,520,843 on 6 — and the tail-to-tail junction sits inside the
K1/K2 repeats, where no read resolves it. Copy number plus both junctions still
allow two walks, and the paper separates its conformers with optical maps.

**That is why it is the right tutorial.** The structure comes from the paper,
the array gives the copy number, the reads give one junction and visibly fail
at the other, and JBrowse shows all three against each other. The picker drew
278 kb of this locus as "not in derivative" where the array shows two copies.

## 1KGP `HGSV_2721`

A GATK-SV `<CPX>` record with `CPX_TYPE=INVdup` and
`CPX_INTERVALS=INV_chr1:39658980-39660275,DUP_chr1:39660047-39660275` — the
caller's own interpretation, in the callset, next to the reads it was called
from. Laid out it is the route `A C′ B′ C D`, and its two junctions are the LL
and RR pairs the `sv_multisamples` tutorial's SV-channels figure already shows.

Smaller than the MECP2 case and needs no offline tool, so it is the cheaper
first cut: read the caller's structure off the record, then check each junction
against the reads. It is also the concrete consumer for
[route-as-a-launch-input](route-as-a-launch-input.md), which would draw the
record's own layout rather than asking the reader to hold it in their head.

## Before starting either

The SV tutorial corpus is already crowded — `cancer_sv`,
`sv_visualization_cgiab`, `sv_callset_review`, `sv_multisamples`. Decide with
Colin whether a new page is right or whether the MECP2 case belongs as a
section inside an existing one.
