# RenderPileupDataRPC

## One RPC for pileup + chain

`RenderAlignmentData` (`executeRenderAlignmentData.ts`) serves both displays,
branching on `args.linkedReads` (`'off'` → pileup, else chain). Shared spine
(fetch → arrays → coverage → assembly); only pre-processing differs — chain:
dedupe + singleton/proper-pair filter + chain metadata; pileup: ref-sequence
fetch + sort-tag values. Chain-only result fields are optional on
`PileupDataResult`.

## Known limitation: `computeMultiRegionLayout`

`computeMultiRegionLayout` (in `sortLayout.ts`) currently ignores both
`sortedBy` and `showSoftClipping` — neither softclip-expanded read extents nor
the custom sort at `sortedBy.pos` is applied when more than one region is
fetched. The single-region paths (`computeLayout` / `computeSortedLayout`) do
honor both. This is a real gap in multi-region pileup views; fixing requires
deciding which region's sortPos applies and propagating expansions across region
boundaries, so it has not been done. Don't assume the multi-region path matches
the single-region path.

## `showSoftClipping` belongs in `rpcProps`

The worker uses `showSoftClipping` in `features/softclip/extract.ts` to gate
per-base softclip sequence extraction (the bases are not produced when off). So
toggling it is a fetch-invalidating setting, not a main-thread-only one. Don't
move it to `gpuProps`.
