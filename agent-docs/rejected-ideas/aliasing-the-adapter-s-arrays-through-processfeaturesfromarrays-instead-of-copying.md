---
name: aliasing-the-adapter-s-arrays-through-processfeaturesfromarrays-instead-of-copying
description: Aliasing the adapter's arrays through `processFeaturesFromArrays` instead of copying
area: performance-and-measurement
---

# Aliasing the adapter's arrays through `processFeaturesFromArrays` instead of copying

costed 2026-08-15 and declined. It was recommended in the code
twice, by `packages/wiggle-core/src/transferables.ts` and by
`plugins/wiggle/src/CLAUDE.md`, both calling the copy "the obvious thing to
remove next" now that `@gmod/bbi` hands a one-region
`getFeaturesAsArraysMulti` back as views into a single buffer. It buys one
`Float32Array(count)` memcpy per source per region, in the worker. It costs:

- **Main-thread retention 12 → 20 bytes a feature, in the common case.**
  Measured on `cDC.bw`, one region, 14,602 features: bbi returns `starts`,
  `ends` and `scores` as views into ONE `4 + count*12` buffer.
  `collectWiggleTransferables` transfers **buffers, not views**, so aliasing
  `scores` retains all `count*12` where `count*4` is needed — on top of the
  `count*8` interleaved positions, which cannot be aliased either way. Today's
  two fresh arrays are `count*12` total. It is the **one-region** shape that
  regresses, which is the ordinary single-contig view and the one bbi added its
  fused parse for; two or more regions pack a buffer per field, exactly sized,
  so aliasing there is free.
- **`EMPTY_RAW` becomes a detach landmine.** The module constant in
  `executeRenderMultiWiggleData.ts` is safe only because `count === 0` makes
  `processFeaturesFromArrays` allocate its own arrays, so none of it reaches
  the transfer list. Aliased, its buffers transfer on the first region missing
  a source and are detached for the second — a `DataCloneError` at the
  `postMessage`, nowhere near the cause. `emptySide` beside it is already
  fresh-per-call for this reason.

**What was given up:** one `count*4` memcpy per source per region, against 67%
more main-thread memory held for the life of the region, at the 1000-source
scale the surrounding code is written for. The dedupe in
`collectWiggleTransferables` stays regardless — it is what makes the aliasing
that *is* done safe across regions.
