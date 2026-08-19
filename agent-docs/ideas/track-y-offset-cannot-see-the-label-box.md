---
name: track-y-offset-cannot-see-the-label-box
description: `getTrackYOffset` is short by one label box per labelled track above it, because an offset label's height is whatever the theme renders a Paper of icon buttons at — 31.140625px on the stock theme, not a number the model can derive. The one live consumer already measures the DOM and only falls back to the arithmetic; three ways to make the fallback exact, and why a hardcoded constant is not one.
---

# `getTrackYOffset` and the label box it cannot measure

`getTrackYOffset` (`plugins/linear-genome-view/src/LinearGenomeView/model.ts`)
walks tracks in DOM render order and adds `trackHeight(t) + trackChromeHeight`
per track above the one asked for. `trackChromeHeight` is the gap, the resize
handle and the Paper's borders — everything `TrackContainer` lays out **except**
the label. Both getters say so in their own docstrings.

So the answer is exact while `effectiveTrackLabels` is `hidden` or
`overlapping`, and short by one label box per labelled track otherwise. `offset`
is the default for any display setting `prefersOffset`, which is every display
with a tree sidebar — so the inexact case is the common one.

The reason it cannot be derived is real: an offset label is an in-flow box whose
height is whatever MUI renders a Paper of icon buttons at under the active
theme. It measured 31.140625px on the stock theme, and a constant that matched
that would be wrong for any theme, any font stack, and any track whose label row
wraps.

## Live impact, and the claim that overshot

The one consumer is the breakpoint split view's connector geometry
(`BreakpointSplitView/model.ts`, `getTrackOverlayData`), which resolves
`yOffsetsOverride ?? domYOffsets ?? viewTop + getTrackYOffset(...)`. The
arithmetic is reached only for a track with no mounted div, so the drawn
connectors are right in the ordinary case. Worth fixing anyway, and worth fixing
the record: `6a669368e5` is titled "the model's track offsets now match the
pixels, exactly", which is true only for the hidden/overlapping settings.

## Ways to close it

- **Publish the measured height.** `TrackLabel` knows its own box; a
  `ResizeObserver` (or one `getBoundingClientRect` on mount) writing it to
  volatile state gives the model a real number, per track, from the theme that
  is actually rendering. Costs an observer per label and makes a layout getter
  depend on a measurement — which is what `domYOffsets` already is, one level
  up.
- **Take the label out of flow.** If the offset label were positioned rather
  than in-flow, `trackChromeHeight` would be complete by construction and this
  whole class of drift would go. Biggest change, and the one that ends it.
- **Say what the getter is.** Rename to something naming the exclusion, or have
  it return `undefined` when labels are showing and no measurement is available,
  so a caller cannot silently take a short answer. Cheapest, and it turns a
  wrong number into a missing one.
