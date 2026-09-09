---
status: Accepted
summary: "A display declares the value scale it places its y through — `valueScale` on `ScoreScaleMixin`, a domain, a scale type and the pixel box — and the axis derives from it: the mixin turns it into ticks, `DisplayChrome` places the axis and the cross-hatches on screen and `renderDisplaySvg` in the export, so a display places no axis. The single wiggle, Manhattan and the mark display are on it; a display with several axes leaves the scale unset and lays out its own"
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

## Decision

- **`ScoreScaleMixin` gains `valueScale`**, an overridable getter hook (default
  none): `{ domain, scaleType, height, offset?, minimalTicks?, symlogConstant? }`
  — the resolved domain and the pixel box `axisPlotBox(height, offset)` it maps
  onto. The mixin derives `ticks` from it through `computeYTicks`.
- **Placement is the chrome's, for every guide on that scale.**
  `DisplayChromeBase` mounts `ChromeYAxis` for any model `isAxisHost`
  recognises (the mixin's members plus `canvasWidthPx`), which draws the
  cross-hatches when `showCrossHatches`, the reader's `scoreRuleMarks` over
  them, and `YScaleBarOverlay` over both; `renderDisplaySvg` appends `SvgYAxis`
  inside `SvgChrome` in the same order, the axis left-oriented at the content's
  left edge. A display whose `valueScale` is unset gets none of it, whatever
  its `ticks` read.
- **The axis primitives live in `@jbrowse/display-ui`** beside `FloatingLegend`
  — `YScaleTicks`, `axisPlotBox`, `YScaleBar`, `YScaleBarOverlay`,
  `CrossHatches`, `ScoreRules` — because the chrome can reach that package and
  not `wiggle-core`, which depends on the chrome. `wiggle-core` re-exports
  them, so every published name holds.

Migrated: `LinearWiggleDisplay` (no scale under density, whose key is the
chrome's ramp), `LinearManhattanDisplay` and `LinearMarkDisplay`. Each lost its
`ticks` getter and its placement sites: four for the axis and hatches, and two
more for the score rules on the two that draw them. `MultiLinearWiggleDisplay` keeps its
own `ticks` — one per row, stacked by its own scales component — with
`valueScale` unset, which is the shape a display with several axes takes.

## Consequences

- `WiggleFamilySvgFrame` no longer reads `ticks` or `showCrossHatches` off the
  model: its `crossHatches` prop is for the multi-wiggle's per-row set, and a
  single-axis display passes nothing.
- The export shell's children grew by one, which moved the `useId` the
  exported legend minted its gradient id from — a per-process counter that
  already differed between a suite run alone and in a batch. The export now
  passes `svgNodeId` as the prefix (`legend-0-identity-0`), the rule
  `svgId.ts` states for every other export id; one synteny snapshot
  re-recorded on that token and nothing else.
- Not migrated: the alignments coverage band, whose axis sits inside a band of
  a taller display, right-oriented in its own gutter (`computeCoverageTicks`,
  `PileupComponent`), and the insert-size axis beside it. Both compose the
  mixin and leave `valueScale` unset. A `box` member on the declaration — the
  band's inset instead of `axisPlotBox` — is the first move if one is wanted.
- The multi-wiggle's `ScoreDomainCaption`, the `[min, max]` an axis-less row
  shows, is what the axis becomes when there is no room for one; it stays a
  hand placement and is why that display answers `legendTop`.

## Rejected alternatives

- **The chrome computing the ticks from the declaration.** `computeYTicks`
  reaches `getScale` — d3 and the symlog resolution — which is `wiggle-core`'s,
  and the chrome cannot depend on it. The mixin, which lives there, derives the
  ticks; the chrome draws what it derived.
- **Leaving the hatches and rules with the displays.** The rules sit over the
  hatches and under the axis, and a chrome drawing only the axis and hatches
  after the display's rules inverted that; the three are one guide set on one
  scale and move together.
