---
title: Dotplot view
description: Whole-genome synteny dotplot
guide_category: Views
---

The dotplot view shows alignments between genome assemblies, or between a single
read and a reference genome. Syntenic regions appear as diagonal lines or
blocks; inversions appear as reverse-diagonal segments; translocations and
rearrangements appear as off-diagonal blocks.

### Opening a dotplot view

1. Launch a new Dotplot view, then select the two assemblies to compare
2. Optionally, add a .paf, .out (MashMap), .delta (MUMmer), .chain, .anchors or
   .anchors.simple (MCScan) file

<Figure caption="Launching a dotplot view from the Add menu (top), then the import form where you select two assemblies and optionally supply a synteny file (bottom). The same form is shared with the linear synteny view." src="/img/dotplot_add.png" />

<Figure caption="Dotplot of grape (Y-axis) vs peach (X-axis) genomes. Diagonal streaks are syntenic blocks where the two genomes are collinear. Off-diagonal blocks indicate chromosomal rearrangements; reverse-diagonal segments indicate inversions." src="/img/dotplot.png" />

### Navigation and interaction

**Zooming:** the mouse wheel always zooms both axes simultaneously. Zoom buttons
in the toolbar work as well.

**Panning and box-selecting:** the toolbar has a mode toggle button (pan icon ↔
crosshair icon):

- **Move mode** (pan icon): dragging pans the view. Hold `Ctrl`/`Cmd` while
  dragging to draw a selection box instead.
- **Crosshair mode** (crosshair icon): dragging draws a selection box to zoom
  into or open a linear synteny view. Hold `Ctrl`/`Cmd` while dragging to pan
  instead.

**Aspect ratio lock:** the lock button in the toolbar constrains zooming and
box-selection to keep both axes at the same scale.

### Opening a synteny view from a dotplot view

Click and drag to select a region in the dotplot, then choose **Open linear
synteny view** from the context menu. This zooms into that region in a new
linear synteny view with both genomes shown as tracks.

<Figure caption="Top: click-and-drag selection (pink highlight) on the grape vs peach dotplot, with the context menu showing 'Zoom in' and 'Open linear synteny view'. Bottom: the resulting linear synteny view for the selected region (Pp02 vs chr15), with red connection lines linking each syntenic alignment block across the two genome panels." src="/img/synteny_from_dotplot_view.png" />

For a step-by-step walkthrough of loading assemblies, generating a PAF with
minimap2, and using the dotplot and linear synteny views together, see the
[Synteny visualization](/docs/tutorials/synteny_visualization) tutorial.
