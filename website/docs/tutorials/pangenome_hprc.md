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
the file rather than an absence to infer from an alignment. This page opens the
Human Pangenome Reference Consortium's release 2 graph at a locus, draws it
beside GRCh38, and takes one allele off the drawing back to the coordinates it
attaches at, and then to the haplotype it came from.
[Part 2](/docs/tutorials/pangenome_hprc_part2) reads the rest of the release on
the same axis.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, that is a current
limit rather than a settled design. We welcome your [feedback](/contact).

:::

## Prerequisites

- nothing at all, to open what this page builds: the
  [HPRC page on genomes.jbrowse.org](/docs/tutorials/genomes_pangenome) launches
  every graph below on a typed region or a whole chromosome. This page is the
  route for loading the files into your own JBrowse
- [the GraphGenomeView plugin](#the-graphgenomeview-plugin), for the tracks that
  use `RgfaTabixAdapter`; every other track here is a URL you can paste
- htslib (`bgzip`, `tabix`), to query the hosted indexes from the command line
  as the sections below do

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

## The route, end to end

At the MHC class II locus, GRCh38 carries 12 kb that many haplotypes replace
with 1.8 kb of their own sequence. The graph holds that swap as an object with
its own length, attached to the reference either side of what it stands in for.
This page finds it, reads where it sits on GRCh38, and then loads the haplotype
it came from to see what the swap did to the genes there.

- open hg38 with its genes and nothing else
- paste the track config from [Load the graph](#load-the-graph) into the app
- [cut the locus as a graph](#open-a-locus-as-a-graph)
- take the allele
  [back to its GRCh38 coordinates](#from-a-node-back-to-a-coordinate)
- [load the haplotype that contributed it](#loading-a-haplotype-as-an-assembly)
  and read that haplotype's own annotation at the same place

Three things are worth naming before any of that, because the rest of the page
rests on all three. The chain of segments running across the drawing is the
**backbone**, which is GRCh38's own path through the graph. Each place that
chain opens out and closes again is a **bubble**, one locus where the haplotypes
disagree. Each loop inside a bubble is an **allele**, a stretch of sequence some
haplotype carries in place of the reference's. A deletion is none of those: it
is an **edge**, a dashed arc from one backbone segment to another that skips
what lies between.

<Figure caption="The C4 locus cut as a force-directed graph, under the hg38 genes and the rGFA segments for the same window. backbone marks GRCh38's own path through the graph and allele marks a node one haplotype carries where the reference has something else. bubble points into a pair of routes between the same two nodes: the reference path, and the dashed arc that skips it, which the drawing labels with what it removes." src="/img/pangenome/hprc_graph_anatomy.png" />

The clip below runs the first four steps on the MHC class II window.

<Video src="/media/pangenome/hprc_end_to_end.mp4" caption="HPRC release 2's graph added to an hg38 session and then read: the track config pasted into Open track..., the MHC class II window cut as a subgraph, that subgraph laid out on GRCh38 coordinates, and one allele's GRCh38 interval marked in the linear view above it." />

The link under the clip opens the session it starts in, so pasting a config for
your own graph walks the same route on it.

## HPRC release 2

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) is roughly a
fivefold expansion over release 1, and publishes three products of the same
sequence:

- the pangenome graph, which this page draws as a graph
- the variant callset, 464 haplotypes as a genotype matrix
- the multiple alignment both are derived from

The last two are
[part 2](/docs/tutorials/pangenome_hprc_part2#the-variant-callset). Every track
below is a URL you can paste: the graph route reads projections we prebuilt and
host, with the build script in
[Reproduce it end to end](#reproduce-it-end-to-end).

## The GraphGenomeView plugin

It is beta and not in the [plugin store](/docs/user_guides/plugin_store) yet, so
it loads by URL. In JBrowse Web that is a `plugins` array at the top level of
`config.json`, beside `assemblies` and `tracks` (see
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

The plugin needs a JBrowse 5 build. It reads two things core first exported in
v5.0.0-beta.1, the MUI icon factory its menu items draw with and the shared
**Launch** submenu, so on a JBrowse 4 host it does not load, and a config naming
it opens with no graph view and none of its adapters. The released 4.x web
builds and Desktop are such hosts; the 5.0 betas and the `main` build the
[hosted HPRC page](/docs/tutorials/genomes_pangenome) launches into are not.

The [graph genome view guide](/docs/user_guides/graph_genome_view) covers the
view's layouts, colors and menus on a smaller graph than this one. Most of
[part 2](/docs/tutorials/pangenome_hprc_part2) needs no plugin at all: the
allele inventory and both callsets are ordinary tracks.

## What release 2 publishes

`pangenomes/freeze/release2/minigraph-cactus/` holds these per reference (a
GRCh38 and a T2T-CHM13 build; everything below uses GRCh38):

| File                | Size   | What it is                                   |
| ------------------- | ------ | -------------------------------------------- |
| `*.sv.gfa.gz`       | 842 MB | SV-resolution graph, and an rGFA             |
| `*.gfa.gz`          | 63 GB  | the base-level graph                         |
| `*.gbz`             | 5.4 GB | the same graph in vg's indexed format        |
| `*.wave.vcf.gz`     | 2.3 GB | every variant, decomposed, **tabix-indexed** |
| `*.wave.vcf.gz.tbi` | 2.2 MB | the index, published beside it               |

The `sv.gfa` is the graph route; the VCF is the variant route. Both open without
downloading the whole file: the VCF ships its index, and we host small BED
projections of the graph (below). Release 3 is the verkko assembly and QC
release, and publishes no graphs.

Two subdirectories sit beside those files, `v2.0/` and `v2.1/`, holding the
fuller per-build set. Both pages read the `v2.1/` build, its `sv.gfa`, its
callsets and its gbz-base database, so node ids agree across the pair. The one
file only `v2.0/` has is the alignment the graph and the callset are derived
from, `v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz`, 5.9 GB with a
`.tai` index, which
[part 2](/docs/tutorials/pangenome_hprc_part3#the-alignment-underneath-both)
opens; v2.1 publishes its MAF only, 53 GB and unindexed.

Every file above is published twice, once per reference, and this page uses the
GRCh38 build. Both build scripts run on the CHM13 files unchanged, with one
config change, the PanSN prefix: `{ "chm13": "CHM13" }` in place of
`{ "hg38": "GRCh38" }`.

## Why this graph opens by locus {#regular-gfa-vs-rgfa}

Release 2 labels no file "rGFA", but `sv.gfa` is the minigraph stage of the
Minigraph-Cactus build, so every segment in it carries the `SN`/`SO`/`SR` tags
that state where the segment sits and which segments are the reference. That is
what lets JBrowse open any locus with no extraction step, and it is the whole
reason this page reads `sv.gfa` rather than the base-level `gfa.gz` beside it,
which states the same thing only inside its path lines.
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#what-your-graph-can-produce)
sets out both formats and which builder each one takes.

A PanSN name has two halves, and only the first needs configuring:

- The **sample** half needs `assemblyNameToPanSN: { "hg38": "GRCh38" }`, tying
  an `hg38` assembly to the graph's `GRCh38` prefix. The prefix disambiguates:
  the same graph also carries `CHM13#0#chr1`.
- The **contig** half is ordinary refName aliasing, which your assembly already
  does, so an hg38 spelling chr6 as `6` needs no further configuration.
- The variant callset in
  [part 2](/docs/tutorials/pangenome_hprc_part2#the-variant-callset) needs no
  mapping at all: its contigs are plain GRCh38 (`chr6`, not `GRCh38#0#chr6`).

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

- **`uri` names a prefix rather than a file.** The adapter appends
  `.segs.bed.gz` and `.links.bed.gz` and reads the `.tbi` beside each, so one
  string points at the pair. Both indexes, about 9 MB, arrive on the first cut
  of a session and are reused by every later one.
- **`assemblyNameToPanSN` ties your assembly to the graph's own spelling of
  it.** The session calls the reference `hg38` where the graph calls it
  `GRCh38#0#chr6`, and the sample half of that name is the part JBrowse cannot
  work out for itself. [Why this graph opens by locus](#regular-gfa-vs-rgfa) has
  the rest of the naming.
- **`color`** paints each segment in the graph view's own **Stable rank**
  colors, so a segment is the same color in both panels.

Each segment draws where its tags say it sits, so the GRCh38 backbone tiles the
reference and the graph is queryable by locus.

The two files here are ours, and the first of them is one command over any rGFA.
`gfa2bed -m` reads the `SN`/`SO`/`SR` tags, which is what puts each segment at a
reference coordinate:

<!-- from: scripts/build_rgfa_tabix.sh -->

```bash
# one row per segment: stableName, start, end, segmentId, rank
gfatools gfa2bed -m your-graph.gfa.gz | sort -k1,1 -k2,2n | bgzip > your-graph.segs.bed.gz
tabix -f -p bed your-graph.segs.bed.gz
```

The links index beside it comes from the same script's second pass over the
L-lines.
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
is what we ran on HPRC's `sv.gfa.gz`, and
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) walks it and
every other file these two pages read.

## Open a locus as a graph

The graph draws a window at a time, and there are three ways to pick one:

- **Drag across the ruler** and choose **Graph genome view (this selection)**.
  Selecting more than the view will draw greys the item out and displays its
  limit.
- **Launch → Graph genome view (this region)** in the track menu takes whatever
  is on screen.
- **Right-click one segment** to cut the graph around that segment.

Any of them works without a graph track in the view: the item appears whenever
the session holds a track whose adapter can cut a subgraph, and the subgraph
comes from the same two files the track reads.

Each launch makes a pane, which draws the window it was cut from and holds it
while the linear view moves on, so the next window is another launch and a pane
you are done with can be closed. Around a hundred kilobases is what the layout
draws legibly at segment resolution, and the view refuses a cut past 5 Mb;
[the bubble tier](/docs/tutorials/pangenome_hprc_part2#a-whole-chromosome-as-a-graph)
is what draws a wider span.

The third lane in the figure below is the
[bubble track](/docs/tutorials/pangenome_hprc_part2#the-bubble-track), which
part 2 loads and the figures from here on read alongside the graph.

<Figure caption="The C4 locus as a force-directed graph, under three lanes of the same window. The bubbles track reports a single bubble spanning the locus, and the graph below is what it contains." src="/img/pangenome/hprc_c4_subgraph.png" />

A force layout has no x axis to share with the linear view, so color carries the
correspondence. **Reference position**, which the graph opens on, ramps hue over
the window the subgraph was cut from and paints any segment without a reference
coordinate flat charcoal. The
[guide](/docs/user_guides/graph_genome_view#colors-that-mean-the-same-thing-in-both-panels)
covers the other schemes.

A rank-0 segment sits on GRCh38 and has a coordinate; a rank>0 segment sits on
another assembly's refName, so the ramp has no GRCh38 position to take and the
segment draws charcoal. Where each attaches comes from the
[anchored layout](#the-layout-dropdown) or a hover; the bubble lane and the
[allele inventory](/docs/tutorials/pangenome_hprc_part2#the-allele-inventory)
give their lengths.

**Bubble spread** and **Graph context** decide whether that picture is readable,
and the
[graph genome view guide](/docs/user_guides/graph_genome_view#two-settings-that-decide-what-is-drawn)
covers what each does on a graph small enough to watch it happen. Two of their
behaviors are specific to a graph this size:

- Raise **Graph context** to **2 hops** when the drawing looks emptier than the
  bubble lane above it says it should be. At this scale that means an allele
  with alleles of its own, which one hop reaches the entrance of and not the
  interior. For an exact slice, `gfatools view -R <region> -r 1` walks the graph
  itself.
- The layout scales to a target node size, so ten times the nodes turns the
  loops that carry the figure into specks. Every window in the table below is
  around a hundred kb.

### Insertions, deletions and their sizes

Every node and every deletion arc carries its own size, so the drawing states
what each alternative is worth.

Extra sequence is a node, so it draws as a tube. Missing sequence is an
**edge**: a link from one backbone segment to another that is not its neighbour,
taken by the haplotypes that skip what lies between. Those edges are dashed and
near-black, off the color ramp.

Read a deletion on the [anchored layout](#the-layout-dropdown), where x is
GRCh38 bp, so the arc spans exactly the sequence it removes. In a row layout the
span carries the size and every arc is the same shape.

<Figure caption="The complement factor H cluster on chr1: two HPRC haplotypes aligned to GRCh38, above the same window as an anchored graph. Each row carries its own CAT annotation, and the dashed arc under the graph's reference row spans the gap that removes CFHR3 and CFHR1." src="/img/pangenome/hprc_cfhr_deletion.png" />

Hovering one of these edges gives the interval and the bp it removes. An edge
joins two backbone segments and carries no sequence of its own, so it names no
donor haplotype and opens nowhere but GRCh38; who carries the deletion is the
[callset's](/docs/tutorials/pangenome_hprc_part2#the-variant-callset) to say.

Release 2 annotates every assembly with CAT, on the assembly's own contigs, so a
haplotype row carries its own gene models. The index
([`cat_genes_hprc_r2_v1.3.index.csv`](https://github.com/human-pangenomics/hprc_intermediate_assembly/blob/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv))
gives one GFF3 per haplotype; load a slice of one as an ordinary `FeatureTrack`
on that haplotype's assembly.

Only the window is cut, so an allele whose interior falls outside it draws as a
short arm off the backbone. When a cut comes back as a single tangle, widen it
until the backbone chain is in frame: the figure below is cut from
`chr1:103,500,000-103,850,000`, wider than the amylase entry in the table
further down.

<Figure caption="The amylase locus on chr1 as a force-directed graph, under the RefSeq genes and the rGFA segments for the same window. Every crossing is inside the amylase bubble at the end of the backbone chain." src="/img/pangenome/hprc_amylase_graph.png" />

The graph's own bubble index says what that window holds, and tabix reads it
over HTTP without the browser. The bubble spanning _AMY1A_ and _AMY1B_ is the
first row:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz \
  'GRCh38#0#chr1:103,690,000-103,780,000' | cut -f1-8 | head -1
# GRCh38#0#chr1  103611080  103732636  95  269401  1  26889  316616
```

After the span: segments, paths, the inversion flag, then the lengths of the
shortest and longest allele the bubble holds. Three things follow from the rest
of the file:

- two columns further out (`cut -f13,14`, dropped from the query above) carry
  those two alleles as **sequence**, so a bubble's own sequence is one tabix
  query away and the adapter puts it in the feature details panel
- the segments and links projections drop sequence entirely, being coordinate
  BEDs, so going from an interior node id back to its bases means the GFA
  itself: `gfatools view -l <segment> -r 0` prints the S-line, and
  `gfatools gfa2fa` writes the whole graph out as FASTA
- bubbles are indexed under the graph's PanSN names and the alleles under plain
  GRCh38 contigs, which is why only the bubble track config carries
  `assemblyNameToPanSN`

`gfatools bubble` and the rGFA tags state the distinct sequence a bubble can
hold, so length is the proxy for copy number here. The `.gbz` beside them
carries a walk per haplotype, which is a copy count at KIV-2 or _AMY1_, and
[reading it is a query](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph)
once the graph is in a gbz-base database. Release 2 strips the `AT` (allele
traversal) field from the wave VCF, recorded in its own header as
`bcftools annotate -x INFO/AT`.

### The Layout dropdown

The [guide](/docs/user_guides/graph_genome_view#three-layouts) sets out what the
three modes put on each axis. Here is the same MHC class II window drawn in two
of them:

<Figure caption="One MHC class II subgraph drawn both ways, same window and same tracks above it. Left, force-directed. Right, anchored: every x is a GRCh38 coordinate, so each allele hangs below where it attaches." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Both halves ring the same node, the 1.8 kb allele the right-click menu on the
left is open on: black under the reference-position ramp, because it has no
reference position of its own. **Highlight in hg38** wrote the orange band above
over the 12 kb of backbone it attaches across, eleven green segments in release
2.1: an off-reference allele is highlighted across the reference it replaces.
The anchored half labels the same node a 10.2 kb deletion, which is the net of
1.8 kb standing in for 12.

Taking the dropdown from one to the other says which node in the tangle is which
node on the axis, and the video under [HPRC release 2](#hprc-release-2) makes
that move on this subgraph.

Each locus below is a window small enough to draw:

| Locus        | Window                         |
| ------------ | ------------------------------ |
| MHC class II | `chr6:32,510,000-32,600,000`   |
| KIR          | `chr19:54,750,000-54,840,000`  |
| AMY1         | `chr1:103,690,000-103,780,000` |
| C4           | `chr6:31,980,000-32,050,000`   |
| LPA KIV-2    | `chr6:160,525,000-160,655,000` |

What the graph holds in one of them is one query against the
[allele inventory](/docs/tutorials/pangenome_hprc_part2#the-allele-inventory),
here cut down to span, kind, size and the haplotype the allele was first seen
in:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.alleles.bed.gz \
  chr6:32,510,000-32,600,000 | cut -f1-3,10,11,16
```

An empty answer needs reading carefully. `chr5:70,925,000-70,954,000`, over
_SMN1_, returns nothing: minigraph merged _SMN1_ and _SMN2_ onto one path.
Near-identical segmental duplications collapse this way throughout, so a quiet
window can be a collapsed one, across the whole class of genes defined by a
duplication: _SMN1_/_SMN2_, _RHD_/_RHCE_, _PMS2_/_PMS2CL_ and the CYP clusters
among them.

### Which haplotype an allele came from

**Sample rows** is the mode that answers this: rank is build order, so one rank
holds alleles from a dozen haplotypes, where a sample row is one haplotype. The
guide pictures it on five strains; with 464 it is a list of donors, naming whose
sequence a node is.

_LPA_ is the locus for the shape. Its KIV-2 repeat sets the level of Lp(a), an
inherited cardiovascular risk factor, and its copy number varies from person to
person:

<Figure caption="The KIV-2 repeat inside LPA as a force-directed graph, under the RefSeq genes, the bubbles lane and the rGFA segments. The bubble the lane reports across the repeat is the chain of loops below it, with one dashed arc bypassing the reference between two of them." src="/img/pangenome/hprc_lpa_kiv2.png" />

A donor row names the haplotype the sequence was taken from, the
[attribution the node panel reports](#from-a-node-back-to-a-coordinate).

### From a node back to a coordinate

**Right-click a node** for two answers that persist past a hover:

- **Highlight in hg38** marks its reference interval in the linear view beside
  the graph and leaves it there.
- **Open in hg38** scrolls that view to it.

The graph's own **Launch** menu does the same for the whole window it was cut
from.

What you are offered depends on which segment you clicked, because rGFA states
each segment's source sequence (`SN`) and offset (`SO`):

- a **backbone (rank 0) segment** sits on GRCh38, so you get its exact
  coordinates there.
- an **allele (rank>0) segment** sits on one haplotype's own sequence, e.g.
  `HG02717#1#chr6`. That coordinate is exact too, and has no loaded assembly to
  open it in, so you get the GRCh38 interval between the two backbone segments
  the allele detaches from and rejoins, the same span a
  [hover](/docs/user_guides/graph_genome_view#hovering-one-panel-highlights-the-other)
  highlights.

Either way the node's haplotype is named, in the tooltip and in the details
panel a left-click opens. Read that name as `contributingAssembly`, which is
what the panel calls it: the first assembly to contribute the segment. The
panel's `carriedBy` row holds the set of haplotypes that walk it, and on this
graph it is empty, because the rGFA route anchors nodes on their `SN` tags and
an rGFA records no traversals. Load a GFA that carries `P` or `W` lines, as the
[graph genome view guide](/docs/user_guides/graph_genome_view#which-strain-takes-which-path)
does, and the view anchors on those paths: `carriedBy` then lists every sample
through the node and **Sample rows** becomes carriage rather than attribution.
At HPRC scale there are two answers, both published files:
[carriage at the graph's own granularity](/docs/tutorials/pangenome_hprc_part2#carriage-at-the-graphs-own-granularity)
is one record per snarl with a genotype per haplotype, so the site under the
node you clicked states who walks it, and the `.gbz` states the walks
themselves, which is
[part 2's route through the graph](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph).

That route is drawn in the [layout figure above](#the-layout-dropdown): its left
half has the menu open on a 1.8 kb allele of NA20809 haplotype 2, the black node
ringed without a number, over the band **Highlight in hg38** left in the linear
view. The band is the 12 kb of backbone that allele attaches across, which here
is _HLA-DRB5_.

The lanes above combine into one route:

- rubberband a locus into a graph
- right-click an allele to put the linear view on its GRCh38 interval
- read that interval off the tracks anchored there: the
  [bubble track](/docs/tutorials/pangenome_hprc_part2#the-bubble-track) gives
  the bubble it belongs to, the
  [allele inventory](/docs/tutorials/pangenome_hprc_part2#the-allele-inventory)
  its length and the haplotype it was first seen in, and the
  [variant callset](/docs/tutorials/pangenome_hprc_part2#the-variant-callset)
  whether anything is genotyped there

The graph states what sequence exists and where it attaches; those three state
how common it is.

Where a contributing haplotype is itself loaded, the same menu opens the allele
on that haplotype's own coordinates, which the next section sets up for any of
the 464, and with two or more loaded the view's own **Launch** menu opens them
all at once as a synteny view. The
[graph genome view guide](/docs/user_guides/graph_genome_view#from-a-node-back-to-a-genome)
shows both on five strains.

### Every way across {#every-way-across}

Each crossing between the two panels is one menu item, and this is the whole
list on this graph. Into the graph, from a linear view whose session holds the
segments track:

- **Track menu → Launch → Graph genome view (this region)** on the segments lane
  cuts whatever is on screen.
- **Drag across the scale bar** and pick **Graph genome view (this selection)**
  for a window narrower than the view. Past the view's limit the item greys out
  and names it.
- **Right-click a segment** in the lane for **Graph genome view (this
  segment)**, which cuts the graph around that one segment, padded by half its
  length each side. Right-clicking a gene in the RefSeq lane offers the same cut
  as **Graph genome view (this feature)**; the segments track has to be in the
  session, not in the view.

Out of the graph:

- **Hover a node** and its GRCh38 interval is banded across every lane in the
  linear view above; hover the linear view and the node under the cursor lights
  up. Nothing to configure.
- **Right-click a node** and take **Highlight in hg38**, which writes that
  interval into the linear view's own highlights, where it stays after the
  pointer moves.
- **Right-click a node** and take **Open in hg38**, which scrolls the linear
  view to it. On a backbone segment that is the segment's own span; on an allele
  it is the interval between the two backbone segments the allele leaves and
  rejoins, and the item says so, **around this node**.
- **View menu → Launch → Linear genome view** does the same for the whole window
  the graph was cut from. Once a contributing haplotype is loaded as an
  assembly, the node menu gains **Open in** that haplotype at the allele's own
  coordinates, and with two or more loaded the same **Launch** submenu opens
  them all as a synteny view;
  [Loading a haplotype as an assembly](#loading-a-haplotype-as-an-assembly) sets
  that up.

The [clip at the top of the page](#the-route-end-to-end) takes the region launch
and **Highlight in hg38**, with the layout dropdown between them. The clip under
[Loading a haplotype as an assembly](#loading-a-haplotype-as-an-assembly) takes
**Open in** on a haplotype, and part 2's
[whole-chromosome clip](/docs/tutorials/pangenome_hprc_part2#a-whole-chromosome-as-a-graph)
takes **Open in hg38** and the scale-bar drag.

## Loading a haplotype as an assembly {#loading-a-haplotype-as-an-assembly}

Every segment states the assembly that contributed it and its offset there, so a
node can open the haplotype it came from once that haplotype is loaded.
[UCSC GenArk](https://hgdownload.soe.ucsc.edu/hubs/) hosts every release 2
assembly, a 2bit and an alias file each, and names the sequences by the same
GenBank accessions the graph does: `NA20809#2#CM094351.1` in the graph is
`CM094351.1` in the 2bit. So a haplotype loads with nothing translated, and the
alias file's `ucsc` column adds `chr6`.

Which haplotype to load is read off the graph. A node's details name
`contributingHaplotype`, the `sample#haplotype` off its rGFA name, and the 1.8
kb allele the [layout figure](#the-layout-dropdown) opens its menu on names
`NA20809#2`, whose accession is on the
[HPRC sample table](https://genomes.jbrowse.org/pangenomes/hprc): haplotype 2 of
NA20809 is GCA_044166615.1. (Most of the class II bubble's off-reference
sequence is credited to HG01071 haplotype 1, which answers a different question;
what is loaded here is the haplotype this allele belongs to.)

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
(`NA20809`), so the assembly can keep whatever name the session likes as long as
one of the two is among its `aliases`.

A launched view carries the session's annotation for the assembly it opens, and
the annotation worth carrying is HPRC's own: release 2 runs CAT on every
assembly, so the haplotype's genes are its own models rather than GRCh38's
lifted across. The
[CAT index](https://github.com/human-pangenomics/hprc_intermediate_assembly/blob/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv)
names one GFF3 per haplotype in its `location` column, whole-genome and
unindexed, so slice the window once and index the slice:

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

GenArk's own gene lanes are the alternative that needs no download, and they are
thin here: its RefSeq mRNAs are other species' transcripts mapped onto the
assembly, and none lands within 100 kb of this allele.

The segments track draws on the haplotype too once its `assemblyNames` list it
and `assemblyNameToPanSN` says which haplotype the name means. This replaces the
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
**Open in NA20809.2** with the allele's own locus, beside the GRCh38 entries it
had before, and taking it adds a linear view of that haplotype's chr6 framed on
the allele, with its CAT genes and the segments the graph credits to it. The
launch frames the pane on the allele alone, so zoom out for what surrounds it.

<Video src="/media/pangenome/hprc_out_to_haplotype.mp4" caption="The MHC class II cut with NA20809 haplotype 2 loaded: the allele hovered for its contributing assembly, its menu opened, the Open in NA20809.2 entry adding a view of that haplotype's own chromosome 6 at the allele, and that view zoomed out to the CAT genes around it." />

<Figure caption="The same launch as a still. Above, the MHC class II window on hg38 and the cut made from it, with the NA20809.2 allele ringed. Below, the view its Open in entry opened, zoomed out from the allele: NA20809 haplotype 2 on its own chromosome 6, the segments the graph credits to it, and its CAT annotation, which has HLA-DRB9 and HLA-DRB6 either side of the allele and no HLA-DRB5 at all." src="/img/pangenome/hprc_haplotype_launch.png" />

On GRCh38 the ringed allele attaches across the 12 kb of backbone the
[layout figure](#the-layout-dropdown) highlights, which is most of HLA-DRB5. On
NA20809 haplotype 2 the same 1.8 kb sits in the gap between HLA-DRB9 and
HLA-DRB6, and the annotation has no HLA-DRB5 model at all, so the two views
state the same structural difference from either side: the graph as an allele
that replaces 12 kb, the haplotype's annotation as a gene that is not there.

Which haplotype a window offers is build order: minigraph credits an allele to
the first assembly to contribute it, so a haplotype added late is named on few
nodes however much it carries, and a backbone-to-backbone deletion names none.
Loading a haplotype makes its own alleles openable and says nothing about
carriage, which stays the
[callset's](/docs/tutorials/pangenome_hprc_part2#the-variant-callset).

## What part 2 adds

The graph states what sequence exists, where it attaches, and which assembly
first contributed it. It does not state who carries that sequence, how often, or
what it is made of. [Part 2](/docs/tutorials/pangenome_hprc_part2) reads those
off the rest of release 2 on the same axis: where the graph varies and by how
much, what each alternative is, which of the 464 haplotypes walk it, and the
multiple alignment the graph and the callset were both derived from.

## Reproduce it end to end

The two tabix indexes behind [the graph track](#load-the-graph) are built by
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph), which runs
the same commands on any rGFA. Point it at `hprc-v2.1-mc-grch38.sv.gfa.gz` and
it writes what we host, and their provenance (source, size, exact commands,
build date) is in [README.txt](https://jbrowse.org/demos/hprc/README.txt) beside
them.

[Part 2](/docs/tutorials/pangenome_hprc_part2#reproduce-it-end-to-end) carries
the scripts behind the rest of the release's files.

## See also

- [](/docs/tutorials/pangenome_hprc_part2)
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
