---
id: dotplot_view
title: Dotplot view
description: Whole-genome synteny dotplot
guide_category: Views
---

import Figure from '../figure'

The dotplot view is a 2D comparative view that displays alignments between
genome assemblies, or between a single read and the genome. Syntenic regions
appear as diagonal lines or blocks; inversions appear as reverse-diagonal
segments; translocations and rearrangements appear as off-diagonal blocks.

### Opening a dotplot view

1. Navigate on the header bar `Add` → `Dotplot view`
2. Select the genome assemblies of interest
3. Optionally, add a .paf, .out (MashMap), .delta (Mummer), .chain, .anchors or
   .anchors.simple (MCScan) file

<Figure caption="Adding a new dotplot or synteny view via the menubar." src="/img/dotplot_menu.png" />

<Figure caption="Screenshot of the import form for a dotplot or synteny view. You can select two different assemblies and an additional file can be supplied." src="/img/dotplot_add.png" />

<Figure caption="Screenshot of a dotplot visualization of the grape vs the peach genome." src="/img/dotplot.png" />

<Figure caption="Screenshot showing the linear synteny view for the grape vs peach genome." src="/img/linear_synteny.png" />

### Opening a synteny view from a dotplot view

You can open a synteny view from a dotplot view by selecting a region on the
dotplot and clicking "Open linear synteny view", shown below:

<Figure caption="Screenshot showing the 'click and drag' selection over the dotplot view which prompts you to open up a linear synteny view from the selected region." src="/img/synteny_from_dotplot_view.png" />

For a step-by-step walkthrough of loading assemblies, generating a PAF with
minimap2, and using the dotplot and linear synteny views together, see the
[Synteny and genome alignment tutorial](/docs/tutorials/synteny_visualization).
