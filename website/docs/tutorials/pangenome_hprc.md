---
title: Pangenome (HPRC) part 1, reading the graph
sidebar_label: Pangenome (HPRC, part 1)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, cut a
  locus out of it, and follow one allele back to the haplotype that carries it
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: download
---

**TL;DR:** a pangenome graph records what a set of genomes share and where they
diverge, so sequence one person carries and the reference lacks is an object in
the file. This page opens the Human Pangenome Reference Consortium's release 2
graph at a locus, draws it beside GRCh38, and takes one allele off the drawing
back to the coordinates it attaches at, and then to the haplotype it came from.
[Part 2](/docs/tutorials/pangenome_hprc_part2) reads who carries that sequence
off the rest of the release on the same axis, and
[part 3](/docs/tutorials/pangenome_hprc_part3) takes the same haplotypes off
that axis and onto their own coordinates.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, that is a current
limit rather than a settled design. We welcome your [feedback](/contact).

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

Nothing here builds a graph file.
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) is the page
that does, and it lists what that takes.

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose
Minigraph-Cactus graph is read through small tabix projections we host beside
it, with the contributing assemblies from their own archives.

- the SV-resolution graph (`sv.gfa`), the minigraph backbone our rGFA tabix
  projections are built from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- every release 2 assembly as a UCSC GenArk hub, a 2bit and an alias file per
  haplotype; this is haplotype 2 of NA20809, the one the graph opens below:
  https://hgdownload.soe.ucsc.edu/hubs/GCA/044/166/615/GCA_044166615.1/
- that haplotype's CAT annotation, whole genome, from the index above:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/working/HPRC/NA20809/assemblies/release2/annotation/cat/NA20809_hap2_hprc_r2_v1.0.1_cat_v1.3.gff3.gz
- our own rGFA projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt

