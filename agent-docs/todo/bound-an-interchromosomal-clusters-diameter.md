---
name: bound-an-interchromosomal-clusters-diameter
description: measure at depth before changing what the floor means
metadata:
  area: alignments
  category: ready
---

# Bound an interchromosomal cluster's diameter

`clusteredInterchromSupport` is single-linkage, so the window bounds the GAP
between neighbours and not the DIAMETER of the cluster: 40 pairs spaced exactly
one window apart chain into one cluster spanning 39 fragment lengths
(`arcClustering.test.ts` has the probe shape). The prose beside it reads as a
diameter claim — "how far a supporting read can sit from the breakpoint is one
fragment length" — so the rule delivered is a density threshold and the rule
described is a distance one.

At depth the difference is not cosmetic. The pass's own measurement puts 865
interchromosomal connections in 200 kb at 300x, i.e. ~231 bp apart on the source
contig against a typical `stats.upper` of 500-700 — so the first coordinate chains
nearly everything in the window and the partner coordinate does all of the
discriminating. Whether that matters depends on how concentrated real mismapping
is on the PARTNER side, which is the thing to measure: mismapping goes to repeats,
and repeats are localized, so "both sides agree" may be weaker evidence than it
reads.

Do not change the rule before measuring it. The obvious alternative — cap a
cluster's diameter at the window and split beyond it — trades chaining for
arbitrary cut points, which is the failure mode the current form was adopted to
escape (the one-open-cluster version scored a four-read breakpoint as 1 and 3).
Measure on HG002 300x and on a sample with a known translocation, and report the
cluster size distribution under both rules before touching either.
