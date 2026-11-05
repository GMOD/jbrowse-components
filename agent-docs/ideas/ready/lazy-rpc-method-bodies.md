---
name: lazy-rpc-method-bodies
description: The RPC registry eagerly imports featureTransforms, markEncoding and flatbush for five method bodies, costing 20 KB gz on an empty page; lazy preload() bodies like RenderAlignmentData's would remove it.
---

# Lazy RPC method bodies

20 KB gz on an empty page, 13 KB with four tracks, about 2 KB with a plugin
named. Re-measure on a fresh build first.

- Give `CoreGetEncodedLayers`, `CoreGetEncodedFeature`, `MarkScanPlotFields`,
  `GetConsensusSequence` and `MafGetSequences` a `preload()` body, as
  `RenderAlignmentData` has (`plugins/alignments/src/RenderAlignmentDataRPC/`).
- Move `matedBy` into its own module.
- Split `plugins/wiggle/src/util.ts` so its constants stop
  importing `markEncoding`.
- Add `rpcMethods: ['CoreGetEncodedLayers']` to `LinearMarkDisplay` and
  `MultiWaySyntenyDisplay`; without it the first fetch waits an extra round trip
  (`CoreLoadTrackCode` preloads the named methods).
