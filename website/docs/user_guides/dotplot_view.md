---
title: Dotplot view
description: Whole-genome synteny dotplot
guide_category: Views
---

**TL;DR:** The dotplot view plots alignments between two genome assemblies (or a
read against a reference). Syntenic regions appear as diagonal streaks,
inversions as reverse-diagonal segments, and translocations/rearrangements as
off-diagonal blocks.

## Opening a dotplot view

Launch a new Dotplot view from the Add menu. The import form is the same one the
linear synteny view uses, so see
[Opening a linear synteny view](/docs/user_guides/linear_synteny_view#opening-a-linear-synteny-view)
for its Quick start / Manual modes and the file types it accepts. The only
dotplot-specific thing to know is that both axes come from the chosen track's
`assemblyNames` - the
[query](/docs/user_guides/linear_synteny_view#query-target-and-cigar)
horizontally and the target vertically - and that **Swap** transposes the plot
rather than reordering panels.

<Figure caption="Launching a dotplot view from the Add menu (top), then the import form's Manual mode, where you select two assemblies and optionally supply a synteny file (bottom). The same form is shared with the linear synteny view." src="/img/dotplot_add.png" />

<Figure caption="Dotplot of grape (Y-axis) vs peach (X-axis) genomes with a minimum alignment length applied. The two genomes are divergent enough that the minimap2 PAF is almost all sub-kilobase hits, so each block draws as a single dot. The horizontal band across grape chr12 is a repeat-rich region rather than synteny." src="/img/dotplot.png" />

### Cutting clutter on a busy plot

Two toolbar controls do most of the work on a whole-genome plot, and the figure
above uses the second:

- The palette button's **Color by** menu. **Query** gives each sequence on the
  horizontal axis its own color, and **Strand** and **Identity** color by those
  instead. Each option carries a description of what it colors. With more than
  one alignment file plotted together, **Distinct color per track** gives each
  its own color, and **Customize per track** below it overrides the mode or pins
  the color for one track at a time. A plot whose blocks are all a single pixel
  wide reads no better in color than in black, so reach for **Min length**
  first.
- **Min length**, in the settings popover, drops alignments shorter than the
  slider value. Divergent genomes align in many short fragments, and hiding them
  is usually what makes the syntenic blocks visible at all.

## A genome against itself

Aligning a sequence to itself puts its internal repeat structure on the plot.
Tandem arrays draw as filled wedges sitting on the diagonal, and inverted
repeats draw as crossings off it.

<Figure caption="T2T-CHM13 chrY aligned to itself over the euchromatic male-specific region, at a 25 kb minimum length. The filled wedge on the diagonal near 9.3 Mb is the TSPY tandem array. The lattice of crossings between 21 and 26 Mb is the Yq palindrome family, each arm meeting its own inverted copy off the diagonal." src="/img/dotplot_self_chry.png" />

Producing the alignment takes one extra minimap2 flag:

```bash
minimap2 -x asm20 -P chrY.fa chrY.fa > chrY_self.paf
jbrowse make-pif chrY_self.paf --csi
```

`-P` is not optional here. Without it minimap2 keeps one primary chain per query
and marks the rest secondary, so a sequence aligned to itself returns its own
diagonal and almost nothing else, which reads as the repeats not being there.
With `-P` every dispersed repeat is kept too, so set **Min length** afterwards
or the plot fills in solid at whole-chromosome zoom.

The two axes come from a synteny track's two `assemblyNames`, so a self
comparison needs two assembly entries pointing at the same sequence under
different names.

## Navigation and interaction

**Zooming:** the mouse wheel always zooms both axes simultaneously. Zoom buttons
in the toolbar work as well.

**Panning and box-selecting:** the toolbar has a mode toggle button (pan icon ↔
crosshair icon):

- Move mode (pan icon): dragging pans the view. Hold `Ctrl`/`Cmd` while dragging
  to draw a selection box instead.
- Crosshair mode (crosshair icon): dragging draws a selection box to zoom into
  or open a linear synteny view. Hold `Ctrl`/`Cmd` while dragging to pan
  instead.

**Aspect ratio lock:** the lock button in the toolbar constrains zooming and
box-selection to keep both axes at the same scale.

## Opening a synteny view from a dotplot view

Click and drag to select a region, then choose **Linear synteny view** from the
context menu to zoom into it in a new linear synteny view with both genomes as
tracks.

<Figure caption="Top: click-and-drag selection (pink highlight) on the grape vs peach dotplot, with the context menu showing 'Zoom in' and 'Linear synteny view'. Bottom: the resulting linear synteny view for the selected region (Pp02 vs chr15), with red connection lines linking each syntenic alignment block across the two genome panels." src="/img/synteny_from_dotplot_view.png" />

## See also

- [](/docs/user_guides/linear_synteny_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny)
- [Synteny/dotplot configuration](/docs/config_guides/synteny_track)
- [DotplotDisplay config schema](/docs/config/dotplotdisplay)
- [Gallery: synteny examples](/gallery/#synteny)
