---
title: Pangenome (HPRC)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, then
  its 464-haplotype variant callset
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** HPRC release 2's `sv.gfa` is an rGFA, so its segments carry
coordinates and the graph opens by locus from two small tabix indexes rather
than the 842 MB file. Its `wave.vcf.gz` ships an index too, so 464 haplotypes
draw as a genotype matrix straight off S3.

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) is roughly a
fivefold expansion over release 1. This tutorial opens two of its products: the
pangenome graph drawn as a graph, and the variant callset (464 haplotypes as a
genotype matrix).

Every track below is a URL you can paste. The callset ships tabix-indexed, so
JBrowse reads the slice in view straight off HPRC's S3. The graph route reads
projections we prebuilt and host, with the build script in
[Reproduce it end to end](#reproduce-it-end-to-end).

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- every track on this page, assembled, at
  [`https://jbrowse.org/demos/hprc/config.json`](https://jbrowse.org/demos/hprc/config.json)
- or an instance of your own, with the four track configs below pasted in
- the GraphGenomeView plugin, for two of those four: they use the
  `RgfaTabixAdapter` and `MinigraphBubbleAdapter`, which ship in it rather than
  in JBrowse Web

## The GraphGenomeView plugin

It is beta and not in the [plugin store](/docs/user_guides/plugin_store) yet, so
it loads by URL:

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

The [graph genome view guide](/docs/user_guides/graph_genome_view) covers the
view's layouts, colors and menus on a smaller graph than this one. The allele
inventory and the variant callset need no plugin.

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
projections of the graph (below). Release 3 has no graphs at all (it is the
verkko assembly and QC release), so release 2 is the one for this.

Every file above is published twice, once per reference. This page uses the
GRCh38 build because that is the assembly most readers already have loaded, but
every locus it features (MHC, KIR, LPA, AMY1, CFHR) is one where GRCh38 is the
weaker backbone, and the T2T-CHM13 build of the same graph and the same callset
sits beside it. Nothing here is specific to GRCh38: both build scripts run on
the CHM13 files unchanged, and the only config change is the PanSN prefix
(`{ "chm13": "CHM13" }` in place of `{ "hg38": "GRCh38" }`).

## Regular GFA vs rGFA

Whether a graph opens by locus straight from the file depends on whether its
segments carry coordinates.

A **regular GFA** (what pggb, odgi, and the full base-level Minigraph-Cactus
graph emit) records no coordinates on its segments. The only reference positions
in the file live inside the P/W path lines, so you cannot look up a locus
without walking every path, and to draw a subgraph you first cut a window out of
the graph offline with `odgi extract`. That is the route the
[E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli#a-window-as-a-file)
takes.

An **rGFA** (what minigraph emits) tags every segment with three fields, the
whole of the [spec](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md):

```
S  s3  TTGCAA  LN:i:6  SN:Z:GRCh38#0#chr1  SO:i:10621  SR:i:0
```

`SN` is the stable sequence the segment sits on, `SO` its offset there, and `SR`
its rank (`0` on the reference backbone). So the file itself states where each
segment sits and which segments are the reference, and JBrowse can open any
locus with no extraction step.

Release 2 ships no `minigraph/` directory and never labels a file "rGFA", but
the graph route does not need release 1: "rGFA" names a tag convention, not a
separate format, and the `sv.gfa` above is the minigraph stage of the
Minigraph-Cactus build, so every one of its segments already carries these tags.
(The base-level `gfa.gz` beside it does not, and neither do pggb graphs, which
keep the `odgi extract` route.)

A PanSN name has two halves, and only the first needs configuring:

- The **sample** half needs `assemblyNameToPanSN: { "hg38": "GRCh38" }`, tying
  an `hg38` assembly to the graph's `GRCh38` prefix. The prefix disambiguates:
  the same graph also carries `CHM13#0#chr1`.
- The **contig** half is ordinary refName aliasing, which your assembly already
  knows how to do, so an hg38 spelling chr6 as `6` works without any further
  configuration.
- The variant callset later in this tutorial needs no mapping at all, because
  its contigs are plain GRCh38 (`chr6`, not `GRCh38#0#chr6`).

## Load the graph

JBrowse reads two tabix-indexed BED projections of the graph, not the 842 MB
graph itself. We host them, so a `FeatureTrack` pointed at the shared prefix
downloads nothing but the region in view; the adapter resolves
`<uri>.segs.bed.gz`, `<uri>.links.bed.gz`, and both `.tbi` files:

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

The `color` jexl paints each segment in the graph view's own **Stable rank**
colors, so a segment is the same color in both panels and the two read as one
picture.

Each segment draws where its tags say it sits, so the GRCh38 backbone tiles the
reference and the graph becomes queryable by locus. Those hosted files are ours,
not HPRC's: we ran the `sv.gfa.gz` through
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
and put the output on `jbrowse.org`.

## Open a locus as a graph

The graph draws a window at a time rather than a whole viewport. To pick one,
**drag across the ruler** to rubberband a region and choose **Graph genome view
(this selection)**. This needs no graph track in the view: the item appears
whenever the session holds a track whose adapter can cut a subgraph. Selecting
more than the view will draw greys the item out and displays its limit. The
track menu's **Launch view → Graph genome view (this region)** takes whatever is
on screen instead, and right-clicking one segment cuts the graph around that
segment.

The subgraph is cut from the same two files the track reads.

<Figure caption="The C4 locus as a graph, in force-directed layout, under three lanes of the same window. The bubbles track reports a single bubble spanning the locus and the graph below is what that bubble contains. Both panels use the graph's Reference position colors, so the segment blocks and the backbone thread in the graph run red to magenta together, and the charcoal loops are the alleles, which sit on no GRCh38 coordinate and so take no hue." src="/img/pangenome/hprc_c4_subgraph.png" />

A force layout has no x axis to share with the linear view, so color is the only
thing that can carry the correspondence. **Reference position** in the **Color**
dropdown is built for that: it ramps hue over the window the subgraph was cut
from, red at its start to magenta at its end. A segment with no reference
coordinate of its own comes off the ramp and draws flat charcoal, so a hue
always states a position on GRCh38 rather than an allele's attachment point.

The ramp is two numbers and a midpoint, so a linear track can paint the same
colors. This is the segments track above with the ramp in place of its rank
colors, so a block above and its node below are the same color:

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank>0 ? 'rgb(60,65,72)' : `hsl(${min(300, max(0, ((feature.start+feature.end)/2 - 31980000) / 70000 * 300))},70%,50%)`"
  }
}
```

The two constants in the `color` are the window's start and its length, here the
C4 window the figure above was cut from, so this belongs on the view rather than
in a hosted config. The `rank` branch is the graph's own off-ramp charcoal; it
fires only on a lane opened on a contributing assembly, where rank>0 segments
have coordinates of their own.

The asymmetry between the panels is structural. A rank-0 segment sits on GRCh38
and has a coordinate, while a rank>0 segment sits on some other assembly's
refName and has none, so no coloring will put those loops on a GRCh38 axis as
segments. Where each one attaches comes from the
[anchored layout](#the-layout-dropdown), whose x is GRCh38 bp, or from a hover;
the bubble lane and the [allele inventory](#the-allele-inventory) give their
lengths.

Two settings control whether that picture is readable.

**Bubble spread**, in the graph's settings menu, sets a floor on how long a node
is drawn. The force engine comes from Bandage, whose graphs are assembled
contigs of kilobases to megabases, so its own floor is tiny; a pangenome allele
is a few bases, which clamps to a stub whose two arms land inside one node
thickness of each other, and the whole window draws as a single thread. **Open
bubbles** gives every allele a drawn length. The cost is that below the floor a
node no longer draws proportional to its length, so read lengths off the
anchored layout or the [allele inventory](#the-allele-inventory), not off this
picture.

The other is the **window**, and wider is not better. The layout scales itself
to a target node size, so a window with ten times the nodes draws ten times as
long a thread at a tenth the size and inks the same fraction of the canvas: the
loops that carry the figure become specks. The windows in the table below are
around a hundred kb for that reason, and a whole chromosome is a linear view's
job, not this one's.

### A detour that starts outside the window

**Graph context**, in the same settings menu, is how far the cut follows links
out of the region, and it defaults to **1 hop**. That matters here more than on
a small graph. An allele's interior segments are indexed under their own
haplotype's sequence, not GRCh38, so a query on the reference never reaches
them: at **None** a detour that leaves the backbone before the window and
rejoins after it arrives as two short stubs, which read as small insertions
rather than as the one large event they are. A hop closes those, at the cost of
one tabix query per off-reference segment already reached, and it expands only
over off-reference segments, so it does not walk the backbone out of the window.

Raise it to **2 hops** when the graph still looks emptier than the bubble lane
above it says it should be, which here means an allele that has alleles of its
own; the
[graph genome view guide](/docs/user_guides/graph_genome_view#two-settings-that-decide-what-is-drawn)
draws the same window both ways on a graph small enough to see it happen. To cut
an exact slice instead, `gfatools view -R <region> -r 1` walks the graph itself
rather than a coordinate frontier.

### What the graph shows that a linear view cannot

Every node and every deletion arc carries its own size, so the drawing states
what each alternative is worth without a hover. Labels appear when the thing
they name is large enough on screen to hold one and disappear as you zoom out.

Extra sequence is a node in the graph, so it draws as a tube. Missing sequence
is an **edge**: a link from one backbone segment to another that is not its
neighbour, taken by the haplotypes that do not carry what lies between them.
Those edges are drawn thick, dashed and near-black rather than on the color
ramp, where hue means reference position and an arc covers a range of it rather
than sitting at one point. The dashes are what separates a deletion from the
solid charcoal stalks of the off-reference alleles around it.

Read a deletion on the [anchored layout](#the-layout-dropdown), which is what
the figure below uses: x there is GRCh38 bp, so the arc spans exactly the
sequence it removes, over the reference that carries it and under the same
coordinates in the linear panel. The force layout bows the same edge out by the
length of the backbone it bypasses, which states a size but not a position,
because FMMM leaves the arc's two ends wherever the simulation puts them.

<Figure caption="The complement factor H cluster on chr1: two HPRC haplotypes aligned to GRCh38, above the same window as an anchored graph. Each row carries that assembly's own CAT gene annotation, so the boxed CFHR3 and CFHR1 are on the reference and on HG00099 and absent from HG01109, whose alignment stops and resumes across the same span. In the graph the reference is the top row, colored by position, and the dashed arc under it spans the 84.7 kb those two genes sit in, labelled on the curve as a deletion of that much. The shorter dashed arcs are the other two backbone-to-backbone deletions in the window, and the thin stalks are alternate alleles, one row per stable rank; two of those carry a deletion label of their own, because they stand in for far more reference than they hold sequence." src="/img/pangenome/hprc_cfhr_deletion.png" />

Hovering one of these edges gives the interval and the bp it removes. This is
the event a linear view is worst at, because a deletion has nothing to draw at
the position it occurs, and the one a graph is best at, because the alternative
route is a real part of the structure.

Release 2 annotates every assembly with CAT, on the assembly's own contigs, so a
haplotype row can carry its own gene models instead of borrowing the
reference's. The index
([`cat_genes_hprc_r2_v1.3.index.csv`](https://github.com/human-pangenomics/hprc_intermediate_assembly/blob/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv))
gives one GFF3 per haplotype; load a slice of one as an ordinary `FeatureTrack`
on that haplotype's assembly.

Chromosome size does not enter into any of this. The amylase locus sits on chr1,
the longest human chromosome, and the graph holds 464 haplotypes of it:

<Figure caption="The amylase locus on chr1 as a force-directed graph, under the RefSeq genes and the rGFA segments for the same window. The graph is cut from two tabix indexes, so 248 Mb of chromosome costs nothing: this window is 126 nodes. The flanks draw as one chain of backbone segments and every crossing in the drawing is inside the amylase bubble at the end of it, so the window says where the complexity is as well as what it is. The dashed arcs are deletions, each bowed around the reference it removes and labelled with how much that is, on a leader where the arc is too small to carry the words; the short arms off the thread are alleles whose interiors sit outside the cut. Colors are reference position in both panels, red at the window's left edge to magenta at its right." src="/img/pangenome/hprc_amylase_graph.png" />

The graph's own bubble index says what that window holds, and tabix reads it
over HTTP without the browser. The bubble spanning AMY1A and AMY1B is the first
row:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz \
  'GRCh38#0#chr1:103,690,000-103,780,000' | cut -f1-8 | head -1
# GRCh38#0#chr1  103611080  103732636  95  269401  1  26889  316616
```

After the span: segments, paths, the inversion flag, then the lengths of the
shortest and longest allele the bubble holds. Two columns further out
(`cut -f13,14`, dropped from the query above) carry those two alleles as
**sequence**, so a bubble's own sequence is one tabix query away and the adapter
puts it in the feature details panel. The segments and links projections drop
sequence entirely, being coordinate BEDs, so going from an interior node id back
to its bases means the GFA itself: `gfatools view -l <segment> -r 0` prints the
S-line, and `gfatools gfa2fa` writes the whole graph out as FASTA. Bubbles are
indexed under the graph's PanSN names and the alleles under plain GRCh38
contigs, which is why only the bubble track config carries
`assemblyNameToPanSN`.

Copy number is not among those numbers, and that is a property of these two
projections rather than of the release. `gfatools bubble` and the rGFA tags
state the distinct sequence a bubble can hold, not how many times a given
haplotype repeats it, so length is the proxy here and the shape of the
alternatives is what the graph adds. The `.gbz` beside them does carry a walk
per haplotype, which at KIV-2 or AMY1 _is_ a copy count. Reading it is a vg job
rather than a browser one, and out of scope for this page. The callset offers no
shortcut either: release 2 strips the `AT` (allele traversal) field from the
wave VCF, which its own header records as `bcftools annotate -x INFO/AT`, so no
traversal is recoverable from the VCF.

### The Layout dropdown

**Force-directed** draws the graph's own shape, with no axis. **Anchored**, the
mode the deletion figure above uses, puts x back on GRCh38 and stacks the
alternate alleles below the backbone by rank. The same MHC class II window drawn
both ways:

<Figure caption="One MHC class II subgraph drawn both ways, same window and same tracks above it. Left, force-directed: the drawing is the graph's shape and nothing about it lines up with the linear view. Right, anchored: every x is a GRCh38 coordinate, so the backbone is one straight line and each alternate allele hangs below the position it attaches to, stacked by rank. The rings mark the same two nodes in both halves, a 12 kb reference stretch and the 12.3 kb allele over it. Reference-position colors are on in both, so the ringed reference stretch carries the same green as the segment above it either way, and in the anchored half the same x; the allele is charcoal in both, being off the ramp." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Each locus below is a window small enough to draw:

| Locus        | Window                         |
| ------------ | ------------------------------ |
| MHC class II | `chr6:32,510,000-32,600,000`   |
| KIR          | `chr19:54,750,000-54,840,000`  |
| AMY1         | `chr1:103,690,000-103,780,000` |
| C4           | `chr6:31,980,000-32,050,000`   |
| LPA KIV-2    | `chr6:160,525,000-160,655,000` |

What the graph holds in one of them is one query against the
[allele inventory](#the-allele-inventory), here cut down to span, kind, size and
the haplotype the allele was first seen in:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.alleles.bed.gz \
  chr6:32,510,000-32,600,000 | cut -f1-3,10,11,16
```

An empty answer needs reading carefully. `chr5:70,925,000-70,954,000`, over
SMN1, returns nothing at all: minigraph merged SMN1 and SMN2 onto one path. That
is the graph's general limitation rather than a curiosity of one locus.
Near-identical segmental duplications collapse into a single path, which rules
this graph out for the whole class of genes defined by one: SMN1/SMN2, RHD/RHCE,
PMS2/PMS2CL and the CYP clusters among them. A quiet window means collapsed or
invariant rather than checked and found nothing.

### Which haplotype an allele came from

The **Layout** dropdown's third mode, **Sample rows**, keeps x on GRCh38 and
gives each contributing assembly its own row, which at a dense locus is the only
row that means anything: rank is build order, so one rank holds alleles from a
dozen different haplotypes while a sample row is one haplotype. The
[graph genome view guide](/docs/user_guides/graph_genome_view#three-layouts)
pictures it on five strains, which is the scale it reads at. With 464
haplotypes, what it says at a locus is which of them donated sequence there, and
the drawing is a row per donor rather than a shape.

LPA is the case for the shape instead, since its KIV-2 repeat sets Lp(a) level
and copy number there is not callable from short reads:

<Figure caption="The KIV-2 repeat inside LPA as a force-directed graph, under the RefSeq genes, the bubbles lane and the rGFA segments for the same window. The bubble the lane reports across the repeat is the chain of loops below it, and each node carries the sequence it holds; the dashed arc, labelled with the size of the deletion it draws, is the route that bypasses the reference between two of them." src="/img/pangenome/hprc_lpa_kiv2.png" />

Either way a donor row names the haplotype the sequence was taken from, the same
attribution the [allele inventory](#the-allele-inventory)'s `discoveryRank` and
`firstSeenIn` carry, and not the set of haplotypes carrying it.

### Hovering one panel highlights the other

Hover a node in the graph and the reference interval it occupies is highlighted
in every linear view beside it; hover the linear view and the segment under the
cursor brightens in the graph. This needs no configuration. For a rank>0 allele
the interval shown is not the allele's own sequence, but the span between the
two backbone segments it detaches from and rejoins. Both directions are pictured
in the
[graph genome view guide](/docs/user_guides/graph_genome_view#hovering-one-panel-highlights-the-other).

### From a node back to a coordinate

Hovering says where a node is only while the cursor is on it. **Right-click a
node** for two answers that persist: **Highlight in hg38** marks its reference
interval in the linear view beside the graph and leaves it there, and **Open in
hg38** scrolls that view to it rather than opening another pane. The graph's own
**Launch view** menu does the same for the whole window it was cut from.

What you are offered depends on which segment you clicked, because rGFA states
each segment's source sequence (`SN`) and offset (`SO`):

- a **backbone (rank 0) segment** sits on GRCh38, so you get its exact
  coordinates there.
- an **allele (rank>0) segment** sits on one haplotype's own sequence, e.g.
  `HG02717#1#chr6`. That coordinate is exact too, but no session loads 464
  haplotypes as assemblies, so there is nothing to open it in. What you get
  instead is the GRCh38 interval between the two backbone segments the allele
  detaches from and rejoins, the same span the hover highlights.

Either way the node's haplotype is named, in the tooltip and in the details
panel a left-click opens. Read that name as `contributingAssembly`, which is
what the panel calls it: the first assembly to contribute the segment, not the
set of haplotypes that walk it. The panel has a `carriedBy` row for the set, and
on this graph it is empty, because the rGFA route anchors nodes on their `SN`
tags and an rGFA records no traversals at all. Load a GFA that carries `P` or
`W` lines instead, as the
[graph genome view guide](/docs/user_guides/graph_genome_view#which-strain-takes-which-path)
does, and the view anchors on those paths: `carriedBy` then lists every sample
through the node and **Sample rows** becomes carriage rather than attribution.
At HPRC scale the same answer comes from `minigraph --call` over the assemblies,
from the `.gbz` and vg, or from the [callset](#the-variant-callset) at that
site.

<Figure caption="Right-clicking one haplotype's allele (circled), over the band Highlight in hg38 left in the linear view above. The ringed node is black because the drawing is colored by reference position and an allele has none; the band it produces is the 12 kb backbone segment it attaches across, which here is HLA-DRB5. The menu works in that GRCh38 interval, not the haplotype's own coordinates: that assembly is not loaded, and no session loads all 464. The band stays until it is removed, so the answer survives letting go of the mouse." src="/img/pangenome/hprc_node_menu.png" />

The lanes above combine into one route: rubberband a locus into a graph,
right-click an allele to put the linear view on its GRCh38 interval, then read
that interval off the tracks anchored there. The
[bubble track](#the-bubble-track) gives the bubble it belongs to, the
[allele inventory](#the-allele-inventory) its length and the haplotype it was
first seen in, and the [variant callset](#the-variant-callset) whether anything
is genotyped there. The graph states what sequence exists and where it attaches,
and those three state how common it is.

Where the contributing assemblies are themselves loaded, a handful of genomes
rather than hundreds, the same menu opens any of them, or all at once as a
synteny view. See the
[graph genome view guide](/docs/user_guides/graph_genome_view#from-a-node-back-to-a-genome).

### The one donor worth loading

On this graph exactly one contributor can be loaded as an assembly: CHM13. The
haplotypes name their contigs by GenBank accession (`CM102524.1`), and there are
464 of them; CHM13 spells its contigs `chr17`, and it is a published reference,
T2T-CHM13v2.0, which UCSC serves as `hs1`. Its coordinates are that assembly's:
the graph's largest CHM13 segment on chr17 ends at 84,141,510, past the end of
GRCh38's chr17 and inside hs1's.

Load it under its own name, with the graph's spelling as an alias. The view
resolves a donor through `assemblyManager`, which is keyed by name and aliases
alike, so `hs1` is what the launch opens and `CHM13` is what the graph says:

```json addassembly
{
  "name": "hs1",
  "displayName": "Human (T2T-CHM13v2.0/hs1)",
  "aliases": ["CHM13", "T2T-CHM13v2.0"],
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "hs1-ReferenceSequenceTrack",
    "adapter": {
      "type": "TwoBitAdapter",
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit"
    }
  }
}
```

Its genes are the same UCSC RefSeq set the hg38 lane above reads, on hs1:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hs1_ncbiRefSeq_ucsc",
  "name": "NCBI RefSeq genes (hs1)",
  "assemblyNames": ["hs1"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/ucsc/hs1/hs1.gff.gz",
    "csi": true
  }
}
```

The segments track can draw on hs1 as well, which is where the
`assemblyNameToPanSN` map earns its second entry: `hs1` asks for `CHM13#0#chr17`
the same way `hg38` asks for `GRCh38#0#chr17`. This replaces the track
[above](#load-the-graph), same `trackId`, one more assembly:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38", "hs1"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38", "hs1": "CHM13" }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

<Figure caption="One donor node, on both coordinate systems. Top: the GRCh38 window, its bubble lane cut to bubbles holding an allele over 100 kb, with the banded bubble a 1,023 bp reference span. Middle: the graph cut from that window, where the boxed node is 142.2 kb of CHM13 sequence attached at a 75 bp anchor. Bottom: that node on hs1's own chr17, an ordinary interval drawn by the same segments track. Both linear panes carry UCSC's RepeatMasker: the CHM13-only sequence is a near-continuous run of it, almost all LINE/L1." src="/img/pangenome/hprc_chm13_allele.png" />

CHM13 entered this graph at rank 61, after sixty haplotypes, so most of what it
carries was already in the graph and little is credited to it:
`tabix hprc-v2.0-mc-grch38.segs.bed.gz 'CHM13#0#chr1'` returns 60 segments for
the whole of chr1, and most attach only to other donors. Finding one that
touches GRCh38, like the node above, means scanning the links index for CHM13
rows with a GRCh38 endpoint:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.links.bed.gz \
  'CHM13#0#chr17' |
  awk -F'\t' '$6 ~ /^GRCh38/ || $10 ~ /^GRCh38/'
```

## The bubble track

A bubble is where haplotypes diverge and rejoin. The bubble track reports where
the graph varies and by how much, in one file rather than the whole graph:

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_bubbles",
  "name": "HPRC release 2 bubbles",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  }
}
```

The `MinigraphBubbleAdapter` labels each bubble with its shortest and longest
allele, and one bubble in the HLA class II window spans tens of kilobases
depending on the haplotype. The path count needs care, since it counts routes
combinatorially rather than haplotypes observed, and saturates at `2147483647`
(the track labels those bubbles uncountable). HPRC publishes no bubble file, so
this one is ours too, built with `gfatools bubble`.

### Inversions

Insertions are nodes and deletions are edges, and an inversion is neither: the
same reference sequence, walked backwards. The bubble file is where it is
findable. `gfatools bubble` sets a column when a bubble's paths disagree about
orientation, and the adapter exposes it as an `inversion` boolean, so **Edit
filters** on the bubble track cuts the lane to them:

```
jexl:feature.inversion
```

The AMY1 bubble row printed
[earlier](#what-the-graph-shows-that-a-linear-view-cannot) carries a `1` in that
column, and 246 of the graph's 130,510 bubbles do. Their breakpoints are in the
links index, stated as an orientation disagreement between two backbone
segments, which is what makes them readable without the graph:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.links.bed.gz \
  'GRCh38#0#chr1:144,400,000-144,600,000' |
  awk -F'\t' '!s[$4$5]++ && $9==0 && $13==0 &&
              substr($4,length($4)) != substr($5,length($5))' | cut -f4,5,7,8,11,12
# s12829+  s12842-  144418665 144419292  144495968 144539697
# s12830-  s12843+  144419292 144419591  144539697 144540296
# s12831-  s12861+  144419591 144442163  144567263 144572458
```

Three links, rank 0 at both ends, each pairing a `+` with a `-`: the segments
between them are walked backwards, which brackets `chr1:144,419,292-144,572,458`
as inverted on some haplotypes.

Read the flag as where to look rather than as a call. An inverted paralog and an
inverted haplotype look alike to the graph, and the callset does not settle it
either: `INV` is declared in the wave VCF's header and no record at these loci
carries it.

The alignments do settle it, and the test is the flanks rather than the block. A
haplotype whose whole window aligns reverse says nothing, since its contig may
simply be deposited that way. A block that reverses between forward flanks is an
inversion.
[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
runs that classification over HPRC's published all-vs-GRCh38 PAF at the bubble
above, prints the split it finds (64 haplotypes reverse it between forward
flanks, 23 keep it forward, and the rest are mixed or reverse throughout and are
evidence for neither), and slices out one of each. Which one of each matters,
because 1q21.1 is a segmental duplication and every haplotype here also aligns
inverted paralogs somewhere nearby: each of those crosses on screen exactly the
way the inversion does, so the script keeps only haplotypes whose alignments
inside the drawn window are the inversion and its two forward flanks.

Each haplotype row carries its own CAT gene annotation, which states the same
event a second way: the named genes inside the boxed span run PPIAL4F, RNVU1-28,
RNVU1-2A, RNVU1-26, NBPF15, RNVU1-15, PPIAL4E down the carrier, and PPIAL4E
through PPIAL4F, the reference's order, down the non-carrier.

<Figure caption="The 1q21.1 bubble the graph flags as an inversion, drawn as alignments. Between the two haplotype rows are the RefSeq genes, the bubble lane cut to inversion-flagged bubbles with the boxed one the subject, and the rGFA segments. The top row is HG01891 hap 1: its ribbon crosses inside the boxed span, runs parallel either side of it, and its own genes run backwards through it. The bottom row is HG02698 hap 2, one forward ribbon and reference gene order across the whole window, which is the comparison that separates an inversion from a contig deposited backwards." src="/img/pangenome/hprc_inversion.png" />

The [allele inventory](#the-allele-inventory) has nothing for them by
construction, since a mixed-orientation pair of backbone segments is a
breakpoint rather than a skipped span and `build_rgfa_alleles.sh` leaves those
pairs out of its deletions rather than report a length that is not one.

## The allele inventory

The bubbles say where the graph varies. A third hosted file says what the
variation is: one row per allele the graph holds, anchored on GRCh38, derived
from the two indexes above with no assemblies, no VCF and no bubble caller.

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "hprc_minigraph_alleles",
  "name": "HPRC release 2 graph: allele inventory",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.alleles.bed.gz"
  }
}
```

The `AlignmentsTrack` over a BED is deliberate. Each row carries a `CIGAR`
against the reference span it replaces (`2062M63348I`), and the alignments
display draws whatever has one, so the alleles pack into rows and each insertion
draws at its real magnitude instead of as a 1 bp box.

The magnitude is measured, the position inside the span is not. A bubble states
what sequence replaces a reference interval, never where inside that interval it
sits, so the CIGAR puts the indel at the end of the span by convention. Over a 2
kb anchor nothing turns on it, but the CFHR-scale spans in the same figure carry
a marker that is placed rather than located.

The lane is not pictured here, deliberately. Its rows are the display packing
overlapping alleles rather than a set of haplotypes, which is a reading it
cannot help. The one event worth looking at over this window, the 84,683 bp
deletion between CFHR3 and CFHR1, is drawn on the same coordinates by the graph
figure earlier in this page, where it is an arc with the two genes it removes
boxed beside it.

The
[graph genome view guide](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
walks through the columns and how the walk derives them.

The whole graph holds a few hundred thousand alleles, about half of them
insertions, so a wide window is dense. The alignments display filters by flag
and tag rather than by expression, so a size filter wants the same file loaded a
second time as a `FeatureTrack`, whose default display has **Edit filters**:
`jexl:abs(feature.delta)>10000`. Filter on `abs`: `delta` is negative for a
deletion, so an unsigned bound keeps only the insertions.

One column decides whether a length is _the_ length. `nested` is set when the
walk that derived the row passed a branch point, so that row's `delta` is one
route through a nested bubble rather than the only one. It is not a rare flag:
the build script's closing summary prints how many rows carry it, and on the
HPRC graph that is a large minority. Add `jexl:feature.nested==0` to the filter
above before reading lengths off this lane in bulk.

Read `discoveryRank` and `firstSeenIn` as the first haplotype to contribute an
allele rather than as who carries it. minigraph collapses, so an allele many
haplotypes share is credited to whichever was added first, and one sample can
end up named on half the rows in a dense window purely by build order. Nor does
a high rank mean the earlier haplotypes lack the sequence: they may have lacked
it, or had their copy merged into an existing path, or simply not aligned there.
It bounds discovery and nothing else. Carriage is the callset's job,
[below](#structure-not-sequence).

## The variant callset

The `wave.vcf.gz` needs nothing: its index ships beside it, so JBrowse reads
only the slice you are viewing out of the 2.3 GB file. Paste the S3 URL into a
`VariantTrack` and pick the matrix display:

```json
{
  "type": "VariantTrack",
  "trackId": "hprc2_wave_grch38",
  "name": "HPRC2 pangenome",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "renderingMode": "phased"
    }
  ]
}
```

`renderingMode: "phased"` is the setting to note. The VCF carries 232 phased
sample columns, and phased mode splits each into its two haplotypes, giving 464
independent rows instead of 232 diploid ones. Co-inherited blocks are visible
only in that form. Three counts circulate around this data and they are one
thing: 231 diploid HPRC samples plus a haploid CHM13 give the 232 columns and
463 assembled haplotypes, which is where `AN` tops out, and the display draws
464 rows because CHM13's second row exists and is entirely no-call.
`hprc465vsgrch38`, the PAF the CFHR figure slices, is HPRC's own file, named for
the assemblies it aligns rather than for these columns.

The VCF is fully decomposed, so `chr6:32,450,000-32,650,000` (the window in the
figure below) holds over fourteen thousand records, most of them SNPs and the
rest small indels. The structural tier is what a pangenome adds over a
short-read callset, and it is already in this file. Add the filter

```
jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50
```

from **Edit filters** and the same window drops to a couple of hundred sites.

Both halves are load-bearing. `alleleLength` is the longest allele the record
describes, and a filter on `end - start` would keep only deletions, since an
insertion consumes no reference. `LV` is the record's level in vg's snarl tree,
and `LV==0` keeps the top-level sites. Without it the panel paints some events
twice at two positions, because this file writes a nested child as its own
record beside its parent, with `PS` naming that parent, and a reader counting
columns counts those events twice. The pair is the standard idiom for a
pangenome VCF and belongs in the filter the same way `renderingMode: "phased"`
belongs in the config.

One thing the filter cannot promise is what a given cell holds. It admits a
record on its longest allele, and most records it admits here are multi-allelic,
so a site can enter the panel on one haplotype's 60 bp insertion while another
haplotype's cell in the same column is colored for a SNP at the same position.
Read a column as a site that holds a structural allele, which is what the block
structure below is about, rather than as a guarantee about every cell in it. The
file states the rest per allele: `TYPE` gives each ALT's class (`snp`, `ins`,
`del`, `complex`) and `LEN` its length, both in the feature details panel a
click on the column opens, so which of a site's alleles a haplotype carries is
one click away rather than an inference.

Frequency is in the file rather than in the picture. `AC`, `AF`, `AN` and `NS`
are on every record, so `jexl:feature.INFO.AF[0]>0.05` selects the common
alleles without clustering anything. `AC`/`AF` are per-ALT arrays, so on a
multi-allelic site index the allele you mean. Two fields guard the reading. A
no-call is not a reference call, and `missingness(feature)` is available as a
filter for exactly that, which matters where assembly coverage is thin (KIR,
LPA) more than it does here. `CONFLICT` names samples the graph gives two
disagreeing paths, and it fires on no record in this window.

Because an insertion consumes no reference, it would not otherwise draw at its
true width. The display widens each insertion cell to a marker sized by the
inserted bp, in that haplotype's own genotype color
([`showInsertionGlyphs`](/docs/config/linearmultisamplevariantdisplay/#slot-showinsertionglyphs)).
Only haplotypes carrying the allele widen, so the marker never implies a sample
has sequence it does not.

That leaves few enough alleles to draw each at its own genomic position, lined
up with the genes above. **Clustering → Cluster rows by genotype... → Run
clustering** in the track menu reorders the 464 rows by genotype similarity and
draws a dendrogram beside them:

<Figure caption="Top-level sites holding a structural allele (50 bp and up) across the HPRC2 haplotypes, one row each, clustered by genotype and drawn under the HLA class II genes they fall in. Haplotypes that share whole sets of alleles cluster into solid blocks spanning several genes, with no HLA typing involved." src="/img/hprc2/mhc_clustered.png" />

## Structure, not sequence

The graph and the callset are the same object at two resolutions. minigraph
records structural variation (roughly >50 bp) and collapses everything smaller,
so SNPs are absent from the graph even though every one is in the VCF. Filter
the callset to that same tier and the two describe the same events from opposite
ends. The graph states an allele and its length but cannot say whose it is,
since collapsing is what let it be found at all, while the callset never lost
the samples.

They still do not line up row for row, for two reasons, in this order.

The first is decomposition, and the file states it outright. `ORIGIN` on a
record names the position of the complex record vcfwave split it out of, so one
graph bubble arrives as many VCF records, and `LV`/`PS` are the file's own map
of that fan-out. Counting records against bubbles compares a decomposed callset
with an undecomposed graph, which is what the `LV==0` filter above undoes.

The second is attribution against carriage. rGFA's `SN` tag names the assembly a
segment was **first contributed by**, so a graph row is attribution, and a
genotype names every haplotype that **carries** an allele, so a matrix row is
carriage. A donor can appear on one haplotype in the graph and carry the same
event on the other in the callset.

The word "bubble" also covers two different decompositions here. The bubble lane
is `gfatools bubble`'s top-level superbubbles over the rGFA; `LV`/`PS` are vg's
snarl tree over the graph the callset was deconstructed from. They agree about
where the graph varies without being in one-to-one correspondence, so match a
bubble to a record by interval rather than by count.

What does line up is the event: mark an interval in the linear view and it
crosses the genes, the segments lane and the genotype matrix in one column, and
the reference-position ramp gives the graph's backbone at that position the same
hue as the segments above it.

<Figure caption="One window, both products. The band marks one deletion site from the callset: the matrix below it, all 464 haplotypes clustered by genotype, colors the clade carrying a deletion there, and the segments lane above it is the graph's own sequence at that position, in the ramp the graph draws with. The graph is the force-directed layout of the same window, which has no coordinate axis to draw the band on, so the arrow runs from the band to a ring on the reference node the deletion removes." src="/img/pangenome/hprc_graph_vs_callset.png" />

## Reproduce it end to end

Two scripts and one gfatools call rebuild the hosted files, or build the same
set for a different graph. Their provenance (source, size, exact commands, build
date) is in [README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_tabix.sh
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_alleles.sh
bash build_rgfa_tabix.sh hprc-v2.0-mc-grch38.sv.gfa.gz out
bash build_rgfa_alleles.sh out
```

[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
writes the two tabix indexes `RgfaTabixAdapter` reads, straight from the gzipped
rGFA (nothing to unpack), using gfatools for the segment projection. It needs an
**rGFA**: `sv.gfa.gz` is one, the `.gfa.gz` beside it is not (see
[Regular GFA vs rGFA](#regular-gfa-vs-rgfa)).

The [bubble track](#the-bubble-track) is neither script but one gfatools call
over the same graph:

```bash
gzip -dc hprc-v2.0-mc-grch38.sv.gfa.gz | gfatools bubble - \
  | sort -k1,1 -k2,2n | bgzip > out.bubbles.bed.gz
tabix -p bed out.bubbles.bed.gz
```

[`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh)
reads only those two indexes, never the graph, and writes the allele inventory
in seconds off the small index pair rather than the 842 MB download they came
from. It therefore works with no assemblies loaded, which is the normal
situation with someone else's graph.

Carriage is reachable here, not merely deferred. HPRC publishes every release 2
assembly, so
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs `minigraph --call` over them and writes one row per haplotype per bubble,
which the guide's
[per-strain paths](/docs/user_guides/graph_genome_view#which-strain-takes-which-path)
draw as a lane each. What that costs is a 464-assembly download and a mapping
run, which is why this page takes the index route: a scope decision, not a
property of the data. Both scripts need htslib (`bgzip`, `tabix`) on your
`PATH`.

The two haplotype rows in the CFHR figure are a third script:
[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
picks a carrier and a non-carrier of the deletion out of the callset, slices
their alignments out of release 2's own all-vs-GRCh38 PAF, and slices each
haplotype's CAT annotation to the same window, giving one synteny row and one
gene lane per haplotype.

## See also

- [Pangenome graphs (Minigraph-Cactus)](/docs/tutorials/pangenome_cactus), which
  builds a graph of this kind from five _E. coli_ strains, small enough to run
  end to end yourself
- [Pangenome graphs (pggb)](/docs/tutorials/pangenome_ecoli) for what each
  linear projection of a graph means
- [Multi-sample variant track](/docs/user_guides/multivariant_track) for the
  callset display used here
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)
