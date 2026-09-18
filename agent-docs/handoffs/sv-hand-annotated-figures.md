---
name: sv-hand-annotated-figures
description: Live plan (2026-09-18) for REMOVING the in-app "Reconstruct derivative allele" workflow — Colin decided it reports inaccurate results (read-edge copy claims, routes at 28–40% of ordinary ONT loci, no mapping quality) — and moving complex-SV interpretation into tutorials built on offline tools and published results, with JBrowse as the viewer. Holds the removal checklist, what stays, and the MECP2 DUP-TRP/INV-DUP tutorial data found on the way.
---

# Removing in-app derivative-allele reconstruction

**Decision (Colin, 2026-09-18): delete it.** "It is not good to report
inaccurate results via in-app workflows, particularly if a new workflow could
generate better results or an AI agent could automate JBrowse to generate
figures with improved outcomes." Not rescued into a jb2plugins plugin: the
problem is inferring an allele from the reads in view, not where the code
lives. Interpretation belongs in tutorials that show published or offline
workflows; JBrowse views the result. **Delete this file when the removal and
its ADR land and the tutorial idea is filed.**

## Why, with the numbers

- Routes appear at 28–40% of ordinary loci on ONT (matched normal and random
  loci), and read count alone does not separate them
  ([reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md), batch study). Each
  was offered as a "derivative allele" on its own synthetic axis.
- The saved segment map cut the reference at read edges, so its copy counts
  moved with read length: the shipped cancer_sv figure's "B ×2, 6.43 kb" is
  the longest returning read. On MECP2 patient BAB14604 it printed 278 kb as
  "not in derivative" where the patient's array shows two copies.
- Routes carry no mapping quality: two MAPQ 0–7 reads in segmental
  duplication came out as a confident route.
- It cannot reach the hard cases at all: no read spans a Carvalho-type
  event, and the repeat-mediated junction is unresolvable by reads.
- What it did well — junctions over 10 kb, rank 1–2, within 100 bp — the arc
  band, the split view and `sv_multihop.py` already show.

## Removal (branch `worktree-delete-derivative-reconstruction`)

- Code: `plugins/alignments/src/features/derivativePaths/`, the display
  getters that fed it (`derivativePathCandidates`, `derivativePathEvidence`,
  `hasReadsForDerivativePaths`, and `medianReadSpanBp` if nothing else reads
  it), `plugins/linear-comparative-view/src/LinearDerivativeVsRef/` and its
  menu registration, the synteny display's `derivativePathEvidence`,
  `scripts/derivative_path_study.ts`, `website/scripts/gen-segment-maps.ts`.
- Docs: `user_guides/derivative_allele.md`; the in-browser sections of
  `tutorials/cancer_sv.md` and `tutorials/sv_visualization_cgiab.md` (the
  offline `derive` section of cancer_sv stays); mentions in
  `user_guides/sv_visualization.md` and `sv_callset_review.md`; the figures,
  video and specs those sections used.
- Agent docs: `mechanisms/derivative-allele-candidates.md`, the two
  `ideas/derivative-allele-*.md`; update `ideas/route-as-a-launch-input.md`
  (its builders go with the picker — restorable from git), SV_MULTIHOP.md's
  in-app sections, plugin CLAUDE.md notes that name the picker as an SA
  consumer.
- An ADR recording the decision and the numbers above, so it is not
  relitigated.
- Stays: read arcs, SV channels, read cloud, chain layout, split view,
  single-read "Linear read vs ref", the breakend walk, the synteny display's
  contig-name and query-offset behaviour (reachable from config).

## Superseded

The prototype on branch `worktree-sv-hand-annotated-figures` (junction-cut
lettering, a Carvalho-style figure driven by reads in view) is abandoned with
the feature. Its figure renderer is worth mining only for a tutorial script
that draws a published result from offline inputs. Comparison artifact:
https://claude.ai/artifact/Q4frHrLXSDuZAFnToXFPKj

## For the tutorial idea (file into ideas/ when this closes)

- **MECP2 DUP-TRP/INV-DUP, public data**: ONT at SRA PRJNA953021 (targeted,
  31 runs; BAB14547 = SRR24098759, BAB14604 = SRR24098758) and arrays at GEO
  GSE250451 (Agilent, hg19), from Grochowski et al. 2024, Cell Genomics. The
  reads resolve the head-to-head junction joining the DUP start to the TRP
  start (BAB14604 hg19 153,188,684 ↔ 153,499,733, 11 reads; BAB14547
  153,131,085 ↔ 153,520,843, 6 reads); the tail-to-tail junction sits in the
  K1/K2 repeats. Copy number plus both junctions still allow two walks; the
  paper resolves its conformers with optical maps, so the tutorial takes the
  structure from the paper. Local copies: `/home/cdiesh/sv_scratch/mecp2/`.
- **1KGP `HGSV_2721`**, GATK-SV `CPX_TYPE=INVdup` with `CPX_INTERVALS`: a
  caller's own interpretation, which a tutorial can show against the reads.
