---
name: multi-row-is-the-mark-display-with-a-default-plot
description: LinearMultiRowFeatureDisplay draws colored features in rows, which is a `rect` mark with `rows` and a color. Rebuild it as the mark display with a default plot, as ADR-178 rebuilt Manhattan, and delete its own worker, encoder, model and component. Benched on the Roadmap ChromHMM painting, the mark worker runs in about half the multi-row worker's time and sends a quarter of its bytes. Three gaps on the mark display remain, the last drawing a facet section as a band of rows; a feature's own color (ADR-243) and clustering span rows (ADR-244) are done. Read before touching either display's rows, row colors, clustering or legend hides.
---

# Multi-row is the mark display with a default plot

Colin agreed the direction on 2026-10-24. The multi-row display never shipped
in a release, so no user config or session needs a lift.

## The proposal

- **Keep the type name, replace the engine.** `LinearMultiRowFeatureDisplay`
  stays a display type, as ADR-178 kept `LinearManhattanDisplay`: its schema
  takes `LinearMarkDisplay`'s as its base with `marks` defaulting to one `rect`,
  and its model composes the mark model. The Display types entry "Multi-row
  feature display (painting)", the two add-track routes that write it
  (`plugins/wiggle/src/MultiWiggleAddTrackWorkflow/util.ts`), every config,
  tutorial and build script keep their spelling.
- **Delete** `MultiRowGetFeaturesRPC`, `MultiRowClusterFeaturesRPC` once
  clustering moves, and the display's model, channel encoder
  (`rendering/multiRowChannels.ts`, `multiRowMarks.ts`), hit testing, tooltip,
  component and SVG export: about 4,300 source lines and 8,400 test lines in
  `plugins/canvas/src`.
- **Why:** GRAMMAR_OF_GRAPHICS.md rule 2 admits a mark-display subtype when its
  whole picture is a plot, and multi-row's is. Of the 134 commits touching the
  display in the month to 2026-10-24, about 90 repeated a cross-cutting pass
  (channel spelling, row color names, facet writes, sort, legend) on a second
  engine.
- **A bare `LinearMarkDisplay` draws the wrong picture.** With no `marks`,
  `defaultPlot` (`plugins/marks/src/LinearMarkDisplay/plotDefault.ts`) plots
  bars of `score` for any BED with a score column, and the base fetch limit is
  1 MB (`packages/display-kit/src/regionTooLargeConfigSchemaFields.ts`) where
  multi-row sets 5 MB. The subtype sets both.

## Speed

`plugins/canvas/benches/multiRowOnMarks.bench.ts` times each RPC executor's
work over the same fetched features, structured clone of the result included:
`dedupeFeaturesById` and `packMultiRowFeatures` against `layerTables` split on
the rows field and `encodeFeatures` for a `rect`. Every arm's
(start, end, row, color) tuples equal the multi-row arm's before any timing.

| Fixture | Features | Rows | Color | multi-row | marks-jexl | marks-key | Wire B/feature, multi-row → marks |
| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| Roadmap ChromHMM, chr7:25-30 Mb | 114,646 | 127 | file's own | 164.5 ms | 0.66x | 0.46x | 67.4 → 16.1 |
| Roadmap ChromHMM, chr7:25-30 Mb | 114,646 | 127 | `name` | 183.3 ms | | 0.44x | 71.7 → 16.1 |
| Roadmap ChromHMM, chr7:10-35 Mb | 409,797 | 127 | file's own | 588.9 ms | 0.65x | 0.46x | 66.8 → 16.0 |
| Roadmap ChromHMM, chr7:10-35 Mb | 409,797 | 127 | `name` | 640.4 ms | | 0.42x | 70.9 → 16.0 |
| BXD painting, chr1 | 1,196 | 198 | file's own | 2.6 ms | 0.64x | 0.50x | 69.7 → 23.4 |
| BXD painting, chr1 | 1,196 | 198 | `name` | 3.0 ms | | 0.42x | 86.1 → 23.4 |

Laptop on AC at load 5-8, 2026-10-24, MIN of 7-15 interleaved rounds, controls
at 1.00-1.04x; rerun on ada before quoting the times anywhere else.

