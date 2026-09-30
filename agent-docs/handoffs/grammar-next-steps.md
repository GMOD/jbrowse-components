---
name: grammar-next-steps
description: What the grammar thread does next as of 2026-09-27 - wiggle onto the bar and point shapes (parked on a call in ideas/), and one leftover of the domainQuantile call. Read before picking up grammar work.
---

# Grammar thread: next steps

ADR-181 (a centred point and a `rule` mark), ADR-179's 2026-09-27 amendment
(each quantile end clips its own tail), ADR-182 (`scales.y.zero`, the axis's
0 as a slot and a Score-menu tick) and ADR-183 (the red clip strip) landed
that day. Figure reshoots wait on ada
and are listed in [scales-and-colour-keys](scales-and-colour-keys.md).

## Next, ranked

A review on 2026-09-27 checked each candidate against main. Its sizes and
probes come from that review and nobody has re-measured them.

1. **Wiggle's xyplot and scatter onto render-core's `bar` and `point`**, parked
   on a call:
   [ideas/waiting-on-a-call/wiggle-onto-bar-and-point.md](../ideas/waiting-on-a-call/wiggle-onto-bar-and-point.md).
   Its first three landings are in, all 2026-09-28: the line as a mark
   (ADR-184), the pivot as a shader-side threshold over the plotted value
   (ADR-185), and the density heatmap as a `span` under a colour scale
   (ADR-113's amendment). Still to build, ranked by how much of the wiggle
   display leans on each: per-source colour on the plot through the row
   table's colour plane, summary modes and the min–max band (a `y2` channel),
   the layout-dependent colour default and the cut-at-origin default, and the
   typed-array fetch (ADR-152's conditions).

The 2026-09-25/26 reviews' findings all landed by 2026-09-27: the link
mark's log floor, ring placement, hover box and alias-spelt pair, and
domainQuantile's range check and Clip-outliers re-tick.

## Leftover of the domainQuantile call

**Ties fill a nearest-rank quantile**: at 0.95 a segmented copy-number track
pins 99.5% of its values to one colour, because one value holds the rank. It
surfaced in the probe behind the 2026-09-27 amendment and nothing decides it
yet.

## Calls put to Colin, 2026-09-27

The evening's grammar analysis (its 21 verified defects landed, 0875b9a6db..1ea5a98e9a) left five direction calls, each a question rather than work:

- **A `line` mark.** Answered: ADR-184 landed it on 2026-09-28, with ADR-185's
  threshold over the plotted value the same day.
- **A `y2` channel**: declined twice, the range bar on 2026-09-23 and the stacked bar on 2026-09-30 (built and measured, commits dd6589d019 and 5c5f071cd1, unlanded); Colin prefers the mirror and the rows form to a stack. Closed.
- **Layer data through the adapter**: a union adapter over feature adapters stamping `source`, as `MultiWiggleAdapter` does, so two files draw in one plot through a `filter` per mark; `source: "density"` is already per-layer data.
- **`scales.y.rules` as a `rule` layer with a constant `y`**, so a reference line takes a zoom range and a per-row value.
- **A `tooltip` channel** naming the fields a hover prints.

