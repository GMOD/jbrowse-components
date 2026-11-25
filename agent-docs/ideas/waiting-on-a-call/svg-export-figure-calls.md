---
name: svg-export-figure-calls
description: "Figure-quality calls left by the 2026-11 SVG export audit: three with a built spike waiting on a yes or no (a pileup cut mid-row, a narrowed row set with no caption, the Hi-C and LD key default), and two parked (indel colors with no key, pale small-chromosome ribbons)."
---

# SVG export figure calls

Each item below is a visible property of an exported figure that an audit of
every view's and display's export found in 2026-11, and that changes what a
figure looks like for everyone. None is a defect with one right answer, so each
waits on Colin. The defects from the same audit landed; what they changed is in
[SVG_EXPORT.md](../../reference/SVG_EXPORT.md).

The evidence images are `products/jbrowse-img/img/*.png` and the goldens in
`products/jbrowse-web/src/tests/__image_snapshots__/`.

**A pileup deeper than its box is cut mid-row and nothing says reads
continue.** On screen the scrollbar says there is more. The export clips at the
box (`renderDisplaySvg`'s display clip) and leaves a few px of the next row:
the last row of the "Not split" section in `sv_read_arcs.png`, the bottom row
in `methylation.png`. The on-screen "Max height reached" rule
(`PileupTruncationRule.tsx`) is not exported either; `ceilingClipped` has no
reader outside it and `lanes.ts`. The proposal is to snap the export's pileup
clip to the last whole row and draw one caption line where rows remain or the
track is scrolled, the same caption standing in for the truncation rule.
Separately, `jbrowse-img` could default alignments to `heightMode: 'grow'`, as
`applyTrackOpts.ts` already does for `sortAt`.
[vertical-real-estate](vertical-real-estate.md) is about allocating height,
not about saying a figure was truncated.

**A figure of a narrowed row set does not say it is narrowed.**
`svgControlsStrip` (`treeSidebarRowViews.ts`) drops the "Showing N of M rows"
line with the controls, and no export draws a replacement. A caption, or the
count appended to the track label, would carry it.

**Default synteny coloring paints indels with no key.** With no color field
set, insertions are yellow and deletions blue (`colorUtils.ts`), and
`hasColorKey(undefined)` is false, so neither the screen nor the export draws
a key. The audit described `hosted_synteny.png` as mostly blue and yellow
streaks; rendered on 2026-11-25 at both the pre-fix and current commits it is
all match-colored, so find a figure that shows the wedges before keying them. Commit
3f0c2e0c2a chose no key so a constant `value` color would not get a "match"
chip; that reason does not cover the default scheme, where the wedge colors
carry meaning. The proposal keys the indel chips when the field is unset and
indels are drawn. It moves the ggjbrowse legend.

**Hi-C and LD figures ship with no color key.** Both use
`hiddenLegendConfigSchema`, so `hic.png` is a heatmap with no scale. The key
is right when shown (binsize in the title, the loaded extent as the domain).
Whether an export should default it on while the screen keeps it off is the
question.

**Small chromosomes' ribbons nearly vanish.** In `hs1_mm39_synteny.png` and
`hg38_hs1_mm39_synteny.png` the chromosomes past about chr17 take the
palette's pale tints, which at `encoding.opacity` 0.4 over the white ground
are barely visible. A palette question, not an export one: rendered at
`encoding.opacity` 0.8 the pale chromosomes stay pale while the rest turn heavy.