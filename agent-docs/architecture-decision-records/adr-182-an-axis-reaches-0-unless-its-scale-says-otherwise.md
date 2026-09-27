---
status: Accepted
summary: "A linear or symlog value axis reaches 0 whatever the loaded values span, and `scales.y.zero`, Vega-Lite's, on by default, is where that is written: off, the axis spans the values. The rule leaves the hidden line in `getNiceDomain` for a slot, a Score-menu checkbox (Start axis at 0) and the config docs. A density plot, which maps score to colour and rules no band, spans its values either way, and a flat window widens by its value. ggplot2's rule, bars reach 0 and the rest span their data, was put to Colin and declined"
---

# ADR-182: An axis reaches 0 unless its scale says otherwise

## Status

Accepted (2026-09-27). Colin, offered ggplot2's rule: "i am not sure i like
the 'everything else spans its data' i think we just need to expose this
'option' more clearly somehow, but still keep our 0 rule".

## Context

Every linear or symlog value axis started at 0 because `getNiceDomain`
(`packages/wiggle-core/src/scale.ts`) lowered a positive minimum to 0 and
raised a negative maximum to it, whatever was drawn. A plot of points whose
values sit between 30 and 60 drew 0 to 60, its bottom half empty, and nothing
in the config, the Score menu or the docs said so. The mark display stated a
rule of its own for bars, widening its range to the origin when a bar draws
(`autoscaleRange`, `plugins/marks/src/LinearMarkDisplay/model.ts`), and the
hidden line overrode it for every other mark. ADR-179's 2026-09-27 amendment
moved the quantile off 0 and noted that the axis would have to add it itself.

Three answers were put to Colin. ggplot2's: a bar reaches its baseline because
the baseline is part of the bar, so bars keep 0 and points, lines and rules
span their data. IGV's: every signal axis starts at 0. Vega-Lite's: a `zero`
property, on by default for a positional scale and off for colour.

## Decision

**`scales.y.zero`, a boolean on the value scale, on by default.** On, an
autoscaled linear or symlog end reaches 0; off, it spans the loaded values. A
pinned `domainMin` or `domainMax` is unmoved either way, and a log axis, which
has no 0, floors at 1 as before. `getNiceDomain` takes `zero` and every
caller states it, so the rule lives in the slot and nowhere hidden.

**The Score menu offers it as Start axis at 0**, beside Clip outliers, where
the display's scale rules a band. A density plot rules none: it maps score to
colour, so its ramp spans the values whatever the slot says
(`axisReachesZero` in `WiggleScoreConfigMixin`), which also answers the
leftover from ADR-179's probe, where a GC heatmap spent its colour on 0 to 30
that no value reached.

**A flat window widens.** One value in view used to
reach down to 0; without that reach the domain was a point, the normalizer
stepped at it and every bar in a segmented copy-number window drew at 0
height. `getNiceDomain` widens the free end by the value's own size, so 30
alone draws 30 to 60.

The mark display's bar rule stays: a bar reaches its `origin`, which is not
always 0, and that is a different statement from the axis reaching 0.

## Consequences

- No default picture moves. A config or a session naming `scales.y.zero:
  false` is the only way to a data-spanning axis, and `ScoreScaleModel`
  carries `scaleZero` and `setScaleZero`.
- `visibleStatsDomain` and the alignments density tier state `zero: true`,
  since a coverage count has its floor at 0 anyway.
- The `ValueScale` docs, the quantitative track guide and the Score menu's
  help text each say the rule in one sentence.

## Rejected alternatives

- **ggplot2's rule, bars reach 0 and everything else spans its data.** The
  recommendation, on the ground that the empty band under a scatter plot
  carries nothing. Colin kept 0 everywhere: a stable baseline is what a reader
  expects of a signal track, and the tick is one click away.
- **Keeping the hidden line and documenting it.** The docs would then describe
  a rule nothing exposes, and a reader wanting the other picture has only a
  pinned bound, which stops following the data.
- **A density plot reading the slot too.** There is no axis for 0 to be the
  bottom of, and the slot's help text would have to explain why a colour ramp
  starts where it does.
