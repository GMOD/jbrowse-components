---
title: Pangenome (HPRC) part 1, reading the graph
sidebar_label: Pangenome (HPRC, part 1)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, cut a
  locus out of it, and follow one allele back to the haplotype that carries it
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
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

- nothing at all, to open what this page builds: the
  [HPRC page on genomes.jbrowse.org](/docs/tutorials/genomes_pangenome) launches
  every graph below. This page loads the files into your own JBrowse
- [the GraphGenomeView plugin](#the-graphgenomeview-plugin), for the tracks that
  use `RgfaTabixAdapter`; every other track here is a URL you can paste
- htslib (`bgzip`, `tabix`), to query the hosted indexes from the command line
  as the sections below do
- `gfatools`, for the handful of commands that go to the GFA itself

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

## The route, end to end

At the MHC class II locus, many haplotypes replace 12 kb of GRCh38 with 1.8 kb
of different sequence. The graph stores that replacement as one object with a
length, attached to the reference on either side of the 12 kb it replaces. We
find the object, read where it sits on GRCh38, and then load the haplotype it
came from to see how the replacement changes the genes there.

The rest of the tutorial uses four terms for the drawing. The chain of segments
running across the drawing is the **backbone**, which is GRCh38's path through
the graph. A **bubble** is a place where that chain opens out and closes again,
at one locus where the haplotypes disagree. An **allele** is a loop inside a
bubble, a stretch of sequence that some haplotype carries in place of the
reference sequence. A deletion is an **edge**, a dashed arc from one backbone
segment to another that skips the segments between them.

<Figure caption="The C4 locus cut as a force-directed graph, under the hg38 genes and the rGFA segments for the same window. Both panels color by reference position, red at the window's start to magenta at its end (the key is top right), so a block in the lane and its node below share a hue; a charcoal node has no GRCh38 coordinate, which is what an allele is. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips it, which is one whole copy of the tandem C4-CYP21-TNX module. Gene names hang under the backbone at the exons they cover." src="/img/pangenome/hprc_graph_anatomy.png" />

The route has five steps:

- open hg38 with its genes and nothing else
- [add the graph track](#load-the-graph)
- [cut the locus as a graph](#open-a-locus-as-a-graph)
- take the allele
  [back to its GRCh38 coordinates](#from-a-node-back-to-a-coordinate)
- [load the haplotype that contributed it](#loading-a-haplotype-as-an-assembly)
  and read that haplotype's annotation at the same place

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

## Load the graph

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
  "displayDefaults": {
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'",
    "showLabels": "none"
  }
}
```

Change these three fields to load a different graph:

- **`uri` names a prefix.** The adapter appends `.segs.bed.gz` and
  `.links.bed.gz` and reads the `.tbi` beside each, so one string points at the
  pair. The first cut of a session downloads both indexes, about 9 MB.
- **`assemblyNameToPanSN` maps your assembly name to the name the graph uses.**
  The session calls the reference `hg38`, and the graph calls it
  `GRCh38#0#chr6`. JBrowse cannot infer the sample part of that name.
- **`color`** paints each segment in the graph view's **Stable rank** colors, so
  a segment has the same color in both panels. `showLabels` is off because a
  segment's name is its GFA id.

The clip below starts by adding the track. It then runs the route's first four
steps on the MHC class II window. That window holds too many nodes to label the
way the C4 figure [above](#the-route-end-to-end) is labelled.

<Video src="/media/pangenome/hprc_end_to_end.mp4" caption="HPRC release 2's graph added to an hg38 session and then read: the track added through Open track... → Add pangenome graph track, the MHC class II window cut as a subgraph, that subgraph laid out on GRCh38 coordinates, and one allele's interval marked in the linear view above it." />

The track draws each segment at the position its tags give, so the GRCh38
backbone tiles the reference. We built both files. One command over any rGFA
builds the first: `gfa2bed -m` reads the `SN`/`SO`/`SR` tags and puts each
segment at a reference coordinate. `sv.gfa` is the minigraph stage of the
Minigraph-Cactus build. Every segment in it carries those tags, so JBrowse opens
any locus in it with no extraction step.

<!-- from: scripts/build_rgfa_tabix.sh -->

```bash
# one row per segment: stableName, start, end, segmentId, rank
gfatools gfa2bed -m your-graph.gfa.gz | sort -k1,1 -k2,2n | bgzip > your-graph.segs.bed.gz
tabix -f -p bed your-graph.segs.bed.gz
```

The links index comes from the same script's second pass over the L-lines. We
ran
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
on HPRC's `sv.gfa.gz`, and
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) walks
through the script. The base-level `gfa.gz` beside `sv.gfa` stores positions in
its path lines.
[The same page](/docs/tutorials/pangenome_prepare_graph#what-your-graph-can-produce)
lists which builder each format needs.

## Open a locus as a graph

The graph draws a window at a time, and there are three ways to pick one:

- **Drag across the ruler** and choose **Graph genome view (this selection)**.
  If the selection is wider than the view will draw, the menu greys the item out
  and shows the limit.
- **Launch → Graph genome view (this region)** in the track menu takes whatever
  is on screen.
- **Right-click one segment** to cut the graph around that segment.

Each launch opens a pane that keeps the window it was cut from while the linear
view moves on. At segment resolution the layout stays legible up to around a
hundred kilobases. The view refuses a cut past 5 Mb, and
[the bubble tier](/docs/tutorials/pangenome_hprc_part2#a-whole-chromosome-as-a-graph)
draws a wider span. The C4 figure [above](#the-route-end-to-end) is one such
cut.

A force layout has no x axis to share with the linear view, so color links the
two. The graph opens colored by **Reference position**, which ramps hue across
the window the subgraph was cut from. A rank-0 segment takes a hue from that
ramp. A rank>0 segment sits on another assembly's refName and has no GRCh38
position, so it draws flat charcoal. The **Bubble spread** and **Graph context**
settings decide whether the picture is readable at all. The
[graph genome view guide](/docs/user_guides/graph_genome_view#two-settings-that-decide-what-is-drawn)
shows what each setting does on a graph small enough to watch the change.

## Reading the drawing

### The Layout dropdown

The [guide](/docs/user_guides/graph_genome_view#three-layouts) sets out what the
five modes put on each axis. Here is the same MHC class II window drawn in two
of them:

<Figure caption="One MHC class II subgraph drawn both ways, same window and same tracks above it, both colored by reference position, red to magenta across the window, with alleles charcoal. Left, force-directed, with the node's right-click menu open on Highlight in hg38. Right, anchored: every x is a GRCh38 coordinate, the reference row is rank 0 at the top, each lower row is one stable rank, and each allele hangs below the point it attaches at; the ringed dashed arc is a deletion, drawn as a jump along the reference row." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Both halves ring the allele that [the route](#the-route-end-to-end) follows, and
the right-click menu on the left is open on that allele. The anchored half
labels the allele by net size as a deletion, because the allele is shorter than
the backbone it replaces.

Each locus below is a window small enough to draw:

| Locus        | Window                         |
| ------------ | ------------------------------ |
| MHC class II | `chr6:32,510,000-32,600,000`   |
| KIR          | `chr19:54,750,000-54,840,000`  |
| AMY1         | `chr1:103,690,000-103,780,000` |
| C4           | `chr6:31,980,000-32,050,000`   |
| LPA KIV-2    | `chr6:160,525,000-160,655,000` |

<Figure caption="The KIV-2 repeat inside LPA as a force-directed graph, under the RefSeq genes, the UniProt kringle domains, the bubbles lane and the rGFA segments. Nodes are colored by reference position, red to magenta across the window, and the alleles charcoal. Each lavender halo is one bubble, labelled in purple with what it is: the haloed knot of loops below the lane's widest bubble is labelled a repeat array, each loop one copy of the repeat, and the short red labels are deletions. One dashed arc bypasses the reference, and LPA is pinned under the backbone." src="/img/pangenome/hprc_lpa_kiv2.png" />

### Bubbles and genes on the drawing

The view draws every bubble in the index as a halo along the bubble's nodes. A
label names the bubble's type: a SNP, an insertion of so much, a deletion, a
repeat array with its route count and range, or a superbubble. Click a label to
open that bubble alone, laid out the same way, with a button back to the window.
A graph with no index, such as a GBZ cut or a plain GFA, derives its bubbles
from the drawing's layering. An opened bubble derives its inner bubbles the same
way, so a superbubble opens level by level. **View menu → Settings → Mark
bubbles** turns the halos off.

The view also draws the session's gene track onto the backbone. Each gene's
exons are dark stretches along the reference nodes that carry them, and the gene
name is pinned under the backbone at the gene's midpoint. An allele has no
reference coordinates and shows no exon. **View menu → Settings → Genes on the
backbone** turns the genes off, and **Gene track** picks the track when the
assembly has several. [Part 4](/docs/tutorials/pangenome_graph_reading) reads
the array this way and then adds the haplotypes' walks to it.

### Insertions, deletions and their sizes

Every node and every deletion arc has a size. Extra sequence is a node, drawn as
a tube. Missing sequence is an edge, drawn dashed and near-black, outside the
color ramp. Read a deletion on the [anchored layout](#the-layout-dropdown).
There x is GRCh38 bp, so the arc spans exactly the sequence it removes.

<Figure caption="The complement factor H cluster on chr1: two HPRC haplotypes aligned to GRCh38, above the same window as an anchored graph. In the synteny view the pink ribbons are the alignment between each haplotype and hg38, and the ribbon narrows where a haplotype has nothing to align, which for HG01109 is the stretch holding CFHR3 and CFHR1. In the graph, the reference row is at the top in reference-position colors, each lower row one stable rank with its alleles as charcoal nodes haloed as bubbles, and the dashed arc under the reference row spans the gap that removes both genes." src="/img/pangenome/hprc_cfhr_deletion.png" />

Hovering an edge gives the interval and the bp it removes. An edge carries no
sequence, so it names no donor haplotype and opens only on GRCh38. The haplotype
rows above it carry release 2's CAT annotation, one GFF3 per haplotype from
[the index](https://github.com/human-pangenomics/hprc_intermediate_assembly/blob/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv),
loaded as an ordinary `FeatureTrack` on that haplotype's assembly.

The view cuts only the window, so an allele whose interior falls outside the
window draws as a short arm off the backbone. When a cut comes back as a single
tangle, widen it until the backbone chain is in frame. The tangle then sits
between flanks that read as a plain chain. The amylase locus needs this: cut
`chr1:103,500,000-103,850,000`, which is wider than the bubble alone.

The graph's bubble index reports what that window holds, and tabix reads the
index over HTTP. The bubble spanning _AMY1A_ and _AMY1B_ is the first row:

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

## From a node back to a coordinate

**Right-click a node** for two actions whose result stays after the hover ends:

- **Highlight in hg38** marks its reference interval in the linear view beside
  the graph and leaves it there.
- **Open in hg38** scrolls that view to it.

The graph's **Launch** menu does the same for the whole window the graph was cut
from. The menu entries depend on which segment you clicked, because rGFA records
each segment's source sequence (`SN`) and offset (`SO`):

- a **backbone (rank 0) segment** sits on GRCh38, so you get its exact
  coordinates there.
- an **allele (rank>0) segment** sits on one haplotype's sequence, e.g.
  `HG02717#1#chr6`. That coordinate is also exact, but no loaded assembly can
  open it. You get the GRCh38 interval between the two backbone segments where
  the allele leaves and rejoins the backbone. A
  [hover](/docs/user_guides/graph_genome_view#hovering-one-panel-highlights-the-other)
  highlights the same span.

For either kind of segment, the tooltip and the details panel that a left-click
opens both name the node's haplotype. The panel calls it `contributingAssembly`,
the first assembly to contribute the segment. The callset records who else
carries that sequence.
[Part 2](/docs/tutorials/pangenome_hprc_part2#carriage-at-the-graphs-own-granularity)
reads one genotype per haplotype at the site under the node you clicked.

In the [layout figure above](#the-layout-dropdown), that menu is open on the
route's allele, over the band that **Highlight in hg38** left in the linear
view. On that interval, part 2's lanes read the
[bubble track](/docs/tutorials/pangenome_hprc_part2#the-bubble-track) for the
bubble the allele belongs to, and the
[variant callset](/docs/tutorials/pangenome_hprc_part2#the-variant-callset) for
whether anything is genotyped there.

When the contributing haplotype is loaded as an assembly, the same menu opens
the allele on that haplotype's coordinates.
[The next section](#loading-a-haplotype-as-an-assembly) loads one haplotype, and
the same steps work for any of the 464.

## Loading a haplotype as an assembly {#loading-a-haplotype-as-an-assembly}

[UCSC GenArk](https://hgdownload.soe.ucsc.edu/hubs/) hosts every release 2
assembly as a 2bit and an alias file. GenArk names the sequences by the same
GenBank accessions the graph uses: `NA20809#2#CM094351.1` in the graph is
`CM094351.1` in the 2bit. A haplotype therefore loads with no name translation,
and the alias file's `ucsc` column adds `chr6`.

The graph tells you which haplotype to load. A node's details name
`contributingHaplotype`, the `sample#haplotype` part of its rGFA name. The
allele that the [layout figure](#the-layout-dropdown) opens its menu on names
`NA20809#2`. The
[HPRC sample table](https://genomes.jbrowse.org/pangenomes/hprc) lists the
accession for that haplotype.

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
track reads the same map to open a node credited to `NA20809#2` on `NA20809.2`,
so the assembly can have any name the session likes. `hg38` stays first, because
the view cuts a graph on the first assembly its track names. The config below
replaces the track [above](#load-the-graph), with the same `trackId` and one
more assembly:

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

Cut the MHC class II window as a graph and right-click the 1.8 kb allele the
[layout figure](#the-layout-dropdown) opens its menu on. The menu now carries
**Open in NA20809.2**, which adds a linear view of that haplotype's chr6 framed
on the allele, with its CAT genes and the segments the graph credits to it.

<Video src="/media/pangenome/hprc_out_to_haplotype.mp4" caption="The MHC class II cut with NA20809 haplotype 2 loaded: the allele hovered for its contributing assembly, its menu opened, the Open in NA20809.2 entry adding a view of that haplotype's chromosome 6, and that view zoomed out to the CAT genes around it." />

<Figure caption="The same launch as a still. Above, the MHC class II window on hg38 and the cut made from it, colored by reference position with alleles charcoal, and the NA20809.2 allele ringed. Below, the view its Open in entry opened: NA20809 haplotype 2 on its own chromosome 6, where the rGFA segments lane draws the node's own segments in charcoal because they have no hg38 coordinate, and its CAT annotation, which has HLA-DRB9 and HLA-DRB6 either side of the allele and no HLA-DRB5 at all." src="/img/pangenome/hprc_haplotype_launch.png" />

On GRCh38 the ringed allele attaches across the 12 kb of backbone the
[layout figure](#the-layout-dropdown) highlights, and that 12 kb covers most of
_HLA-DRB5_. On NA20809 haplotype 2 the same 1.8 kb sits in the gap between
_HLA-DRB9_ and _HLA-DRB6_, and that haplotype's annotation has no _HLA-DRB5_
model at all. The two views show one structural difference from each side.

## Reproduce it end to end

[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
two tabix indexes behind [the graph track](#load-the-graph), and its commands
run on any rGFA. Pointed at `hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files
we host. [README.txt](https://jbrowse.org/demos/hprc/README.txt) beside those
files records their provenance.

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
