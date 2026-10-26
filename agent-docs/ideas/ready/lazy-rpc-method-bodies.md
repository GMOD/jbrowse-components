---
name: lazy-rpc-method-bodies
description: The RPC registry namespace-imports featureTransforms, markEncoding and flatbush, so five method bodies cost 20 KB gz on an empty page and 13 KB with four tracks. Giving each a preload() body like RenderAlignmentData removes it, provided the displays name the method in rpcMethods so the first fetch pays no extra round trip. Measured 2026-10-08 on a stale build.
---

# Lazy RPC method bodies

20 KB gz on an empty page, 13 KB with four tracks, about 2 KB with a plugin
named. Re-measure on a fresh build first.

- Give `CoreGetEncodedLayers`, `CoreGetEncodedFeature`, `MarkScanPlotFields`,
  `GetConsensusSequence` and `MafGetSequences` a `preload()` body, as
  `RenderAlignmentData` has (`plugins/alignments/src/RenderAlignmentDataRPC/`).
- Move `matedBy` into its own module.
- Split `plugins/wiggle/src/util.ts` so its constants and `withoutExtension` stop
  importing `markEncoding`.
- Add `rpcMethods: ['CoreGetEncodedLayers']` to `LinearMarkDisplay` and
  `MultiWaySyntenyDisplay`; without it the first fetch waits an extra round trip
  (`CoreLoadTrackCode` preloads the named methods).
