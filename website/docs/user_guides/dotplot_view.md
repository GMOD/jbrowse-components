---
title: Dotplot view
description: Whole-genome synteny dotplot
guide_category: Views
---

The dotplot view plots alignments between two genome assemblies (or a read
against a reference). Syntenic regions appear as diagonal streaks, inversions as
reverse-diagonal segments, and translocations/rearrangements as off-diagonal
blocks.

## Opening a dotplot view

**Add → Dotplot view** opens the import form. It is the same one the linear
synteny view uses, so see
[Opening a linear synteny view](/docs/user_guides/linear_synteny_view#opening-a-linear-synteny-view)
for its Quick start / Manual modes and the file types it accepts. Three things
are dotplot-specific:

- Both axes come from the chosen track's `assemblyNames`: the
  [query](/docs/user_guides/linear_synteny_view#query-target-and-cigar)
  horizontally and the target vertically.
- **Swap** transposes the plot.
- A launch of two different genomes re-orders the vertical axis's chromosomes
  against the horizontal axis, so the alignments fall along the diagonal.

<Figure caption="Launching a dotplot from the Add menu (top), and the import form's Manual mode (bottom)." src="/img/dotplot_add.png" />

<Figure caption="Two yeast assemblies, S288C on x against YJM1447 on y." src="/img/gallery/yeast_dotplot.png" />

### Cutting clutter on a busy plot

On a whole-genome plot, start with **Min length** in the settings menu (the
sliders button in the header). It drops alignments shorter than the slider
value, and divergent genomes align in many short fragments, so hiding them
usually makes the syntenic blocks visible. A plot that still reads as specks is
too divergent for whole-genome scale; zoom to a smaller window.

<Figure caption="Grape (y) against peach (x) with a minimum alignment length applied." src="/img/dotplot.png" />

The palette button's **Color by** menu sets what the color means; each option
has a description:

- **Query** colors each sequence on the horizontal axis differently, and
  **Strand** colors by strand
- **Color by value** holds the numbers an alignment has, identity and mapping
  quality among them. A text column there paints one color per label (worked in
  [](/docs/tutorials/odp_linkage_groups_synteny)), and the view's
  `encoding.color.scale.domain` lists labels that take the palette in order and
  lead the legend
- **Distinct color per track** gives each of several plotted alignment files a
  separate color, and **Track colors** below it pins one track's color

The rest of the settings menu:

- **Opacity** and **Line width** set how each alignment draws
- **Identity fade** fades each alignment by its sequence identity
- **CIGAR indels** draws per-base indels inside an alignment
- **Level of detail** sets how much of a tiered file is loaded
- **Gridlines** extends each axis' ruler ticks across the plot. At whole-genome
  zoom neither axis has room for ticks, so the row reads **none at this zoom**
  while it stays ticked

## A genome against itself

Aligning a sequence to itself puts its internal repeat structure on the plot.
Tandem arrays draw as filled wedges sitting on the diagonal, and inverted
repeats draw as crossings off it. The male-specific Y is also dense in dispersed
repeats, drawn at any minimum length that keeps the palindromes.

<Figure caption="T2T-CHM13 chrY against itself at a 25 kb minimum length, with the TSPY array and the P1 to P5 palindromes boxed." src="/img/dotplot_self_chry.png" />

The boxes' coordinates come from the T2T-CHM13 Y chromosome paper
([Rhie et al. 2023](https://www.nature.com/articles/s41586-023-06457-y)).
Zooming to the boxed 4.8 Mb separates the palindromes into four crossings, and
the same track opens one of them in a
[linear synteny view](/docs/user_guides/linear_synteny_view) colored by strand:
the arms draw as a single minus-strand ribbon over the plus-strand match of the
sequence to itself. The unpainted gaps inside the arms are where the two copies
differ.

<Figure caption="Top: the boxed span replotted at a 100 kb minimum length. Bottom: one crossing in a linear synteny view, colored by strand." src="/img/synteny_self_chry_palindromes.png" />

Use the plot to find the structures and a synteny view on one of them: ribbons
span the full height of the strip and stack, so the whole 4.8 Mb box draws as a
solid block in a synteny view.

Align the sequence to itself with one extra minimap2 flag:

```bash
minimap2 -x asm20 -P chrY.fa chrY.fa > chrY_self.paf
jbrowse make-pif chrY_self.paf --csi
```

`-P` is required here: without it minimap2 keeps one primary chain per query and
marks the rest secondary, so a sequence aligned to itself returns the diagonal
and little else. With `-P` every dispersed repeat is kept too, so set **Min
length** afterwards or the plot fills in solid at whole-chromosome zoom.

The dotplot's two axes come from a synteny track's two `assemblyNames`, so a
self comparison needs two assembly entries pointing at the same sequence under
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

**Aspect ratio lock:** **Lock aspect ratio (same bp/px)**, in the ⋮ menu in the
dotplot header, constrains zooming and box-selection to keep both axes at the
same scale.

## Opening a synteny view from a dotplot view

Click and drag to select a region, then choose **Linear synteny view** from the
context menu to zoom into it in a new linear synteny view with both genomes as
tracks.

<Figure caption="Top: a drag selection on the dotplot and its menu. Bottom: the linear synteny view it opens." src="/img/synteny_from_dotplot_view.png" />

## See also

- [](/docs/user_guides/linear_synteny_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny)
- [Synteny/dotplot configuration](/docs/config_guides/synteny_track)
- [DotplotDisplay config schema](/docs/config/dotplotdisplay)