All three pages read the release's `v2.1/` build, so node ids agree across the
set. The one file only `v2.0/` carries is the alignment
[part 3](/docs/tutorials/pangenome_hprc_part3#the-alignment-underneath-both)
opens.

## The route, end to end

At the MHC class II locus, GRCh38 carries 12 kb that many haplotypes replace
with 1.8 kb of their own sequence. The graph holds that swap as an object with
its own length, attached to the reference either side of what it stands in for.
This page finds it, reads where it sits on GRCh38, and then loads the haplotype
it came from to see what the swap did to the genes there.

Three words carry the drawing, and the rest of the page rests on all three. The
chain of segments running across the drawing is the **backbone**, which is
GRCh38's own path through the graph. Each place that chain opens out and closes
again is a **bubble**, one locus where the haplotypes disagree. Each loop inside
a bubble is an **allele**, a stretch of sequence some haplotype carries in place
of the reference's. A deletion is an **edge**, a dashed arc from one backbone
segment to another that skips what lies between.

<Figure caption="The C4 locus cut as a force-directed graph, under the hg38 genes and the rGFA segments for the same window. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips it." src="/img/pangenome/hprc_graph_anatomy.png" />

With those named, the route is five steps:

- open hg38 with its genes and nothing else
- paste the track config from [Load the graph](#load-the-graph) into the app
- [cut the locus as a graph](#open-a-locus-as-a-graph)
- take the allele
  [back to its GRCh38 coordinates](#from-a-node-back-to-a-coordinate)
- [load the haplotype that contributed it](#loading-a-haplotype-as-an-assembly)
  and read that haplotype's own annotation at the same place

The clip below runs the first four steps on the MHC class II window, which holds
too many nodes to label the way the figure above is.

<Video src="/media/pangenome/hprc_end_to_end.mp4" caption="HPRC release 2's graph added to an hg38 session and then read: the track config pasted into Open track..., the MHC class II window cut as a subgraph, that subgraph laid out on GRCh38 coordinates, and one allele's interval marked in the linear view above it." />

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

JBrowse reads two tabix-indexed BED projections of the graph. We host them, so a
`FeatureTrack` pointed at the shared prefix downloads nothing but the region in
view; the adapter resolves `<uri>.segs.bed.gz`, `<uri>.links.bed.gz`, and both
`.tbi` files:

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
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

Three fields carry the track, and they are the three to change for a graph of
your own:

- **`uri` names a prefix.** The adapter appends `.segs.bed.gz` and
  `.links.bed.gz` and reads the `.tbi` beside each, so one string points at the
  pair. Both indexes, about 9 MB, arrive on the first cut of a session.
- **`assemblyNameToPanSN` ties your assembly to the graph's own spelling of
  it.** The session calls the reference `hg38` where the graph calls it
  `GRCh38#0#chr6`, and the sample half of that name is the part JBrowse cannot
  work out for itself.
- **`color`** paints each segment in the graph view's own **Stable rank**
  colors, so a segment is the same color in both panels.

Each segment is drawn at the position its tags give, so the GRCh38 backbone
tiles the reference. Both files are ours, and the first is one command over any
rGFA: `gfa2bed -m` reads the `SN`/`SO`/`SR` tags, which is what puts each
segment at a reference coordinate.

<!-- from: scripts/build_rgfa_tabix.sh -->

```bash
# one row per segment: stableName, start, end, segmentId, rank
gfatools gfa2bed -m your-graph.gfa.gz | sort -k1,1 -k2,2n | bgzip > your-graph.segs.bed.gz
tabix -f -p bed your-graph.segs.bed.gz
```

The links index comes from the same script's second pass over the L-lines.
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
is what we ran on HPRC's `sv.gfa.gz`, and
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) walks it.

### Why this graph opens by locus {#regular-gfa-vs-rgfa}

Every segment in `sv.gfa`, the minigraph stage of the Minigraph-Cactus build,
carries the `SN`/`SO`/`SR` tags that state where the segment sits and which
segments are the reference, so JBrowse opens any locus in it with no extraction
step. The base-level `gfa.gz` beside it states the same thing inside its path
lines, and
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#what-your-graph-can-produce)
sets out which builder each format takes. Of a PanSN name only the sample half
needs configuring; the contig half is ordinary refName aliasing your assembly
already does.

## Open a locus as a graph

The graph draws a window at a time, and there are three ways to pick one:

- **Drag across the ruler** and choose **Graph genome view (this selection)**.
  Selecting more than the view will draw greys the item out and displays its
  limit.
- **Launch → Graph genome view (this region)** in the track menu takes whatever
  is on screen.
- **Right-click one segment** to cut the graph around that segment.

Each launch makes a pane that holds the window it was cut from while the linear
view moves on. Around a hundred kilobases is what the layout draws legibly at
segment resolution, and the view refuses a cut past 5 Mb;
[the bubble tier](/docs/tutorials/pangenome_hprc_part2#a-whole-chromosome-as-a-graph)
draws a wider span. The third lane in the figure below is part 2's
[bubble track](/docs/tutorials/pangenome_hprc_part2#the-bubble-track).

<Figure caption="The C4 locus as a force-directed graph, under three lanes of the same window. The bubbles track reports a single bubble spanning the locus, and the graph below is what it contains." src="/img/pangenome/hprc_c4_subgraph.png" />

A force layout has no x axis to share with the linear view, so color carries the
correspondence. **Reference position**, which the graph opens on, ramps hue over
the window the subgraph was cut from. A rank-0 segment takes a hue from that
ramp; a rank>0 segment sits on another assembly's refName, has no GRCh38
position for the ramp to take, and draws flat charcoal. **Bubble spread** and
**Graph context** decide whether the picture is readable at all, and the
[graph genome view guide](/docs/user_guides/graph_genome_view#two-settings-that-decide-what-is-drawn)
covers what each does on a graph small enough to watch it happen.

## Reading the drawing

### Insertions, deletions and their sizes

Every node and every deletion arc carries its own size. Extra sequence is a
node, drawn as a tube. Missing sequence is an **edge**: a link from one backbone
segment to another that is not its neighbour, taken by the haplotypes that skip
what lies between. Those edges are dashed and near-black, off the color ramp.
Read one on the [anchored layout](#the-layout-dropdown), where x is GRCh38 bp,
so the arc spans exactly the sequence it removes.

<Figure caption="The complement factor H cluster on chr1: two HPRC haplotypes aligned to GRCh38, above the same window as an anchored graph. The dashed arc under the graph's reference row spans the gap that removes CFHR3 and CFHR1." src="/img/pangenome/hprc_cfhr_deletion.png" />

Hovering an edge gives the interval and the bp it removes. An edge carries no
sequence of its own, so it names no donor haplotype and opens nowhere but
GRCh38. The haplotype rows above it carry release 2's CAT annotation, one GFF3
per haplotype from
[the index](https://github.com/human-pangenomics/hprc_intermediate_assembly/blob/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv),
loaded as an ordinary `FeatureTrack` on that haplotype's assembly.

Only the window is cut, so an allele whose interior falls outside it draws as a
short arm off the backbone. When a cut comes back as a single tangle, widen it
until the backbone chain is in frame: the figure below is cut from
`chr1:103,500,000-103,850,000`.

<Figure caption="The amylase locus on chr1 as a force-directed graph, under the RefSeq genes and the rGFA segments for the same window. Every crossing is inside the amylase bubble at the end of the backbone chain." src="/img/pangenome/hprc_amylase_graph.png" />

The graph's own bubble index says what that window holds, and tabix reads it
over HTTP. The bubble spanning _AMY1A_ and _AMY1B_ is the first row:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz \
  'GRCh38#0#chr1:103,690,000-103,780,000' | cut -f1-8 | head -1
# GRCh38#0#chr1  103611080  103732636  95  269401  1  26889  316616
```

After the span: segments, paths, the inversion flag, then the lengths of the
shortest and longest allele the bubble holds. Length is the proxy for copy
number here, since `gfatools bubble` and the rGFA tags state the distinct
sequence a bubble can hold. A count per haplotype is in the `.gbz`, which
carries a walk each, and
[reading it is a query](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph).

### The Layout dropdown

The [guide](/docs/user_guides/graph_genome_view#three-layouts) sets out what the
three modes put on each axis. Here is the same MHC class II window drawn in two
of them:

<Figure caption="One MHC class II subgraph drawn both ways, same window and same tracks above it. Left, force-directed. Right, anchored: every x is a GRCh38 coordinate, so each allele hangs below where it attaches." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Both halves ring the same node, the 1.8 kb allele the right-click menu on the
left is open on. The anchored half labels it a 10.2 kb deletion, the net of 1.8
kb standing in for 12.

Each locus below is a window small enough to draw:

| Locus        | Window                         |
| ------------ | ------------------------------ |
| MHC class II | `chr6:32,510,000-32,600,000`   |
| KIR          | `chr19:54,750,000-54,840,000`  |
| AMY1         | `chr1:103,690,000-103,780,000` |
| C4           | `chr6:31,980,000-32,050,000`   |
| LPA KIV-2    | `chr6:160,525,000-160,655,000` |

<Figure caption="The KIV-2 repeat inside LPA as a force-directed graph, under the RefSeq genes, the bubbles lane and the rGFA segments. The bubble the lane reports across the repeat is the chain of loops below it, with one dashed arc bypassing the reference between two of them." src="/img/pangenome/hprc_lpa_kiv2.png" />

## From a node back to a coordinate

**Right-click a node** for two answers that persist past a hover:

- **Highlight in hg38** marks its reference interval in the linear view beside
  the graph and leaves it there.
- **Open in hg38** scrolls that view to it.

The graph's own **Launch** menu does the same for the whole window it was cut
from. What you are offered depends on which segment you clicked, because rGFA
states each segment's source sequence (`SN`) and offset (`SO`):

- a **backbone (rank 0) segment** sits on GRCh38, so you get its exact
  coordinates there.
- an **allele (rank>0) segment** sits on one haplotype's own sequence, e.g.
  `HG02717#1#chr6`. That coordinate is exact too, and has no loaded assembly to
  open it in, so you get the GRCh38 interval between the two backbone segments
  the allele detaches from and rejoins, the same span a
  [hover](/docs/user_guides/graph_genome_view#hovering-one-panel-highlights-the-other)
  highlights.

Either way the node's haplotype is named, in the tooltip and in the details
panel a left-click opens. The panel calls it `contributingAssembly`, the first
assembly to contribute the segment, and who carries that sequence is the
callset's to say:
[part 2](/docs/tutorials/pangenome_hprc_part2#carriage-at-the-graphs-own-granularity)
reads one genotype per haplotype at the site under the node you clicked.

The [layout figure above](#the-layout-dropdown) has that menu open on a 1.8 kb
allele of NA20809 haplotype 2, over the band **Highlight in hg38** left in the
linear view: the 12 kb of backbone the allele attaches across, which here is
_HLA-DRB5_. On that interval part 2's lanes read the
[bubble track](/docs/tutorials/pangenome_hprc_part2#the-bubble-track) for the
bubble the allele belongs to and the
[variant callset](/docs/tutorials/pangenome_hprc_part2#the-variant-callset) for
whether anything is genotyped there.

Where the contributing haplotype is itself loaded, the same menu opens the
allele on that haplotype's own coordinates, which
[the next section](#loading-a-haplotype-as-an-assembly) sets up for any of
the 464.

## Loading a haplotype as an assembly {#loading-a-haplotype-as-an-assembly}

[UCSC GenArk](https://hgdownload.soe.ucsc.edu/hubs/) hosts every release 2
assembly, a 2bit and an alias file each, and names the sequences by the same
GenBank accessions the graph does: `NA20809#2#CM094351.1` in the graph is
`CM094351.1` in the 2bit, so a haplotype loads with nothing translated, and the
alias file's `ucsc` column adds `chr6`.

Which haplotype to load is read off the graph. A node's details name
`contributingHaplotype`, the `sample#haplotype` off its rGFA name; the allele
the [layout figure](#the-layout-dropdown) opens its menu on names `NA20809#2`,
whose accession is on the
[HPRC sample table](https://genomes.jbrowse.org/pangenomes/hprc).

```json addassembly
{
  "name": "NA20809.2",
  "aliases": ["NA20809#2"],
  "displayName": "NA20809 haplotype 2 (HPRC release 2, GCA_044166615.1)",
  "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCA/044/166/615/GCA_044166615.1/GCA_044166615.1.2bit",
  "refNameAliases": {
    "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCA/044/166/615/GCA_044166615.1/GCA_044166615.1.chromAlias.txt"
  }
}
```

The alias is the whole of the join: the view resolves a node's haplotype
(`NA20809#2`) against the loaded assemblies by name and alias, then its sample
(`NA20809`), so the assembly can carry any name the session likes as long as one
of the two is among its `aliases`.

A launched view carries the session's annotation for the assembly it opens. The
CAT index names one GFF3 per haplotype in its `location` column, whole-genome
and unindexed, so slice the window once and index the slice:

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

The segments track draws on the haplotype too once `assemblyNames` lists it and
`assemblyNameToPanSN` says which haplotype the name means. `hg38` stays first,
because a graph is cut on the first assembly its track names. This replaces the
track [above](#load-the-graph), same `trackId`, one more assembly:

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

<Video src="/media/pangenome/hprc_out_to_haplotype.mp4" caption="The MHC class II cut with NA20809 haplotype 2 loaded: the allele hovered for its contributing assembly, its menu opened, the Open in NA20809.2 entry adding a view of that haplotype's own chromosome 6, and that view zoomed out to the CAT genes around it." />

<Figure caption="The same launch as a still. Above, the MHC class II window on hg38 and the cut made from it, with the NA20809.2 allele ringed. Below, the view its Open in entry opened: NA20809 haplotype 2 on its own chromosome 6, and its CAT annotation, which has HLA-DRB9 and HLA-DRB6 either side of the allele and no HLA-DRB5 at all." src="/img/pangenome/hprc_haplotype_launch.png" />

On GRCh38 the ringed allele attaches across the 12 kb of backbone the
[layout figure](#the-layout-dropdown) highlights, which is most of _HLA-DRB5_.
On NA20809 haplotype 2 the same 1.8 kb sits in the gap between _HLA-DRB9_ and
_HLA-DRB6_, and that haplotype's annotation has no _HLA-DRB5_ model at all. The
two views state one structural difference from either side.

## Reproduce it end to end

The two tabix indexes behind [the graph track](#load-the-graph) are built by
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph), which runs
the same commands on any rGFA. Point it at `hprc-v2.1-mc-grch38.sv.gfa.gz` and
it writes what we host; their provenance is in
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them.

[Part 2](/docs/tutorials/pangenome_hprc_part2#reproduce-it-end-to-end) and
[part 3](/docs/tutorials/pangenome_hprc_part3#reproduce-it-end-to-end) carry the
scripts behind the rest of the release's files.

## See also

- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_hprc_part3)
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
