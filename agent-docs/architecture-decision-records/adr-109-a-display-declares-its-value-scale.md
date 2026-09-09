---
status: Accepted
summary: "A display declares the value scales it places its y through — `valueScales` on `ScoreScaleMixin`, each a domain, a scale type, the band it rules and the bands it repeats over — and the axes derive from them: the mixin resolves each to ticks, `DisplayChrome` places an axis per band in its gutter with the cross-hatches, `renderDisplaySvg` does the same in the export, and a scale with no room for an axis is captioned. Every axis in the tree goes through it; no display places one"
---

# ADR-109: A display declares its value scale

## Status

Accepted (2026-09-09). The y-axis counterpart of
[ADR-108](adr-108-a-display-declares-its-colour-scales.md), which made the
legend a guide derived from declared colour scales; this makes the axis a guide
derived from a declared value scale.
[ADR-097](adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)'s split
is untouched: the shader's anchor stays each shape's own, and what is shared
here is a CPU-side reader of the scale, the shape ADR-097 §Consequences names
for one.

## Context

Four displays composed `ScoreScaleMixin` for the axis's config and then each
hand-rolled the axis itself: a `ticks` getter calling `computeYTicks` with the
same five arguments (`wiggleDisplayViews`, gwas, the mark display; the two
newer ones hardcoding `scaleType: 'linear'`), a `YScaleBarOverlay` placed in
the component beside a `CrossHatches`, and a `YScaleBar` placed in
`renderSvg.tsx` at `svgScalebarLeftPx(view)`, with `WiggleFamilySvgFrame`
ruling the export's hatches — nine placement sites for one drawing. The
2026-09-09 grammar review ranked this the highest-leverage move left on the
mark layer: a guide derived from a scale is what the legend became under
ADR-108, and the axis had stayed imperative.

The stacked-band displays were further off still, and in three different
forms: the alignments coverage band placed a left gutter axis or a right one
depending on its group chips, with a 9 px `[min, max]` label under 30 px,
in two hosts on screen and a third in the export; its read cloud placed a
second axis per section with a rotated caption, flipping sides with the arcs;
the multi-wiggle stacked one axis per row past its dendrogram with its own
caption under 70 px; MAF put a gutter on each of its two bands. Six axes,
none of them the chrome's, and the same spine spelled at 45, 50 and the
content edge.

## Decision

- **`ScoreScaleMixin` gains `valueScales`**, an overridable getter hook
  (default `[]`) of `ValueScale`, the type `@jbrowse/display-ui` owns:
  `domain` and `scaleType`; `height`, the band the scale rules, and `offset`,
  the plot box's inset inside it (`axisPlotBox(height, offset)`);
  `minimalTicks` and `symlogConstant`; and, where the chrome needs more than
  one box at one edge:
  - `ticks` — the display's own ladder, for a band whose arithmetic is its
    own: the coverage band's octaves against the shader's box
    (`computeCoverageTicks`), the read cloud's decades against the arc
    geometry (`computeInsertSizeTicks`), MAF's fixed 0–100%. The mixin
    derives one through `computeYTicks` otherwise.
  - `bandTops` — the screen y of each band the scale rules, for a display
    that stacks the same plot: the multi-wiggle's rows, a grouped alignments
    track's coverage band per group, each projected through the display's own
    scroll. One at 0 by default; `[]` for a scale the display maps to colour
    rather than to y.
  - `side` — the edge the axis hugs. Right where the left is spoken for: the
    group label chips, or arcs that spring from the top.
  - `left` — what a panel of the display's own takes at the left edge before
    the gutter starts: the dendrogram.
  - `caption` — a name for the axis, drawn rotated along the gutter's outer
    edge (`TLEN`).

  The mixin resolves them to `axes: YAxis[]` — each scale with its domain and
  ticks resolved — which is what the chrome reads (`isAxisHost`). A display
  whose every ladder is its own answers `axes` directly without the mixin
  (MAF).
- **Placement is the chrome's, for every guide on every scale.**
  `DisplayChromeBase` mounts `ChromeYAxis`, which for each axis and each band
  on screen draws the cross-hatches when `showCrossHatches`, the reader's
  `scoreRuleMarks` over them, and the axis in its gutter over both;
  `renderDisplaySvg` appends `SvgYAxis` inside `SvgChrome` in the same order.
  A scale whose bands are too short for tick labels (`COMPACT_AXIS_HEIGHT`,
  30 px) or that rules no band is captioned `[min, max]` once at the top-right
  (`ScoreDomainCaption`), and the legend starts below the captions.
