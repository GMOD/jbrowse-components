---
name: a-second-junction-producer-under-the-coverage-band-showsplitjunctionarcs
description: A second junction producer under the coverage band (`showSplitJunctionArcs`)
area: rendering-and-displays
---

# A second junction producer under the coverage band (`showSplitJunctionArcs`)

built, reviewed against main 2026-08-14, and declined once the arc band drew
what the overlay had been built to draw. It clustered split junctions within
10 bp and took the modal site, where `arcKey` coalesces on exact coordinates,
so at a junction with microhomology jitter the two printed different counts at
one locus. `cancer_sv/k562_bcr_abl_split` is published off the band alone: it
draws the 154-read intronic acceptor and the 26-read ABL1 exon-2 one as
weighted arcs across the region dividers, and both paths dedupe per readId, so
the counts agree. **What was given up:** the printed count label and the
position over the coverage band. The label is a later option on the band
itself, sourced from `ComputedArc.support` — one producer, serving
same-chromosome junctions too, roughly 60-100 lines reusing `SashimiArcLabels`'
halo constants — and it is not a reason to keep a second producer alive
meanwhile. The code is parked on `origin/parked/split-read-sashimi-arcs` and
would still cherry-pick: the three unlanded commits (`cfeeb76274`,
`2053dc0e6b`, `0775fa61b4`) sit on the merge base and the files they touch have
no churn since except `model.ts` and `tooltipUtils.ts`. Expect a confusing
branch: it is 8 commits ahead of main, of which four are the interchromosomal
arc work that has landed under rebased hashes and one is an obsolete handoff.
Two differences the case for dropping it does not turn on, and a reader
comparing the two should not mistake for regressions: the branch's overlay was
**not** gated on `readConnections`, and it tinted each arc by connection type
where main paints every interchromosomal arc one `ARC_COLOR_INTERCHROM`, on
purpose.
