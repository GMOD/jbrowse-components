---
name: derivative-allele-candidates
description: How the reads in view become a ranked list of derivative alleles — the grouping key built from the junctions and never the read edges, why a junction tolerance is a distance rather than a grid, mode-seeded clustering against the two clusterings that divide or merge real alleles, and the discipline that keeps the output a proposal rather than a call. Read before touching the grouping key, the tolerance, the support floor or the rank.
---

# From reads in view to a ranked derivative allele

A derivative allele is an ordered, oriented list of reference intervals, and
that is exactly what a split read's segment chain already is. So the
reconstruction needs no consensus contig and no new alignment: **group the
chains in view by the path their junctions describe, and the size of each group
is that path's support.** `computeDerivativePaths`
(`plugins/alignments/src/features/derivativePaths/computePaths.ts`) is the whole
of it, and the chains come from `computeReadChains` —
[split-read-chains](split-read-chains.md) is how those are built.

The rules below are what that grouping got wrong on the way, each one producing
a confident and plausible count that was an artifact of the code rather than a
fact about the sample. They are collected here because none of them is really
about alleles: this is a `groupBy` over noisy partial evidence, and the same
mistakes are available in any of them.

**No measurement is repeated here.** Every failure below was measured against
real COLO829 / K562 / HG008-T records, and the numbers have one home:
[reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md).

## 1. The junctions are the allele; the outer edges are the reads

A chain has two kinds of content. Two reads crossing one rearrangement agree
exactly on where the pieces join, and disagree entirely on where each read
happened to start and stop.

**Fold the outer edges into the grouping key and every read becomes its own
candidate**, with a support of 1 apiece. `pathSignature` is built from the
junctions alone for that reason.

The rule has a sharper second form once something downstream holds onto a
candidate. The picker held the user's chosen route by its `locString`, which is
built from `segments`, whose outer edges come from the group's representative —
the widest supporting read. One wider read landing while the dialog was open
rewrote the group's locstring, the lookup missed, and the radio dropped silently
back to row 0. `pathId` is now the grouping key itself, handed out opaque, and
its doc comment says nothing may parse it. **Anything that identifies, keys on
or compares a candidate is built from the junctions**; `locString`, `segments`,
`readCount`, `refNames` and `extendsOffScreen` are all read-derived and all move.

## 2. A tolerance is a distance, not a grid

Two reads place one junction only to within the aligner's precision, so
endpoints have to be quantized before they can be compared. The one-liner is
`Math.round(bp / tolerance)`, and it answers a different question — which fixed
cell a coordinate falls in, not whether two coordinates are close. **Endpoints
1 bp apart get different answers whenever they straddle a cell edge, and
endpoints 10 bp apart do so half the time.**

Nothing about that is visible from inside: every individual answer looks
reasonable, and the published support depends on where the locus sits relative
to a multiple of the tolerance. Swept over one cell width it moved a fixture's
read count by several and grew a spurious second candidate at most offsets.

**The test that catches it sweeps the offset**, and `computePaths.test.ts` does
exactly that, plus a translation-invariance check over the real records. A test
of one pair of endpoints passes against the grid.

## 3. Seed a cluster at the mode, not at the first endpoint and not at a neighbour

Given a distance, there are three obvious ways to turn endpoints into junctions
and two of them divide or merge real alleles.

- **A leader sweep** — sort ascending, open a new cluster when an endpoint is
  further than the tolerance from the one that opened the current one — anchors
  each cluster on the *lowest* endpoint anybody supplied. One jittered 1-read
  chain landing just left of a stacked junction re-anchors the cluster and cuts
  the junction's own upper placements into a second one: one allele reported as
  two candidates with its support divided, caused by a chain the `minReads`
  floor was about to discard anyway.
- **Single linkage** — join each endpoint to its nearest neighbour — lets
  clusters chain, and this data has a real case. COLO829's two chr9 fold-back
  junctions sit 28 bp apart, and read jitter between them bridges the two into
  one cluster, merging two alleles into one candidate. (`scripts/sv_multihop.py`'s
  dedup is a leader sweep over kept records, not this; its check suite pins
  that a drifting run does not merge.)
- **Mode seeding** — count the exact endpoints, take them as seeds in
  descending-count order, and let each seed claim every unclaimed endpoint
  within the tolerance *of the seed itself* — is what `buildClusterOf` does.
  Reads stack exactly on an unambiguous breakpoint, so the modes ARE the
  junctions and the jitter joins whichever one it lies within tolerance of. Two
  junctions further apart than the tolerance are two modes, so neither can
  swallow the other.