- **One form for every axis, on screen and in the export.** The axis sits in
  a gutter `AXIS_GUTTER_WIDTH_PX` (50 px) wide with its spine on the gutter's
  inner edge and its numbers growing outward (`AxisGutter`). On screen the
  gutter is inside the plot, at `left` or inside the right edge clear of the
  vertical scrollbar; in an export a left-side axis nothing pushes right sits
  in the export margin — which is the same 50 px — with its spine on the
  content edge, so the numbers land outside the plot. A label never leaves its
  band (`YScaleBar`'s `bandHeight`), which is what the multi-wiggle's
  `insetLabels` used to say for its rows alone.
- **The axis primitives live in `@jbrowse/display-ui`** — `ValueScale`,
  `YAxis`, `YScaleTicks`, `axisPlotBox`, `AxisGutter`, `YScaleBar`,
  `YScaleBarOverlay`, `ScoreDomainCaption`, `CrossHatches`, `ScoreRules`,
  `axisDrawn`, `axisGutterLeft` — because the chrome can reach that package
  and not `wiggle-core`, which depends on the chrome. `wiggle-core` re-exports
  them, so every published name holds.

Migrated, and every one of them lost its placement sites: `LinearWiggleDisplay`
(no scale under density, whose key is the chrome's ramp),
`LinearManhattanDisplay`, `LinearMarkDisplay`, `MultiLinearWiggleDisplay` (one
scale, a band per row, `left` past the dendrogram, no band under density rows
in their own colours so the chrome captions the domain), `LinearAlignmentsDisplay`
(coverage: a band per section, right beside group chips; insert size: a band
per section reserving an arc band, on the side the arcs spring from, captioned
`TLEN`) and `LinearMafDisplay` (coverage and conservation, one band each).

## Consequences

- Deleted: the wiggle-core gutter (`YScaleGutter`, `SvgYScaleGutter`,
  `leftAxisSpineX`, `ONSCREEN_AXIS_LEFT_PX`); the alignments' `InsertSizeAxis`,
  `TlenAxisLabel`, `coverageAxisStyle.ts`, `CoverageScaleBars`, the two
  on-screen axis hosts, `computeInsertSizeTickSections`, `scalebarOverlapLeft`
  and `tickSpanOnScreen`; the multi-wiggle's `MultiWiggleSvgScales` (its row
  labels are `MultiWiggleRowLabels` now, its separators
  `MultiWiggleRowSeparators`), `rowHeightTooSmallForScalebar`, `legendTop` and
  `scoreCaptionReservedPx`; `WiggleFamilySvgFrame`'s `crossHatches` slot and
  `svgScalebarLeftPx` / `svgLegendRightPx`; MAF's two `YScaleGutter` mounts and
  `coverageTicks`.
- Visible moves, each named in its commit: the single-plot displays' on-screen
  numbers move from over the plot (right-oriented at x = 50) to the gutter
  (left-oriented, the spine where it was); the stacked-band axes' spines move
  from x = 45 to the gutter edge at 50; every exported left-side axis sits in
  the margin, where only the wiggle family's did; the multi-wiggle's rows get
  an axis between 30 and 70 px where they were captioned; a grouped coverage
  track's short bands get one caption at the top-right instead of one per
  band, and the caption is `ScoreDomainCaption` (12 px, from the domain, naming
  a log scale) for every scale rather than the alignments' own 9 px label; the
  alignments coverage axis no longer dodges an overlapping track label, as no
  other axis did.
- `ScoreDomainCaption` and `formatScore` moved from the wiggle plugin to
  `display-ui`, which is why `measureLegendText` imports its own leaf rather
  than the `@jbrowse/core/util` barrel — the barrel reaches `add-track-core`,
  and `display-ui`'s import-graph guards refuse to follow it.
- `LegendMixin`'s `legendTop` stays for what a display draws in the corner
  itself (Hi-C's resolution box); the chrome adds its own captions on top.
- `WiggleFamilySvgFrame` no longer reads `ticks` or `showCrossHatches` off the
  model, and has no hatch slot: the shell rules every display's hatches.
- The export shell's children grew by one, which moved the `useId` the
  exported legend minted its gradient id from — a per-process counter that
  already differed between a suite run alone and in a batch. The export now
  passes `svgNodeId` as the prefix (`legend-0-identity-0`), the rule
  `svgId.ts` states for every other export id; one synteny snapshot
  re-recorded on that token and nothing else.

## Rejected alternatives

- **The chrome computing the ticks from the declaration.** `computeYTicks`
  reaches `getScale` — d3 and the symlog resolution — which is `wiggle-core`'s,
  and the chrome cannot depend on it. The mixin, which lives there, derives the
  ticks; the chrome draws what it derived.
- **Leaving the hatches and rules with the displays.** The rules sit over the
  hatches and under the axis, and a chrome drawing only the axis and hatches
  after the display's rules inverted that; the three are one guide set on one
  scale and move together.
- **A `box` member — the band's inset — in place of `height`/`offset`.** The
  first move this ADR named for the coverage band, and it turned out not to be
  one: `coverageLayout` is `axisPlotBox` generated from the shader, so the
  band's inset is the inset every other scale has. What the coverage axis
  needed was where its bands sit, which is `bandTops`.
- **One scale per display, with `ticks` overridden for a band whose ladder is
  its own.** Reads as one declaration and one derivation, and is neither once
  a display has two scales (coverage and insert size) — the override cannot
  say which. The ladder rides the scale that owns it.
- **Two on-screen forms, one for the single-plot displays and one for the
  stacked bands, chosen by an `orientation` member.** The difference was
  where the numbers went, over the plot or in the gutter, and nothing about a
  scale decides that; a member the chrome only reads to pick a form is the
  placement leaking back into the declaration. One form, and the numbers of
  the single-plot displays move.
- **A per-display compact threshold**, so the multi-wiggle could keep its 70
  px. Thirty is `YScaleBar`'s own geometry — below it two 10 px labels
  overlap — and the coverage band's default height is 45, so a shared 70
  would have captioned every default coverage band. The multi-wiggle's rows
  gain an axis in the window instead.
