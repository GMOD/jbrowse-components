---
name: derivative-allele-reconstruction-gaps
description: Two junction classes the derivative-allele reconstruction cannot reach, both blocked on a number nobody has taken — an event the aligner wrote as a CIGAR deletion inside one read rather than as an SA hop (50 of the 58 misses), and a chain whose segments sum past a read length, which is the shape a chromoplexy chain has. The third gap, a contig's blocks outside the displayed regions, is in derivative-allele-from-assembly-contigs.md.
---

# What the derivative-allele reconstruction cannot reach

The picker groups split reads by the path their segments describe
([mechanisms/derivative-allele-candidates](../mechanisms/derivative-allele-candidates.md)),
and [reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md) is the study behind
both gaps below. Neither is blocked on a design: each has a stated fix and a
measurement that has to come first, and the measurements are different ones.

The third gap in the same feature — a contig's chain reaching only the blocks in
the displayed regions, until PIF is indexed by query name — is
[derivative-allele-from-assembly-contigs.md](derivative-allele-from-assembly-contigs.md),
kept separate because most of that file is what shipped rather than what is
missing.

## Chain in-read deletions, not only SA segments

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

If the numbers say no, this becomes a
Rejected ADR with them, which is worth as
much as shipping it.

## Derive from partial spanners

Filed 2026-09-02 out of the review of the derivative-allele feature, which
listed it as the fourth-largest payoff after in-app bases, the in-CIGAR
deletion study and the tool handoff.

### The gap

`derive` keeps a read only when `touches_all` says every `--loci` entry falls
inside one of its aligned segments. That is the right rule for the COLO829
der(3): the four-segment allele is ~40 kb and 29 ONT reads cross the whole
thing. It is the wrong rule for a chain whose segments sum past a read length.
A chromoplexy chain through six chromosomes has no spanning read, so `derive`
exits with "no read spans every locus" and there is nothing to lower or widen.

### What the picker already knows

`computeDerivativePaths` groups reads by the junction pairs they carry and
relates a route to a longer one it is a prefix, suffix or interior of (the
`part of` relation the dialog renders). So the overlap structure an assembler
would need — which partial routes share which junctions, in which order — is
computed in-app today, and `Copy derive command` could emit it.

### The shape of a fix, and why it is not built

Take reads spanning each *adjacent pair* of loci, polish one consensus per
junction, then join consecutive consensuses on their shared segment. That is a
small overlap-layout-consensus assembler, and the join step is where it stops
being a script: two junction consensuses disagree on the shared segment's
length whenever depth was thin on one of them, and picking one is a call this
tool has no evidence to make. `hifiasm`/`Shasta` on the pulled reads is the
honest version, and that is an external tool with a pinned toolchain — see
`reference/SV_MULTIHOP.md` §"Should sv_multihop become its own repo".

**Trigger:** a real chain in a hosted dataset that no single read spans, so the
join failure mode can be measured rather than guessed.
