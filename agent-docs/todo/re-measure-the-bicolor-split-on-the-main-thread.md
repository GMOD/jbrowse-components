---
name: re-measure-the-bicolor-split-on-the-main-thread
description: ADR-016's objection no longer describes the code; re-measure the main-thread pos/neg split under ADR-078's per-region encode memo before moving bicolorPivot and useBicolor out of rpcProps
metadata:
  area: wiggle, perf
  category: measure-first
---

# Re-measure the bicolor split on the main thread

ADR-016 keeps the wiggle pos/neg split in the worker because "the upload
autorun re-splits every cached region on each region arrival, O(N × K)". That
described a whole-map upload callback with no memory. Under ADR-078,
`installPerRegionLifecycle` re-encodes only the region whose map entry changed
(`encodedFrom.get(key) !== regionData`), so a main-thread split in
`buildSourceRenderData` is O(K) per arrival — the same as the worker's — and a
`bicolorPivot` / `useBicolor` change becomes N re-encodes instead of N refetches.

What moves: the split out of `processFeaturesFromArrays`, `bicolorPivot` and
`useBicolor` out of both displays' `rpcProps()` and into `gpuProps()` (where
`bicolorPivot` already is), and the four `pos*`/`neg*` arrays off the wire.
Whiskers and min/max already re-derive the split on the main thread
(`wiggleLayers.ts`), so the avg path stops being the odd one out.

**First move: measure on a 1000-source multiwiggle.** ADR-016 was implemented
and reverted on a measurement once; the premise has changed, the number has
not been taken again. `REJECTED_IDEAS.md` lists the idea as ADR-settled on the
old premise and should point here.
