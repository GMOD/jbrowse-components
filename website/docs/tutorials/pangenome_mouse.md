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

The graph is hosted at
[staging.genomes.jbrowse.org/pangenomes/mouse](https://staging.genomes.jbrowse.org/pangenomes/mouse)
(staging, until the graph plugin's JBrowse 5 host ships), and every step below
starts from that page.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, the step
describes a current limit of the view. We welcome your [feedback](/contact).

:::

## Prerequisites

- htslib (`tabix`), to query the hosted indexes from the command line

## Where the data comes from

Each chromosome comes from one `minigraph` call over the reference followed by
the strains. The reference goes first, which gives it rank 0.

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
# -xggs is the incremental-graph-construction preset, adding each genome onto
# the growing graph in turn; -c adds base-level alignment, which minigraph
# recommends for graph generation
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

## Open a chromosome

On the [portal page](https://staging.genomes.jbrowse.org/pangenomes/mouse), the
**Graph** line opens a whole chromosome and the **Loci** table the graph's most
variable loci. Click **chr13** on the **Graph** line. JBrowse opens GRCm39's
chromosome 13 with the genes, a curve of segments per bubble and the bubble tier
as lanes, and under them the graph, cut from the same tier at one node per
bubble. The graph follows the linear view, and zoomed in past the handover the
segments track names, it cuts the segments.

## Nnt: a deletion that appears as an insertion

Start at _Nnt_. Type `chr13:119,440,000-119,600,000`, and the graph follows the
view down and cuts the segments there. Pick **Force-directed layout** from the
**Layout** dropdown, which holds the graph at this cut, since the force drawing
has no reference axis to follow. Turn on the bubbles and segments tracks in the
track selector to read the window lane by lane, as the figure does.

C57BL/6J carries a well-known multi-exon deletion at _Nnt_ that abolishes the
protein and makes B6J mice glucose intolerant. **GRCm39 is C57BL/6J**, so the
backbone of this graph is the strain with the deletion. The graph therefore
shows the deletion as sequence that the _other_ strains carry and the reference
lacks, the opposite sign from every description of it.

<Figure caption="The Nnt window with the RefSeq genes, the bubbles lane and the rGFA segments above the force-directed graph. The loop hanging off the backbone beside Nnt is haloed and labelled as an insertion, because the reference is the strain that lacks the sequence." src="/img/pangenome/graph_mouse_nnt_halos.png" />

## Finding the loci

_Nnt_ is a locus someone had already written about. The rest of this panel has
no published literature to read, so the loci have to come from the graph. The
coarse tier records how many segments each bubble holds. Ranking the tier by
that count reports where the graph varies most, and intersecting the result with
the reference annotation names the loci.

The portal page's **Loci** table is that ranking. It recovers the vomeronasal
receptor and Speer families and the immunoglobulin heavy chain locus without a
curated list, and the rows above _Dock2_'s are bubbles hundreds of kilobases to
megabases wide. _Dock2_'s row is the densest bubble that still fits in one cut,
inside one intron at `chr11:34,516,044-34,560,497`. Click its **graph** link.
The window opens with the genes, the bubbles, the allele inventory and the
segments as lanes, and the graph following under them. Pick **Force-directed
layout** from the **Layout** dropdown:

<Figure caption="The densest bubble in the mouse graph that still fits in one cut, found by ranking the coarse tier and named off the reference annotation. The gene lane shows only intron, the bubbles lane is a single row, the allele inventory draws each alternative path at its real size, and the graph carries one label naming the whole cut as a superbubble, with Dock2 pinned under the backbone. The coloured path is C57BL/6J, the reference, and every charcoal stretch is sequence it lacks, so each loop is a place where other strains depart from the reference." src="/img/pangenome/mouse_dock2.png" />

Because the ranking reads the graph, the method repeats on a panel nobody has
written about yet.
[`generatePangenomeLoci.ts`](https://github.com/GMOD/jb2hubs/blob/main/website/generatePangenomeLoci.ts)
in the genomes.jbrowse.org repo computes it.

## One bubble, one label

A bubble index has one row per bubble, and each row reports where the graph
varies and how much. No index row describes the inside of a bubble, so draw the
bubble as a force-directed graph and open it to see its contents.

The index lists the _Dock2_ window as a single bubble, so the whole cut the
**graph** link made is that bubble. One label names it in the index's terms, the
superbubble the figure under [Finding the loci](#finding-the-loci) carries, with
its segment count and the span of its routes. A bubble that fills the whole
drawing gets the label and no halo, because a halo around everything would mark
nothing.

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
[Browsing the HPRC graph](/docs/tutorials/pangenome_hprc#the-lpa-kringle-repeat)
opens one such level under its linear view.

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

[Pangenome (hosting your own graph)](/docs/tutorials/pangenome_prepare_graph)
turns a finished graph into the files above with one command,
`build_pangenome_graph.sh`. The mouse panel needs its graph built first, since
nobody has published one.
[`build_mouse_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_mouse_pangenome.sh)
downloads the assemblies, extracts one sequence per chromosome renamed to PanSN,
runs `minigraph` per chromosome and joins the chromosomes with their segment ids
renumbered, which is most of a day of alignment, before projecting the files.

The script writes a `README.txt` beside the data recording the source, the
modifications, the tool versions and the audits that ran. Copy the audits into
your own build. The build stops unless the reference path reproduces the
reference chromosome lengths, and stops on a duplicate segment id after
renumbering. Without these audits, either failure produces a graph with wrong
coordinates, and every downstream check passes on it.

## See also

- [](/docs/tutorials/pangenome_cattle)
- [](/docs/tutorials/pangenome_prepare_graph)

## References

- Li H, Feng X, Chu C. The design and construction of reference pangenome graphs
  with minigraph. Genome Biology. 2020;21:265.
  https://doi.org/10.1186/s13059-020-02168-z
- Wick RR, Schultz MB, Zobel J, Holt KE. Bandage: interactive visualization of
  de novo genome assemblies. Bioinformatics. 2015;31(20):3350-3352.
  https://doi.org/10.1093/bioinformatics/btv383
