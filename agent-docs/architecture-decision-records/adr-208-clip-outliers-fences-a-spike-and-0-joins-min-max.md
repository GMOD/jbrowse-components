---
status: Accepted
summary: "Below a `scales.y.domainQuantile` of 1 an open end follows the extremes and stops only at a fence, twice the span the quantile ends draw (0 included where the axis reaches it), through `fenceOutliers` in `@jbrowse/core/util/quantileExtent`; the wiggle plot, the mark display and the coverage band read it, colour ramps still clip at the quantile. A plot with no spike draws no red strip. The Score menu's Start axis at 0 row moves into the Set min/max score dialog as Always include 0, greyed with its reason when both ends are pinned or the scale is log, beside the values in view and the axis drawn from them; the menu row reads (spans data) while it is off. Amends ADR-179, ADR-182 and ADR-183"
---

# ADR-208: Clip outliers fences a spike, and 0 joins min/max

## Status

Accepted (2026-10-04). Colin: "The 'score at 0' uncheck does nothing", "The
scores at 0 conflicts with set min/max...fuse them", and "The outliers thing
shows clipping even when there is barely any deviation e.g. in multiwiggle. it
should only be for extreme outliers". A subagent arbitrated the rule and the
dialog against the alternatives below. Amends
[ADR-179](adr-179-an-open-scale-end-follows-one-quantile.md),
[ADR-182](adr-182-an-axis-reaches-0-unless-its-scale-says-otherwise.md) and
[ADR-183](adr-183-a-bar-the-axis-cut-wears-a-red-strip.md).

## Context

The three complaints are one experience: the axis is the output of the
quantile, `zero`, the pinned ends and nice-rounding, and the Score menu showed
neither what each input did nor the data it acted on.

Measured in the dev app on volvox, the 0 checkbox worked: MultiWig over ctgA
went from 0–280 to 100–280. It moves nothing where the values in view already
reach or cross 0, which is most ChIP, RNA and coverage BigWigs, or where Set
min/max pinned the bottom, since `getNiceDomain` applies a pinned end after
`zero` (`packages/wiggle-core/src/scale.ts`). Neither case said so.

At the wiggle default of 0.99, MultiWig over ctgA autoscaled to the quantile
ends 118–266, niced to 0–280, while its tallest bin reached about 303, so five
bins wore red strips for standing 8% over the axis. A quantile removes its
share of whatever is in view whether or not anything there is unusual, which
ADR-179's coverage amendment had already found.

## Decision

**The quantile fences the extremes rather than replacing them.**
`fenceOutliers` takes the extremes in view, the `quantileExtent` ends and
`zero`: an end stays at its extreme unless that would stretch the axis past
twice the span the quantile ends draw, 0 included where the axis reaches it,
and then stops at the fence. With `zero` on and one-signed data that is
`min(max, 2 × q)`. Quantile ends that meet span their own size, as a flat
domain widens in `getNiceDomain`, so a constant baseline with one spike fences
rather than cutting every other value.

`autoscaleDomainFromSpans` (wiggle and the mark display) and
`computeVisibleCoverageDomain` (the coverage band) call it, and each caller
states `zero`, as `getNiceDomain`'s callers do. Colour ramps and Hi-C keep
clipping at the quantile itself: a saturated colour hides nothing its key does
not say, where a cut bar loses its height and wears red, and Hi-C's 0.95 wants
the saturation. `domainQuantile` names both; the slot docs say which reading
each object takes.

**Always include 0 moves into Set min/max score.** The checkbox only moves an
end left empty, which a menu row beside the dialog could not say. It greys out
with its reason when both ends are pinned ("Both ends are set") or the scale is
log ("A log axis has no 0"), and density, which rules no band, does not offer
it. The dialog reads the values in view (`autoscaleRange`) and the axis drawn
from them (`autoscaledDomain`) off the live model, so a reader sees that
unticking 0 cannot move an axis whose values already span it. The menu row
captions `(spans data)` while `zero` is off, beside the pinned pair.

## Consequences

- The wiggle default stays 0.99, and a plot with no spike now draws to its
  extremes with no strip. A spike leaves the values under it at least half the
  axis, where the quantile gave them all of it.
- The coverage band's opt-in Clip outliers fences too. ADR-179 declined
  `min(max, 2 × q99)` as the band's default because a pile-up wider than 1% of
  the view escapes it; the default stays 1, and the fence is what the opt-in
  means.
- `makeAxisZeroItem` and `AXIS_ZERO_LABEL` leave `@jbrowse/wiggle-core`;
  nothing in the tree imported them. `computeAutoscaleDomain` takes `zero` as a
  required fourth argument.
- `ScoreScaleModel` carries `autoscaleRange`. `SetMinMaxDialog` takes
  `offerZero` and reads both ranges off its model rather than a `domain` prop.

## Rejected alternatives

- **A switch: the quantile once the max passes k times it, else the
  extremes.** As a pan carries the max across the threshold the axis jumps by
  that factor; the fence is continuous in the data.
- **The extremes by default, Clip outliers opt-in** (IGV's default). ADR-179
  rejected it as "No automatic clipping": a spiky BigWig reads as flat out of
  the box. The fence keeps that default and draws no strip on plain data.
- **A Tukey fence**, Q3 + 3·IQR: ADR-179 measured it cutting nearly every peak
  of ChIP-like coverage.
- **A Min field choosing auto, 0 or a number.** `zero` is symmetric, raising a
  negative maximum to 0 as well, and is Vega-Lite's word; a Min choice would
  misstate the slot.
- **One Y axis dialog holding Clip outliers too.** Clip outliers is toggled
  mid-browse, and the ask was to fuse 0 with min/max.