- The multi-row worker also sends each feature's name and ID as strings, a
  sample of field names, row-field candidate values and legend candidates,
  which is most of its bytes. The mark display builds its key from the color
  table it already sends, and the tooltip's name (gap list, below) can come
  from a lookup per hover.
- `marks-jexl` paints each feature its file's color through
  `jexl:'rgb(' + feature.itemRgb + ')'`, the only spelling the mark display has
  today.
- `marks-key` reads the color column as an ordinal key, the worker half of a
  native identity scale; the main thread then parses each distinct color once.
- `marks-identity` is the shipped spelling, `{ scale: 'identity' }`
  (ADR-243): 0.45x on Roadmap chr7:25-30 Mb and 0.46x on BXD, 2026-10-25,
  its colors equal to multi-row's.
- **Not timed:** the main thread's work per arriving region
  (`buildMultiRowChannels` against the mark display's color paint and row-table
  remap) and the paint. ADR-165 already has both displays reorder, focus and
  recolor rows through one row table.

## A facet section is a band

Colin's call, 2026-10-25, the recommendation below.

- **Multi-row:** `facet: 'group'` stacks bands of rows by a row attribute,
  `group`, which `rowGroups` tags by matching row names (ADR-169), through
  `TreeSidebarMixin`'s `bandedSources`.
- **Mark display:** `facet: { field }` splits the features in the worker into
  sections, each running the layer's steps. With `rows` beside it, `drawsRows`
  is false (`plugins/marks/src/LinearMarkDisplay/model.ts:587-589`) and the
  `rows` slot's doc says bands of rows are "not drawn yet"
  (`configSchema.ts:441-448`).
- **Decided:** one meaning, a facet section is a band. A facet on a
  feature field splits in the worker as today; a facet on a row attribute
  (`group`, a samples-TSV column) bands the rows on the main thread from the
  rows' attributes, as `bandedSources` does now; `rows` inside either draws
  rows within each band. That draws the case the `rows` doc calls not drawn
  yet, with no new word.

## Gaps on the mark display

Each gap is its own change, in this order. Put row-axis work in
`packages/tree-sidebar`, beside the variant, MAF and wiggle displays that
share it, not in `LinearMarkDisplay/model.ts` (2,076 lines).

1. **Hiding a legend category** from paint and hit test. Multi-row re-encodes
   the region on a toggle (ADR-165), which costs nothing while nothing is
   hidden; a per-instance mask in the span shader would cost every span config.
   An identity key row matches its `domain` color to the met keys by packed
   color, since a key is `r,g,b` and a `domain` entry any CSS spelling.
2. **Row discovery and the menus.** The automatic rows field (`repClass`, else
   `name`: `rowsFields.ts`), "One row per..." with row counts, Color by and
   Group by, and rows read from the window rather than the fetch buffer
   (`windowedRegion.ts`; the mark display's `discoveredRows`, `model.ts:692`,
   reads every loaded region). Color by's itemRgb preset writes
   `{ scale: { type: 'identity' } }`; Edit plot's scale picker leaves identity
   out (ADR-243).
3. **Bands of rows**, as decided above, with `rowGroups` (the mark
   display's `rowColorFields` is `[]`, `model.ts:605-607`).

Small, any time: an identity key with no `domain` (multi-row names each
color by its features' names; the mark display keys nothing), the feature
name in the tooltip, Copy location, `axis.grid`
row separators (`packages/tree-sidebar/src/rowAxisConfigSchema.ts`), strand
preset colors, `rowColor` painting the blocks when no color is set
(`rowColorPaintsMarks`), and feature details, which rerun the region's steps
per click (`packages/core/src/rpc/methods/CoreGetEncodedFeature.ts:29-33`).

## Then the swap

- The subtype's schema and model, the 5 MB limit, the plot examples.
- Delete the engine, `MultiRowClusterFeaturesRPC` with it, whose matrix
  already reads tree-sidebar's `coverSpan` (ADR-244). An ADR records the
  retirement and supersedes the multi-row halves of ADR-165 and ADR-169.
- Reshoot the multi-row figures (`website/scripts/figure-manifest.json`,
  `specs/cookbook.ts`, `specs/ui.ts`) and check the tutorials that show it
  (`git grep -l LinearMultiRowFeatureDisplay -- website/docs`).
- The user guide `website/docs/user_guides/multirow_feature_track.md` keeps
  its subject and gains Edit plot.