The line to keep: **a cluster is capped at the tolerance around a seed the
data's own weight chose.** Both wrong answers anchor on an accident instead —
the first endpoint seen, or a neighbour.

## 4. The cluster's label is the id the picker is holding

The cluster is also what rule 1 builds the key out of, so whichever coordinate
labels a cluster becomes the name a consumer holds a route by. Label it with the
sweep's own leader and any read landing left of the whole pile renames the
route — the same silent drop back to row 0 as rule 1, one layer down. Labelling
by the mode makes that rare rather than routine, and the mode is the better
representative anyway: it is the called position, while the leader is the
worst-placed read in the pile.

**The residue is irreducible and the consumer plans for it.** A route whose two
reads disagree about a junction has no mode to speak of, so a third read can
still rename it. `selectedCandidateIndex`
(`plugins/linear-comparative-view/src/LinearDerivativeVsRef/buildDerivativeVsRefSpec.ts`)
therefore matches on `pathId` first and falls back to the route's *shape*
(`derivativePathTestId` — refNames and orientations, which no coordinate moves),
taking the fallback only when it names exactly one row. Two routes of one shape
at nearby loci is precisely what a fold-back locus offers, and guessing between
them draws the wrong allele under the right caption.

## 5. Fold the reverse complement before grouping; choose the orientation after

An allele and its reverse complement are the same allele, and the SA segments
this reads are not strand-normalized, so both readings really do occur in one
fetch — on COLO829's der(3), most reads describe it one way and a substantial
minority the other.

**Canonicalize before the key, using the key's own material.** `canonicalize`
computes both readings' signatures and takes the smaller. Choosing between them
on anything read-derived re-imports rule 1's bug: "present it from its lower
coordinate" splits one allele in two, because a read covering a long stretch of
the first arm and a read that clips early but runs far down the last one rank
their readings oppositely — which is exactly how one 26-read allele was reported
as a 16-read and a 10-read candidate.

**Then choose the orientation to display separately, per candidate, after the
grouping is settled.** `orientForDisplay` runs on the group's representative, so
unlike the rule it replaced it cannot move a read from one candidate to another,
and it is then free to consult the read extent the signature must ignore.

## 6. The rank needs a total order, and the last term is what supplies it

Support, then segment count, is not a total order — two routes routinely agree
on both, which is the ordinary shape of a window holding several two-segment,
two-read candidates. What separated them was `groups`' insertion order, i.e. the
order the reads were walked, i.e. the order their fetches completed, so the same
window ranked the same two alleles either way round on different runs.

That is not only untidy: the picker shows the first `MAX_SHOWN` rows over a
pileup that is usually still streaming, so **an unstable tail decides which
candidates a person is offered.** The final tie-break is `pathId`, unique by
construction because it is the group key — the same tie-break `resolveArcs`
makes on `arcKey`, for the same reason.

**Rank is stable without being meaningful**, and that warning travels with it.
Nothing here ranks by how interesting a route is, so at COLO829's chr9 fold-back
the segment-count tiebreak duly puts a three-segment route above the two-segment
allele the tutorial is about. Every row carries a shape-derived testid and every
figure spec selects by it, because a spec keyed on row position captures the
wrong allele under the right caption.

## 7. The representative is the widest chain, never an average

Every chain in the group already agrees on the junctions, so the only thing left
to choose is how much reference context the candidate carries — and the widest
read is the one that saw the most. **Averaging would invent a boundary no read
observed**, which is the kind of number that then gets read back as evidence.

The two outer segments are the only ones grown by `flank`, and the growth is
applied by read role (the first segment's entry edge, the last one's exit edge)
before being mapped onto low/high coordinates, so a reversed segment grows away
from its junction rather than through it. Interior segments are used as they
stand, because their edges ARE the junctions.

## 8. Return everything above the floor, and never let the floor become a verdict

`computeDerivativePaths` returns every path above `minReads` rather than a
top-N, because **how many paths a window produces is itself evidence about all
of them**: one or two is what a real event looks like, forty is a repeat, and a
caller that truncated to ten first cannot tell a reader that. Presenting a
shorter list is the picker's job, and the picker says what it left out.

The floor's own doc comment is the line worth stealing verbatim: it is what
makes a row "a route several reads agree on" rather than "a route", and the
dialog says so in those words. **It is emphatically not a judgement that a
one-read chain is mismapped** — this file has no way to know that — and the
moment the number is defended as quality control it has become a filter with no
way to see what it removed.

