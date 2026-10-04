---
status: Accepted
summary: "Below a `scales.y.domainQuantile` of 1 an open end follows the extremes and stops only at a fence, twice the span the quantile ends draw (0 included where the axis reaches it), through `fenceOutliers` in `@jbrowse/core/util/quantileExtent`; the wiggle plot, the mark display and the coverage band read it, colour ramps still clip at the quantile, and a plot with no spike draws no red strip. The Score submenu, its three dialogs (Set min/max score, Autoscale with other tracks, Reference lines) and Show cross hatches become one track-menu row, Y axis..., opening a drawer widget that writes `scales.y` as each control changes: Scale, Min/Max (debounced), Include 0, Clip extreme outliers, Share axis with, Grid lines, Reference lines and Reset to defaults. The coverage band's row is Coverage axis..., a density plot's Score range..., and Summary score mode moves into Resolution. Amends ADR-179, ADR-182 and ADR-183"
---

# ADR-208: Clip outliers fences a spike, and one Y axis drawer holds the scale

## Status

Accepted (2026-10-04). Colin: "The 'score at 0' uncheck does nothing", "The
scores at 0 conflicts with set min/max...fuse them", "The outliers thing shows
clipping even when there is barely any deviation e.g. in multiwiggle. it should
only be for extreme outliers", and, over the first fused dialog, "this frankly
feels like a mess. having a mix of submenus, checkboxes, dialogs, and misc
concerns 'reference lines'...its all too much". He chose a drawer that applies
each change at once ("having the instantly change data instead of having to
click apply may be good...it can make things more tangible"). Subagent reviews
arbitrated the fence, the shape and the build. Amends
[ADR-179](adr-179-an-open-scale-end-follows-one-quantile.md),
[ADR-182](adr-182-an-axis-reaches-0-unless-its-scale-says-otherwise.md) and
[ADR-183](adr-183-a-bar-the-axis-cut-wears-a-red-strip.md).

## Context

The axis is the output of the quantile, `zero`, the pinned ends, the group and
nice-rounding, and the Score menu spread those across two radio submenus, two
checkboxes, three dialogs and the Show menu, showing neither what each did nor
the data it acted on.

Measured in the dev app on volvox, Start axis at 0 worked: MultiWig over ctgA
went from 0–300 to 20–300. That is the whole effect there, because coverage
climbs from about 27 over the contig's first bins and the axis spans the values
in view, as Vega-Lite's `zero: false` and ggplot2's data-range limits both do.
It moves nothing where the values reach or cross 0, most ChIP, RNA and coverage
BigWigs, or where a pinned min overrides it, since `getNiceDomain` applies a
pinned end after `zero` (`packages/wiggle-core/src/scale.ts`). None of that was
visible.

At the wiggle default of 0.99, MultiWig autoscaled to the quantile ends
118–266, niced to 0–280, while its tallest bin reached about 303, so five bins
wore red strips for standing 8% over the axis. A quantile removes its share of
whatever is in view whether or not anything there is unusual, which ADR-179's
coverage amendment had already found.

## Decision

**The quantile fences the extremes rather than replacing them.**
`fenceOutliers` takes the extremes in view, the `quantileExtent` ends and
`zero`: an end stays at its extreme unless that would stretch the axis past
twice the span the quantile ends draw, 0 included where the axis reaches it,
and then stops at the fence. With `zero` on and one-signed data that is
`min(max, 2 × q)`. Quantile ends that meet span their own size, as a flat
domain widens in `getNiceDomain`. `autoscaleDomainFromSpans` (wiggle and the
mark display) and `computeVisibleCoverageDomain` (the coverage band) call it,
each stating `zero`. Colour ramps and Hi-C keep clipping at the quantile
itself: a saturated colour hides nothing its key does not say, where a cut bar
loses its height and wears red, and Hi-C's 0.95 wants the saturation.

**One row, one drawer widget, one config object.** Every control in the old
submenu wrote `scales.y`, so one row, Y axis..., opens `ScoreAxisWidget` in the
side drawer, beside the view rather than over it, and each control writes the
slot as it changes, so the plot answers while the reader watches:

- Scale (linear, log, symlog); Min and Max, debounced 300 ms and flushed on
  blur or close, held back while the text is not a number rather than read as
  empty; Values in view beneath them.
- Include 0 (`zero`) and Clip extreme outliers (`domainQuantile`), both moving
  only an empty end, so both grey out once Min and Max are set, Include 0 also
  on a log axis. Include 0 and the guides are offered where the scale rules a
  band (`scoreRulesDrawn`), which a density plot does not.
- Share axis with, the peer list `autoscaleWith` writes; Grid lines; Reference
  lines, each row writing once every row reads.
- Reset to defaults writes `baseDisplayConfig`'s `scales.y` back whole, so an
  admin's declared axis survives.

Each write calls the track's `persistConfigurationNow()`, so undo steps one
edit at a time. The display is a `safeReference`: hiding the track or closing
the view empties it, and the widget says so. The row's label carries only what
the plot cannot show, a pinned end and a non-linear scale ("Y axis (190 –
auto, log)..."). The coverage band's row is Coverage axis..., beside its own
Color SNPs above...; a density plot's is Score range.... Summary score mode
moves under Resolution, the other setting about how bins are read.

The wiggle plugin registers the widget through
`@jbrowse/wiggle-core/scoreAxisWidget`, a subpath that keeps its React out of
the package entry; alignments and the mark display open it by name, and every
product bundling either bundles wiggle.

## Consequences

- A wiggle plot with no spike draws to its extremes with no strip. A spike
  leaves the values under it at least half the axis, where the quantile gave
  them all of it. The coverage band's default stays 1; its opt-in Clip extreme
  outliers fences, the rule ADR-179 declined as the band's default because a
  pile-up wider than 1% of the view escapes it.
- `makeScoreSubMenu`, `makeScaleTypeSubMenu`, `makeClipOutliersItem`,
  `makeSetMinMaxScoreItem`, `makeAutoscaleGroupItem`, `makeSetScoreRulesItem`,
  `makeCrossHatchItem`, `ScoreSubMenuOptions` and `SetMinMaxDialog` leave
  `@jbrowse/wiggle-core`, which nothing in the tree or the sibling plugin
  checkouts imported; `makeScoreAxisMenuItem` and the three row labels arrive.
  `computeAutoscaleDomain` takes `zero` as a required fourth argument.
- The docs' click paths name the panel's controls (`Y axis... → Range`), and
  the spec recipe writes one step per `scales.y` member.

## Rejected alternatives

- **A switch: the quantile once the max passes k times it, else the
  extremes.** As a pan carries the max across the threshold the axis jumps by
  that factor; the fence is continuous in the data.
- **The extremes by default, Clip outliers opt-in** (IGV's default). ADR-179
  rejected it as "No automatic clipping": a spiky BigWig reads as flat out of
  the box.
- **Unticking 0 fits the bulk of the data**, the lowest 1% or 5% left out. It
  needs a threshold nobody can defend, and puts red strips on ordinary data,
  the complaint this decision answers. No grammar trims automatically; a
  reader who wants the bulk types a Min, ggplot2's `coord_cartesian`.
- **Include 0 inside the Set min/max dialog** (this branch's first answer). It
  seated the conflict beside the fields without removing it, Clip outliers had
  the same conflict and stayed behind, and applying on Submit hid what the box
  did.
- **Include 0 back in the menu beside Clip outliers**, a reviewer's answer to
  that. It kept the mix of submenus, checkboxes and dialogs Colin called a
  mess.
- **A modal Y axis dialog with OK, Cancel and Apply.** It covers the track it
  edits; the drawer sits beside it, so each change shows at once.
- **A preview line, "with 0: 0 – 300 · without 0: 20 – 300".**
  `autoscaleRange` already has `zero` inside the fence, so the flipped arm is
  wrong exactly when a spike is in view.
- **A Min field choosing auto, 0 or a number.** `zero` is symmetric, raising a
  negative maximum to 0 as well, and is Vega-Lite's word.
