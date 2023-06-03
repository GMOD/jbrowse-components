---
id: dotplot_view
title: Dotplot view
---

import Figure from '../figure'

The dotplot view is a 2D comparative view that can display alignments between
different genome assemblies, or even compare a long-read or NGS short-read
against the genome.

### Opening a dotplot view

1. Navigate on the header bar `Add`->`Dotplot view`
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

<Figure caption="Screenshow showing the 'click and drag' selection over the dotplot view which prompts you to open up a linear synteny view from the selected region." src="/img/synteny_from_dotplot_view.png" />
