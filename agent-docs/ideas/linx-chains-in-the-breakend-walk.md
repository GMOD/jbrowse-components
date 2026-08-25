---
name: linx-chains-in-the-breakend-walk
description: What the GRIDSS/Esvee/LINX/PURPLE stack already knows about which breakends share a derivative chromosome, and how the breakpoint split view's chain walk could take it — LINX's links.tsv as a ready-made chain, junction copy number as the tiebreak the walk refuses to invent, and what the walk now reads from an assembly id.
---

# LINX chains in the breakend walk

`walkBreakendChain` (`packages/sv-core`) follows co-located breakends outward
from a clicked record and refuses to choose when two junctions leave one locus:
"picking the closer or the better-supported one would be this code inventing an
answer the caller declined to give". The Hartwig stack is a caller that does not
decline. Checked against the tools' own READMEs on 2026-08-25:

- **GRIDSS2** writes `BEID` — the ids of the breakend assembly contigs
  supporting a breakpoint — and "variants containing the same BEID are phased
  cis"; a contig spanning several breakpoints also lists them under an `asm`
  prefix in `LOCAL_LINKED_BY` / `REMOTE_LINKED_BY`
  ([Cameron et al. 2021](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-021-02423-x)).
- **Esvee**, GRIDSS's successor in hmftools, writes `ASMID` ("unique id(s) of
  assembly(s) containing the breakend") and `ASMLNKS` ("breakend id of
  breakends linked by assembly"), and for an assembly with 2+ alignments emits
  one junction per consecutive pair
  ([esvee README](https://github.com/hartwigmedical/hmftools/blob/master/esvee/README.md)).
- **LINX** chains breakends into derivative chromosomes, assembled links first,
  then inferred ones under copy-number constraints ("chains should not pass
  through a region with lower available allele copy number than the JCN of the
  chain"), and writes the result to `*.linx.links.tsv`: `clusterId, chainId,
  chainIndex, chainCount, lowerBreakendId, upperBreakendId,
  lowerBreakendIsStart, upperBreakendIsStart, chromosome, arm, assembled,
  traversedSVCount, length, junctionCopyNumber, junctionCopyNumberUncertainty,
  pseudogeneInfo, ecDna` — "the predicted chain can be reconstructed by
  traversing each linked segment in order"
  ([linx README](https://github.com/hartwigmedical/hmftools/blob/master/linx/README.md)).
  Its ambiguity ranking, in order: allele copy number support, highest-JCN
  foldback or complex duplication, breakends with a single feasible link,
  matching JCN, adjacency, higher JCN, shortest link.
- **PURPLE** supplies the copy number LINX's JCN rests on.

## What shipped

`junctionFromFeature` reads `BEID` and `ASMID` into `Junction.assemblyIds`, and
`nextJunctionFrom` uses them for exactly one thing: when more than one open
destination leaves a stop, the continuation that shares an assembly id with the
junction the walk arrived by is taken, because the caller assembled one contig
across both. With no shared id, or one, the walk is unchanged. No real GRIDSS or
Esvee callset is in the tree, so the field shapes come from the READMEs and the
test is synthetic; the first such VCF to reach a demo should be run through the
walk before the behaviour is described in a tutorial.

## What is parked

1. **`links.tsv` as a chain source.** `navToMultiLevelBreak` already takes a
   caller-supplied `stops`, written for "a spreadsheet row set". A LINX links
   file is that row set: group by `chainId`, order by `chainIndex`, and each
   segment's two breakend ids resolve to positions through the SV VCF (or the
   `*.linx.vis_sv_data.tsv` that carries them directly). "Open LINX chain" from
   a record then shows LINX's derivative chromosome, not the walk's
   reconstruction of it, and the two can be put side by side the way the
   tutorial already puts the reads beside the contig. This is the cheapest
   item and the one with the clearest reader.
2. **Junction copy number as a tiebreak.** LINX's first two ranking rules need
   PURPLE; the cancer_sv demo carries a DepMap copy-number bedGraph, which is
   coarser but the same quantity. A walk that read a CN track would be taking
   on LINX's inference, and the reason not to is the one `nextJunctionFrom`
   states: a wrong hop draws a confident panel. If it is ever done, it belongs
   as a reported reason ("chosen by copy number") on the stop, never a silent
   choice.
3. **`ASMLNKS` / `LOCAL_LINKED_BY`.** These name the linked breakend directly
   rather than the contig, so they pin a hop without the tolerance search at
   all. Worth adding when a callset carrying them is in hand; the `assemblyIds`
   path covers the same evidence one step removed.

The read- and assembly-based reconstruction this complements is
[derivative-allele-from-assembly-contigs](derivative-allele-from-assembly-contigs.md).
