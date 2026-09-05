---
name: ordering-synteny-lanes-by-similarity
description: Reordering MultiWaySyntenyDisplay's lanes so similar genomes sit adjacent. The display side is already built — `rowOrder` is a slot with a densest-first default — and what is missing is the N x N similarity. Two things decide whether it can be had: a ribbon only ever joins ADJACENT lanes, so the objective is seriation and a dendrogram's leaf order is a heuristic for a different problem; and the similarity's fetch cost depends entirely on the source, free from per-lane gene groups and O(N^2) adapter calls from an all-vs-all PAF. A star denies the matrix but not an order — `diagonalizeRegions` is the in-tree proof that star-shaped data sorts by projection, and the lane counterpart is a profile ordering. Read before wiring TreeSidebarMixin into this display, or before reaching for diagonalization as the seriation it is not.
---

# Ordering synteny lanes by similarity

Not committed work. The feature is "stack the genomes so the ones that agree sit
next to each other", and the reason it is worth writing down rather than doing
is that two of its constraints are not visible from the feature description.

The lane-selection half — which of 464 haplotypes to draw at all — is in
[multiway-synteny-lgv-track](multiway-synteny-lgv-track.md) under "HPRC at
scale", and it lands on the wave VCF's genotype matrix rather than the
alignment. This file is the ORDER of whatever set that picks.

## The display side is done

`rowOrder` is already a slot on `MultiWaySyntenyDisplay`'s model
(`types.array(types.string)`): lanes it names pin to the top in its order, and
lanes it does not follow densest-first. `layoutMultiWay`'s `preferred` argument
reads it. So nothing needs building to CONSUME an order — the open question is
only where one comes from, and a first cut can write `rowOrder` from a track
menu item without touching the layout at all.

## A ribbon joins adjacent lanes, so this is seriation

`alignFrameTo`'s comment already states the structural fact for a different
purpose: "a ribbon only ever joins ADJACENT lanes". That makes lane order decide
**which pairs are drawn at all**, not just how the stack reads — the display
fetches links per adjacent pair, so reordering changes the data on screen.

The objective is therefore to maximize the total similarity of the N-1 adjacent
pairs along the stack: a maximum Hamiltonian path over the similarity graph,
which is seriation. Hierarchical clustering answers a different question, and
its leaf order is a **heuristic** for this one — a good and conventional
heuristic, and the one to ship first since `clusterMatrix` already returns
`order`, but it optimizes cluster nesting rather than the chain. Two genomes can
sit adjacent in a dendrogram's leaf order with a low direct similarity whenever
the tree's branch rotation was decided by a third genome. Where the stack is
short enough for the difference to be visible (a dozen lanes), a greedy
nearest-neighbour chain followed by 2-opt over the same matrix costs
microseconds and optimizes the objective the ribbons actually have.

Do not read "the tree comes out fine" from the MAF display's dendrogram: that
one is drawn as a tree in a sidebar, where nesting IS the output. Here the tree
would be discarded and only the order kept.

## What the similarity costs depends on the source, and that is the real gate

The display has three fetches (`MultiWaySyntenyDisplay/afterAttach.ts`). What
each one can say about a PAIR of lanes is what decides this:

| source | pairs it states | cost of the N x N matrix |
| --- | --- | --- |
| lane gene models, grouped by name | every pair | **free** — already fetched per lane |
| all-vs-all PAF, adjacent-pair links | the N-1 drawn pairs | N(N-1)/2 `CoreGetFeatures` calls |
| the base fetch, no `targetAssemblyName` | anchor vs each lane | 1 call, but it is a star |
| star PAF (`hprc465vsgrch38.aln.paf.gz`) | 39 of 780 | no pairwise matrix at any price |

A star denies the **matrix**, which is not the same as denying an **order** — see
the diagonalization section below.

