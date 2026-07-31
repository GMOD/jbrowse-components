---
title: Pangenome (HPRC)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, then
  its 464-haplotype variant callset
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) is roughly a
fivefold expansion over release 1. This tutorial opens two of its products: the
pangenome graph drawn as a graph, and the variant callset (464 haplotypes as a
genotype matrix).

Every track below is a URL you can paste. The callset ships tabix-indexed, so
JBrowse reads the slice in view straight off HPRC's S3. The graph route reads
projections we prebuilt and host, with the build script in
[Reproduce it end to end](#reproduce-it-end-to-end).

## Prerequisites

- every track on this page, assembled, at
  [`https://jbrowse.org/demos/hprc/config.json`](https://jbrowse.org/demos/hprc/config.json)
- or an instance of your own, with the four track configs below pasted in
- the GraphGenomeView plugin, for two of those four: they use the
  `RgfaTabixAdapter` and `MinigraphBubbleAdapter`, which ship in it rather than
  in JBrowse Web

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

The plugin is in beta and not in the
[plugin store](/docs/user_guides/plugin_store) yet, so it loads by URL like
this; the [graph genome view guide](/docs/user_guides/graph_genome_view) covers
the view's layouts, colors and menus on a smaller graph than this one. The
allele inventory and the variant callset need no plugin.

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
    "color": "jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'"
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

<Figure caption="The C4 locus as a graph, in force-directed layout, under three lanes of the same window. The bubbles track reports a single bubble spanning the locus and the graph below is what that bubble contains. Both panels use the graph's Reference position colors, so the segment blocks and the thread in the graph run red to magenta together and a loop's color says where above it attaches." src="/img/pangenome/hprc_c4_subgraph.png" />

A force layout has no x axis to share with the linear view, so color is the only
thing that can carry the correspondence. **Reference position** in the **Color**
dropdown is built for that: it ramps hue over the window the subgraph was cut
from, red at its start to magenta at its end, and a segment with no reference
coordinate of its own takes the hue of the backbone it branches from.

The ramp is two numbers and a midpoint, so a linear track can paint the same
colors. Set this on the segments track for the same window and a block above and
its node below are the same color:

```json
{
  "displayDefaults": {
    "color": "jexl:'hsl(' + min(300, max(0, ((get(feature,'start')+get(feature,'end'))/2 - 32500000) / 60000 * 300)) + ',70%,50%)'"
  }
}
```

The two constants are the window's start and its length, so this belongs on the
view rather than in a hosted config.

The asymmetry between the panels is structural. A rank-0 segment sits on GRCh38
and has a coordinate, while a rank>0 segment sits on some other assembly's
refName and has none, so no coloring will put those loops on a GRCh38 axis as
segments. The ramp shows where each one attaches; the bubble lane and the
[allele inventory](#the-allele-inventory) give their lengths.

Two things control whether that picture is readable, and neither is obvious.

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
out of the region, and it defaults to **None**. That matters here more than on a
small graph. An allele's interior segments are indexed under their own
haplotype's sequence, not GRCh38, so a query on the reference never reaches
them: a detour that leaves the backbone before the window and rejoins after it
arrives as two short stubs, which read as small insertions rather than as the
one large event they are. **1 hop** closes those, at the cost of one tabix query
per off-reference segment already reached.

Reach for it when the graph looks emptier than the bubble lane above it says it
should be; the
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
Those edges are drawn thick and near-black rather than on the color ramp, where
hue means reference position and an arc covers a range of it rather than sitting
at one point.

Read a deletion on the [anchored layout](#the-layout-dropdown), which is what
the figure below uses: x there is GRCh38 bp, so the arc spans exactly the
sequence it removes, over the reference that carries it and under the same
coordinates in the linear panel. The force layout bows the same edge out by the
length of the backbone it bypasses, which states a size but not a position,
because FMMM leaves the arc's two ends wherever the simulation puts them.

<Figure caption="The complement factor H cluster on chr1: two HPRC haplotypes aligned to GRCh38, above the same window as an anchored graph. Each row carries that assembly's own CAT gene annotation, so the boxed CFHR3 and CFHR1 are on the reference and on HG00099 and absent from HG01109, whose alignment stops and resumes across the same span. In the graph the reference is the top row, colored by position, and the thick dark arc under it spans the 84.7 kb those two genes sit in. The shorter thick arcs are the other two deletions in the window, and the thin stalks are alternate alleles, one row per stable rank." src="/img/pangenome/hprc_cfhr_deletion.png" />

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

<Figure caption="The amylase locus on chr1 as a force-directed graph, under the RefSeq genes and the rGFA segments for the same window. The graph is cut from two tabix indexes, so 248 Mb of chromosome costs nothing: this window is 63 nodes. The two dark arcs are deletions, labelled with the reference they skip; the short arms off the thread are alleles whose interiors sit outside the cut. Colors are reference position in both panels, red at the window's left edge to magenta at its right." src="/img/pangenome/hprc_amylase_graph.png" />

The graph's own bubble index says what that window holds, and tabix reads it
over HTTP without the browser. The bubble spanning AMY1A and AMY1B is the first
row:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz \
  'GRCh38#0#chr1:103,690,000-103,780,000' | cut -f1-8 | head -1
# GRCh38#0#chr1  103611080  103732636  95  269401  1  26889  316616
```

After the span: segments, paths, the inversion flag, then the shortest and
longest allele the bubble holds. Bubbles are indexed under the graph's PanSN
names and the alleles under plain GRCh38 contigs, which is why only the bubble
track config carries `assemblyNameToPanSN`.

Copy number is not among those numbers: minigraph records the distinct sequence
a bubble can hold, not how many times a haplotype repeats it. Length is the
proxy, and the shape of the alternatives is what the graph adds.

### The Layout dropdown

**Force-directed** draws the graph's own shape, with no axis. **Anchored**, the
mode the deletion figure above uses, puts x back on GRCh38 and stacks the
alternate alleles below the backbone by rank. The same MHC class II window drawn
both ways:

<Figure caption="One MHC class II subgraph drawn both ways, same window and same tracks above it. Left, force-directed: the drawing is the graph's shape and nothing about it lines up with the linear view. Right, anchored: every x is a GRCh38 coordinate, so the backbone is one straight line and each alternate allele hangs below the position it attaches to, stacked by rank. Reference-position colors are on in both, so the segment above and the node below share a color either way, and in the anchored half an x as well." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

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
SMN1, returns nothing at all: near-identical duplications collapse, and
minigraph merged SMN1 and SMN2 onto one path. A quiet window means collapsed or
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

<Figure caption="The KIV-2 repeat inside LPA as a force-directed graph, under the RefSeq genes, the bubbles lane and the rGFA segments for the same window. The bubble the lane reports across the repeat is the chain of loops below it, and each node carries the sequence it holds; the dark arc is the route that skips the reference between two of them." src="/img/pangenome/hprc_lpa_kiv2.png" />

Either way the attribution is the same one `discoveryRank` and `firstSeenIn`
carry: the haplotype minigraph took the sequence from, not the set of haplotypes
carrying it. Collapsing is what let the allele be found at all, so carriage
remains the callset's job, [below](#structure-not-sequence).

### Hovering one panel highlights the other

Hover a node in the graph and the reference interval it occupies is highlighted
in every linear view beside it; hover the linear view and the segment under the
cursor brightens in the graph. This needs no configuration. For a rank>0 allele
the interval shown is not the allele's own sequence, but the span between the
two backbone segments it detaches from and rejoins. Both directions are pictured
in the
[E. coli tutorial](/docs/user_guides/graph_genome_view#hovering-one-panel-highlights-the-other).

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
panel a left-click opens.

<Figure caption="Right-clicking one haplotype's allele (circled), over the band Highlight in hg38 left in the linear view above. The menu works in the GRCh38 interval the allele attaches to, not the haplotype's own coordinates: that assembly is not loaded, and no session loads all 464. The band stays until it is removed, so the answer survives letting go of the mouse." src="/img/pangenome/hprc_node_menu.png" />

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
[E. coli tutorial](/docs/user_guides/graph_genome_view#from-a-node-back-to-a-genome).

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

<Figure caption="The allele inventory over the complement factor H cluster, under the RefSeq genes and the rGFA segments. Grey bars are the reference span each allele replaces, labelled with it, and purple marks are insertions drawn at the size they insert, which is what the CIGAR in the BED buys. The long bar from CFHR3 to CFHR1 is the deletion the graph figure above draws as an arc. Rows are the display packing overlapping alleles, not haplotypes." src="/img/pangenome/hprc_allele_inventory.png" />

The
[E. coli tutorial](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
walks through the columns and how the walk derives them.

The whole graph holds a few hundred thousand alleles, about half of them
insertions. At that scale, start from a size filter in **Edit filters**, e.g.
`jexl:get(feature,'delta')>10000`.

Read `discoveryRank` and `firstSeenIn` as the first haplotype to contribute an
allele rather than as who carries it. minigraph collapses, so an allele many
haplotypes share is credited to whichever was added first, and one sample can
end up named on half the rows in a dense window purely by build order. Carriage
is the callset's job, [below](#structure-not-sequence).

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
samples, and phased mode splits each into its two haplotypes, giving 464
independent rows instead of 232 diploid ones. Co-inherited blocks are visible
only in that form.

The VCF is fully decomposed, so `chr6:32,450,000-32,650,000` (the window in the
figure below) holds over fourteen thousand records, most of them SNPs and the
rest small indels. The structural tier is what a pangenome adds over a
short-read callset, and it is already in this file. Add the filter

```
jexl:alleleLength(feature) >= 50
```

from **Edit filters** and the same window drops to a couple of hundred alleles,
each a real insertion or deletion. (`alleleLength` is the longest allele the
record describes; a filter on `end - start` would keep only deletions, since an
insertion consumes no reference.)

Because an insertion consumes no reference, it would not otherwise draw at its
true width. The display widens each insertion cell to a marker sized by the
inserted bp, in that haplotype's own genotype color
([`showInsertionGlyphs`](/docs/config/linearmultisamplevariantdisplay/#slot-showinsertionglyphs)).
Only haplotypes carrying the allele widen, so the marker never implies a sample
has sequence it does not.

That leaves few enough alleles to draw each at its own genomic position, lined
up with the genes above. **Clustering → Cluster rows by genotype... → Run
clustering** in the track menu reorders the 464 rows by genotype similarity and
draws a dendrogram beside them, in the worker, so the view stays responsive:

<Figure caption="Structural alleles (50 bp and up) across the HPRC2 haplotypes, one row each, clustered by genotype and drawn under the HLA class II genes they fall in. Haplotypes that share whole sets of insertions and deletions cluster into solid blocks spanning several genes, with no HLA typing involved." src="/img/hprc2/mhc_clustered.png" />

## Structure, not sequence

The graph and the callset are the same object at two resolutions. minigraph
records structural variation (roughly >50 bp) and collapses everything smaller,
so SNPs are absent from the graph even though every one is in the VCF. Filter
the callset to that same tier and the two describe the same events from opposite
ends. The graph states an allele and its length but cannot say whose it is,
since collapsing is what let it be found at all, while the callset never lost
the samples.

The two do not line up row by row, and it is worth being clear why. rGFA's `SN`
tag names the assembly a segment was **first contributed by**, so a graph row is
attribution; a genotype names every haplotype that **carries** an allele, so a
matrix row is carriage. A donor can appear on one haplotype in the graph and
carry the same event on the other in the callset. What does line up is the
event: mark an interval in the linear view and it crosses the genes, the
segments lane and the genotype matrix in one column, and the reference-position
ramp gives the graph's alleles at that position the same hue as the segments
above them.

<Figure caption="One window, both products. The band marks a single deletion from the callset: the matrix below it shows which of the ten donors' haplotypes carry it, and the segments lane above it is the graph's own sequence at that position, in the ramp the graph draws with. The graph is the force-directed layout of the same window, where the marked event is a bubble rather than a row, in the same hue as the band." src="/img/pangenome/hprc_graph_vs_callset.png" />

## Reproduce it end to end

Two scripts and one gfatools call rebuild the hosted files, for a different
graph. Their provenance (source, size, exact commands, build date) is in
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them.

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
situation with someone else's graph. The E. coli tutorial's
[per-strain paths](/docs/user_guides/graph_genome_view#which-strain-takes-which-path)
answer the carriage question instead, at the cost of re-mapping every haplotype.
Both need htslib (`bgzip`, `tabix`) on your `PATH`.

## See also

- [Pangenome graphs (Minigraph-Cactus)](/docs/tutorials/pangenome_cactus), which
  builds a graph of this kind from five _E. coli_ strains, small enough to run
  end to end yourself
- [Pangenome graphs (pggb)](/docs/tutorials/pangenome_ecoli) for what each
  linear projection of a graph means
- [Multi-sample variant track](/docs/user_guides/multivariant_track) for the
  callset display used here
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)
