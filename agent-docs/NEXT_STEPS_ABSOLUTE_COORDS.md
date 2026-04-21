# Next steps — absolute genomic coordinate refactor

Current state: alignments and wiggle worker output use absolute genomic
`uint32` positions. GPU shaders consume positions via `hpClipX(hpSplitUint(...))`
or `hpLinear(...)`; no `-regionStart` transform exists in either plugin.

## P1 — validate in browser (blocks confidence)

The refactor touched every render path in alignments and wiggle. Unit tests
cover logic but not pixel output. Need manual visual verification:

- Start dev server (`yarn start` or the repo's equivalent)
- Load a BAM track and verify each of:
  - [ ] Read bodies render at correct positions
  - [ ] Mismatch 1bp bars colored A/C/G/T
  - [ ] Gaps (deletions = red bars, skips = thin line)
  - [ ] Insertion indicators (thin bars + serifs + numeric labels)
  - [ ] Soft/hard clip bars
  - [ ] Soft clip base characters (when showSoftClipping on)
  - [ ] Coverage depth bars
  - [ ] SNP coverage colored stacks
  - [ ] Noncov histogram (insertion/softclip/hardclip proportions)
  - [ ] Indicator triangles at top of coverage
  - [ ] Modification colors (MM tag)
  - [ ] Modification coverage stacked bars
  - [ ] Paired-end arcs (bezier curves)
  - [ ] Long-range vertical lines
  - [ ] Chain connecting lines (linked reads)
  - [ ] Chain highlight/selection overlays
  - [ ] Feature highlight/selection overlay
  - [ ] Sashimi arcs
  - [ ] Reversed region display — all of the above but mirrored
- Load a BigWig track and verify xyplot, density, line, scatter rendering
- Load at T2T scale (chr1, ~248 Mbp) and zoom to various bp ranges to
  verify hp-math precision holds. A visible shift of a few pixels at max
  zoom-out would indicate a precision bug.
- Hover tooltips for: reads, mismatches, insertions, soft clips, hard
  clips, modifications, coverage bins, indicators, sashimi arcs, wiggle bins
- SVG export — all of the above rendered into the SVG output
- If rendering matches previous behavior, regenerate the 4 jbrowse-web
  image snapshots (`AlignmentsModifications`, `AlignmentsMethylation`,
  `Alignments`, `AlignmentStack`) with `jest -u`.

**If anything is visibly broken:** the most likely culprits are
`arc.slang` (the hpLinear-based bezier is the only truly novel math) or
a consumer I missed.

## P2 — dead-storage cleanup (alignments)

`region.regionStart` is write-only on `Canvas2DRegionData` (in
`Canvas2DAlignmentsRenderer.ts`) and `LocalRegion` (in
`GpuAlignmentsRenderer.ts`). Recommend removing from both structs and from
the `ReadUploadData` / `CoverageUploadData` / `ArcsUploadData` interfaces
that provide it (~5 test fixtures). Also audit `PileupDataResult.regionStart`
— `packArcs` no longer takes it, so it may be removable.

Audit-before-remove: grep for `\.regionStart\b` and check each hit.

## P3 — canvas + variants plugins

These plugins still use the old convention:

- `plugins/canvas/src/RenderFeatureDataRPC/collectRenderData.ts` emits
  `startOffset`/`endOffset` fields (relative offsets into region)
- `plugins/canvas/src/LinearBasicDisplay/components/Canvas2DFeatureRenderer.ts:50-127`
  adds `region.regionStart` back
- `plugins/variants/src/MultiVariantDisplay/components/Canvas2DVariantRenderer.ts:76-77`
  same pattern

Converting them follows the same recipe as alignments. Recommend handling
each plugin in its own PR.

## P4 — cosmetic follow-ups

- `packages/alignments-core/src/coverageDownsampling.ts` —
  `downsampleMinMax` takes a `startOffset` param; rename to `startPos`
  for consistency with `coverageStartPos`. Cascades into ~25 files but
  mechanically simple.
- `packages/alignments-core/src/coverageDownsampling.test.ts:116` —
  test title "startOffset is applied to positions" should be renamed.

## Testing recipe

1. Unit tests: `pnpm jest --testPathPatterns="<plugin>" --no-coverage`
2. Lint: `pnpm lint --cache` (only investigate errors you introduced)
3. Browser validation checklist (see P1 template)
4. Commit per plugin or per phase, not per file — keeps the history
   bisectable.
