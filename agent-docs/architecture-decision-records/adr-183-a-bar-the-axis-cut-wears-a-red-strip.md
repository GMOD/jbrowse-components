---
status: Accepted
summary: "A bar clamped at the y domain's edge wears a 2 px red strip across that edge on wiggle's xyplot, the coverage band and render-core's `bar`, on every backend and the SVG export, held in one `clipStrip` module"
---

# ADR-183: A bar the axis cut wears a red strip

## Status

Accepted (2026-09-27). Colin: "the red clip is fine with me", from a
three-way capture of the coverage band over a collapsed-repeat pile-up.

Amended by [ADR-208](adr-208-clip-outliers-fences-a-spike-and-one-y-axis-drawer-holds-the-scale.md):
a default wiggle plot strips only the bars past the outlier fence.

Amended 2026-11-17: the coverage band's interbase bars are cut by the same
axis. A bar of N insertion and clip events stands half as tall as a depth bar
of N reads, so a stack of more events than the depth axis tops out at stops at
half the band's drawing height and wears the strip across its cut end, the
bottom, since the bars hang from the band's top. Until then nothing cut it: at
chr5:70,954,910 in NA12878, 661 soft clips at one boundary under an axis the
0.99 fence put near 120 ran through the depth bars to the band's bottom edge,
and Colin's rule for the layer is half the band. The cut is `cutAbove`, the
test `clipSide` cuts a depth bar's top by, on the stack's height against the
half-band, and it picks the one segment whose end is over and whose start is
not. The stack is cut edge by edge (`interbaseEdgePx`), so the segments past
the cut draw nothing, and the hover still reads every count at the position.
The strip is the second quad of each instance, as on the wiggle xyplot. This
closes the breakend case parked on 2026-08-14, where the reads ending and
starting at one base outnumber the peak depth; a clamp was declined there
because a flat end read as "exactly at the peak". That case was measured on
a synthetic stack and has no instance on real data on record: clips cannot
outnumber the reads on their own side of a boundary, and 2 Mb of NA12878 at
30x (chr1:100,000,000-102,000,000) held 47 boundaries with ten or more clips,
none with clips on both sides and none over the depth beside it. Under the
default axis, which follows the deepest pile, a stack therefore keeps to its
half; the cut is for an axis the outlier fence, a pinned `domainMax` or a
shared scale put below it. The strip marks the cut on
an insertion or soft-clip segment; on a hard-clip segment it is dark red on
red, one pixel wide, and reads weakly.

## Context

`domainQuantile` (ADR-179) clips an autoscaled axis at the 0.99 quantile on
the wiggle plot and the coverage band, and a pinned `domainMax` clips
anywhere. A bar past the cut is clamped to full height by `normalizeScore`,
ggplot2's `oob_squish`, so a collapsed-repeat pile-up of depth 775 over a
window whose axis reads 35 draws as one more bar touching the top. Nothing
said it was cut. v4 drew a 2 px `clipColor` strip on every clipped bar
(`git show bafc8df5b4^:plugins/wiggle/src/drawXY.ts`), and `bafc8df5b4`
removed it with the canvas code.

Three pictures went to Colin, shot on the volvox BAM with reads over a 150 bp
locus replicated 30 times: as drawn, v4's red strip, and the clipped bar's
top 10 px fading out. The fade was easy to miss at the default band height.

## Decision

**2 px of #c62828 across the edge that cut the bar**, the top for a value
past `domainMax` and the bottom for one under `domainMin`. A log axis has no
bottom to cut: a value under its floor stands on the baseline as a bar of no
height. The red is a shade darker than the coverage band's hard-clip
triangles, which stand just above where the strip sits.

**One module, `clipStrip.slang`, holds the three facts**: `CLIP_STRIP_PX`,
`CLIP_STRIP_COLOR` and `clipSide(value, domainMin, domainMax, scaleType)`,
whose JS twin every Canvas2D painter reads, and through it the SVG export.
The cut is measured with a tolerance of a hundred-thousandth of the domain:
the coverage band rebuilds a depth as float32 `relDepth` times the region's
peak, and a quantile that lands on an observed depth would otherwise strip on
the backend whose rounding came out high and not on the other.

**Wiggle's xyplot and render-core's `bar` draw the strip as a second quad per
instance**, twelve vertices where there were six, every vertex of an uncut
bar sent off clip. **The coverage band draws it as a sixth layer**,
`clipStrip`, a pass off the depth bars' own buffer and last in
`COVERAGE_BAND_LAYER_ORDER`, since the SNP, modification and interbase layers
stack inside the bar and would paint over a strip drawn with it. A `bar`
cut to no height, its origin on the same edge, paints only the strip, which
is then its ink.

## Consequences

- Every default wiggle plot at 0.99 shows the strip on the bins the quantile
  cut, which is what the quantile does; the figures with a spike in view
  change and want a reshoot. The coverage band showed it too, on the tallest
  stretch of plain 30x coverage in most views, and returned to 1 the same day
  (ADR-179).
- `coverageBandMarks` wires the layer for both displays that draw the band,
  so MAF gained it with alignments.
- `barCutCoverage.test.ts` pins twelve vertices; `clipStrip.test.ts`,
  `rendererUtils.test.ts`, `wiggleMarksPaint.test.ts` and
  `drawAgainstHit.test.ts` pin the painters and the tolerance.

## Rejected alternatives

- **The fade.** Quieter, and at the default band height invisible from
  across the room, which is the one thing a clip marker must not be.
- **A `clipColor` slot**, v4's. One color is the marker; a track coloring
  its own strip would be a second thing for the key to explain.
- **A whole clipped bar in the strip color.** Louder still, and it hides
  the SNP and modification segments the bar carries.
- **For the interbase bars, a denominator of the depth at each position.**
  It gives up a bar of N events standing the same height everywhere in the
  view, which `interbaseBarHeightPx` scales by the region's peak for.
- **Rescaling an over-tall interbase stack into the half-band.** The segments
  past the cut come back squeezed in, painting colors where the bar shows one.
- **A scale of their own for the interbase bars**, or the fence counting their
  events. The first loses "N events is half of N reads", and one pile of
  hundreds flattens every other bar; the second lets clip counts move the
  depth axis and undoes the fence at the pile it was set for.
- **Leaving the interbase overflow**, as informative. It overdraws the depth
  bars it is read against.
