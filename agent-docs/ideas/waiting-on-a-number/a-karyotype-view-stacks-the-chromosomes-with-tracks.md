---
name: a-karyotype-view-stacks-the-chromosomes-with-tracks
description: A karyotype view draws each chromosome as a banded row with linear tracks along it, a second coordinate stage beside the circular view, and lends its ideogram to the LGV import form; waits on splitting the strip past the 8192 px backing store.
---

# A karyotype view stacks the chromosomes, with tracks

A view that draws every assembled molecule as a horizontal row, one per line,
banded where the assembly has cytobands, with linear tracks drawn along each
row: karyoploteR's `plot.type = 1`. A click or drag on a row opens a
LinearGenomeView there. The LGV import form shows the same ideogram, without
tracks, as a location picker under its control row.

The picker on its own was the first version considered. It can't hold tracks,
and the figure with data on it (GWAS hits, CNV calls, density across every
chromosome at once) is the reason to have an ideogram at all.

## Rows and bands

- **Rows are `assembly.wholeGenomeRegions`:** the assembled molecules where the
  alias source states sequence roles, leaving out unplaced, unlocalized, alt
  and patch scaffolds. This draws the line between chromosomes and scaffolds.
  The picker shows only when sequence roles name molecules, so an assembly of
  3,000 scaffolds keeps today's form.
- **Bands are `assembly.cytobands`**, loaded with the assembly in `setLoaded`,
  so neither the view nor the picker fetches anything. Without them a row is a
  plain bar.
- **One band painter.** `bandColors`, `colorMap`, the acen triangles and the
  rounded caps move out of the LGV's `components/Cytobands.tsx` into a module
  that the overview scalebar, the picker and the view all read.

## Tracks: a second coordinate stage

The circular view is a coordinate stage over the linear displays (ADR-119):
the view is a `RegionHost`, each display renders unchanged into a hidden strip
one block per slice, and the ring pass samples that strip. A karyotype view is
the same host with one block per chromosome. Its stage draws each block's
stretch of the strip at that chromosome's row, which is a translation per row
where the ring needs a warp. The pointer maps a row and x back to strip x the
way `ringHit` and `RingPointer` do, and the view takes the LGV's display types
through `pickDisplayForView` as the circular view does.

## The number it waits on

The strip spans every row end to end. On hg38 that is the genome over chr1,
about 12.4 times a row's width: a 1200 px row needs a strip of about 15,000 CSS
px. ADR-119's strip scales down past `maxCanvasCssPx()` (`MAX_CANVAS_DIM_PX`,
8192 device px, over the dpr), so rows would draw at about half resolution at
dpr 1 and a quarter at dpr 2. The ring's strip is a circumference, a few
thousand px, and never met this.

A spike settles it: whether one display's strip can be split across several
canvases (a row each, or a run of rows) without the display knowing. If it
can, build the view. If the split reaches into every display, measure how a
wiggle and a feature density read at the blurred resolution before choosing
between that and narrower rows.

## Open

- **Row height:** 24 chromosomes with a few tracks each makes a tall view, so
  tracks on it probably want a compact default height.
- **Vertical chromosomes**, the classic karyotype picture, need a rotation the
  stage doesn't have. Rows come first.
