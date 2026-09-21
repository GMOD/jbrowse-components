---
status: Accepted
summary: "The `bar` and `point` shapes take the `row` lane the `span` shape already had: an instance stands in the band of its row, `rowHeight` px each, the shared value scale ruling every band on its own, and a rowless caller is row 0 over the whole canvas with no new branch. `facet: 'source'` over `MultiWiggleAdapter` is then the multi-row xyplot as a `marks` config, `MultiQuantitativeTrack` joins the mark display's track types, and the axis chrome rules each band through `bandTops`, the member the multi-wiggle display already fills"
---

# ADR-126: A `row` lane on `bar` and `point`

## Status

Accepted (2026-09-16). Step 2 of the 2026-09-16 grammar handoff, after
[ADR-125](adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md) and
the measurement under `reference/MARK_ENCODING.md` §"The mark display over a
BigWig, measured" cleared the path.

## Context

The mark layer had three shapes, and only `span` read the `row` lane: a
pileup stacks, a bar or a point plots on one shared scale over the whole plot
box. A multi-BigWig is the one common track whose rows are a field —
`MultiWiggleAdapter` stamps `source` on every feature — and the multi-wiggle
display draws it as one xyplot per source, stacked edge to edge, the value
scale ruled per row. Declaring that picture as a `marks` config needed a
facet that bands a value shape, which is a `row` on `bar` and `point`.

Two things could have killed it. The bar shader maps `y` through one uniform
domain over the canvas height; a per-row transform that moved that mapping
onto the instance would have cost the shared-scale path. And a band per row
needs an axis per band, which the mark display's chrome drew once.

## Decision

**The band is the instance's row and the scale stays a uniform.** Both
shaders gain `uint row` on the instance record and `float rowHeight` in the
uniforms, and place the value as `rowHeight * row + valueToYPxScaled(y, …,
rowHeight)`. A caller with one row sends the canvas height, so row 0 over
`rowHeight = canvasHeight` is the arithmetic every bar and point drew with
before; there is no branch and no second path. The record grows by one word
(bar 16 to 20 bytes, point 20 to 24). `RowChannel` and `RowParams`
(`render-core/marks/rowLane.ts`) are the two shapes' shared spelling, `row`
and `rowHeight` both optional, and the pack fills zeros where a caller sends
no rows, which is how Manhattan and every hand-built channel set stay as they
are.

**The mark display bands its value marks the way it bands spans.**
`SHAPE_SPECS` names `row` for `bar` and `point`, so the worker fills it: the
facet's row for a faceted layer, zeros otherwise. `rowCount` was already the
facet's row count or the highest row any layer carries plus one, and
`markRowHeightPx(canvasHeight, rowCount)` is the band every shape gets.

**The axis rules each band.** `valueScales` answers `height: rowHeight`,
`offset` the glyph inset alone, and `bandTops` one per row where `rowCount`
is above one, the members `ChromeYAxis` already reads for the multi-wiggle
rows; with one row it answers the plot box it always did. The facet chips
label the bands as they label a pileup's.

**`MultiQuantitativeTrack` joins the display's track types**, and a display
opened on it with nothing declared plots bars of `score` faceted by `source`
where the features carry more than one source (`scanPlotFields`), which is
the multi-row xyplot a user picking the display from the menu expects.

## Consequences

- `{ shape: 'bar', facet: 'source', encoding: { y: 'score' } }` over a
  `MultiWiggleAdapter` is the multi-row xyplot; `point` gives the same rows as
  a scatter. `mark-display.ts` carries the scene, and no golden: the Mark
  Display suite has none in `snapshots.lock`, where the wiggle suite's
  `bigwig-multibigwig-multirowxy` has six, and CI runs `--gate-only`, so a
  golden is never read. What stands behind the scene is the cross-backend
  differential, which names the suite in `CI_GATE_SUITES`.
- A `row` a config declares in `encoding` on a bar or a point bands it too,
  with no facet: a `pileup` step's output, or any integer field.
- `rowLane.test.ts` pins the band arithmetic and the rowless identity;
  `markList.test.ts` pins the uniform and the packed row; `model.test.ts`
  pins the banded axis and the single-row axis staying as it was.
  `drawAgainstHit.test.ts` sweeps both shapes with rows, but it holds `ink()`
  to `hitNearest()` and both read `bandTopPx`, so it catches a painter the hit
  test disagrees with rather than a band in the wrong place.
  `MarkDisplayMultiWiggleRows.test.tsx` runs config to drawn band over a real
  adapter, and is the only thing tying `valueScales`' band to the
  `renderState.canvasHeight` the shapes draw on.
- **The shader's band is a second spelling.** `barMark.slang` and
  `pointMark.slang` place `rowHeight * row` themselves, `rowLane.ts`'s
  `bandTopPx` places it again, and no jest test runs a vertex shader — the
  `//! js-export` oracle strips entry points before it builds its twin — so
  the cross-backend gate is the only thing that would see the two disagree.
  The scale half of the same arithmetic is already one source, `barMark.ts`
  importing `valueToYPxScaled` from the generated twin, so lifting `bandTop`
  beside it is what closes the seam. Measure it first: `bandTopPx` runs per
  instance in `paintBlock`.
- The per-row axis draws only where a band clears `COMPACT_AXIS_HEIGHT`, as
  the multi-wiggle display's does; a track of forty sources at the default
  height shows the bands and the chips and no ticks.

## Rejected alternatives

- **A per-instance domain**, so each row could autoscale on its own. That is
  the transform that costs the shared-scale uniform path, and the multi-wiggle
  display shares one domain across its rows too; a row wanting its own scale
  is a second mark on `resolve: 'independent'`.
- **A `band` on `defineMark` per facet section**, the clip a stacked display
  declares. A band is a clip and not an offset (`render-core/CLAUDE.md`), so
  the shape would still have placed `y` against the whole canvas, and one mark
  cannot declare a band per instance.
- **Rows on `span` only, with `bar` reading `row` through a second shape.**
  A fourth shape duplicating the bar's geometry for one lane, against
  ADR-040's two-consumer rule for a shared module and its own weight in the
  shader tree.
