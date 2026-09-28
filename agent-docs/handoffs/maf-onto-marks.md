---
name: maf-onto-marks
description: Colin's 2026-09-28 ask to draw the MAF display through the mark display, opened the day the wiggle port's first three landings went in. An inventory that day found MAF already draws every GPU layer through render-core's span, bar and coverage marks and owns no shader, so the port is the data path, the row geometry, the band stack and the overlays. The first item landed the same day as ADR-186 - flatten fans out a record, so a MafTrack takes the mark display with a row per species - and the rest stays ranked here.
---

# The MAF display onto the mark display

Colin, 2026-09-28, after the span gained its colour scale: "we can try to make
maf leverage the new wiggle display marks". The first item below landed that
evening as [ADR-186](../architecture-decision-records/adr-186-flatten-fans-out-a-record-keyed-by-name.md).
The wiggle port's own state is in [grammar-next-steps](grammar-next-steps.md).
An Opus inventory the same day read `plugins/maf/src` against
`plugins/marks/src/LinearMarkDisplay`; what follows is its findings with the
file pointers to re-read.

## What is established

- **MAF owns no shader.** `plugins/maf/src/LinearMafRenderer/mafMarks.ts`
  declares five `spanMark` passes (cells, identity heatmap, codon cells, source
  chromosome, summary bars), two `barMark` passes (identity X-Y, conservation)
  and alignments-core's `coverageBandMarks`, all drawn by `createMarkBackend`.
  What is MAF's own is the main-thread packers (`mafChannels.ts`,
  `identity.ts`, `codons.ts`, `summarySpans.ts`, `drawSourceChrom.ts`,
  `conservationBand.ts`), seven Canvas2D overlays under
  `LinearMafDisplay/components/rendering`, the hit tests (`findRowHover.ts`,
  `mafHitTest.ts`) and the row and band geometry in `stateModel.ts`. About
  5,300 non-test lines draw; 6,200 fetch and parse; 3,700 are model, config
  and menus.
- **The config already speaks the mark vocabulary**: `color` is `mismatch |
  base | identity | chromosome | codon` and the X-Y plot is `y: "identity"`
  (`website/docs/user_guides/maf_track.md`); `rows`, `rowColor`, the
  tree-sidebar slots, the legend and `fetchSizeLimit` are the same schemas the
  mark display composes.
- **The mark display attaches to a MafTrack** since ADR-186. A `MafFeature`
  is **one feature per alignment block** with an `alignments` record per
  species (`plugins/maf/src/MafFeature.ts`, `types.ts`), and `flatten` over it
  with `key: "species"` answers a row per species on the block's reference
  span, carrying `chr`, `srcStart`, `strand`, `srcSize` and `seq`; no
  `identity` field yet. The `marks_maf` track in
  `test_data/volvox/config_marks.json` and the `mark-maf-species-rows` scene
  are the working example. The summary sub-adapter's file is already one
  record per species per block (`util/loadMafSummaryAdapter.ts`).
- A reorder re-places and re-encodes every loaded region
  (`stateModel.ts` `placeMafRegionData` memo); the row table (ADR-165) is what
  the mark display would bring instead.

## What the mark display must gain, ranked

1. ~~A way onto a MafTrack, with one feature per species per block.~~ Landed,
   ADR-186. One cost to watch: a species row's hover JSON is its block's, so
   it carries every species' sequence (`FlattenedFeature.toJSON` merges the
   container's).
2. A per-base cell step with the reference comparison (match, gap, base),
   run-merged and sub-pixel sampled as `binning.ts` and `rowFlank.ts` do; a
   per-base `match` field then gives the identity heatmap and X-Y plot through
   `bin` and `aggregate mean`. `bin: auto`'s 1-2-5 ladder differs from MAF's
   power-of-two `binBp`.
3. Per-display row geometry: a fixed px `rowHeight` with virtual scroll,
   `rowProportion`, and per-mark `minWidthPx`/`seamPx`, which `spanMark`
   already takes and `markList.ts` hardwires.
4. A row set, guide tree and reference row declared by the adapter
   (`samples`, `nhLocation`, `samplesTsv`, the worker's `refSampleId`).
5. A band stack with its own axes above the rows, for coverage and
   conservation.
6. A coarse tier serving per-row records from `summaryAdapter`, where
   `DensityTierMixin` serves one row of bins from `densityAdapter`.
7. Per-base `text` gated by row height and coloured against its cell.
8. Interbase and texture glyphs: insertion markers, the inversion hatch,
   e-line double lines.
9. A second-adapter join for the frames (codon cells, letters, conservation,
   the CDS strip).
10. Cross-region derived fields: the source-chromosome rank per row, the
    inversion consensus strand.
11. SNP and interbase coverage in the band.

## What ports today with no new mark

1. The summary presence bars as a FeatureTrack over the summary file:
   `rows: "src"` and a `span` with a colour scale over `score`. A separate
   track, not the in-display zoom swap.
2. The CDS frame strip as a FeatureTrack over the `mafFrames` bigBed.
3. The row-model config as-is.
4. The identity-yields-at-base-level switch as a `minBpPerPx`/`maxBpPerPx`
   pair, once item 2 above exists.

## Stale comments met on the way

`components/mafHitTest.ts` names `maf.slang` and `drawMafBlocks`, neither of
which exists; `trackMenuItems.ts` says both write `layout`, which `rows`
replaced.
