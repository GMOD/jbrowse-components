---
name: mark-display-audit
description: "A read-only audit of LinearMarkDisplay (plugins/marks, the worker encoder, Edit plot, hover, legend, export) on 2026-11-21: one unmeasured interval-bin cost, hover and menu findings not yet rechecked, and the simplifications the readers named."
---

# Mark display audit

A read-only pass over `plugins/marks/src/LinearMarkDisplay`, the worker side in
`packages/core/src/util` (`markEncoding.ts`, `featureTransforms.ts`,
`stepTables.ts`) and the hover, legend and export path. Nothing was changed and
no test was run. Three Opus readers took a slice each; the main session read
`model.ts`, `markConfigViews.ts`, `markResolveViews.ts`, `markRequest.ts`,
`markList.ts` and the default-plot scan, and found those sound.

Each item says how far it was checked. "Checked" means the main session read
the cited code after the reader reported it. "Reader only" means one reader
traced it and nobody reread it; reread before fixing.

## Needs a measurement before anything is built

- **An interval `bin` cuts a feature at every bin along its whole length.**
  `stepTables.ts` `intervalsOf` walks `last` up to the feature's end with no
  clamp, and `layerFeatures.ts` hands `layerTables` no region. Checked: the
  code has no clamp.
  - The reader's case: `{ type: 'bin', step: 'auto', fields: ['start', 'end'] }`
    then a `count`, at 1 bp/px inside a 2.2 Mb gene, makes about 440,000 pieces
    for one feature, nearly all off screen. That count is arithmetic, not a
    measurement.
  - ADR-197 already declines a warning for a fine auto step, on the reasoning
    that a row makes its on-screen width over four pixels plus one piece. That
    holds only for a row that ends on screen. Measure the case above before
    reopening it; the fix the reader names is clamping `first` and `last` to
    the fetched region's bins, which `binnedFetchRegions` already aligns.

## Reader only: hover, legend and menus

- **A link's `strokeWidth` field shows in neither the tooltip nor a key.**
  `findMarkHit.ts` `MarkHitInfo` carries no size, `MarkTooltip.tsx`
  `markTooltipRows` lists y, color, shape and row. Trigger: the BEDPE loops
  config in `website/docs/user_guides/hic_track.md`. A tooltip row is small; a
  width key is a feature, not a defect.
- **A point or rect sharing the flatten root with a cross-sequence link
  still hovers a span mixing the two sequences.** `featureInstances.ts`
  `featureSpan` takes min and max over every instance of the root, the
  link's far `x2` included. The link's own hit reads its two feet
  (`findMarkHit.ts`); the other marks of that feature do not.
- **"Sort rows by value here" is offered when no mark compares.**
  `markMenus.ts`; `rowCompare` is undefined when only a link draws, and the
  neighbouring Cluster rows item is already disabled in that state.

## Simplifications

Ranked by how much each removes. None was prototyped.

- **One problems entry for both editors.** The form and the text box reach
  `markProblems` by different routes; the first defect is that split. One model
  method returning `MarkProblem[]` over a lifted draft, context included.
- **The facet-or-rows split is derived twice.** `markProblems.ts` (`bandsRows`,
  `faceted`, `drawsRows`, `split`) repeats `markConfigViews.ts` (`bandsRows`,
  `facet`, `drawsRows`, `splitField`). One pure function over
  `{ facetField, rowsField, rowAttributes }`.
- **Two chunked scans.** `keyOnScreen.ts` and `drawnScales.ts` differ only in
  which instances count; one scan taking a kept test.
- **Two hand lists of lanes.** `facet.ts` `emptyLayer` omits `root` and
  `keptInstances.ts` omits `x2Region`; a `mapLanes` over core's `LaneName`.
- **`setRpcData` is a test seam in the production model.** `model.ts`; its only
  callers are the marks and GWAS tests, and it stores a request without the
  `bpPerPx` and resolved `opts` that `fetchNeeded` stores, so the
  feature-details tests exercise a request production never sends.
- **A written `gapBp` rides the request and comes back unchanged**
  (`markRequest.ts` `pathOf`, `pathSeries.ts`), so editing it refetches.
- Smaller: the px channels listed in four places (`markProblems.ts`,
  `markEdit.ts`, `markSpecs.ts`); `'subfeature'` in `plotEdit.ts` against
  `DEFAULT_FLATTEN_FIELD` `'subfeatures'`; `stepsOf` repeating the ops mapping
  for `aggregate` and `window`; dead `x` and `x2` branches in `markProblems.ts`
  `atDefault`; the `MARK_SPECS` docstring naming `layerRequests` in `model.ts`,
  which moved to `markConfigViews.ts`.

## Read and left alone

- Stale layers drawn through a changed mark list are ADR-006's scrim, and
  `hasLanes` plus the stored `request` keep the draw and the details click
  consistent with the payload held.
- `RowKeys` growing only is ADR-165.
- The request key, absolute uint32 output, hit tests against drawn geometry,
  the legend's tables and SVG export were traced by the readers and found in
  agreement.

## Not covered

render-core shape internals beyond `barMark`, `lineMark` and `rowSpanIndex`;
`cellsStep.ts`; core's `colorProblems` and `scaleEndProblems`;
`MarkClusterDialog`'s matrix arguments; `LinearManhattanDisplay`.
