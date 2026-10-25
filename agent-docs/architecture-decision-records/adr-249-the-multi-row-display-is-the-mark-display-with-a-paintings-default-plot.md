---
status: Accepted
summary: "`LinearMultiRowFeatureDisplay` keeps its name and becomes a mark display subtype in `plugins/marks`, as ADR-178 rebuilt Manhattan: its schema takes `LinearMarkDisplay`'s with a 5 MB fetch limit, and its model composes the mark model and `ColorWritesMixin`. With nothing declared, the mark display's one-time field scan picks the plot through an overridable `defaultPlotOf`: a row per adapter source, else per `repClass`, else per `name`; a `rect` per feature, or a 0-height `rect` over each span under a `rect` over a keepEmpty `flatten` where the features are spliced; and an identity `encoding.color` where the file states BED colors. One row per..., Group by and Color by offer the scanned attributes. The mark display gains what the painting needed: rows listed from the window, a row's color painting marks that name none, `axis.grid` separators, Copy location, rows comparing on the span drawn on top, and an identity scale reading a field's CSS colors. Deletes the display's own worker, encoder, hit testing, component, SVG export and clustering RPC, about 13,900 lines. Amends ADR-165 and ADR-169"
---

# ADR-249: The multi-row display is the mark display with a painting's default plot

## Status

Accepted (2026-10-25), Colin's "go for it" on
`ideas/ready/multi-row-is-the-mark-display-with-a-default-plot.md`, which this
retires. Amends ADR-165 and ADR-169: the mark display now drives the row table
and the bands on the painting's behalf.

## Context

The multi-row display drew colored features in rows, which is a `rect` mark
with `rows` and a color (GRAMMAR_OF_GRAPHICS.md rule 2). Of the 134 commits
touching it in the month to 2026-10-24, about 90 repeated a cross-cutting pass
(channel spelling, row colors, facet writes, sort, legend) on a second engine.

`plugins/canvas/benches/multiRowOnMarks.bench.ts`, deleted with the engine,
timed each RPC executor's work over the same fetched features on a laptop on
AC, 2026-10-24 and 2026-10-25:

| Fixture | Features | multi-row | one `rect`, identity color | spliced pair | Wire B/feature, multi-row → rect → pair |
| --- | ---: | ---: | ---: | ---: | --- |
| Roadmap ChromHMM, chr7:25-30 Mb | 114,646 | 148.0 ms | 0.43x | 0.84x | 67.4 → 16.1 → 32.1 |
| BXD painting, chr1 | 1,196 | 2.3 ms | 0.46x | 0.58x | 69.7 → 23.4 → 39.6 |

## Decision

- **Keep the type name, replace the engine.** The display type, its "Display
  types" entry and every config's spelling stay; the subtype lives in
  `plugins/marks/src/LinearMultiRowFeatureDisplay/`.
- **The scan picks the plot.** The mark display's default plot became a view,
  `defaultPlotOf(fields)`, written once through `applyDefaultPlot` when
  `marks` is empty. The subtype's `multiRowPlot` reads `PlotFields`'
  `attributes`, `spliced` and `bedColored`, which the scan now reports.
- **A spliced feature is two marks**, drawn only where the scan sees blocks:
  the bench's spliced column is what a painting with none would pay. A
  block a `flatten` fans out of a feature's child features hovers and opens as
  the feature, through the `root` lane (`rootRowOf`, commit fe10636be2,
  which named it `owner`).
- **The menus write the display.** One row per... writes `rows.field`, Group
  by `facet`, Color by the display's `encoding.color`, which every mark naming
  no color paints (ADR-248).
- **The rows are the window's.** `discoveredRows` keeps a section only where a
  layer has an instance over a visible block (`sectionsInWindow`).
- **A row's color paints a mark naming none** under a display naming none
  (`withRowColors`), the multi-row display's third color tier.
- **Rows compare on the topmost span**, so a spliced plot sorts and clusters
  on its blocks rather than on the line under them.
- **An identity scale reads its `field`'s CSS colors**, as Vega-Lite's does;
  with no field it paints the BED color as before.

## Consequences

- `rowProportion` and `clusterField` leave the display. A rect's band is its
  `mark.height.band`, and rows compare on what colors the blocks.
- A `jexl:` `value` beside an identity scale no longer names the key; the
  volvox and ARG configs say `scale.type: 'identity'` alone or with a `field`.
- "One row per..." lists the attributes the scan's sample carries, with no row
  counts.
- The tooltip names no feature; the feature name stays on the small-items list.

## Rejected alternatives

- **The spliced pair as the default for every painting.** Twice the bytes and
  nearly twice the worker time on a painting with no blocks (bench above).
- **A `blocks` member on `rect`.** A second way to say what `flatten` says.
- **Resolving the automatic rows field in the worker**, as the old engine did.
  Regions answered independently, so the engine pinned the first answer and
  refetched any region that disagreed; one scan before the first fetch decides
  it once.
