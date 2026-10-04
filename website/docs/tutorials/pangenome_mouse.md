---
title: Pangenome (mouse)
description:
  Open the mouse strain pangenome, read Nnt against a reference that is itself
  one of the strains, then rank the graph for its densest bubble and descend
  into it
guide_category: Tutorials
tutorial_category: Pangenomes
---

The mouse strain pangenome aligns eighteen inbred and wild-derived strains from
the Mouse Genomes Project onto the GRCm39 reference with `minigraph`. GRCm39 is
itself one of the strains, C57BL/6J, which inverts the sign of the best-known
variant in the panel. No locus list has been published for these strains, so we
rank the graph for its most variable loci and open the densest bubble. We:

- at _Nnt_, read a C57BL/6J deletion as sequence the other strains have
- rank the bubbles in the graph and open the densest one that fits in a window,
  at _Dock2_
- check the bubble against the hosted index

Every step starts from the mouse graph page on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/mouse),
where it stays until a JBrowse 5 host for the graph plugin ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- htslib (`tabix`), to query the hosted index
- [`minigraph`](https://github.com/lh3/minigraph), to build a graph like this
  one

## Where the data comes from

The reference is UCSC's mm39 and the strains are the Mouse Genomes Project
assemblies as UCSC GenArk rehosts them. We host the graph, projected into the
files below.

- mm39 (GRCm39):
  https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.fa.gz
- the eighteen strains, one GenArk folder per GenBank accession:
  https://hgdownload.soe.ucsc.edu/hubs/GCA/
- segments:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.segs.bed.gz
- links:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.links.bed.gz
- bubbles:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz
- the allele inventory:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.alleles.bed.gz
- the coarse tier, one node per bubble:
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.tier10000.segs.bed.gz
  and
  https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.tier10000.links.bed.gz

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) describes what
each file holds.

## Load the graph

We'll load the reference, then the graph and its bubbles. The graph track names
the file prefix `build_pangenome_graph.sh` writes, and the `uri`s below are our
hosted copy, so swap the prefix for your own build. The segments, links and
bubbles are tabix-indexed.

```json addassembly
{
  "name": "mm39",
  "aliases": ["GRCm39"],
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.2bit",
  "refNameAliases": {
    "uri": "https://jbrowse.org/ucsc/mm39/mm39.chromAlias.txt"
  }
}
```

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "mouse_minigraph_segments",
  "name": "Mouse strain pangenome (rGFA segments)",
  "assemblyNames": ["mm39"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph",
    "coarse": {
      "uri": "https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.tier10000",
      "aboveBpPerPx": 328
    }
  },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

The bubbles lane reads the same build's bubble index:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "mouse_minigraph_bubbles",
  "name": "Mouse strain pangenome bubbles",
  "assemblyNames": ["mm39"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz"
  }
}
```

## Nnt: a deletion that appears as an insertion

Click **chr13** on the **Graph** line of the
[portal page](https://staging.genomes.jbrowse.org/pangenomes/mouse), which opens
the whole chromosome with the graph drawn one node per bubble. Type
`chr13:119,440,000-119,600,000`, and the graph track cuts the segments there.
Pick **Layout → Force-directed layout** from its track menu and tick **Mark
bubbles**. Turn on the bubbles track in the track selector.

C57BL/6J has a multi-exon deletion at _Nnt_ that abolishes the protein and makes
C57BL/6J mice glucose intolerant. **GRCm39 is C57BL/6J**, so the backbone of
this graph is the strain with the deletion. The graph shows the deletion as
sequence that the _other_ strains have and the reference lacks, the opposite
sign from the published descriptions.

<Figure caption="The Nnt window with the RefSeq genes and the bubbles lane above the force-directed graph track. The node hanging off the backbone beside Nnt is haloed and labelled as an insertion, because the reference is the strain that lacks the sequence." src="/img/pangenome/graph_mouse_nnt_halos.png" />

## Ranking the graph's bubbles to find Dock2 {#finding-the-loci}

The coarse tier records how many segments each bubble holds. Ranking the tier by
that count finds where the graph varies most, and intersecting the result with
the reference annotation names the loci.
[`generatePangenomeLoci.ts`](https://github.com/GMOD/jb2hubs/blob/main/website/generatePangenomeLoci.ts)
in the genomes.jbrowse.org repo computes the ranking.

The portal page's **Loci** table is the tier ranked by segments per bubble. It
recovers the vomeronasal receptor and Speer families and the immunoglobulin
heavy chain locus, and the rows above the _Dock2_ row are bubbles hundreds of
kilobases to megabases wide. The _Dock2_ row is the densest bubble that fits in
one cut, inside one intron at `chr11:34,516,044-34,560,497`. Click its **graph**
link, then pick **Layout → Force-directed layout** from the graph track menu and
tick **Mark bubbles**:

<Figure caption="The Dock2 intron bubble, the densest in the mouse graph that fits in one cut. The bubbles lane is a single row, the allele inventory draws each alternative path at its size, and the graph has one superbubble label, with Dock2 pinned under the backbone. The coloured path is C57BL/6J, the reference, and each charcoal loop is sequence other strains have and the reference lacks." src="/img/pangenome/mouse_dock2.png" />

`minigraph` writes no path lines, so the graph records only the assembly that
first contributed each allele: `firstSeenIn` in the allele inventory is that
construction order, and the graph does not list which strains have an allele.

## Finding the Dock2 bubble in the hosted bubble index

The _Dock2_ bubble is one row of the hosted bubble index:

```bash
tabix https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz \
  'mm39#0#chr11:34516044-34560497'
```

The row gives the segment count and route span the figure's superbubble label
prints.

## Building a minigraph graph from the strain assemblies

To build a graph like this one, run `minigraph` once per chromosome over the
sequence for that chromosome from each assembly, reference first so that it
takes rank 0:

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
# -xggs: incremental graph construction, adding each genome in turn
# -c: base-level alignment, which minigraph recommends for graph generation
minigraph -cxggs -t 8 mm39.chr13.fa strain1.chr13.fa strain2.chr13.fa > chr13.gfa
```

[](/docs/tutorials/pangenome_prepare_graph) then turns the graph into the files
above with one command, `build_pangenome_graph.sh`.
[`build_mouse_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_mouse_pangenome.sh)
runs the whole build: it downloads the assemblies, extracts each chromosome
renamed to PanSN, runs `minigraph` per chromosome, and joins the chromosomes
with their segment ids renumbered, which is most of a day of alignment.

The script writes a `README.txt` beside the data recording the source, the
modifications, the tool versions and the audits that ran. The build stops if the
reference path does not reproduce the reference chromosome lengths, or if
renumbering leaves a duplicate segment id; either failure produces a graph with
wrong coordinates that every later check accepts. Copy these audits into your
own build.

## See also

- [](/docs/tutorials/pangenome_cattle)
- [](/docs/tutorials/pangenome_prepare_graph)

## Citations

- Li H, Feng X, Chu C. The design and construction of reference pangenome graphs
  with minigraph. Genome Biology. 2020;21:265.
  https://doi.org/10.1186/s13059-020-02168-z
- Wick RR, Schultz MB, Zobel J, Holt KE. Bandage: interactive visualization of
  de novo genome assemblies. Bioinformatics. 2015;31(20):3350-3352.
  https://doi.org/10.1093/bioinformatics/btv383
