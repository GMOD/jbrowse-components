---
name: launch-menu-rename-and-reconstruction-limits
description: Two proposals left over from the derivative-allele guidelines, neither started — one small enough to write today, one that needs a measurement before it can be judged at all.
---

# Left over from the reconstruction guidelines

Landed already: the track-menu twins for the three rubberband-only entries
(consensus, MAF subsequences/species launches, Get sequence), the
`Launch view` → `Launch` rename across code, docs, specs and tours, the user
guide's *What the reconstruction needs* / *Judging what it lists* sections plus
the tutorial's pointer at them, and the recapture the rename left behind — 20
figures and 5 tours, against the 6 and 3 this file used to list.

## 1. Say why the candidate list is empty on a short-read track

Small, clear, nobody started it. The dialog's empty state currently offers
"navigate to a breakpoint, and widen the window if the reads are long", which
sends someone with a 150 bp library looking for an event their data cannot
express — the first line of the guide's new *What the reconstruction needs*.

The loaded feature arrays carry per-read spans, so a median aligned length under
about a kilobase can say so in the dialog instead. Keep it to the empty state:
the ranked list already prints segment sizes, and a second warning over a list
that has rows is noise.

## 2. Chain in-read deletions, not only SA segments — MEASURE FIRST

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
  reader came for, and rank-1-or-2 is what the guide now tells people to trust.

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
