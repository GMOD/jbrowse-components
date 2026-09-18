---
title: Pangenome (mouse)
description:
  Open the mouse strain pangenome, read Nnt against a reference that is itself
  one of the strains, then rank the graph for its densest bubble and descend
  into it
guide_category: Tutorials
tutorial_category: Pangenomes
---

A pangenome graph of nineteen mouse genomes shows where the strains differ from
one another and by how much. This one is the GRCm39 reference plus eighteen
inbred and wild-derived strains from the Mouse Genomes Project, aligned together
with `minigraph`. Two things make it worth reading. The reference is itself one
of the strains, which inverts the sign of the best-known variant in it. And
nobody has published a locus list for this panel, so the loci have to come out
of the graph.

We serve the graph as the same rGFA projections the
[HPRC pangenome page](/docs/tutorials/pangenome_hprc/) opens, so the tracks, the
adapters and the coarse tier are that page's.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, the step
describes a current limit of the view. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  loaded the way the HPRC page loads it
- htslib (`tabix`), to query the hosted indexes from the command line

## Where the data comes from

Each chromosome comes from one `minigraph` call over the reference followed by
the strains. The reference goes first, which gives it rank 0.

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
minigraph -cxggs -t "$THREADS" $(tr '\n' ' ' < "chrom/$c/order.txt")
```

The projections are hosted beside the graph:

- the segment and link index:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.segs.bed.gz and
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.links.bed.gz
- the bubble index:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz
- the allele inventory:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.alleles.bed.gz
- the coarse tier:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.tier10000

[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) describes
what each of those files holds and how a graph produces them.

`minigraph` writes no path lines, so this graph records no carriage, meaning
nothing in it records which strain carries a given allele, and `firstSeenIn` in
the allele file is construction order. [](/docs/tutorials/pangenome_cattle) is
the panel where path lines recover it.

## Nnt: a deletion that appears as an insertion

Start at `Nnt`. Type `chr13:119,440,000-119,600,000`, cut the window from the
segments track with **Launch → Graph genome view (this region)**, and pick
**Force-directed layout** from the **Layout** dropdown. C57BL/6J carries a
well-known multi-exon deletion there that abolishes the protein and makes B6J
mice glucose intolerant. **GRCm39 is C57BL/6J**, so the backbone of this graph
is the strain with the deletion. The graph therefore shows the deletion as
sequence that the _other_ strains carry and the reference lacks, the opposite
sign from every description of it.

<Figure caption="The Nnt window with the RefSeq genes, the bubbles lane and the rGFA segments above the force-directed graph. The loop hanging off the backbone beside Nnt is haloed and labelled as an insertion, because the reference is the strain that lacks the sequence." src="/img/pangenome/graph_mouse_nnt_halos.png" />

## Finding the loci

`Nnt` is a locus someone had already written about. The rest of this panel has
no published literature to read, so the loci have to come from the graph. The
coarse tier records how many segments each bubble holds. Ranking the tier by
that count reports where the graph varies most, and intersecting the result with
the reference annotation names the loci.

The ranking recovers the beta-defensin cluster, the vomeronasal receptor and
Speer families and the immunoglobulin heavy chain locus without a curated list.
The densest window it returns is a single bubble inside one intron of `Dock2`,
at `chr11:34,516,044-34,560,497`:

<Figure caption="The densest bubble in the mouse graph that still fits in one cut, found by ranking the coarse tier and named off the reference annotation. The gene lane shows only intron, the bubbles lane is a single row, the allele inventory draws each alternative path at its real size, and the graph carries one label naming the whole cut as a superbubble, with Dock2 pinned under the backbone. The coloured path is C57BL/6J, the reference, and every charcoal stretch is sequence it lacks, so each loop is a place where other strains depart from the reference." src="/img/pangenome/mouse_dock2.png" />

Because the ranking reads the graph, the method repeats on a panel nobody has
written about yet.
[`generatePangenomeLoci.ts`](https://github.com/GMOD/jb2hubs/blob/main/website/generatePangenomeLoci.ts)
in the genomes.jbrowse.org repo computes the ranking. That repo publishes the
derived catalogues at
[staging.genomes.jbrowse.org/pangenomes/mouse](https://staging.genomes.jbrowse.org/pangenomes/mouse)
— staging, until the graph plugin's JBrowse 5 host ships — so a locus can be
opened without building anything.

## One bubble, one label

A bubble index has one row per bubble, and each row reports where the graph
varies and how much. No index row describes the inside of a bubble, so draw the
bubble as a force-directed graph and open it to see its contents.

Type `chr11:34,516,044-34,560,497`, the _Dock2_ intron, and cut it the way the
[Nnt step](#nnt-a-deletion-that-appears-as-an-insertion) does. The index lists
this window as a single bubble, so the whole cut is that bubble. One label names
it in the index's terms, the superbubble the figure under
[Finding the loci](#finding-the-loci) carries, with its segment count and the
span of its routes. A bubble that fills the whole drawing gets the label and no
halo, because a halo around everything would mark nothing.

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

_Nnt_ holds one large allele that the other strains carry and the reference
lacks, so its cut should hold nothing to descend into. The
[Nnt figure](#nnt-a-deletion-that-appears-as-an-insertion) halos that allele as
a plain insertion, and none of its labels is a superbubble.

## Check it against the index

The _Dock2_ halo is one row of the hosted bubble index:

```bash
tabix https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz \
  'mm39#0#chr11:34516044-34560497'
```

The label printed this same segment count and route span. No file holds the
bubbles inside it. The view derives them from the popped graph's layering each
time the level opens, and discards them when the level closes.

## Build it yourself

[`build_mouse_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_mouse_pangenome.sh)
downloads the assemblies, extracts one sequence per chromosome renamed to PanSN,
runs `minigraph` per chromosome, concatenates, and projects the files above. It
is a long run, most of a day of alignment.

The script writes a `README.txt` beside the data recording the source, the
modifications, the tool versions and the audits that ran. Copy the audits into
your own build. The build stops unless the reference path reproduces the
reference chromosome lengths, and stops on a duplicate segment id after
renumbering. Without these audits, either failure produces a graph with wrong
coordinates, and every downstream check passes on it.

## See also

- [](/docs/tutorials/pangenome_cattle)
- [](/docs/tutorials/pangenome_graph_reading)
- [](/docs/tutorials/pangenome_prepare_graph)

## References

- Li H, Feng X, Chu C. The design and construction of reference pangenome graphs
  with minigraph. Genome Biology. 2020;21:265.
  https://doi.org/10.1186/s13059-020-02168-z
- Wick RR, Schultz MB, Zobel J, Holt KE. Bandage: interactive visualization of
  de novo genome assemblies. Bioinformatics. 2015;31(20):3350-3352.
  https://doi.org/10.1093/bioinformatics/btv383
