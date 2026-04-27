# Completed Work Items

Items moved here from TODO.md once done. Entries are brief; the git log has
the full story.

---

## Canvas

**Drop `regionStart` field; ship absolute genomic uint32.** _Done 2026-04-25._
Removed `regionStart` from `FeatureDataResult`/`RegionRenderData`. Worker now
emits absolute uint32 positions directly (`collectRenderData.ts`). Shaders
updated: removed `regionStart` uniform from `canvasUniforms.slang`, regenerated
all four passes (rect, line, chevron, arrow). Canvas2D and overlay consumers
simplified by removing `+ region.regionStart` recombination. Stale doc comment
in `rpcTypes.ts` deleted. All 176 canvas tests pass.

## Alignments

**Pileup/chain RPC executor architecture.** _Done 2026-04-26._ Both ~500-line
executors restructured into thin orchestrators (~220-260 lines each) over
named shared phases in `plugins/alignments/src/shared/`:

- `fetchFeaturesFromAdapter` — adapter resolve + getFeatures + regionStart.
- `buildBaseReadArrays` — common per-read TypedArrays + featureIdToIndex.
- `buildAlignmentDetailArrays` — gap/mismatch/interbase/mod/segment/softclip
  builders behind one `updateStatus` step.
- `buildChainMetadata` — chain grouping + per-chain stats + chainStats.
- `runCoveragePipeline` — 8-step coverage pipeline (compute → freqs → SNP →
  noncov → mod → modTooltip → sashimi → pack) as one named operation; step
  order locked.
- `buildCoverageResultFields` — formats coverage outputs into result fields.
- `computePairedInsertSizeStats` — pileup-only SAM-flag paired insert size.
- `collectResultTransferables` — auto-derives the transferables list by
  walking the result object for TypedArray buffers + ArrayBuffer values.
  Eliminates "added a TypedArray field, forgot to transfer" as a class of
  bug. Caught a latent drift where chain was dropping
  `softclipBaseReadIndices.buffer`.

All redundant `numXxx` count fields removed from `PileupDataResult`,
renderer upload types, and `MismatchArrays` in alignments-core. Consumers
derive from TypedArray `.length` (or `.length / 2` for paired-position
arrays) — single source of truth: the array is its own count.

Full executor merge remains not viable (chain has ~125 lines of chain-only
logic — dedup/filter, chain metadata; pileup has ~80 lines of pileup-only
logic — ref sequence fetch, mod coverage, softclips). `buildLaidOutPileupMap`
/ `buildLaidOutChainMap` look identical structurally but deduplicate
differently (read ID vs mate-pair name) — kept separate.
