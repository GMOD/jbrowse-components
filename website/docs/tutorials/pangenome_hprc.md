---
title: Pangenome (HPRC)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, its
  464-haplotype variant callset, and the multiple alignment both come from
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: hosted
---

**TL;DR:** HPRC release 2's `sv.gfa` is an rGFA, so its segments carry
coordinates and the graph opens by locus from two small tabix indexes. Its
`wave.vcf.gz` ships an index too, so 464 haplotypes draw as a genotype matrix
straight off S3.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](#the-graphgenomeview-plugin), for the tracks that
  use `RgfaTabixAdapter` and `MinigraphBubbleAdapter`; every other track here is
  a URL you can paste
- to rebuild the hosted files rather than read them: htslib (`bgzip`, `tabix`)
  and [`gfatools`](https://github.com/lh3/gfatools) for the graph indexes and
  the bubble file, plus `bedtools` and UCSC's `bedGraphToBigWig` and
  `bigBedToBed` for the repeat-density lanes

Both UCSC binaries are
[single-binary downloads](https://hgdownload.soe.ucsc.edu/admin/exe/), and
`build_repeat_density.sh`'s header carries the curl line for each.

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose
Minigraph-Cactus graph, wave callset and the alignment underneath both are read
straight off S3 or through small tabix projections we host beside them.

- the SV-resolution graph (`sv.gfa`), the minigraph backbone our rGFA tabix
  projections are built from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.sv.gfa.gz
- the decomposed variant callset, 464 haplotypes, read straight off S3:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz
- the undecomposed, snarl-level carriage file, 462 haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/submissions/671F0A25-700C-4DDF-96B0-9668F6C0F25E--hprc_v2.0_mc_grch38_index/hprc-v2.0-mc-grch38.pgbi.vcf.gz
- the multiple alignment the graph and the callset are both derived from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz
- the release's all-vs-GRCh38 alignment, sliced for the CFHR and inversion
  synteny figures:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- the T2T-CHM13v2.0 reference (hs1), loaded as its own donor assembly:
  https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit
- GRCh38's RepeatMasker annotation, binned for the repeat-density lanes:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/rmsk.txt.gz
- hs1's RepeatMasker annotation, the same lanes' other assembly:
  https://hgdownload.soe.ucsc.edu/gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb
- our own rGFA, bubble and repeat-density projections, with the exact build
  recorded beside them: https://jbrowse.org/demos/hprc/README.txt
- hs1's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hs1/hs1.gff.gz

## The route, end to end

Everything this page does to the graph, in one session:

- open hg38 with its genes and nothing else
- paste the track config from [Load the graph](#load-the-graph) into the app
- [cut a window as a graph](#open-a-locus-as-a-graph)
- take one node [back to its coordinates](#from-a-node-back-to-a-coordinate)

The link under the clip opens the session it starts in, so pasting a config for
your own graph walks the same route on it.

<Video src="/media/pangenome/hprc_end_to_end.mp4" caption="HPRC release 2's graph added to an hg38 session and then read: the track config pasted into Open track..., the MHC class II window cut as a subgraph, that subgraph moved onto the reference axis, and one allele's GRCh38 interval marked in the linear view above it." />

## HPRC release 2

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) is roughly a
fivefold expansion over release 1. This tutorial opens three of its products:

- the pangenome graph, drawn as a graph
- the variant callset, 464 haplotypes as a genotype matrix
- the multiple alignment both are derived from

Every track below is a URL you can paste. The callset ships tabix-indexed, so
JBrowse reads the slice in view straight off HPRC's S3. The graph route reads
projections we prebuilt and host, with the build script in
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
projections of the graph (below). Release 3 is the verkko assembly and QC
release, and publishes no graphs.

Two subdirectories sit beside those files, `v2.0/` and `v2.1/`, holding the
fuller per-build set. The alignment the graph and the callset are derived from
is only there: `v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz`, 5.9
GB with a `.tai` index, which [the last section](#the-alignment-underneath-both)
opens.

Every file above is published twice, once per reference, and this page uses the
GRCh38 build. Both build scripts run on the CHM13 files unchanged, with one
config change, the PanSN prefix: `{ "chm13": "CHM13" }` in place of
`{ "hg38": "GRCh38" }`.

## Regular GFA vs rGFA

Whether a graph opens by locus straight from the file depends on whether its
segments carry coordinates, which is
[what the two formats differ on](/docs/user_guides/graph_genome_view#where-a-segments-coordinates-come-from).
An **rGFA** (what minigraph emits) tags every segment with three fields, the
whole of the [spec](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md):

```
S  s3  TTGCAA  LN:i:6  SN:Z:GRCh38#0#chr1  SO:i:10621  SR:i:0
```

- `SN` is the stable sequence the segment sits on
- `SO` is its offset there
- `SR` is its rank, `0` on the reference backbone

So the file itself states where each segment sits and which segments are the
reference, and JBrowse opens any locus with no extraction step. A **regular
GFA** states the same thing only inside its P/W path lines, so it takes a walk
first, or a window cut offline with `odgi extract` as in the
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#a-window-as-a-file).

Release 2 labels no file "rGFA", but `sv.gfa` is the minigraph stage of the
Minigraph-Cactus build, so its segments already carry these tags. The base-level
`gfa.gz` beside it does not, and neither do pggb graphs, which keep the
`odgi extract` route.

A PanSN name has two halves, and only the first needs configuring:

- The **sample** half needs `assemblyNameToPanSN: { "hg38": "GRCh38" }`, tying
  an `hg38` assembly to the graph's `GRCh38` prefix. The prefix disambiguates:
  the same graph also carries `CHM13#0#chr1`.
- The **contig** half is ordinary refName aliasing, which your assembly already
  does, so an hg38 spelling chr6 as `6` needs no further configuration.
- The variant callset later in this tutorial needs no mapping at all: its
  contigs are plain GRCh38 (`chr6`, not `GRCh38#0#chr6`).

## Load the graph

JBrowse reads two tabix-indexed BED projections of the graph. We host them, so a
`FeatureTrack` pointed at the shared prefix downloads nothing but the region in
view; the adapter resolves `<uri>.segs.bed.gz`, `<uri>.links.bed.gz`, and both
`.tbi` files:

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
colors, so a segment is the same color in both panels.

Each segment draws where its tags say it sits, so the GRCh38 backbone tiles the
reference and the graph is queryable by locus. Those hosted files are ours: we
ran the `sv.gfa.gz` through
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
and put the output on `jbrowse.org`.

## Open a locus as a graph

The graph draws a window at a time, and there are three ways to pick one:

- **Drag across the ruler** and choose **Graph genome view (this selection)**.
  Selecting more than the view will draw greys the item out and displays its
  limit.
- **Launch view → Graph genome view (this region)** in the track menu takes
  whatever is on screen.
- **Right-click one segment** to cut the graph around that segment.

Any of them works without a graph track in the view: the item appears whenever
the session holds a track whose adapter can cut a subgraph, and the subgraph
comes from the same two files the track reads.

The third lane in the figure below is the [bubble track](#the-bubble-track),
which the figures from here on read alongside the graph.

<Figure caption="The C4 locus as a force-directed graph, under three lanes of the same window. The bubbles track reports a single bubble spanning the locus, and the graph below is what it contains." src="/img/pangenome/hprc_c4_subgraph.png" />

A force layout has no x axis to share with the linear view, so color carries the
correspondence. **Reference position**, which the graph opens on, ramps hue over
the window the subgraph was cut from and paints any segment without a reference
coordinate flat charcoal. The
[guide](/docs/user_guides/graph_genome_view#colors-that-mean-the-same-thing-in-both-panels)
covers the other schemes.

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
C4 window the figure above was cut from, which makes it a per-view setting.

A rank-0 segment sits on GRCh38 and has a coordinate; a rank>0 segment sits on
another assembly's refName, so the ramp has no GRCh38 position to take and those
segments draw the flat grey the expression gives them. Where each attaches comes
from the [anchored layout](#the-layout-dropdown) or a hover; the bubble lane and
the [allele inventory](#the-allele-inventory) give their lengths.

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

Hovering one of these edges gives the interval and the bp it removes.

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
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz \
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
reading it is a vg job. Release 2 strips the `AT` (allele traversal) field from
the wave VCF, recorded in its own header as `bcftools annotate -x INFO/AT`.

### The Layout dropdown

The [guide](/docs/user_guides/graph_genome_view#three-layouts) sets out what the
three modes put on each axis. Here is the same MHC class II window drawn in two
of them:

<Figure caption="One MHC class II subgraph drawn both ways, same window and same tracks above it. Left, force-directed. Right, anchored: every x is a GRCh38 coordinate, so each allele hangs below where it attaches." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Both halves ring the same node, the 12 kb reference stretch the graph draws in
green. On the left a right-click menu is open on the black allele beside it, and
**Highlight in hg38** wrote the orange band above over that ringed backbone
segment: an off-reference allele is highlighted across the reference it
replaces.

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
[allele inventory](#the-allele-inventory), here cut down to span, kind, size and
the haplotype the allele was first seen in:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.alleles.bed.gz \
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

The graph's own **Launch view** menu does the same for the whole window it was
cut from.

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
At HPRC scale the answer is a published file:
[carriage at the graph's own granularity](#carriage-at-the-graphs-own-granularity)
is one record per snarl with a genotype per haplotype, so the site under the
node you clicked states who walks it.

That route is drawn in the [layout figure above](#the-layout-dropdown): its left
half has the menu open on a 1.8 kb HG01433.2 allele, the black node ringed
without a number, over the band **Highlight in hg38** left in the linear view.
The band is the 12 kb backbone segment that allele attaches across, which here
is _HLA-DRB5_.

The lanes above combine into one route:

- rubberband a locus into a graph
- right-click an allele to put the linear view on its GRCh38 interval
- read that interval off the tracks anchored there: the
  [bubble track](#the-bubble-track) gives the bubble it belongs to, the
  [allele inventory](#the-allele-inventory) its length and the haplotype it was
  first seen in, and the [variant callset](#the-variant-callset) whether
  anything is genotyped there

The graph states what sequence exists and where it attaches; those three state
how common it is.

Where the contributing assemblies are themselves loaded, a handful of genomes,
the same menu opens any of them, or all at once as a synteny view. See the
[graph genome view guide](/docs/user_guides/graph_genome_view#from-a-node-back-to-a-genome).

## Loading CHM13 as an assembly {#the-one-donor-worth-loading}

Two contributors spell their contigs `chr17`-style and can be loaded as
assemblies: CHM13 and HG002, whose two haplotypes count separately. The other
460 haplotypes name their contigs by GenBank accession (`CM102524.1`). CHM13 is
the one with a published reference behind it, T2T-CHM13v2.0, which UCSC serves
as `hs1`; [](/docs/tutorials/hg002_haplotypes) loads the other. Its coordinates
are that assembly's: CHM13 segments on chr17 run past the end of GRCh38's chr17
and inside hs1's.

Load it under its own name, with the graph's spelling as an alias. The view
resolves a donor through `assemblyManager`, which is keyed by name and aliases
alike, so `hs1` is what the launch opens and `CHM13` is what the graph says:

```json addassembly
{
  "name": "hs1",
  "displayName": "Human (T2T-CHM13v2.0/hs1)",
  "aliases": ["CHM13", "T2T-CHM13v2.0"],
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit"
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

With both assemblies loaded a CHM13 node opens on either one, and on hs1 its
coordinates are the donor's own rather than the GRCh38 interval it attaches
across. The node in the figure below is 142 kb of chr17 that GRCh38 does not
carry, near the end of the chromosome, and RepeatMasker tiles it with long L1
elements.

The hs1 pane holding that node is barely wider than the node itself, so the
allele has only its own surroundings to be dense against. The panel beside it is
the same measurement at a scale that can say whether the L1 density means
anything. Open the LINE row alone over the last 3 Mb of the chromosome and set
the track's **Resolution** low, so each drawn value averages about 100 kb. At
the file's own 5 kb bins the allele is invisible inside the spikes; averaged to
something near its own size it is a block.

<Figure caption="A donor node on both coordinate systems: the GRCh38 window, the graph cut from it, then that node on hs1's own chr17 tiled by long L1 elements in red. Beside them ①, LINE density across the last 3 Mb of the chromosome at a ~100 kb mean." src="/img/pangenome/hprc_chm13_allele.png" />

CHM13 entered this graph late, after most of the other haplotypes, so little is
credited to it: `tabix hprc-v2.0-mc-grch38.segs.bed.gz 'CHM13#0#chr1'` returns a
short list for the whole of chr1, most of it attaching only to other donors.
Finding one that touches GRCh38, like the node above, means scanning the links
index for CHM13 rows with a GRCh38 endpoint:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.links.bed.gz \
  'CHM13#0#chr17' |
  awk -F'\t' '$6 ~ /^GRCh38/ || $10 ~ /^GRCh38/'
```

### What kind of sequence GRCh38 was missing

The lane above says the inserted sequence is tiled by L1. Whether that is
unusual, a subtelomere being repeat-dense either way, takes the same measurement
on both assemblies at the same scale: the fraction of each 5 kb bin covered by
one RepeatMasker class, one lane per class, on GRCh38 and CHM13 alike.
`bedtools` measures it, one lane at a time, from a RepeatMasker BED of
`chrom start end class`:

<!-- from: scripts/build_repeat_density.sh -->

```bash
# CHM13's rmsk ships as a bigBed where UCSC's hg38 is a table
bigBedToBed chm13v2.0_rmsk.bb rmsk.raw.bed

# only the chroms the rmsk BED covers, so no lane carries empty scaffold bins
bedtools makewindows -g hs1.main.sizes -w 5000 | sort -k1,1 -k2,2n > windows.bed

# merge first: one fragmented L1 is several overlapping records, and unmerged
# coverage counts the shared bases twice and reports over 100%
awk -F'\t' '$4=="LINE"' rmsk.bed | bedtools merge -i - > line.bed

# -a windows -b class puts the covered fraction of each window in the last column
bedtools coverage -a windows.bed -b line.bed -sorted -g hs1.main.sizes |
  awk -F'\t' '{printf "%s\t%s\t%s\t%.5f\n", $1, $2, $3, $NF}' > line.bg
bedGraphToBigWig line.bg hs1.main.sizes hs1_repeat_density_LINE.bw
```

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "hs1_repeat_density",
  "name": "Repeat density by class (RepeatMasker, 5 kb bins)",
  "assemblyNames": ["hs1"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "LINE",
        "color": "rgb(200,60,45)",
        "uri": "https://jbrowse.org/demos/hprc/repeat_density/hs1_repeat_density_LINE.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "SINE",
        "color": "rgb(60,110,180)",
        "uri": "https://jbrowse.org/demos/hprc/repeat_density/hs1_repeat_density_SINE.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "LTR",
        "color": "rgb(70,150,90)",
        "uri": "https://jbrowse.org/demos/hprc/repeat_density/hs1_repeat_density_LTR.bw"
      }
    ]
  },
  "displayDefaults": {
    "defaultRendering": "multirowxy",
    "minScore": 0,
    "maxScore": 1
  }
}
```

Swap `hs1` for `hg38` in the `trackId`/`assemblyNames` and the URLs for the
GRCh38 copy. `DNA`, `Satellite` and `Simple_repeat` are hosted under the same
names if you want them, near zero here but the whole story on a centromere. The
pinned `minScore`/`maxScore` are load-bearing for the same reason they are in
the
[cookbook recipe](/docs/cookbook#multiple-signals-on-one-track-each-its-own-color)
this follows: autoscale runs per row, so each class would rescale to its own
maximum and the comparison the track exists for would disappear.

Open the track on each assembly's last 650 kb of chr17, what each one ends the
chromosome with, since sequence one of them lacks has no lifted-over interval.
`build_repeat_density.sh` reports the two windows at almost the same total
repeat content, so a single density lane would show no difference. What moved is
the composition, in opposite directions: more L1, less Alu.

Whether that is a lot depends on the scale it is asked at, which is what the
last part of [the donor-node figure](#the-one-donor-worth-loading) draws. The
same script ranks the allele against every window of its own size in CHM13, and
it comes out near the top of its own neighbourhood and unremarkable against the
genome. The enrichment is local: this sequence is L1-dense for this end of
chr17.

## The bubble track

A bubble is where haplotypes diverge and rejoin. The bubble track reports where
the graph varies and by how much, in one file:

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
depending on the haplotype. The path count needs care: it counts routes
combinatorially rather than haplotypes observed, and saturates at `2147483647`
(the track labels those bubbles uncountable). HPRC publishes no bubble file, so
this one is ours too, built with `gfatools bubble`.

### A whole chromosome as a graph

The graph track above draws one node per **segment**, and a window past a few
hundred kilobases is more nodes than anything can lay out.

The bubble file is also a level of detail. Collapsing each bubble to a single
node, with the invariant reference between bubbles as backbone, turns the same
graph into something that fits on a screen.
[`build_bubble_tier.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bubble_tier.sh)
does that in one pass over the file you already have:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_bubble_tier.sh
bash build_bubble_tier.sh hprc-v2.0-mc-grch38.bubbles.bed.gz \
  hprc-v2.0-mc-grch38.tier10000 10000
```

The threshold is on **content**, the larger of the reference span and the
longest allele. A pure insertion is an alternative to nothing, so a large share
of the bubbles are zero-length on GRCh38, and a threshold on `end - start` would
drop every one of them, the graph's largest insertions among them.

The result reads through the same adapter as the fine index. A tier is a prefix,
so choosing a level of detail is choosing a file:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_tier",
  "name": "HPRC release 2 graph: bubble tier (one node per bubble)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.tier10000",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  }
}
```

One setting has to move with it. The view refuses a cut over 5 Mb, which is a
proxy for node count and a fair one at segment granularity, but a tier breaks
the proxy. A `GraphGenomeView` pointed at one carries **`maxRegionBp`** raised
to the span it is drawing, which the figure below links a session for. The real
ceiling is unchanged: `maxGraphNodes` counts what actually came back.

The same bubble file also plots directly as a curve of where the graph varies
and by how much. `MinigraphBubbleAdapter` already reports each bubble's segment
count as its `score`, so the only change is the track type, a `FeatureTrack`
offering no wiggle display to pick:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "hprc_bubble_score",
  "name": "HPRC release 2 graph: variability (segments per bubble)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  }
}
```

<Figure caption="All 249 Mb of GRCh38 chr1 with the cytogenetic bands on the same axis, then the three chr1 loci this page opens, then three lanes off two files: the bubble file as a curve of segments per bubble, the same bubbles as the tier's segments lane, and the tier as a graph. The blank column is 1q12, where nothing aligns." src="/img/pangenome/hprc_whole_chromosome.png" />

The tier draws the whole chromosome in a few hundred nodes and lays them out in
milliseconds; `build_bubble_tier.sh` prints what it kept for whatever threshold
you pass it. The chain alternates strictly, one backbone node per bubble,
because `gfatools bubble` reports top-level bubbles only and those never
overlap, so one flat walk is complete. The heterochromatin gap the caption
names, a long run of unknown sequence (N) in GRCh38, costs it a single backbone
node. Bubbles are called across the centromere itself.

The lane above the curve is what this view is for. Every locus this page has
opened on chr1 is in it (the amylase bubble, the 1q21.1 inversion, the
_CFHR3_/_CFHR1_ deletion), and the curve is high at each. None of them is the
tallest peak on the lane, and the tallest sits at a locus this page never opens.
Scanning here and expanding what stands out is the working order.

This is the coarse end of a ladder: a tier node is a bubble, so it says where
the graph varies and by how much, and nothing about the alleles inside it. The
node id is the bubble's own source segment, so the same span in the fine index
is the expanded view of it.

### Inversions

Insertions are nodes and deletions are edges; an inversion is the same reference
sequence, walked backwards. The bubble file is where it is findable.
`gfatools bubble` sets a column when a bubble's paths disagree about
orientation, and the adapter exposes it as an `inversion` boolean, so **Edit
filters** on the bubble track cuts the lane to them:

```
jexl:feature.inversion
```

The _AMY1_ bubble row printed [earlier](#insertions-deletions-and-their-sizes)
carries a `1` in that column, which few bubbles do. Their breakpoints are in the
links index, stated as an orientation disagreement between two backbone
segments, which makes them readable without the graph:

- columns 4 and 5 name the two endpoints, each id ending in the `+` or `-` it is
  entered on
- columns 9 and 13 give their ranks

So the test is: both ends on the backbone, and the two signs disagree.

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.links.bed.gz \
  'GRCh38#0#chr1:144,400,000-144,600,000' |
  awk -F'\t' -v OFS='\t' '
    { dup = seen[$4 $5]++ }                  # count every row, so a repeat prints once
    $9 == 0 && $13 == 0 && !dup {            # both ends on the GRCh38 backbone
      from = substr($4, length($4))          # the trailing + or -
      to   = substr($5, length($5))
      if (from != to) print $4, $5, $7, $8, $11, $12
    }'
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

The alignments do settle it, and the test is the sequence either side rather
than the block. A haplotype whose whole window aligns reverse says nothing,
since its contig may simply be deposited that way. A block that reverses while
the sequence either side of it stays forward is an inversion.
[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
runs that classification over HPRC's published all-vs-GRCh38 PAF at the bubble
above, prints the split it finds (carriers reverse the block while keeping its
surroundings forward, non-carriers keep it forward, and the rest are mixed or
reverse throughout and are evidence for neither), and slices out one of each.
Which one matters: 1q21.1 is a segmental duplication and every haplotype here
also aligns inverted paralogs nearby, each crossing on screen the way the
inversion does, so the script keeps only haplotypes whose alignments inside the
drawn window are the inversion and the forward sequence either side.

Each haplotype row carries its own CAT gene annotation, which states the same
event a second way without reference to the ribbon. The pair boxed on each row
is the same two genes, _PPIAL4F_ and _PPIAL4E_: on the carrier _PPIAL4F_ comes
first, on the non-carrier _PPIAL4E_ does, and the hg38 row between them agrees
with the non-carrier.

<Figure caption="The 1q21.1 bubble the graph flags as an inversion, drawn as alignments. Between the two haplotype rows are the RefSeq genes, the bubble lane cut to inversion-flagged bubbles, and the rGFA segments. The boxed pair on each row is PPIAL4F and PPIAL4E." src="/img/pangenome/hprc_inversion.png" />

The [allele inventory](#the-allele-inventory) has nothing for them by
construction: a mixed-orientation pair of backbone segments is a breakpoint
rather than a skipped span, so `build_rgfa_alleles.sh` leaves those pairs out of
its deletions.

## The allele inventory

The bubbles say where the graph varies. A third hosted file says what the
variation is: one row per allele the graph holds, anchored on GRCh38 and derived
from the two indexes above.

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

The `AlignmentsTrack` over a BED is what draws the sizes. Each row carries a
`CIGAR` against the reference span it replaces (`2062M63348I`), and the
alignments display draws whatever has one, so the alleles pack into rows and
each insertion draws at its real magnitude.

The magnitude is measured, the position inside the span is not. A bubble states
what sequence replaces a reference interval, never where inside that interval it
sits, so the CIGAR puts the indel at the end of the span by convention. Over a 2
kb anchor nothing turns on it; over a CFHR-scale span the marker is placed
rather than located.

The lane's rows are the display packing overlapping alleles, not a set of
haplotypes. The one event worth looking at over this window, the 84,683 bp
deletion between _CFHR3_ and _CFHR1_, is
[drawn on the same coordinates by the graph](#insertions-deletions-and-their-sizes).

The whole graph holds a few hundred thousand alleles, about half of them
insertions, so a wide window is dense. The
[graph genome view guide](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
walks through the columns, how the walk derives them, and the two filters that
make a lane this size readable: `jexl:abs(feature.delta)>10000` for size and
`jexl:feature.nested==0` before reading lengths in bulk. `nested` is common on
this graph, and `build_rgfa_alleles.sh`'s closing summary prints how many rows
carry it.

`discoveryRank` and `firstSeenIn` carry the same
[attribution](#from-a-node-back-to-a-coordinate) the node panel does, on the
allele rather than the segment. minigraph collapses, so one haplotype can end up
named on half the rows in a dense window purely by build order, and a high rank
does not mean the earlier haplotypes lacked the sequence. Carriage is
[a different file](#carriage-at-the-graphs-own-granularity).

## The variant callset

The `wave.vcf.gz` ships its index beside it, so JBrowse reads only the slice you
are viewing out of the 2.3 GB file. Paste the S3 URL into a `VariantTrack` and
pick the multi-sample display:

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

`renderingMode: "phased"` splits each of the VCF's 232 phased sample columns
into its two haplotypes, giving 464 independent rows instead of 232 diploid
ones. Co-inherited blocks are visible only in that form. Three counts circulate
around this data and they are one thing:

- 231 diploid HPRC samples plus a haploid CHM13 are the 232 columns
- 463 assembled haplotypes is where `AN` tops out
- the display draws 464 rows, because CHM13's second row exists and is entirely
  no-call

`hprc465vsgrch38`, the PAF the CFHR figure slices, is HPRC's own file, named for
the assemblies it aligns rather than for these columns.

The VCF is fully decomposed, so `chr6:32,450,000-32,650,000` (the window in the
figure below) holds over fourteen thousand records, most of them SNPs and the
rest small indels. The structural tier is already in this file. Add the filter

```
jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50
```

from **Edit filters** and the same window drops to a couple of hundred sites.

Both halves are load-bearing:

- `alleleLength` is the longest allele the record describes. A filter on
  `end - start` would keep only deletions, since an insertion consumes no
  reference.
- `LV` is the record's level in vg's snarl tree, and `LV==0` keeps the top-level
  sites. Without it the panel paints some events twice at two positions, because
  this file writes a nested child as its own record beside its parent, with `PS`
  naming that parent.

`LV==0` has a cost. A parent record sits at one position and its children spread
over the span it covers, so the filter collapses that whole span onto one
column. At C4 the effect is the width of the figure:
`chr6:32,000,000-32,020,000` holds hundreds of records and not one of them is
`LV==0`, so the filter alone empties 20 kb across _CYP21A1P_ and _TNXA_, which
is where that locus varies most. Pair it with a size filter, as above, or drop
it and read the duplicates; a blank column under it is a statement about the
snarl tree rather than about the cohort.

Read a column as a site that holds a structural allele rather than as a
guarantee about every cell in it. The filter admits a record on its longest
allele and most records it admits here are multi-allelic, so a site can enter
the panel on one haplotype's 60 bp insertion while another haplotype's cell in
the same column is colored for a SNP. The file states the rest per allele:
`TYPE` gives each ALT's class (`snp`, `ins`, `del`, `complex`) and `LEN` its
length, both in the feature details panel a click opens.

Frequency is in the file. `AC`, `AF`, `AN` and `NS` are on every record, so
`jexl:feature.INFO.AF[0]>0.05` selects the common alleles without clustering
anything. `AC`/`AF` are per-ALT arrays, so on a multi-allelic site index the
allele you mean. Two fields guard the reading:

- A no-call is not a reference call, and `missingness(feature)` is available as
  a filter for exactly that, which matters where assembly coverage is thin (KIR,
  _LPA_).
- `CONFLICT` names samples the graph gives two disagreeing paths, and it fires
  on no record in this window.

The display widens each insertion cell to a marker sized by the inserted bp, in
that haplotype's own genotype color
([`showInsertionGlyphs`](/docs/config/linearmultisamplevariantdisplay/#slot-showinsertionglyphs)),
since an insertion consumes no reference. Only haplotypes carrying the allele
widen.

That leaves few enough alleles to draw each at its own genomic position, lined
up with the genes above. **Clustering → Cluster rows by genotype... → Run
clustering** in the track menu reorders the 464 rows by genotype similarity and
draws a dendrogram beside them. The next section's figure is that matrix, beside
the graph the same alleles came out of.

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="The 464-haplotype lane clustered from the track menu: Clustering, Cluster rows by genotype, Run clustering, and the rows arriving in their new order with a dendrogram beside them." />

## Carriage at the graph's own granularity

The callset above is decomposed, so one graph bubble arrives as many records and
a column is a primitive variant rather than an allele of the graph. Release 2
also publishes the undecomposed form, one record per **snarl**, in the
`hprc_v2.0_mc_grch38_index` submission. Read it when the question is who carries
a given bubble: its rows and the graph's alleles are the same objects.

```json
{
  "type": "VariantTrack",
  "trackId": "hprc2_pgbi_grch38",
  "name": "HPRC2 pangenome carriage (snarl-level, 462 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/submissions/671F0A25-700C-4DDF-96B0-9668F6C0F25E--hprc_v2.0_mc_grch38_index/hprc-v2.0-mc-grch38.pgbi.vcf.gz"
  },
  "displays": [
    { "type": "LinearMultiSampleVariantDisplay", "renderingMode": "phased" }
  ]
}
```

The snarl file ships its own index, so nothing is downloaded but the slice in
view: the C4 window is a couple of seconds over HTTP. It carries 231 sample
columns rather than the wave file's 232, CHM13 not being among them, so phased
mode draws 462 rows and `AN` tops out there too.

`AT` is what this file adds: it states each allele as the **traversal** it takes
through the graph, the same statement the `AT` in a pggb VCF makes, which the
wave file drops (`bcftools annotate -x INFO/AT` is in its own header). The
[same `LV==0` filter](#the-variant-callset) cuts this lane to top-level sites,
the tier the [bubble track](#the-bubble-track) holds.

`ID` and `AT` name **base-level integer nodes** (`>161001867>161004536`), not
the `sNNNNN` segment ids of `sv.gfa`, so match a record to a bubble by interval.

With this lane loaded the two readings sit over one coordinate and say
different, compatible things: the [allele inventory](#the-allele-inventory)
gives the haplotype the graph credits an allele to, and a genotype column here
gives the haplotypes that walk it.

## The alignment the graph and callset came from {#the-alignment-underneath-both}

The graph and the callset are both derived from the multiple alignment, and
release 2 publishes that too: `hprc-v2.0-mc-grch38.full.taf.gz`, 5.9 GB, 464
haplotypes, beside a `.tai` index written by
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy). The index makes it
addressable, so a locus is a ranged read rather than a download:

```json
{
  "type": "MafTrack",
  "trackId": "hprc_v2_0_mc_grch38",
  "name": "HPRC release 2 pangenome alignment (464 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BgzipTaffyAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz"
  }
}
```

The `uri` shorthand resolves the sibling `.tai`, which downloads once.

TAF is taffy's own column-oriented format, and the same alignment is published
as a 53 GB MAF under `v2.1/`, which `BgzipMafAdapter` reads with the same `uri`
shorthand. The v2.0 file is the one this page uses: it is the build the graph
and the callset above come from, and it is far smaller to store and cheaper to
read a locus out of.

Each product this page has opened states something different about the same
sequence, so the figure below puts them on one axis: the graph as its segments
and again as a subgraph, the callset as a genotype matrix over all 464
haplotypes, and the alignment as rows. The band runs down all of them.

<Figure caption="The C4 locus on one axis: the NCBI RefSeq genes, the graph's rGFA segments, the callset's 464 haplotypes clustered by genotype, thirty-two of those haplotypes as alignment rows clustered by identity, and the same window as a force-directed subgraph. The band marks the pseudogene pair between C4A and C4B, where the haplotypes that carry nothing there gather into a block." src="/img/maf_hprc_pangenome.png" />

The locus is C4, the example [HPRCv2](https://github.com/pangenome/HPRCv2)
itself opens with. Every alignment row is a human haplotype, so a row that drops
out belongs to a person who does not carry that segment. Read down a column for
who carries what, across for where each segment starts and stops.

Both matrices are clustered, over different measurements: the callset by
genotype, the alignment by how much of each bin a haplotype aligns and matches
at, where a bin it does not reach scores zero. Each dendrogram comes from its
own measurement, so neither reads as the other's. The graph's attribution is a
third, crediting a segment to whichever assembly first contributed it, where a
genotype names every haplotype that carries the allele. What lines up across all
of them is the span, which is what the band is for.

Clustering the alignment is a run. A MAF usually orders its rows by a guide tree
the file ships, and HPRC's ships none: how the haplotypes group is a property of
the locus. **Cluster rows by identity...** under the track menu's **Clustering**
submenu computes it over the window in view, and **Reset row order** puts back
whatever the file supplied.

The alignment draws sixteen samples rather than all 232, thirty-two haplotype
rows at two per sample, because a row needs enough height for its name to fit
beside it and the whole cohort named is a track several screens tall. Drop
`subtreeFilter` from the session and every haplotype is there, at whatever
height it fits in.

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity and codon view, all derived from the alignment with no extra
files.

## Every haplotype in its own coordinates

The alignment above is anchored: each haplotype is drawn on GRCh38's axis, which
is what makes hundreds of rows comparable at all, and what leaves each
assembly's own coordinates out of the picture. A
[multi-way synteny track](/docs/tutorials/multiway_synteny_lgv_track) is the
other reading. One lane per haplotype, each in that assembly's own contig
coordinates and carrying that assembly's own CAT gene models, with ribbons
connecting a gene to its copy in the lane below.

No aligner is in the loop. CAT projects the GENCODE gene set onto every release
2 assembly, so a gene keeps its name on every haplotype, and joining the
annotations by name is already the ortholog table: one row per GRCh38 gene in
the window, one column per haplotype, `.` where that haplotype's annotation has
no copy.

### Picking the panel out of the callset

`build_hprc_cfhr_synteny.sh` genotypes the CFHR3/CFHR1 deletion over all 464
haplotypes rather than taking a list, and prints what it found: 139 haplotypes
carry it, 36 samples are homozygous for it and 124 are homozygous reference.

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# the site as the callset states it. One record with two ALTs here, so the
# deletion allele is the one far shorter than the REF span rather than the one
# at a fixed index.
bcftools view -r chr1:196753075-196753075 -Oz -o cfhr_site.vcf.gz "$WAVE"
```

It then walks the homozygous samples in callset order and keeps a haplotype only
if three things hold: its alignment in the window sits on one contig, release 2
annotated it, and its own CAT annotation agrees with the genotype it was picked
on, meaning no _CFHR3_ or _CFHR1_ on a carrier and both on a non-carrier. The
third is the control, since the callset and the annotation are separate products
of the release, and a lane is drawn only where the two say the same thing.

That last check is the one that costs: a CAT annotation is ~110 MB, whole
genome, and ships no index, so the shortlist is fetched concurrently
(`CAT_JOBS`, 6 by default) and each slice is kept, which is what makes a re-run
that only wants the table cheap.

### Reading it

```json session config=https://jbrowse.org/demos/hprc/config.json
{
  "defaultSession": {
    "name": "CFH cluster, one lane per haplotype",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "hg38",
          "loc": "chr1:196,640,000-196,900,000",
          "tracks": [
            {
              "trackId": "hg38_ncbiRefSeq_ucsc",
              "type": "LinearBasicDisplay",
              "showOnlyGenes": true,
              "displayMode": "compact"
            },
            {
              "trackId": "hprc_cfhr_multiway",
              "type": "MultiWaySyntenyDisplay",
              "rowOrder": [
                "HG00097.1",
                "HG00099.1",
                "HG00128.1",
                "HG00133.1",
                "HG01109.1",
                "HG01123.1",
                "HG01960.1",
                "HG02055.1"
              ],
              "height": 460
            }
          ]
        }
      }
    ]
  }
}
```

`rowOrder` puts every non-carrier above every carrier, and that ordering is what
makes the deletion readable: a ribbon connects **adjacent** lanes only, so a
chain can only run as far as the first lane missing the gene.

<Figure caption="The CFH cluster on chr1 as one multi-way synteny track: hg38 genes over a lane per HPRC haplotype, each on its own contig and carrying its own CAT gene models. The CFHR3 and CFHR1 chains run through the non-carrier lanes and stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/pangenome/hprc_cfhr_lane_stack.png" />

Every lane sits at a different coordinate on a different contig, which is what
the headers say, and the flanking genes still line up down the stack because a
lane is fitted to the orthologs rather than projected onto GRCh38. The two
chains that stop are _CFHR3_ and _CFHR1_: the carriers' own annotations have
neither gene, so there is nothing in those lanes for a ribbon to reach.

## Comparing the graph with the callset

The graph and the callset are the same object at two resolutions. minigraph
records structural variation (roughly >50 bp) and collapses everything smaller,
so SNPs are absent from the graph even though every one is in the VCF. Filter
the callset to that same tier and the two describe the same events from opposite
ends. The graph states an allele and its length, and cannot say whose it is:
collapsing is what let it be found at all. The callset never lost the samples,
so it states whose.

The graph and the callset still do not line up row for row:

- the rows differ because one lane is
  [attribution and the other carriage](#from-a-node-back-to-a-coordinate), so a
  donor can appear on one haplotype in the graph and carry the same event on the
  other in the callset
- the records differ because of decomposition, which the file states outright:
  `ORIGIN` names the position of the complex record vcfwave split each one out
  of, so one graph bubble arrives as many VCF records, and that is what the
  `LV==0` filter above undoes

The word "bubble" also covers two different decompositions here. The bubble lane
is `gfatools bubble`'s top-level superbubbles over the rGFA, where `LV`/`PS` are
vg's snarl tree over the graph the callset was deconstructed from. They agree
about where the graph varies without being in one-to-one correspondence, so
match a bubble to a record by interval rather than by count.

What does line up is the event: mark an interval in the linear view and it
crosses the genes, the segments lane and the genotype matrix in one column, and
the reference-position ramp gives the graph's backbone at that position the same
hue as the segments above it.

<Figure caption="One window, both products. The band is one 14.6 kb deletion site from the callset, and the matrix below it, all 464 haplotypes clustered by genotype, colors the haplotypes carrying it. The force graph has no coordinate axis, so an arrow runs from the band to the reference node the deletion removes." src="/img/pangenome/hprc_graph_vs_callset.png" />

## Reproduce it end to end

Two scripts and one gfatools call rebuild the hosted files, or build the same
set for a different graph, with the tools listed under
[Prerequisites](#prerequisites). Their provenance (source, size, exact commands,
build date) is in [README.txt](https://jbrowse.org/demos/hprc/README.txt) beside
them.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_tabix.sh
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_alleles.sh
bash build_rgfa_tabix.sh hprc-v2.0-mc-grch38.sv.gfa.gz out
bash build_rgfa_alleles.sh out
```

- [`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
  writes the two tabix indexes `RgfaTabixAdapter` reads, straight from the
  gzipped rGFA (nothing to unpack), using gfatools for the segment projection.
  It needs an **rGFA**: `sv.gfa.gz` is one, the `.gfa.gz` beside it is not (see
  [Regular GFA vs rGFA](#regular-gfa-vs-rgfa)).
- [`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh)
  reads only those two indexes and never the graph, so the allele inventory
  takes seconds off the small index pair rather than the 842 MB download they
  came from, and works with no assemblies loaded, the normal situation with
  someone else's graph.

The [bubble track](#the-bubble-track) is neither script but one gfatools call
over the same graph:

```bash
gzip -dc hprc-v2.0-mc-grch38.sv.gfa.gz | gfatools bubble - \
  | sort -k1,1 -k2,2n | bgzip > out.bubbles.bed.gz
tabix -p bed out.bubbles.bed.gz
```

Carriage is already [a published file](#carriage-at-the-graphs-own-granularity),
tabix-indexed like the callset. The route that rebuilds it,
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh),
writes one row per haplotype per bubble for the guide's
[per-strain paths](/docs/user_guides/graph_genome_view#which-strain-takes-which-path)
lane, at the cost of a 464-assembly download and a mapping run. One call per
sample is the whole of it:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call asks for the path each sample takes through every bubble rather than an
# alignment. It emits one line per `gfatools bubble` line above, in the same
# order for every sample, so line N of one sample and line N of another are the
# same bubble and can be joined on line number alone.
# -xasm is the assembly-to-graph preset, and -c asks for the base-level
# alignment the call is read off.
minigraph -cxasm --call -t 8 graph.rgfa.gz sample.fa > sample.call.bed
```

Run it once per assembly, with the reference first: the reference's path through
a bubble is the allele every other sample's path is compared against.

`build_rgfa_tabix.sh` takes an optional third argument, the reference's PanSN
sample, and writes a second index pair keyed only under that sample's sequences
(`hprc-v2.0-mc-grch38.ref.*`, also hosted). It is a fraction of the full pair's
index size, returns byte-identical rows, and is for a segments track drawn on
GRCh38. Do not point the graph cut at it: **Graph context** defaults to 1 hop, a
hop follows an allele's interior segments, and those are indexed under the donor
contig the small pair drops, so the graph comes back as though the setting were
**None**.

Three figures have a script of their own. The
[repeat-density lanes](#what-kind-of-sequence-grch38-was-missing) come from one
that bins UCSC's RepeatMasker for both assemblies:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_repeat_density.sh
bash build_repeat_density.sh out
```

It writes the twelve bigWigs (six classes x two assemblies, genome-wide) and
prints the per-class table the section above quotes, so the numbers come out of
the same run that builds the lanes. The first run downloads ~500 MB and
re-running skips what is already built, so an interrupted run resumes.

The other two both read release 2's published all-vs-GRCh38 PAF:

```bash
BASE=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
curl -fO $BASE/build_hprc_cfhr_synteny.sh
curl -fO $BASE/build_hprc_inversion_synteny.sh
bash build_hprc_cfhr_synteny.sh       # writes ./hprc_cfhr_synteny_build/
bash build_hprc_inversion_synteny.sh  # writes ./hprc_inversion_synteny_build/
```

[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
picks a carrier and a non-carrier of the deletion out of the callset, slices
their alignments out of that PAF, and slices each haplotype's CAT annotation to
the same window.
[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
runs the [inversion classification](#inversions) over the same PAF and prints
the split it finds before slicing out one haplotype of each kind.

## See also

- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/mappability_qc)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/maf_track)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph, the wave callset and the alignment
  underneath both.
- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), which define the `SN`/`SO`/`SR`
  tags this page opens the graph by and call the bubbles.
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which writes the
  `.tai` index that makes the 5.9 GB alignment addressable by locus.
