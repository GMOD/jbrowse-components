---
name: memoizing-computevisiblecoveragestats-to-make-the-500-ms-coarse-tick-cheaper
description: Memoizing `computeVisibleCoverageStats` to make the 500 ms coarse tick cheaper
area: performance-and-measurement
---

# Memoizing `computeVisibleCoverageStats` to make the 500 ms coarse tick cheaper

declined 2026-08-14 by reading what it costs rather than by
measuring a variant, which is the cheaper order here. The tick was the right
suspect: it is where the over-budget frames of a six-track pan land, confirmed
in [INTERACTION_PERF.md](../reference/INTERACTION_PERF.md). But the function is a tight
typed-array loop over the visible bp span — ~19k entries per track at the
benchmark locus, tens of microseconds — so skipping the work has nothing to
save, at any track count. What the tick costs is the invalidation it publishes:
`coverageStats` -> `coverageDomain` -> `coverageDepthDomain` ->
`renderState`, which is a full canvas repaint per open track, and it happens
even when every value is unchanged because each step builds a fresh object.
A **value-equality** memo would stop that chain and is a different change —
**also declined, and by a count rather than by reasoning.** Six tracks, 360
frames, 4 coarse ticks: the stats changed at every tick for every display, **0
of 24 equal**, each display taking exactly its initial value plus one per tick
(`jb2bench/scripts/render/coarsetick.probe.ts`). The memo has no case to fire
in, because the tick fires precisely when the coarse window has moved far
enough to cover different data — and a stationary view does not tick at all,
MobX caching the computed, so there is no third state where the values repeat.

Two generalisations, and the second is the one that cost a detour. **Before
memoizing a getter on a hot tick, ask whether the cost is the computation or
the invalidation** — they want opposite fixes, one caching the result and the
other preserving the previous result's identity. And **when a recompute is
triggered by a change in its own inputs, suspect that its output changes too**:
the whole suppression idea assumed a tick that fires more often than the data
moves, and this one fires exactly as often.
