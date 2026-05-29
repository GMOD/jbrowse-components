---
title: Linear synteny view
description: Side-by-side alignment of two genomes
guide_category: Views
---

The linear synteny view stacks two genomes horizontally, one above the other,
and draws their alignments as ribbons connecting matching regions across the two
panels. Each genome panel behaves like a linear genome view, so you can scroll,
zoom, and add tracks to either side independently while the ribbons update to
follow.

Forward-strand alignments are drawn in one color and inverted alignments in
another, so a ribbon that twists or crosses between the panels marks an
inversion or rearrangement relative to the other genome.

### Opening a linear synteny view

1. Launch a new Linear synteny view, then select the two assemblies to compare
2. Optionally, add a .paf, .out (MashMap), .delta (Mummer), .chain, .anchors or
   .anchors.simple (MCScan) file

<Figure caption="The shared import form for synteny and dotplot views. You can select two different assemblies and an additional file can be supplied." src="/img/dotplot_add.png" />

<Figure caption="Screenshot showing the linear synteny view for the grape vs peach genome." src="/img/linear_synteny.png" />

For a step-by-step walkthrough of loading assemblies, generating a PAF with
minimap2, and using the dotplot and linear synteny views together, see the
[Synteny visualization](/docs/tutorials/synteny_visualization) tutorial.
