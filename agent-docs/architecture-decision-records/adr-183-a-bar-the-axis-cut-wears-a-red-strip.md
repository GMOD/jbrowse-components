---
status: Accepted
summary: "A bar whose value the y domain excludes is clamped to the axis edge, and now wears 2 px of red across that edge on wiggle's xyplot, the coverage band and render-core's `bar`, on WebGPU, WebGL, Canvas2D and the SVG export. One `clipStrip` shader module holds the colour, the thickness and `clipSide`, whose JS twin every painter reads. Wiggle and `bar` draw it as a second quad per instance; the coverage band as a sixth layer off the depth bars' buffer, after the segments stacked inside them. Colin chose the strip over a fade from captures on 2026-09-27"
---

# ADR-183: A bar the axis cut wears a red strip

## Status

Accepted (2026-09-27). Colin: "the red clip is fine with me", from a
three-way capture of the coverage band over a collapsed-repeat pile-up.

Amended by [ADR-208](adr-208-clip-outliers-fences-a-spike-and-0-joins-min-max.md):
a default wiggle plot strips only the bars past the outlier fence.

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
- **A `clipColor` slot**, v4's. One colour is the marker; a track colouring
  its own strip would be a second thing for the key to explain.
- **A whole clipped bar in the strip colour.** Louder still, and it hides
  the SNP and modification segments the bar carries.
