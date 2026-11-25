---
name: svg-export-figure-calls
description: "Figure-quality calls left by the 2026-11 SVG export audit, each needing a ruling before any code: a pileup cut mid-row with no sign, blank track height, selection dimming in a circular export, a narrowed row set with no caption, indel colors with no key, the Hi-C and LD key default, pale small-chromosome ribbons, a scalebar on synteny rows, the dialog's label mode for stacked views."
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

**An export keeps a track's box height whatever its content needs.**
`lgv_snapshot.svg` has about 250 px of empty band under two rows of reads, and
all four synteny goldens reserve 250 px for an alignments track that draws two
rows, which puts about 230 px of blank above each ribbon band. Trimming a
track to its content in an export would change every figure's height and
break "the figure is what the screen shows".

**A row selected in the SV inspector dims every other chord in a circular
export.** `ShapePaths` applies `dimmedFeatureIds` in export mode, and the SV
inspector fills that set from the session's selected feature, so every other
chord exports at 0.15 opacity. `SVG_EXPORT.md` says a figure carries no
selection; `ShapeDisplay.test.tsx` ("the export dims the chords in the dimmed
set") pins the dimming on purpose. One of the two changes. An inspector row is
a deliberate pick, unlike a hover, which argues for amending the doc.

**A figure of a narrowed row set does not say it is narrowed.**
`svgControlsStrip` (`treeSidebarRowViews.ts`) drops the "Showing N of M rows"
line with the controls, and no export draws a replacement. A caption, or the
count appended to the track label, would carry it.

**Default synteny coloring paints indels with no key.** With no color field
set, insertions are yellow and deletions blue (`colorUtils.ts`), and
`hasColorKey(undefined)` is false, so neither the screen nor the export draws
a key: `hosted_synteny.png` is mostly blue and yellow streaks. Commit
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
are barely visible. A palette question, not an export one.

**Synteny rows draw no scalebar; breakpoint split rows do.** The reason
written in `SVGBreakpointSplitView.tsx` (rows a reader compares need a scale
each) applies to synteny rows too. A scalebar adds about 37 px per row at the
default font (`getRowHeaderLayout`).

**The export dialog's first-run label mode ignores a stack's rows.**
`ExportSvgDialog.tsx` reads `model.effectiveTrackLabels ?? 'offset'`, and
neither `LinearSyntenyView` nor `BreakpointSplitView` has that getter, so a
stack whose rows are all set to overlapping or hidden opens the dialog on
"offset". It matters once per browser: the choice is stored in one
`localStorage` key shared by every view type. A getter returning the rows'
common mode, else `'offset'`, would fix it.

**The mark display's "N of M skipped" notice is not exported.** A Manhattan or
mark track with a non-numeric field shows a warning chip on screen
(`LinearMarkDisplayComponent.tsx`) and exports its partial plot with nothing
said. Colin has declined runtime warnings for malformed data elsewhere, which
argues for leaving it.

**The LD index-SNP highlight changed color on screen.** Exporting it moved
the band and dot from a hard-coded orange (`rgba(255,170,0,0.35)`, `#e69500`)
to `palette.highlight.main` and `highlight.dark`, on screen as well. It
landed that way; this is here in case the orange was the intent.
