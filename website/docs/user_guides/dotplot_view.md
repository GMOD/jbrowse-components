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

**Add → Dotplot view** opens the import form. It is the same one the linear
synteny view uses, so see
[Opening a linear synteny view](/docs/user_guides/linear_synteny_view#opening-a-linear-synteny-view)
for its Quick start / Manual modes and the file types it accepts. The only
dotplot-specific thing to know is that both axes come from the chosen track's
`assemblyNames` - the
[query](/docs/user_guides/linear_synteny_view#query-target-and-cigar)
horizontally and the target vertically - and that **Swap** transposes the plot
rather than reordering panels.

<Figure caption="Launching a dotplot view from the Add menu (top), then the import form's Manual mode, where you select two assemblies and optionally supply a synteny file (bottom). The same form is shared with the linear synteny view." src="/img/dotplot_add.png" />

<Figure caption="Two yeast assemblies, S288C/R64 on the X-axis against the YJM1447 strain on the Y. The diagonal runs corner to corner and steps off itself once, on chromosome XII, which is a rearrangement between the strains." src="/img/gallery/yeast_dotplot.png" />

### Cutting clutter on a busy plot

Two toolbar controls do most of the work on a whole-genome plot, and the figure
below uses the second:

- The palette button's **Color by** menu. **Query** gives each sequence on the
  horizontal axis its own color, and **Strand** and **Identity** color by those
  instead. Each option carries a description of what it colors. With more than
  one alignment file plotted together, **Distinct color per track** gives each
  its own color, and **Customize per track** below it overrides the mode or pins
  the color for one track at a time. A plot whose blocks are all a single pixel
  wide reads no better in color than in black, so reach for **Min length**
  first.
- **Min length**, in the settings menu, drops alignments shorter than the slider
  value. Divergent genomes align in many short fragments, and hiding them is
  usually what makes the syntenic blocks visible at all.

<Figure caption="Grape (Y-axis) against peach (X-axis), with a minimum alignment length already applied. These two are divergent enough that every block still draws as a single dot and no diagonal survives. The horizontal band across grape chr12 is a repeat-rich region rather than synteny." src="/img/dotplot.png" />

When a plot still reads as specks after Min length, the pair is too divergent
for a whole-genome view to say anything; the next move is a smaller window
rather than another setting.

## A genome against itself

Aligning a sequence to itself puts its internal repeat structure on the plot.
Tandem arrays draw as filled wedges sitting on the diagonal, and inverted
repeats draw as crossings off it. Everything else on the plot is real too: the
male-specific Y is dense in dispersed repeats, and at any minimum length that
keeps the palindromes those blocks are drawn as well.

<Figure caption="T2T-CHM13v2 chrY aligned to itself over the euchromatic male-specific region, at a 25 kb minimum length. Boxed on the diagonal, the TSPY tandem array; boxed off it, the P1 to P5 Yq palindrome family, each arm meeting its own inverted copy." src="/img/dotplot_self_chry.png" />

Both structures are described in the T2T-CHM13 Y chromosome paper
([Rhie et al. 2023](https://www.nature.com/articles/s41586-023-06457-y)), which
is where the coordinates the boxes use come from.

The plot says where the palindromes are and not what one is. Zooming it to the
boxed 4.8 Mb separates the family into four crossings, and for what one of them
is the same track opens in a
[linear synteny view](/docs/user_guides/linear_synteny_view) instead, both
panels framing one palindrome and colored by strand: the arms draw as a single
minus-strand ribbon over the plus-strand match of the sequence to itself.

The gene lanes say the same thing from the annotation. Each arm carries its own
copies of the same Y-linked families, RBMY1B and RBMY1A1 on one side against
RBMY1D and RBMY1E on the other, CDY10P and CDY11P either side of the centre. The
unpainted gaps inside the arms are where the two copies differ.

<Figure caption="Top, the boxed 4.8 Mb replotted on its own at a 100 kb minimum length, where four crossings survive. Bottom, one of them in a linear synteny view, colored by strand, with the genes beneath each panel. The pinched magenta ribbon is the inverted alignment." src="/img/synteny_self_chry_palindromes.png" />

Which view to reach for is a question of how many alignments are in frame. Every
ribbon spans the full height of the strip, so ribbons stack rather than
separate: the same track over the whole 4.8 Mb box above is a mat, where a
dotplot gives each alignment its own place on two axes. Use the plot to find the
structures and a synteny view on one of them.

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

<Figure caption="Top: a click-and-drag selection on the grape vs peach dotplot, with the context menu offering 'Zoom in' and 'Linear synteny view'. Bottom: the linear synteny view it opens for the selected region." src="/img/synteny_from_dotplot_view.png" />

## See also

- [](/docs/user_guides/linear_synteny_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny)
- [Synteny/dotplot configuration](/docs/config_guides/synteny_track)
- [DotplotDisplay config schema](/docs/config/dotplotdisplay)
- [Gallery: synteny examples](/gallery/#synteny)
