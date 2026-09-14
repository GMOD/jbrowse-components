---
title: Pangenome (mouse), a bubble inside a bubble
sidebar_label: Pangenome (mouse, nested bubbles)
description:
  Open the densest bubble in the mouse strain graph as a force-directed graph,
  and descend into it level by level with bubbles the graph derives for itself
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A bubble index has one row per bubble, and each row reports where the graph
varies and how much. A large bubble covers a whole region. The densest bubble in
the mouse strain graph holds hundreds of segments inside one intron of _Dock2_.
No index row describes the inside of a bubble, so we draw the bubble as a
force-directed graph and open it to see its contents.
[Pangenomes beyond human](/docs/tutorials/pangenome_nonhuman) builds this graph
and finds the bubble.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, the step
describes a current limit of the view. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  loaded the way the HPRC page loads it
- htslib (`tabix`), to query the hosted bubble index as the last section does

## Where the data comes from

The data is the mouse strain graph from
[Pangenomes beyond human](/docs/tutorials/pangenome_nonhuman). One `minigraph`
call per chromosome built it from GRCm39 and eighteen strain assemblies, and we
serve it as rGFA projections.

- the segment and link index:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.segs.bed.gz and
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.links.bed.gz
- the bubble index:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz

## One bubble, one label

Type `chr11:34,516,044-34,560,497`, the _Dock2_ intron, cut it from the segments
track with **Launch → Graph genome view (this region)** and pick
**Force-directed layout** from the **Layout** dropdown. The index lists this
window as a single bubble, so the whole cut is that bubble. One label names it
in the index's terms: a superbubble, with its segment count and the span of its
routes. A bubble that fills the whole drawing gets the label and no halo,
because a halo around everything would mark nothing.

<Figure caption="The Dock2 intron window with the RefSeq genes, the bubbles lane and the rGFA segments above the force-directed graph. The bubbles lane is one row, and the graph's one label names the whole cut as a superbubble." src="/img/pangenome/graph_mouse_dock2_halos.png" />

The view pins Dock2 under the backbone, and no exon stretch appears anywhere in
the cut. The gene track on the graph and the linear view above it both show that
the cut is intron.

A superbubble is the index's name for a bubble too big to type. The label gives
a segment count and a route range and no kind, since the row's numbers describe
the whole region at once.

## Open it, and open what is inside

Click the label. The view cuts out the bubble's segments and lays out only
those. It then derives bubbles from the popped graph. A backbone node that no
edge jumps over is a boundary, and whatever lies between two boundaries is a
bubble. Each derived bubble gets a halo and a label, and one of them opens in
turn.
[Part 4 of the HPRC tutorial](/docs/tutorials/pangenome_graph_reading#open-the-array)
shows one such level opened under its linear view.

Each level has a button that returns to the level above, so you climb back out
in the order you descended. The view types the labels at each level the way the
index types a bubble. The type comes from the reference interval a bubble
replaces and from the shortest and longest route through it. The layering gives
those values for any anchored graph.

## The control

_Nnt_ is the window Pangenomes beyond human opens first. It holds one large
allele that the other strains carry and the reference lacks. Type
`chr13:119,440,000-119,600,000` and cut it the same way. Nnt should halo as a
plain insertion with nothing to descend into.

<Figure caption="The Nnt window force-directed. The large loop halos as one insertion beside the smaller sites along the backbone, Nnt's exons run along the reference nodes with its name pinned under them, and no halo is a superbubble." src="/img/pangenome/graph_mouse_nnt_halos.png" />

## Check it against the index

The first figure's halo is one row of the hosted bubble index:

```bash
tabix https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz \
  'mm39#0#chr11:34516044-34560497'
```

The label printed this same segment count and route span. No file holds the
bubbles inside it. The view derives them from the popped graph's layering each
time the level opens, and discards them when the level closes.

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
