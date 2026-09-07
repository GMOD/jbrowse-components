---
name: one-sequence-pass-for-all-of-a-read-s-mm
description: One sequence pass for all of a read's MM groups, htslib's shape, as a general optimization
area: performance-and-measurement
---

# One sequence pass for all of a read's MM groups, htslib's shape, as a general optimization

built and measured 2026-08-14, output identical, and declined
everywhere except Fiber-seq-shaped tags. `bam_next_basemod` keeps a countdown
per canonical base and makes a single pass, so copying it looks obviously right
and this was first measured at **1.13x** on the ONT fixture. Then the same-base
merge shipped, `A+a.;C+h?;C+m?` stopped being three sequence walks and became
two, and remeasuring against the baseline that now ships gives **0.949x — a
loss**. `plugins/alignments/benches/multiGroupParse.bench.ts`, all arms kept.

The full sweep, because the crossover is the useful part: 0.917x at one distinct
group, 0.930x at two synthesized, 0.949x at the ONT fixture's two real ones,
1.385x at fiberseq's 2.86. **The crossover is between two and three DISTINCT
groups**, and one pass charges every read base an array index and several
property loads where the per-group loop is a tight `charCodeAt` do-while — two
saved passes do not cover that.

**Two things worth carrying, since the shape is likely to be re-proposed from
the htslib source:** it must branch on the count of *distinct* groups, because
counting duplicates puts real ONT output on the losing side; and it must clamp
at the end of the sequence the way the per-group walk does (`seqLength - 1`
forward, `0` reverse) for an MM tag that asks for more of a base than the read
has left. The arm did not, dropping those calls silently, and every row of the
bench reading "output identical" had only meant no read in those fixtures
overran.
