---
title: Pangenome (HPRC) part 4, the graph as the picture
sidebar_label: Pangenome (HPRC, part 4)
description:
  Draw the LPA kringle repeat as a force-directed graph with every bubble named
  on it, open the array, and lift one haplotype's walk out to read how many
  copies it carries
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A pangenome graph holds shapes a linear track cannot draw: a repeat array is a
knot of loops, a haplotype that skips sequence is an edge around it, and a
region where dozens of haplotypes differ is a tangle. We draw the LPA kringle
IV-2 array from the Human Pangenome Reference Consortium's release 2 graph as a
graph, with each bubble named where it sits in the drawing, open the array to
see its copies, and then lift one haplotype's walk out of the tangle to read how
much sequence it carries through the array against GRCh38.
[Part 1](/docs/tutorials/pangenome_hprc) opened this graph beside the linear
view and [part 3](/docs/tutorials/pangenome_hprc_part3) cut the eight haplotypes
this page walks.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, that is a current
limit rather than a settled design. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  loaded the way part 1 loads it
- htslib (`tabix`), to query the hosted bubble index from the command line as
  the last section does

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), through the same
rGFA projections part 1 uses and the eight-haplotype cut part 3 makes.

- the rGFA segment and link index of the SV-resolution graph, on GRCh38:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.segs.bed.gz and
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.links.bed.gz
- the bubble index, one row per bubble from `gfatools bubble`:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz
- the KIV-2 bubble cut from the base-level graph for GRCh38 and eight
  haplotypes, with their walks:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.kiv2.eight-haplotypes.gfa

## The window as a graph

Open the LPA window from part 1 and pick **Force-directed layout** from the
Layout dropdown. The drawing is seeded along the reference, so GRCh38 runs left
to right under the linear view in the same colours, and every bubble the index
holds is drawn as a halo along its own nodes with a label saying what kind of
variation it is.

<Figure caption="The LPA window with the RefSeq genes, the HPRC bubbles and the rGFA segments above the force-directed graph. The kringle array is the knot of loops in the middle and its halo names it as a repeat array; the small halos on the backbone are the deletions and the insertion the index lists beside it, and LPA is pinned under the backbone with its exons drawn along it." src="/img/pangenome/graph_kiv2_halos.png" />

The session's gene track is drawn onto the graph as well: LPA's name is pinned
under the backbone at its midpoint, and its exons are the dark stretches along
the reference nodes that carry them, so the array's backbone copies show the
kringle exons they hold. An allele has no reference coordinates, so the loops
carry none.

The halos are the bubble index drawn onto the graph. A deletion is a halo around
the short arm of a bubble whose other arm is the backbone; an insertion is a
halo around a loop hanging off one point; the array is the whole knot. Their
labels carry the same numbers the bubbles lane above prints, so a bubble can be
found in either picture from the other.

## Open the array

Click the array's label. The view cuts the bubble's segments out of the graph on
screen and lays them out on their own, with a button back to the window. No
index row describes the inside of a bubble, so the popped graph derives its own
bubbles from the way its nodes layer along the reference, and a bubble inside a
bubble gets a label of its own to click in turn.

<Figure caption="The array's segments popped out of the window and drawn on their own. Each loop is a run of kringle copies a haplotype walks and the reference misses, and the popped graph's own label states how many routes it holds." src="/img/pangenome/graph_kiv2_popped.png" />

Every loop here is a different number of copies. The drawing says that much and
nothing more: the rGFA records which segments exist and how they link, and no
haplotype walks through it, so nothing in this file can say who takes which
loop.

## The same bubble with its walks

Part 3 cut this bubble from the base-level graph for GRCh38 and eight
haplotypes, keeping each haplotype's walk. Open that file with **Add → Graph
genome view**, or through the live link on the figure, and pick the
force-directed layout again.

<Figure caption="The eight-haplotype cut of the bubble, force-directed. Node width follows how many of the nine walks carry a node, so the reference is fat and each haplotype's private run of copies is a thin loop; the array's halo reads its route lengths off the walks, and each loop carries a chip naming the haplotypes that take it and how long it is." src="/img/pangenome/graph_kiv2_walks.png" />

Every route the walks take through the array is labelled at the far point of its
loop with the haplotypes that take it and its length, so the copy count of all
eight reads off one drawing. Where several haplotypes' private copies are drawn
on one loop the chips stack.

Two things changed because the file carries walks. A node's thickness is the
number of haplotypes through it, Bandage's depth drawn as width, so the backbone
every haplotype shares is the thick line and the copies one haplotype alone
carries are the thin loops. And the array's halo no longer counts routes through
a DAG: its label is the shortest and longest walk between the bubble's two ends,
which are real haplotype lengths.

## Lift one haplotype out

The **Walk** dropdown in the toolbar names each haplotype in the file. Pick one
and its route keeps its ink while every other node and link fades; a readout
beside the legend gives the walk's length through the window and how it compares
to the reference walk.

<Figure caption="HG00133 lifted out, then GRCh38. HG00133's private copies are the one loop drawn at full strength and its readout states its excess over the reference; lifting GRCh38 itself leaves every private loop a ghost and reads the reference length." src="/img/pangenome/graph_kiv2_walk_lifted.png" />

Lifting GRCh38 is the check. The reference takes no loop, so nothing but the
backbone stays lit, and its readout compares the walk to itself. Lifting each of
the other seven in turn reads each haplotype's copy count as an excess over the
reference, one at a time, off the same drawing.

## Check it against the index

The array's halo label in the first figure comes from one row of the hosted
bubble index. Query it:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz \
  'GRCh38#0#chr6:160616002-160646753'
```

The row's route count and its shortest and longest allele are what the label
printed, and its segment list is what the pop cut out. The walk lengths in the
last figure are not in this file at all: they come from the W lines of the
eight-haplotype cut, which is why the array reads as one bubble of nine routes
there and as a count of paths through the rGFA here.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_graph_nested)

## References

- Liao WW, Asri M, Ebler J, et al. A draft human pangenome reference. Nature.
  2023;617(7960):312-324. https://doi.org/10.1038/s41586-023-05896-x
- Wick RR, Schultz MB, Zobel J, Holt KE. Bandage: interactive visualization of
  de novo genome assemblies. Bioinformatics. 2015;31(20):3350-3352.
  https://doi.org/10.1093/bioinformatics/btv383
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens.
