---
name: derive-from-partial-spanners
description: "`sv_multihop.py derive` requires a read that touches every locus of a chain, so a chain longer than one read cannot be built at all — chromoplexy chains are exactly that shape, and the picker's `part of` relation already models the overlapping partial routes an assembly from them would stitch; parked until a real chain that no read spans is in hand to measure against."
---

# Derive from partial spanners

Filed 2026-09-02 out of the review of the derivative-allele feature, which
listed it as the fourth-largest payoff after in-app bases, the in-CIGAR
deletion study and the tool handoff.

## The gap

`derive` keeps a read only when `touches_all` says every `--loci` entry falls
inside one of its aligned segments. That is the right rule for the COLO829
der(3): the four-segment allele is ~40 kb and 29 ONT reads cross the whole
thing. It is the wrong rule for a chain whose segments sum past a read length.
A chromoplexy chain through six chromosomes has no spanning read, so `derive`
exits with "no read spans every locus" and there is nothing to lower or widen.

## What the picker already knows

`computeDerivativePaths` groups reads by the junction pairs they carry and
relates a route to a longer one it is a prefix, suffix or interior of (the
`part of` relation the dialog renders). So the overlap structure an assembler
would need — which partial routes share which junctions, in which order — is
computed in-app today, and `Copy derive command` could emit it.

## The shape of a fix, and why it is not built

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
