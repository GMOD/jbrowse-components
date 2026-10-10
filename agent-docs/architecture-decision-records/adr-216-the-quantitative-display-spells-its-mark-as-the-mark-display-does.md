---
status: Accepted
summary: "The quantitative display's one mark is spelt as the mark display spells one: `mark` is `bar`, `point`, `line` or `span` (`heatmap` was a span under its own name), `y` names the field plotted (`scoreField`), one `size` is a point's diameter or a line's width (`lineWidth` folded in, unset drawing each mark's own default), and `summaryScoreMode`'s `avg` is `mean`, the aggregate's word. `mark`, `interpolate`, `size` and `origin` join the plot vocabulary, so Edit plot and the agent API can change a quantitative plot's type. v4 `lineWidth` and `avg` lift; `scoreField` and `heatmap` were beta spellings and get none"
---

# ADR-216: The quantitative display spells its mark as the mark display does

## Status

Accepted (2026-10-07). Settles call 3 of the 2026-10-07 grammar audit. Amends
[ADR-174](adr-174-the-quantitative-display-spells-its-rendering-as-a-mark.md)'s
`heatmap`. Amended 2026-10-10: `summaryScoreMode` is `aggregate`, joins
`PLOT_VOCABULARY`, and lifts with its `avg` through the display's `retired`
spellings (`LinearWiggleDisplay/retired.ts`) instead of `preProcessSnapshot`,
which also reaches the slot inside a v4 `renderers` block. The menu label stays
"Summary score mode". The slot picks a summary the source stored per zoom bin
rather than computing one, which is what the mark display spells as
`y: 'maxScore'` (ADR-123); the name stays because the drawing is that
aggregate's, run ahead of time, and a top-level slot cannot meet the mark
display's `aggregate` transform step. `summary` was the rename considered.

## Context

ADR-174 gave the quantitative display `mark` and `interpolate` "in the mark
display's and Vega-Lite's words", and three of its words were still its own.
`heatmap` named what the mark display draws as a `span` under a color scale
(ADR-113's amendment), so `marks: [{ mark: 'heatmap' }]` was refused where
`mark: 'heatmap'` loaded. `scoreField` named what every mark spells
`encoding.y`, and ADR-178 had already removed it from Manhattan for that
reason. `size` was a point's diameter and `lineWidth` a line's width, where a
mark has one `encoding.size` read by whichever mark draws. `summaryScoreMode`
offered `avg` where every aggregate says `mean`. And none of `mark`,
`interpolate`, `size` or `origin` was in the plot vocabulary, so the most-used
quantitative display's plot type could not be changed through Edit plot or the
agent's `plot`, though the Plot type menu wrote it.

## Decision

- **`mark` is `bar`, `point`, `line` or `span`.** `renderingOf` draws a `span`
  as the density strip, and `markOf` reads v4's `density` as one. No lift for
  `heatmap`: it shipped in v5 betas alone, and the in-tree configs, specs and
  guides move by hand.
- **`y` is the field plotted**, a `featureField` defaulting to `score`, in
  the plot vocabulary already for MAF's X-Y plot; the slot table is
  `yFieldConfigSchemaFields`. No lift for `scoreField`, a v5 spelling.
- **`size` is one `maybeNumber`**: a point's diameter and a line's width, unset
  drawing 2 px and 1 px. v4's `lineWidth` lifts into it. The point-size and
  line-width menus both write it and reset to unset.
- **`summaryScoreMode`'s `avg` is `mean`**, the enum's and the code's word; a
  v4 config's `avg` lifts in the schema's `preProcessSnapshot`. The menu label
  stays "Average".
- **`mark`, `interpolate`, `size` and `origin` join `PLOT_VOCABULARY`**, each
  with its line.

## Consequences

- Edit plot on a quantitative track shows and takes `mark`, `interpolate`,
  `y`, `size`, `origin` beside `rows`, `rowColor`, `color` and `scales`; the
  mark display's plot gains `origin`, which it declared already.
- `WiggleScoreConfigMixin` no longer carries `size`; the quantitative display
  reads it beside `lineWidth`, both off the one slot.
- A v4 config with `lineWidth: 3` draws its points 3 px wide too once
  switched to points, since the mark has one size.
- The internal rendering names (`xyplot`, `density`, `scatter`) stay, as
  ADR-174 kept them.

## Rejected alternatives

- **Moving the wiggle display onto `marks[]`** is the parked
  `ideas/ready/wiggle-onto-bar-and-point.md`, and "not now" on 2026-09-30.
  This ADR converges the spelling, not the renderer.
- **A separate `lineWidth` beside `size`.** Two sizes for one mark, where
  the mark display reads one.
