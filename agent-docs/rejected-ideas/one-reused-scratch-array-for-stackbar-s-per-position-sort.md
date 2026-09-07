---
name: one-reused-scratch-array-for-stackbar-s-per-position-sort
description: One reused scratch array for `stackBar`'s per-position sort
area: performance-and-measurement
---

# One reused scratch array for `stackBar`'s per-position sort

measured
2026-08-14 and declined as **not resolvable**: 1.17x / 1.01x / 1.09x on 50k
positions with 2 entries each, and 1.00x / 1.12x / 1.25x on 10k positions with
8, against controls that themselves swung **0.89-1.11**. The second fixture's
middle sample is the one to read — scratch 1.12x, control 1.11x, i.e. the whole
apparent win was the harness.

The idea is the obvious next step from a comment that invites it: `stackBar`
heads its loop with `[...colorMap.values()].sort(...)`, one array per position,
and `computeBisulfiteCoverage` says beside it that spreading the map twice
"made two lists per position where one is needed" — so the remaining one reads
like a known cost. It isn't. `scratch.length = 0` plus push, sorted in place,
emits byte-identical packed output over all five fields and both coverage
models, and buys nothing.

The transferable part: a position's colorMap holds 2-8 entries, so the array is
tiny and V8's young-generation allocation is about as cheap as the refill. What
scales on this path is proportional to CALLS, not positions —
`groupByPosition`'s two Map lookups and probability accumulation per call,
30-40x more work per position than the stack. Same generalisation as the
`Float32Array` entry below, from the other side: price what the loop count is,
not what looks allocation-heavy.

Note that the per-position **object and closure** `heightForPosition` returns
were NOT tested here and are a different question — that abstraction is what
keeps the two coverage models from drifting, so it is not a like-for-like swap.
