---
title: Pangenome (mouse), a bubble inside a bubble
sidebar_label: Pangenome (mouse, nested bubbles)
description:
  Open the densest bubble in the mouse strain graph as a force-directed graph,
  and descend into it level by level with bubbles the graph derives for itself
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A bubble index reports where a graph varies and how much, one row per bubble,
but a large bubble is a region rather than a variant: the densest bubble in the
mouse strain graph holds hundreds of segments inside one intron of _Dock2_. No
index row describes the inside of a bubble, so we draw it as a force-directed
graph and open it to show what the inside is made of.
[Pangenomes beyond human](/docs/tutorials/pangenome_nonhuman) is where this
graph comes from and where the bubble was found.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, that is a current
limit rather than a settled design. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  loaded the way the HPRC page loads it
- htslib (`tabix`), to query the hosted bubble index as the last section does

## Where the data comes from

The mouse strain graph of
[Pangenomes beyond human](/docs/tutorials/pangenome_nonhuman): GRCm39 and
eighteen strain assemblies through one `minigraph` call per chromosome, served
as rGFA projections.

- the segment and link index:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.segs.bed.gz and
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.links.bed.gz
- the bubble index:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz

## One bubble, one label

Open the _Dock2_ window as a graph and pick **Force-directed layout**. The index
lists this window as a single bubble, so the whole cut is that bubble, and one
label names it with the index's own terms: a superbubble, with its segment count
and the span of its routes. A halo around everything would mark nothing, so a
bubble that is the whole drawing keeps its label and goes without one.

<Figure caption="The Dock2 intron window with the RefSeq genes, the bubbles lane and the rGFA segments above the force-directed graph. The bubbles lane is one row and the graph carries one label, naming the whole cut as a superbubble." src="/img/pangenome/graph_mouse_dock2_halos.png" />

Dock2 itself is pinned under the backbone, with no exon stretch anywhere in the
cut: the gene track shows the same fact on the graph that the linear view shows
above it, that this is intron.

A superbubble is the index's name for a bubble too big to type. The label
reflects that: it gives a segment count and a route range and no kind, since the
row's numbers describe the whole region at once.

## Open it, and open what is inside

Click the label. The view cuts the bubble's segments out and lays them out on
their own, and then derives bubbles from the popped graph itself: a backbone
node that no edge jumps over is a boundary, and whatever lies between two
boundaries is a bubble. Those get halos and labels of their own, and one of them
opens in turn.
[Part 4 of the HPRC tutorial](/docs/tutorials/pangenome_graph_reading#open-the-array)
shows one such level opened under its linear view.

Each level keeps the one above it behind a button, so the descent unwinds the
way it was made. The labels at each level are typed the way the index types a
bubble, from the reference interval a bubble replaces and the shortest and
longest route through it, which the layering states for any anchored graph.

## The control

_Nnt_ is the window Pangenomes beyond human opens first: one large allele the
other strains carry and the reference lacks. Drawn the same way it should halo
as a plain insertion and hold nothing to descend into.

<Figure caption="The Nnt window force-directed. The large loop halos as one insertion beside the smaller sites along the backbone, Nnt's exons run along the reference nodes with its name pinned under them, and no halo is a superbubble." src="/img/pangenome/graph_mouse_nnt_halos.png" />

## Check it against the index

The first figure's halo is one row of the hosted bubble index:

```bash
tabix https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz \
  'mm39#0#chr11:34516044-34560497'
```

The label printed this same segment count and route span. The bubbles inside it
are in no file: they are read off the popped graph's layering each time it
opens, and closing the level discards them.

## See also

- [](/docs/tutorials/pangenome_nonhuman)
- [](/docs/tutorials/pangenome_graph_reading)

## References

- Li H, Feng X, Chu C. The design and construction of reference pangenome graphs
  with minigraph. Genome Biology. 2020;21:265.
  https://doi.org/10.1186/s13059-020-02168-z
- Wick RR, Schultz MB, Zobel J, Holt KE. Bandage: interactive visualization of
  de novo genome assemblies. Bioinformatics. 2015;31(20):3350-3352.
  https://doi.org/10.1093/bioinformatics/btv383
