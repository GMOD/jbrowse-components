---
name: synteny-snps-from-sequence-at-base-zoom
description: Draw mismatches on a synteny ribbon at base zoom the way the alignments track does — fetch both assemblies' sequence for the visible window and compare through the fine CIGAR at render time — instead of storing cs bases in the PIF. The owner's steer; the worker-side plumbing it needs is listed, and the fold never needs it.
---

# SNPs on the synteny ribbon from sequence, at base zoom

Filed 2026-09-02 out of the PIF coarse-tier handoff. The format is frozen
(ADR-104) with no per-base data in it, on purpose: the steer is the BAM/CRAM
model, where mismatches are computed from the reference at render time, not
the `cs`-tag model, where they are stored.

## The shape

Fine tier only. At a zoom where bases are drawable, the display asks the
worker for both assemblies' sequence over the small visible window and walks
each alignment's fine CIGAR across it, emitting a mismatch mark where the two
bases differ. The fold (`cr:Z:`) never needs bases; a coarse row draws no
SNPs and says nothing about them.

What the worker needs handed to it, because it has no assembly manager
(the "resolve before the RPC" rule in `CLAUDE.md`):

- the mate assembly's sequence adapter config and its refName alias map, so
  the mate range can be fetched and canonicalized worker-side;
- mate ranges batched per refName rather than one fetch per alignment.

Per-alignment walk:

- plus strand walks query and target together through the CIGAR;
- minus strand walks the mate from `mateEnd` downward against the
  complement;
- with `--eqx` or a `cs` tag the `=`/`X` positions are already in the fine
  CIGAR, so sequence only supplies the base colour and the walk is over `X`
  runs;
- an M-only `cg` needs a full base compare across the window.

Degradation: an all-vs-all track whose mate assembly is not loaded in the
session cannot fetch the mate sequence and degrades to no SNPs rather than an
error.

## What it does not fix

The fetch unit is still the whole alignment, so a chain-scale fine row
downloads its multi-MB CIGAR to draw a small window whether or not SNPs are
drawn. That is the "no intra-record slicing" item in
[synteny-comparative.md](synteny-comparative.md) and a chunked fine tier is
its fix; this proposal sits on top of it, not instead of it.