**The gene-group row is the one to build.** Group keys are global — a gene name,
falling back to the adapter's `syntenyId` — so two lanes' shared groups are
computable from data the display already holds, with no pairwise fetch. The
similarity is the count of shared groups, or better their rank agreement, and
`orientationVote` already walks exactly that intersection (`upperX` against a
lane's placements, `MIN_SHARED_FOR_ORIENTATION = 3`) to decide orientation. The
matrix is a byproduct of machinery that exists.

**The alignment row is where the user's instinct is right and needs sharpening.**
It is not that an all-vs-all file is *required* — it is that the base fetch,
which asks the adapter with no `targetAssemblyName` and gets "every pair anchored
on the queried assembly", is a star by construction whatever file backs it. Real
pairwise means one call per pair, and the third fetch issues those only for
adjacent lanes. So ordering N lanes on alignment evidence costs N(N-1)/2 calls to
decide an order that then needs N-1: 45 calls to order 10 lanes, 107,416 to order
464. Affordable for a comparative stack of a dozen assemblies, not at cohort
scale — which is the same conclusion the lane-selection entry reaches by a
different route.

A **star** PAF cannot state the pairs at any price:
[HPRC_RELEASE2.md](../reference/HPRC_RELEASE2.md) measured
`hprc465vsgrch38.aln.paf.gz` over 14 BGZF slices and found 39 of 780 sample
pairs stated, with both all-vs-all adapters now raising `noSuchPairError`
rather than drawing an empty band. What it can still support is a projection
ordering rather than a seriation — the diagonalization section below.

**Do not reach for composition to fill the gap.** `jbrowse transitive-paf` was
built, worked (88% recall at 99.8% precision on a held-out E. coli pair) and was
deleted — `a2858d0c86` → `79080af254`, with the reasoning in HPRC_RELEASE2.md.
impg does not fill it either: `-x` returns projections, and on the vs-GRCh38
star a 1 Mb chr20 query returned 338 rows of which zero paired two non-reference
haplotypes.

## Diagonalization already orders from star-shaped data, and is not seriation

`diagonalizeRegions` (`packages/core/src/util/`, run through
`DiagonalizeSyntenyRpc` per synteny level and shared with `DiagonalizeDotplot`)
reorders a view's REGIONS, not lanes, so it is not this feature. But it settles
the question the table above raises, and the shape of its answer is the useful
part.

**What it does:** group alignments by (query chrom, reference chrom), give each
query chromosome the reference chromosome it aligns the most bases to as its
ANCHOR, then sort by that anchor's index on the reference axis and by the
length-weighted mean position along it. Reversal comes from a strand vote, or
from the ref-vs-query position covariance where the vote is closer than
`decisiveStrandFraction` (0.6), since a chromosome full of inversions splits the
vote near 50/50.

**So it is a projection sort, not a chain.** Every item gets a scalar from one
shared reference and the sort follows; there is no N x N matrix and no adjacency
objective. The seriation argument above is untouched by it — but the
"unavailable from a star" reading is not, because this is exactly star-shaped
data producing a useful order. Every alignment targets the reference, and that
is sufficient here precisely because the output is a projection.

**The principle transfers to lanes; the function does not.** Diagonalize's scalar
is position along the anchor chromosome, and lanes in one window all align to the
same locus, so that scalar is degenerate across them. What a lane does still have
from star data is its PROFILE against the shared reference, which is what
`buildIdentityMatrix` already builds and what PC1 of that profile set would order
by — the local-PCA ordering
[gpu-sample-distance-matrix](gpu-sample-distance-matrix.md) lists as falling out
of the same pass. So on a star the honest ceiling is a profile ordering: cheaper
than seriation, weaker than it, and not nothing.

**Copy its shell.** `DiagonalizeDialog`, `DiagonalizeProgressMixin`,
`DiagonalizeLoadingScreen` and `diagonalizeCancelGate` are a worked answer to
"a user asks for a reorder, it takes a while, it needs a progress bar and a
cancel", and the RPC is deliberately called once per level so each routes to the
worker its own track renders on and reuses that worker's parsed adapters. A lane
reorder wants all of that and should not reinvent it.

## A multiple alignment is the one source that is cheap and pairwise at once

TAF/MAF gives every genome's base in a shared column coordinate, so any pair's
distance is exact and one pass over the columns serves all of them — O(N) fetch
for O(N^2) information, which is why the MAF display could afford clustering at
464 haplotypes when the synteny stack cannot.

Worth knowing before copying it: `buildIdentityMatrix` does **not** take that
pairwise route. It scores each row against the REFERENCE per bin and clusters
those profiles, which is O(rows x columns) against a true pairwise pass's
O(rows^2 x columns) — about 200x cheaper at 464 rows, and the reason the shipped
matrix is shaped that way. The approximation is a real one: two haplotypes that
diverge from the reference at the same bins score identically there whether or
not they diverge the same WAY. Going pairwise on the MAF is the case that meets
the compute-shader criterion in
[gpu-sample-distance-matrix](gpu-sample-distance-matrix.md) — bases x bases,
viewport-defined — and it is the only place in this subject where a kernel is the
lever rather than a cap.

## The order to take it

1. **Gene-group seriation, main thread, behind a track menu item.** Build the
   N x N shared-group matrix off the placements already fetched, seriate, write
   `rowOrder`. No RPC, no new fetch, and it is the case a comparative stack of
   annotated assemblies actually hits. As of 2026-09-04 the motivating demos
   exist at both scales: the gene-symbol tutorials stack eight primates and
   forty-seven E. coli, and the 47-way page says out loud what densest-first
   cannot — "the reduced Shigella genomes fall toward the bottom without
   anything naming them".
2. **`clusterMatrix` for the order, then a 2-opt pass.** Reuse the shared tail
   rather than hand-rolling, then improve the chain against the objective above.
   Keep the tree only if a sidebar is wanted; the ordering does not need it.
3. **Alignment-evidence ordering behind an explicit gate**, refusing above a lane
   count the N(N-1)/2 fetch cannot serve. On a star adapter it degrades to the
   profile ordering rather than refusing — an order from 39 of 780 stated pairs
   would be a lie, an order from every lane's profile against the shared
   reference is a weaker claim honestly made, and the status line should say
   which one ran.

What would retire the gate on the third item is a placement source that states
every pair in one read. That is a multiple alignment, and the display's contract
is already source-agnostic about placements.