Same discipline at the top of the file: the output is a proposal, not a call. A
confident-looking path built from reads mismapped into a repeat looks exactly
like a true one here. Saying that in the module comment is what stops the next
caller treating a rank as a likelihood — and it is why
`projectReadsOntoDerivative` was reverted, since its evidence was the same
chains the path came from.

## 9. "No path is supported" and "nothing was fetched" are different answers

An empty candidate list means either that the reads describe no rearrangement or
that there are no reads, and the two call for opposite responses: narrow the
window, or widen it. `hasReadsForDerivativePaths`
(`plugins/alignments/src/LinearAlignmentsDisplay/model.ts`) separates them,
because a window over the track's byte budget renders as `force load` with
nothing behind it, and reporting that as "no path is supported here" sends a
reader looking for an event that was never fetched.

## 10. Display grouping must not partition the evidence

The display already splits reads into lanes — by HP tag, by strand, by sample —
and that split says nothing about which molecule carries which junction. **A
path supported by four reads across two lanes is still supported by four**, so
`derivativePathCandidates` runs the grouping per lane and concatenates rather
than counting within a lane. Chaining within a lane loses nothing, because a
segment sitting in another lane is named by the read's own SA tag and
`unpairedReadChain` folds it in from there.

The exception is worth stating alongside: a *hidden* lane is not a partition but
an exclusion — the all-vs-all self-alignment lane is gone from `rawDataByGroup`
outright — so counting its chains would rank paths on reads the track never
draws.

**And what the evidence IS is a property of the display, not of this file.** The
same grouping runs over a de novo assembly's contig-vs-reference blocks, where
one or two contigs cross a locus rather than 28 reads
([ideas/derivative-allele-from-assembly-contigs](../ideas/derivative-allele-from-assembly-contigs.md)).
A support floor of 2 then discards a real allele and every row says "1 reads",
so the floor, the noun and whether the evidence can name off-screen segments
travel together as `DerivativePathEvidence` and the display answers them. A
number defended as quality control (rule 8) is the failure this shape avoids
twice: once for reads, once for a unit that never had the same distribution.

## 11. A run of a route is not a competing route, and not extra support either

Rule 1 keys a group on the whole junction list, so a read that crosses only the
first junction of a three-junction allele forms a group of its own. Two such
reads make a row, and the picker's caption presents every row as a route the
reads cross "in the same order and orientation" — which reads as a second
allele, when the shorter route is consistent with the longer one and cannot tell
it from a simpler event.

Neither obvious repair holds. Crediting the shorter route's reads to the longer
one overstates it: they say nothing about the junctions they did not cross, and
a plain translocation and the first hop of a chain look identical to them.
Hiding the row loses the count, which rule 8 says is evidence about the window.

So the relation is named and nothing is moved. `computeDerivativePaths` marks a
candidate whose junctions are a contiguous run of another's — in either reading,
since the shorter route's reads may have crossed the allele from the other end —
with `partOf`, the `pathId` of the most-supported route that contains it, and
the picker prints "part of a longer route in this list" beside the row. A route
that diverges at any junction, such as COLO829's three-segment path that skips
the chr12 insert, shares no run and stays the dissent it is.

## Depth lives elsewhere

- Every measurement behind rules 1 through 6, the offline `sv_multihop.py` that
  answers the same question from a callset, and the line this feature area does
  not cross: [reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md).
- How the chains this groups are built:
  [split-read-chains](split-read-chains.md).
- How a candidate is written as `A B C D E′ B′` and drawn as a segment map:
  `letterSegments.ts` beside this file's subject, and
  `plugins/linear-comparative-view/src/LinearDerivativeVsRef/segmentMapSvg.ts`,
  which `website/scripts/gen-segment-maps.ts` runs over the committed COLO829
  reads for the tutorial's figure.
- What is shipped, what is parked, and what was settled by a rule rather than a
  design:
  [ideas/sa-hops-in-the-bezier-overlay.md](../ideas/sa-hops-in-the-bezier-overlay.md).

## What travels

Strip the genomics and this is a `groupBy` over noisy partial evidence —
collapsing crash reports to a fault, log lines to a signature, pings to a
session. Four of the rules need no domain at all: **build the key from the part
the evidence cannot disagree about** (1), **`Math.round(x / tolerance)` is a
grid, not a distance** (2), **a rank shown as a list needs a total order or the
list is arrival order** (6), and **a support floor is presentation, not quality
control** (8). Close on the last one: it is a discipline rather than a
technique, and it is what makes the other rules worth trusting. Framing and
audience: [ideas/upstreamable-ideas.md](../ideas/upstreamable-ideas.md).
