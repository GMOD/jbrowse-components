---
title: Pangenome (HPRC) part 1, reading the graph
sidebar_label: Pangenome (HPRC 1, reading the graph)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, cut a
  locus out of it, and follow one allele back to the haplotype that carries it
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A pangenome graph records what a set of genomes share and where they diverge.
Sequence that one person carries and the reference lacks is therefore an object
in the file. We open the Human Pangenome Reference Consortium's release 2 graph
at a locus and draw it beside GRCh38. We then follow one allele from the drawing
back to the GRCh38 coordinates where it attaches, and then to the haplotype it
came from. [Part 2](/docs/tutorials/pangenome_hprc_part2) reads who carries that
sequence from the rest of the release on the same axis.
[Part 3](/docs/tutorials/pangenome_hprc_part3) moves the same haplotypes off
that axis and onto the haplotypes' assembly coordinates.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, the step
describes a current limit of the view. We welcome your [feedback](/contact).

:::

## Prerequisites

- a JBrowse 5 build, [Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop), with
  [the GraphGenomeView plugin](#the-graphgenomeview-plugin) loaded; the graph
  track needs the plugin, and every other track here is a URL you can paste
- htslib (`bgzip`, `tabix`), for the two commands that query the hosted indexes
  from the command line, and `gfatools` for the command that built them; both
  are for [Reproduce it end to end](#reproduce-it-end-to-end) and the
  [other windows](#other-windows-to-cut), and the route itself runs none
- nothing at all, to follow the first five steps: the
  [HPRC page on genomes.jbrowse.org](/docs/tutorials/genomes_pangenome) opens
  this graph at twenty loci, from the same files and the same build as the track
  below, so a session it opens has the graph track in it and the plugin loaded

The steps below build no graph file.
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) builds one
and lists what that takes.

## Where the data comes from

The data is [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710). We
read its Minigraph-Cactus graph through small tabix projections that we host
beside it, and fetch the contributing assemblies from their original archives.

- the SV-resolution graph (`sv.gfa`), which is the minigraph backbone we build
  our rGFA tabix projections from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- every release 2 assembly as a UCSC GenArk hub, a 2bit and an alias file per
  haplotype; this is haplotype 2 of NA20809, the one the graph opens below:
  https://hgdownload.soe.ucsc.edu/hubs/GCA/044/166/615/GCA_044166615.1/
- that haplotype's CAT annotation, whole genome, from the index above:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/NA20809/assemblies/release2/annotation/cat/NA20809_hap2_hprc_r2_v1.0.1_cat_v1.3.gff3.gz
- our rGFA projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt

All three pages read the release's `v2.1/` build, so node ids agree across the
pages. The one exception is the alignment that
[part 3](/docs/tutorials/pangenome_hprc_part3#the-alignment-underneath-both)
opens, which only the `v2.0/` build carries.

## The route

At the MHC class II locus, many haplotypes replace 12 kb of GRCh38 with 1.8 kb
of different sequence. The graph stores that replacement as one object with a
length, attached to the reference on either side of the 12 kb it replaces. We
find that object on the drawing, read where it sits on GRCh38, and then load the
haplotype it came from to see what the replacement does to the genes there. Six
steps, each one section:

1. [Start](#start) in hg38 with its genes and nothing else.
2. [Add the graph track](#add-the-graph-track) and go to the MHC class II
   window.
3. [Cut that window out as a graph](#cut-the-window-out-as-a-graph) and learn
   the four words that describe it.
4. [Lay the graph out on GRCh38 coordinates](#lay-it-out-on-grch38-coordinates)
   to find the allele.
5. [Take the allele back to its GRCh38 interval](#from-the-allele-back-to-grch38)
   and read which haplotype contributed it.
6. [Load that haplotype](#loading-a-haplotype-as-an-assembly) and open the
   allele on its own chromosome.

## The GraphGenomeView plugin

GraphGenomeView is beta and not in the
[plugin store](/docs/user_guides/plugin_store) yet, so it loads by URL. In
JBrowse Web that is a `plugins` array at the top level of `config.json`, beside
`assemblies` and `tracks` (see
[configuring plugins](/docs/config_guides/plugins)):

<!-- GRAPH_PLUGIN_CONFIG START -->

```json
{
  "plugins": [
    {
      "name": "GraphGenomeView",
      "esmUrl": "https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js"
    }
  ]
}
```

<!-- GRAPH_PLUGIN_CONFIG END -->

On [JBrowse Desktop](/docs/quickstart_desktop), install it once from the start
screen at **Global plugins... → Add custom plugin**, putting that `esmUrl` under
**Advanced options** in **ESM build URL** and leaving the two fields above it
empty.

The plugin reads two things core first exported in v5.0.0-beta.1, so it needs a
JBrowse 5 build. The
[graph genome view guide](/docs/user_guides/graph_genome_view) covers the view's
layouts, colors and menus on a smaller graph than this one.

## Start

The route starts in a session holding hg38, its RefSeq genes and nothing of the
pangenome. If your JBrowse already has hg38 with a gene track, open it there and
skip to the [next step](#add-the-graph-track). With nothing installed, press
**graph** on the HLA / MHC row of the
[hosted page](/docs/tutorials/genomes_pangenome#a-locus-as-a-graph) instead: the
session it opens already holds the track the next step adds and a cut of the
class II window, so pick up at [reading the cut](#reading-what-you-cut).
Otherwise these two configs are the assembly and the gene track every figure on
this page draws:

```json addassembly
{
  "name": "hg38",
  "aliases": ["GRCh38"],
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/cytoBand.txt"
  },
  "geneticCodes": { "chrM": 2 }
}
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg38_ncbiRefSeq_ucsc",
  "name": "NCBI RefSeq genes (hg38)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz",
    "csi": true
  }
}
```

The session below is that starting state, open on a 300 kb stretch of the MHC
with the gene track showing. The clip under
[the cut](#cut-the-window-out-as-a-graph) was filmed from this session, and the
link beside it opens the same state on a hosted JBrowse with the plugin already
loaded, which is the quickest way to follow the page without installing
anything.

```json session
{
  "defaultSession": {
    "name": "HPRC part 1, before the graph",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr6:32,400,000-32,700,000",
        "tracks": ["hg38_ncbiRefSeq_ucsc"]
      }
    ]
  }
}
```

## Add the graph track

JBrowse reads two tabix-indexed BED projections of the graph, which we host. A
`FeatureTrack` pointed at their shared prefix downloads only the region in view.
The adapter resolves `<uri>.segs.bed.gz`, `<uri>.links.bed.gz`, and both `.tbi`
files:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  },
  "displayDefaults": { "showLabels": "none" }
}
```

Change these two fields to load a different graph:

- **`uri` names a prefix.** The adapter appends `.segs.bed.gz` and
  `.links.bed.gz` and reads the `.tbi` beside each, so one string points at the
  pair. The first cut of a session downloads both indexes, about 9 MB.
- **`assemblyNameToPanSN` maps your assembly name to the name the graph uses.**
  The session calls the reference `hg38`, and the graph calls it
  `GRCh38#0#chr6`. JBrowse cannot infer the sample part of that name.

`showLabels` is off because a segment's name is its GFA id. Nothing sets a
color: cutting a graph from the lane paints the lane in the graph's own colors,
red at the start of the cut window to magenta at its end, so a block above and
its node below share a hue.

With the track showing, type `chr6:32,500,000-32,560,000` into the location box
and press Enter. That is the MHC class II window every figure below is cut from,
and the lane draws one block per graph segment across it: the GRCh38 backbone
tiles the reference, because every segment in `sv.gfa` carries the rGFA tags
that place it. Where the lane stacks blocks on top of each other, haplotypes
disagree with the reference.

## Cut the window out as a graph

The graph draws a window at a time. Open the segments track's menu and pick
**Launch → Graph genome view (this region)**. A graph pane opens under the
linear view holding the window on screen, and the lane above takes the graph's
colors. Two other ways to choose a window:

- **Drag across the ruler** and choose **Graph genome view (this selection)**.
  If the selection is wider than the view will draw, the menu greys the item out
  and shows the limit.
- **Right-click one segment** in the lane to cut the graph around that segment.

A pane keeps the window it was cut from while the linear view moves on. At
segment resolution the layout stays legible up to around a hundred kilobases,
the view refuses a cut past 5 Mb, and
[part 2's bubble tier](/docs/tutorials/pangenome_hprc_part2#a-whole-chromosome-as-a-graph)
draws anything wider.

The clip below runs the route from this page's own start: the track added
through the add-track form, the window typed in, the cut, the re-layout of the
[next step](#lay-it-out-on-grch38-coordinates) and the highlight of the
[one after](#from-the-allele-back-to-grch38).

<Video src="/media/pangenome/hprc_end_to_end.mp4" caption="HPRC release 2's graph added to an hg38 session and then read: the track added through Open track... → Add pangenome graph track, the MHC class II window cut as a subgraph and the lane above taking the graph's colors, that subgraph laid out on GRCh38 coordinates, and one allele's interval marked in the linear view above it." />

### Reading what you cut

Four words describe the drawing. The chain of segments running across it is the
**backbone**, which is GRCh38's path through the graph. A **bubble** is a place
where that chain opens out and closes again, at one locus where the haplotypes
disagree. An **allele** is a loop inside a bubble, a stretch of sequence some
haplotype carries in place of the reference sequence. A deletion is an **edge**,
a dashed arc from one backbone segment to another that skips the segments
between them.

Hover any node in your cut: the tooltip gives its length and its rank, and rank
0 is the backbone. The figure labels all four shapes on a smaller cut, the C4
locus half a megabase towards the centromere, which holds few enough nodes to
label. Your MHC class II cut has the same parts and many more of them.

<Figure caption="The C4 locus cut as a force-directed graph, under the hg38 genes and the rGFA segments for the same window. Both panels color by reference position, red at the window's start to magenta at its end (the key is top right), so a block in the lane and its node below share a hue; a charcoal node has no GRCh38 coordinate, which marks it as an allele. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips it, which is one whole copy of the tandem C4-CYP21-TNX module. Gene names hang under the backbone at the exons they cover." src="/img/pangenome/hprc_graph_anatomy.png" />

A force layout has no x axis to share with the linear view, so color links the
two. The graph opens colored by **Reference position**, which ramps hue across
the window the subgraph was cut from. A backbone (rank 0) segment takes a hue
from that ramp. An allele (rank>0) segment sits on another assembly's sequence
and has no GRCh38 position, so it draws flat charcoal. Hovering a node bands its
interval across the lanes above, and hovering a block in the lane lights its
node.

The view also draws the session's gene track onto the backbone. Each gene's
exons are dark stretches along the reference nodes that carry them, with the
gene name pinned under the backbone. Every bubble in the hosted index draws as a
halo along its nodes, labelled with what it is. **View menu → Settings** turns
either off (**Genes on the backbone**, **Mark bubbles**), and the
[guide](/docs/user_guides/graph_genome_view#bubbles-genes-and-walks-on-the-drawing)
covers what a label click does.

## Lay it out on GRCh38 coordinates

Open the **Layout** dropdown in the graph pane's toolbar and pick **Anchored**.
Every x is now a GRCh38 coordinate, the reference row is at the top, each lower
row is one rank, and each allele hangs below the point it attaches at. A
deletion draws as a dashed jump along the reference row, and the drawing lines
up with the segments lane above it. The
[guide](/docs/user_guides/graph_genome_view#three-layouts) sets out what the
five layouts put on each axis.

<Figure caption="One MHC class II subgraph drawn both ways, same window and same tracks above it, both colored by reference position, red to magenta across the window, with alleles charcoal. Left, force-directed, with the node's right-click menu open on Highlight in hg38. Right, anchored: every x is a GRCh38 coordinate, the reference row is at the top, each lower row is one rank (the order minigraph added the assembly that first contributed that sequence), and each allele hangs below the point it attaches at; the ringed dashed arc is a deletion, drawn as a jump along the reference row." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Both halves ring the allele the route follows: the charcoal node hanging under
_HLA-DRB5_, near the middle of the window. Hover it and the tooltip gives its
length, 1.8 kb, and the haplotype it came from. The anchored half labels it by
net size as a deletion, because the allele is shorter than the 12 kb of backbone
it replaces. The rank rows are what the anchored layout adds: the order
minigraph added the assembly that first contributed each stretch of sequence.

## From the allele back to GRCh38

**Right-click the ringed node** for two actions whose result stays after the
hover ends:

- **Highlight in hg38** marks its reference interval in the linear view beside
  the graph and leaves it there.
- **Open in hg38** scrolls that view to it.

Take **Highlight in hg38**. A band appears in the linear view across the 12 kb
the allele attaches over, and that band covers most of _HLA-DRB5_. The band
stays through the rest of this page and part 2 reads its lanes against it.

What the menu offers depends on which segment you clicked, because rGFA records
each segment's source sequence (`SN`) and offset (`SO`):

- a **backbone (rank 0) segment** sits on GRCh38, so you get its exact
  coordinates there.
- an **allele (rank>0) segment** sits on one haplotype's sequence, e.g.
  `NA20809#2#CM094351.1`. That coordinate is also exact, but no loaded assembly
  can open it yet. You get the GRCh38 interval between the two backbone segments
  where the allele leaves and rejoins the backbone. A
  [hover](/docs/user_guides/graph_genome_view#hovering-one-panel-highlights-the-other)
  highlights the same span.

Now **left-click the same node**. The details panel opens on the right, and
`contributingAssembly` names the first assembly to contribute the segment, with
`contributingHaplotype` giving the `sample#haplotype` part of its rGFA name:
`NA20809#2`. The callset records who else carries the sequence, and
[part 2](/docs/tutorials/pangenome_hprc_part2#carriage-at-the-graphs-own-granularity)
reads one genotype per haplotype at the site under the band. The graph's own
**Launch** menu does the same as the node menu for the whole window the graph
was cut from.

## Load the haplotype that contributed it {#loading-a-haplotype-as-an-assembly}

[UCSC GenArk](https://hgdownload.soe.ucsc.edu/hubs/) hosts every release 2
assembly as a 2bit and an alias file. GenArk names the sequences by the same
GenBank accessions the graph uses: `NA20809#2#CM094351.1` in the graph is
`CM094351.1` in the 2bit. A haplotype therefore loads with no name translation,
and the alias file's `ucsc` column adds `chr6`. The
[HPRC sample table](https://genomes.jbrowse.org/hubs/HPRC) lists the accession
for every haplotype; the one the details panel named is `GCA_044166615.1`.

```json addassembly
{
  "name": "NA20809.2",
  "displayName": "NA20809 haplotype 2 (HPRC release 2, GCA_044166615.1)",
  "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCA/044/166/615/GCA_044166615.1/GCA_044166615.1.2bit",
  "refNameAliases": {
    "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCA/044/166/615/GCA_044166615.1/GCA_044166615.1.chromAlias.txt"
  }
}
```

A launched view shows the session's annotation for the assembly it opens. The
CAT index's `location` column names one GFF3 per haplotype. Each GFF3 covers the
whole genome and has no index, so slice out the window once and index the slice:

```bash
# haplotype 2 of NA20809, from the index's location column; chr6 is CM094351.1 there
curl -sSL https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/NA20809/assemblies/release2/annotation/cat/NA20809_hap2_hprc_r2_v1.0.1_cat_v1.3.gff3.gz \
  | gzip -dc \
  | awk -F'\t' '/^#/ {next} $1=="CM094351.1" && $5>=32300000 && $4<=32800000' \
  | sort -k1,1 -k4,4n > hprc_mhc_NA20809.2.genes.gff3
bgzip hprc_mhc_NA20809.2.genes.gff3
tabix -p gff hprc_mhc_NA20809.2.genes.gff3.gz
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "NA20809.2_cat_genes",
  "name": "CAT genes (NA20809 haplotype 2)",
  "assemblyNames": ["NA20809.2"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "hprc_mhc_NA20809.2.genes.gff3.gz"
  }
}
```

The segments track also draws on the haplotype once `assemblyNames` lists the
haplotype and `assemblyNameToPanSN` names the graph haplotype that the entry
stands for. The view needs no other link between the two. A graph cut from the
track reads the same map to open a node contributed by `NA20809#2` on
`NA20809.2`, so the assembly can be given any name. `hg38` stays first, because
the view cuts a graph on the first assembly its track names. The config below
replaces the track [above](#add-the-graph-track), with the same `trackId` and
one more assembly:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38", "NA20809.2"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38", "NA20809.2": "NA20809#2" }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

Cut `chr6:32,500,000-32,560,000` as a graph again and right-click the same 1.8
kb allele. The menu now has **Open in NA20809.2**, which adds a linear view of
that haplotype's chr6 framed on the allele, with its CAT genes and the segments
the graph records as contributed by it. Zoom that view out a few steps for the
genes around it.

<Video src="/media/pangenome/hprc_out_to_haplotype.mp4" caption="The MHC class II cut with NA20809 haplotype 2 loaded: the allele hovered for its contributing assembly, its menu opened, the Open in NA20809.2 entry adding a view of that haplotype's chromosome 6, and that view zoomed out to the CAT genes around it." />

<Figure caption="The same launch in two frames. First, the MHC class II window on hg38 and the cut made from it, colored by reference position with alleles charcoal, the NA20809.2 allele ringed and its right-click menu open with the Open in NA20809.2 entry boxed. Second, the view that entry opened, under the same cut: NA20809 haplotype 2 on that haplotype's chromosome 6, where the rGFA segments lane draws the ringed node as the boxed charcoal segment, since it has no hg38 coordinate, and its CAT annotation, which has HLA-DRB9 and HLA-DRB6 either side of the allele and no HLA-DRB5 at all." src="/img/pangenome/hprc_haplotype_launch.png" />

On GRCh38 the ringed allele attaches across the 12 kb of backbone the band
marks, and that 12 kb covers most of _HLA-DRB5_. On NA20809 haplotype 2 the same
1.8 kb sits in the gap between _HLA-DRB9_ and _HLA-DRB6_, and that haplotype's
annotation has no _HLA-DRB5_ model at all. The two views show one structural
difference from each side. The same steps work for any of the 464 haplotypes:
read `contributingHaplotype` off the node, find its accession in the sample
table, and paste the two configs with the names changed.

## Other windows to cut

The route works on any window the view will draw. Each locus below is small
enough at segment resolution, and each shows a shape the MHC window does not:

| Locus       | Window                         | What the cut holds                          |
| ----------- | ------------------------------ | ------------------------------------------- |
| C4          | `chr6:31,980,000-32,050,000`   | one copy of a tandem module as a dashed arc |
| KIR         | `chr19:54,750,000-54,840,000`  | a gene cluster that varies in gene count    |
| LPA KIV-2   | `chr6:160,525,000-160,655,000` | a repeat array as a knot of loops           |
| CFH cluster | `chr1:196,700,000-196,900,000` | a two-gene deletion as one edge             |
| AMY1        | `chr1:103,500,000-103,850,000` | a copy-number bubble wider than its genes   |

Every node and every deletion arc has a size. Extra sequence is a node, drawn as
a tube. Missing sequence is an edge, drawn dashed and near-black, outside the
color ramp, and hovering an edge gives the interval and the bp it removes. Read
a deletion on the anchored layout, where the arc spans exactly the sequence it
removes.

:::tip 💡 See also

[Part 4](/docs/tutorials/pangenome_graph_reading#the-window-as-a-graph) cuts the
LPA KIV-2 window from the table as a graph, opens its repeat array and lifts one
haplotype's walk out of it.

:::

<Figure caption="The complement factor H cluster on chr1: two HPRC haplotypes aligned to GRCh38, above the same window as an anchored graph. In the synteny view the pink ribbons are the alignment between each haplotype and hg38, and the ribbon narrows where a haplotype has nothing to align, which for HG01109 is the stretch holding CFHR3 and CFHR1. In the graph, the reference row is at the top in reference-position colors, each lower row one rank (the order minigraph added the assembly that first contributed that sequence) with its alleles as charcoal nodes haloed as bubbles, and the dashed arc under the reference row spans the gap that removes both genes." src="/img/pangenome/hprc_cfhr_deletion.png" />

An edge carries no sequence, so it names no donor haplotype and opens only on
GRCh38. The two haplotype rows above the graph are release 2's CAT annotation on
each haplotype's own assembly, loaded the way
[the haplotype step](#loading-a-haplotype-as-an-assembly) loads NA20809.2, over
alignments that [part 3](/docs/tutorials/pangenome_hprc_part3) reads out of the
graph.

The view cuts only the window, so an allele whose interior falls outside the
window draws as a short arm off the backbone. When a cut comes back as a single
tangle, widen it until the backbone chain is in frame. The amylase window in the
table is wider than its bubble for that reason. The hosted bubble index says
what any window holds, and `tabix` reads it over HTTP; the bubble spanning
_AMY1A_ and _AMY1B_ is the first row:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz \
  'GRCh38#0#chr1:103,690,000-103,780,000' | cut -f1-8 | head -1
# GRCh38#0#chr1  103611080  103732636  95  269401  1  26889  316616
```

The columns after the span are segments, paths, the inversion flag, and the
lengths of the shortest and longest allele the bubble holds. Length stands in
for copy number here, because `gfatools bubble` and the rGFA tags record the
distinct sequence a bubble can hold. The `.gbz` carries one walk per haplotype,
so it holds a count per haplotype, and
[reading that count is a query](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph).

## Reproduce it end to end

The track [above](#add-the-graph-track) reads two files we built from HPRC's
`sv.gfa.gz`. One command over any rGFA builds the first: `gfa2bed -m` reads the
`SN`/`SO`/`SR` tags and puts each segment at a reference coordinate.

<!-- from: scripts/build_rgfa_tabix.sh -->

```bash
# one row per segment: stableName, start, end, segmentId, rank
gfatools gfa2bed -m your-graph.gfa.gz | sort -k1,1 -k2,2n | bgzip > your-graph.segs.bed.gz
tabix -f -p bed your-graph.segs.bed.gz
```

The links index comes from the same script's second pass over the L-lines.
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
runs both, and
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) walks
through the script and
[lists which builder each graph format needs](/docs/tutorials/pangenome_prepare_graph#what-your-graph-can-produce).
Pointed at `hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host, and
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside those files
records their provenance.

[Part 2](/docs/tutorials/pangenome_hprc_part2#reproduce-it-end-to-end) and
[part 3](/docs/tutorials/pangenome_hprc_part3#reproduce-it-end-to-end) carry the
scripts behind the rest of the release's files.

## See also

- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_graph_reading)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/tutorials/genomes_pangenome)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/user_guides/graph_genome_view)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph and the assemblies it was built from.
- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), which define the `SN`/`SO`/`SR`
  tags this page opens the graph by.
