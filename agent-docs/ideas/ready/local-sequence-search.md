---
name: local-sequence-search
description: Genome-wide exact sequence search versus running real BLAT locally, and what each would cost.
---

# Local sequence-to-coordinates search (no UCSC)

The BLAT/in-silico PCR dialogs only work for assemblies UCSC hosts; a genome
opened from local files now gets an up-front "no UCSC database" warning instead
of an errAbort after a round trip. That leaves "where is this sequence" genuinely
unanswerable for a local assembly, and there are two very different ways to close
it.

**Genome-wide exact search (recommended).** What people paste is usually a
primer, probe, exon or read, and they want exact-or-near-exact placement — a
substring search, not an alignment. Most of it already exists:
`SequenceSearchAdapter` plus the LGV's **Sequence search** dialog scan the
reference and build an on-the-fly track. Two gaps: the adapter is scoped to the
visible region ±10 kb (`SequenceSearchAdapter.ts`), so it cannot answer a
genome-wide question, and it does not navigate — though the navigate-to-best-hit
and notify path from `plugins/blat/src/ucscShared.ts` is now there to reuse.
So: a genome-wide mode that runs per-refName in the RPC worker and emits features
as it finds them (no eager materialization across the boundary), feeding the same
track + navigate path. Cheap and fast for volvox, a bacterium, yeast, a single
chromosome. hg38 means streaming ~3 GB of sequence, so the real design question
is the size gate and cancellation, answerable from `assembly.regions`.

**Real BLAT locally (separate decision, not an extension of the above).** kent's
`blat` / `gfServer` + `gfClient` buys gapped, mismatch-tolerant and protein
search that a substring scan cannot do. Costs: a per-platform native binary in
the Desktop package (Electron main can shell out, the browser cannot, so this
permanently splits the two products), a `gfServer` index built per assembly
before any query works, and kent licensing that is free for academic/nonprofit
but not commercial — a distribution question, not a technical one. Worth it only
for a concrete need to align inexactly against a genome UCSC does not host.
(Related: `dynablat-01.soe.ucsc.edu:4040` handshakes over raw TCP for GenArk
hubs, which Electron main could reach and a browser could not, but raw gfServer
returns seed/tile hits that gfClient has to stitch into PSL.)

**Do not auto-fall-back** from BLAT to a local search. They answer differently
precise questions, and silently swapping one for the other is how a user
concludes their sequence "isn't in the genome" when it is there with two
mismatches.
