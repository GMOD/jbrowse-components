---
status: Accepted
summary: "A linear or log colour ramp's open ends follow the loaded values by the rule `scales.y.autoscale` names: `autoscale: 'local'` spans their extremes and `'localpercentile'` clips each sign's magnitudes at `numQuantile`, anchored at 0 (`rampExtent`, `@jbrowse/core/util/rampExtent`). The mark, feature, alignments and Hi-C colours take both members; Hi-C's `useColorPercentile` checkbox is `color.autoscale` defaulting to `localpercentile` at 0.95, declared retired. Each region's worker or the display computes the percentile over what it paints — per feature, per box, per read, per contact — and a display unions per-region extents as before"
---

# ADR-175: A colour ramp's open end follows the data as y does

## Status

Accepted (2026-09-26). Colin chose "ramps clip at a percentile". Reverses the
convergence handoff's "Hi-C's percentile domain is a domain rule of its own".

## Context

`scales.y` chose an open end's value three ways (`local`, `localsd`,
`localpercentile` with `numQuantile`), while a colour ramp only ever spanned
the extremes, so one spike on a coverage or score ramp washed every other value
into its low end. Hi-C alone saturated at a percentile, through a display
boolean fixed at 95.

## Decision

`colorAutoscaleSlots` (`autoscale`, `numQuantile`) sits beside the ramp ends on
FeatureColor, MarkColor and AlignmentsColor, `local` and 0.99 by default; HicColor
declares the same two at `localpercentile` and 0.95, today's picture. The rule
is `scales.y`'s: each sign's magnitudes clipped at the quantile, anchored at 0,
so the word means one thing on either axis. `rampExtent` answers it over the
values a painter already holds: the encoder per region and feature, the feature
display per painted box across its loaded regions (`rectColorValues`), the
alignments bake per read, and the Hi-C worker per contact, which keeps its
quickselect since a 4.5M-count selection belongs off the main thread.
`colorEncodingOf` carries `numQuantile` only under `localpercentile`, so tuning
it on a `local` ramp refetches nothing.

## Consequences

- A mark or feature ramp across several regions unions each region's clipped
  extent, so it clips at the most any one region reaches, not at one
  percentile of the whole view.
- `localsd` is left out: nothing asks for it, and its spread around a mean
  has no reading on a ramp anchored at 0.
- Hi-C's menu toggle writes `color.autoscale`, and its label names the
  percentile the colour holds.
