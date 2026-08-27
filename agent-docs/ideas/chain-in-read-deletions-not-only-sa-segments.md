---
name: chain-in-read-deletions-not-only-sa-segments
description: 50 of the 58 junctions the derivative-allele reconstruction misses are events the aligner wrote as a CIGAR deletion inside one read rather than as an SA hop, and `computeDerivativePaths` could group those the same way with no other change — but the `minReads = 2` floor stops protecting the list the moment a germline indel clears it, so the routes-per-control-locus number decides this and nobody has taken it.
---

# Chain in-read deletions, not only SA segments

Moved out of `handoffs/launch-menu-rename-and-reconstruction-limits.md` on
2026-08-27, where it had sat unstarted. The reasoning is complete and the
measurement that would justify it is not, which is the whole of why this is
parked rather than built.

The study in [SV_MULTIHOP.md](../reference/SV_MULTIHOP.md) says the sub-10 kb
cliff is a representation, not the grouping: 50 of the 58 missed junctions are
events the aligner wrote as a CIGAR deletion inside one read. Treating a
deletion above some size as a junction would let `computeDerivativePaths` group
them exactly as it groups SA hops, with no other change to the mechanism.

**Do not ship it on the reasoning alone.** Two things could go wrong and only a
run can say whether they do:

- **Routes at ordinary loci.** `minReads = 2` holds control-locus routes to 0.30
  and 0.37 per window today. Two reads sharing a 200 bp germline indel clear
  that floor trivially, so the floor stops protecting the list.
- **Rank.** A high-support germline indel can outrank the somatic route the
  reader came for, and rank-1-or-2 is what the user guide tells people to trust.

`scripts/derivative_path_study.ts` answers both — `fetch <dataset>` then
`score <dataset>`, recall AND routes-per-control-locus, with the in-CIGAR arm as
a second scoring mode. The corpus is gitignored and **not on this machine**, so
budget the refetch (215 loci of remote range queries against a CRAM and a 116x
BAM; COLO829 also needs the local files under `/home/cdiesh/fusion_demo_build`).
Use D ops only — an N op is a splice, and every RNA-seq read would become a
route.

If the numbers say no, this belongs in
[REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) with them, which is worth as
much as shipping it.
