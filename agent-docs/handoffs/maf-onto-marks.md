---
name: maf-onto-marks
description: Colin's 2026-09-28 ask to draw the MAF display through the mark display, opened the day the wiggle port's first three landings went in. An inventory that day found MAF already draws every GPU layer through render-core's span, bar and coverage marks and owns no shader, so the port is the data path, the row geometry, the band stack and the overlays. Items 1, 2 and 4 landed the same day - ADR-186's flatten over a record puts a row per species on the mark display, ADR-187's cells step turns each row into its runs against the reference with each insertion an interbase feature, ADR-189's adapter listing gives the rows the tree's order and the guide tree - then item 3's pinned, scrolling row height. A bench that evening found the Feature steps taking 8 s where the MAF display takes 0.7 at 470 species (ADR-190); ADR-191 moved the whole mark pipeline onto tables the same night, ADR-192 took the hit index off a span and ADR-193 made the MAF worker's arena the rows, so the rest of the list is open again. ADR-199 keeps the MAF display its own display type: the two paths share a parser, an arena and an identity walk where they compute the same thing, and the list below is what the mark display lacks, built when a track needs it.
---

# The MAF display onto the mark display

Colin, 2026-09-28, after the span gained its colour scale: "we can try to make
maf leverage the new wiggle display marks". The first two items below landed that
evening as [ADR-186](../architecture-decision-records/adr-186-flatten-fans-out-a-record-keyed-by-name.md)
and [ADR-187](../architecture-decision-records/adr-187-a-cells-step-reads-a-row-against-the-block-it-came-from.md).
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

## Measured before going further

`plugins/maf/benches/mafOnMarks.bench.ts` ran the `marks_maf_cells`
declaration against the MAF display's own path over the same fetched blocks.
Over `Feature` objects it is too slow to replace anything, and a declared
identity through `bin` and `aggregate mean` answers the wrong mean;
[ADR-190](../architecture-decision-records/adr-190-the-maf-display-stays-off-the-feature-steps.md)
records it. A bench-only spike running the same steps over typed lanes, with a
row lookup in place of the hit index, lands at about the MAF display's speed
and draws an exact identity, and
[ADR-191](../architecture-decision-records/adr-191-the-mark-pipeline-runs-over-tables.md)
built the tables into the pipeline itself. [ADR-192](../architecture-decision-records/adr-192-a-span-answers-a-hover-by-its-row.md)
then took the hit index off a span, which over a 470-species region cost more
than the rest of the request, and
[ADR-193](../architecture-decision-records/adr-193-an-adapter-answers-the-mark-pipeline-its-typed-arrays.md)
has the MAF adapters answer the MAF worker's arena as the rows and the encoder
fill a lane at a time. The `marks_maf_cells` span now runs at
1.26x<!--m:typed-sources-maf-display.470-species-200-blocks-of-250-columns.typedVsMaf-->
the MAF display's path at 470 species. Items 5 to 11 are open again.
[ADR-195](../architecture-decision-records/adr-195-a-maf-adapter-parses-its-blocks-into-the-packer.md)
then had MAF-tabix and bigMaf parse straight into the packer, which takes the
span over narrow MAF-tabix blocks to
0.78x<!--m:maf-parse-into-packer.26-species-20000-blocks-of-8-columns-maftabixadapter.typedDirectVsFeatures-->
of its time and leaves wide blocks and 470 species level.

One lever is left on the data path, measured:

- **The `cells` walk** is 133 ms of the 220 ms request on ada, a byte kernel
  the MAF display's `buildMafChannels` also pays. A `cells` that bins as it
  walks, where a `bin` follows it, is the obvious fusion for the identity,
  which makes runs and then bins them where `buildIdentityRuns` counts matches
  in one walk. The declared identity, the bin and aggregate already one
  kernel (ADR-197), takes
  468.9ms<!--m:interval-bin-maf-identity.470-species-200-blocks-of-250-columns.typedIdentityMs-->
  against the MAF display's
  182.6ms<!--m:interval-bin-maf-identity.470-species-200-blocks-of-250-columns.mafIdentityMs-->.

## Where it is going

[ADR-199](../architecture-decision-records/adr-199-the-maf-display-stays-its-own-and-shares-the-grammars-kernels.md):
the MAF display stays the MafTrack's display type, and the two paths share
one implementation wherever they compute the same thing — the parser, one
per format since ADR-195's amendment, the packed arena, and the identity walk
(the lever above). The list below
is what the mark display lacks against the MAF display, built when a declared
track needs it rather than to retire the MAF display.

## What the mark display lacks against the MAF display

1. ~~A way onto a MafTrack, with one feature per species per block.~~ Landed,
   ADR-186. A species row's hover JSON is its block's minus the fanned-out
   `alignments`, so it carries its own sequence and no sibling's.
2. ~~A per-base cell step with the reference comparison.~~ Landed, ADR-187:
   `cells` writes `state`, `base` and `match` per run, walking every column.
   The identity heatmap and X-Y plot are declarable since ADR-197: `bin`
   over `fields: ['start', 'end']` cuts each run at the bin edges and an
   `aggregate` `mean` of `match` weighted by `overlap` is exact against a
   count off the text, fused into one kernel (the `marks_maf_identity`
   track). `bin` by `field` still counts starts, as the density sidecar
   does. Still open: sub-pixel sampling (`binBp`) and the cross-block flank
   (`rowFlank.ts`), the two things the MAF painters do that the steps do
   not; `bin: auto`'s 1-2-5 ladder differs from MAF's power-of-two `binBp`;
   and the time, which is the `cells` walk's (the lever below).
3. ~~Per-display row geometry: a fixed px `rowHeight` with virtual scroll,
   and `rowProportion`.~~ Landed: the mark display composes `RowHeightMixin`,
   pins a row under `rows` and fits it elsewhere, and scrolls the rows past
   the plot, the span through its `scrollTop` and the value shapes through
   `rowOffsetPx`; the `marks_maf_cells_pinned` track and the
   `mark-maf-rows-pinned` scene show it. `rowProportion` is each span's
   own since ADR-194. Still open: per-mark
   `minWidthPx`/`seamPx`, which `spanMark` takes and `markList.ts` still
   hardwires to the display's one `minWidthPx` and a seam of 0.
4. ~~A row set and guide tree declared by the adapter.~~ Landed, ADR-189:
   `listRowSources` on the adapter, the mark display taking it through the
   flatten's key, the guide tree through the mixin. The reference row is a
   species row like any other, so hiding it is a `filter` step or the rows'
   `kept` focus, and the worker's `refSampleId` needs no counterpart.
5. A band stack with its own axes above the rows, for coverage and
   conservation.
6. A coarse tier serving per-row records from `summaryAdapter`, where
   `DensityTierMixin` serves one row of bins from `densityAdapter`.
7. Per-base `text` gated by row height and coloured against its cell.
8. Interbase and texture glyphs: the MAF insertion marker, whose width
   grows with the length and which carries a count label (`cells` emits each
   insertion as an interbase feature a span paints as a `minWidthPx`
   sliver), the inversion hatch, e-line double lines.
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
