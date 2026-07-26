---
title: Pangenome (HPRC)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, then
  its 464-haplotype variant callset and per-haplotype ancestry painting, all
  from hosted files with no pipeline to run
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) is roughly a
fivefold expansion over release 1. This tutorial opens three of its products:
the pangenome graph drawn as a graph, the variant callset (464 haplotypes as a
genotype matrix), and a per-haplotype local-ancestry painting.

Every track below is a URL you can paste. The callset ships tabix-indexed, so
JBrowse reads the slice you are looking at straight off HPRC's S3; the other two
we have prebuilt and host, with the build scripts in
[Reproduce it end to end](#reproduce-it-end-to-end).

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

Only one thing makes the graph open by locus straight from the file: its
coordinates.

A **regular GFA** (what pggb, odgi, and the full base-level Minigraph-Cactus
graph emit) records no coordinates on its segments. The only reference positions
in the file live inside the P/W path lines, so you cannot look up a locus
without walking every path, and to draw a subgraph you first cut a window out of
the graph offline with `odgi extract`. That is the route the
[E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli#the-graph-itself-a-local-subgraph)
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

The `color` jexl is what makes the graph and the linear view read as one
picture: it paints each segment in the graph view's own **Stable rank (rGFA)**
colors, so a segment is the same color in both panels.

Each segment draws where its tags say it sits, so the GRCh38 backbone tiles the
reference and the graph becomes queryable by locus. Those hosted files are ours,
not HPRC's: we ran the `sv.gfa.gz` through
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
and put the output on `jbrowse.org`.

## Open a locus as a graph

:::info Requires the graph genome view plugin

The graph genome view is a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web (its force-directed layout uses the GPL-licensed
[Bandage](https://github.com/rrwick/Bandage) engine). It is in **beta** and not
in the [plugin store](/docs/user_guides/plugin_store) yet, but it is a native ES
module and loads from any config today (see
[configuring plugins](/docs/config_guides/plugins)):

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

The tracks above need it too: `RgfaTabixAdapter` and `MinigraphBubbleAdapter`
ship in the same plugin.

:::

The graph draws a window at a time rather than a whole viewport, so the way in
is to **drag across the ruler** to rubberband one and pick **Graph genome view
of selection**. That picks a window directly, with no navigating first, and it
needs no graph track in the view: the item appears whenever the session holds a
track whose adapter can cut a subgraph. Select more than the view will draw and
the item greys out and names its own limit, so the size to aim at is something
you read rather than remember.

The subgraph is cut from the same two files the track reads.

<Figure caption="The HLA class II region as a graph, in force-directed layout, under four lanes of the same window. The blue segment blocks are the GRCh38 backbone; the orange bar is the bubble every orange loop in the graph hangs off, labelled with its shortest and longest allele. The alleles are in the bottom lane, each drawn at the point it attaches and widened to its own bp, since a rank>0 segment has no GRCh38 coordinate to be drawn across." src="/img/pangenome/hprc_mhc_bandage.png" />

The asymmetry between the panels is structural. A rank-0 segment sits on GRCh38
and has a coordinate; a rank>0 segment sits on some other assembly's refName and
has none, so no coloring will put the orange loops on a GRCh38 axis as segments.
What a reference axis can hold is where each one attaches and how long it is,
which is the bubble lane and the [allele inventory](#the-allele-inventory) lane.

The **Layout** dropdown trades that picture for an **anchored** layout, which
puts the x axis back on GRCh38:

<Figure caption="The same subgraph in the anchored layout. Every x is now a GRCh38 coordinate, so the backbone is one straight line and each alternate allele hangs directly below the position it attaches to, stacked by rank. The trade against the force layout above: position instead of shape, so a bubble reads as a pair of stalks rather than a loop." src="/img/pangenome/hprc_mhc_anchored.png" />

Each locus below is named with a window small enough to draw. The counts are
what the [allele inventory](#the-allele-inventory) holds in each:

| Locus        | Window                         | In the graph              |
| ------------ | ------------------------------ | ------------------------- |
| MHC class II | `chr6:32,510,000-32,600,000`   | 56 alleles, longest 94 kb |
| KIR          | `chr19:54,750,000-54,840,000`  | 42 alleles, longest 79 kb |
| AMY1         | `chr1:103,690,000-103,780,000` | 19 alleles, longest 94 kb |
| C4           | `chr6:31,980,000-32,050,000`   | 9 alleles, longest 39 kb  |

Two things the table cannot show, both worth knowing before reading a window as
empty.

**Copy number is not in the graph.** minigraph records the distinct sequence a
bubble can hold, not how many times a haplotype repeats it, so AMY1 and C4 are
long alternate alleles and length is the only proxy for a copy count.

**Near-identical duplications collapse.** `chr5:70,880,000-70,980,000` over SMN1
holds 2 alleles whose longest is 334 bp, because minigraph merged SMN1 and SMN2
onto one path. A quiet window here means collapsed or invariant, never checked
and found nothing.

C4, from the table:

<Figure caption="The C4 locus, small enough that the whole subgraph fits in one picture. The bubbles track above reports a single bubble spanning the locus; the graph below is what that one bubble contains." src="/img/pangenome/hprc_c4_subgraph.png" />

### Which haplotype an allele came from

The **Layout** dropdown's third mode, **Sample rows**, keeps x on GRCh38 and
gives each contributing assembly its own row. It is worth the switch here
because rank is build order: at a locus this dense one rank holds alleles from a
dozen different haplotypes, so an anchored rank row means nothing biological,
while a sample row is one haplotype.

<Figure caption="MHC class II in the Sample rows layout, under the RefSeq genes and rGFA segments for the same window. The top row is the GRCh38 backbone; each of the 12 rows below it is one haplotype that donated sequence here, labelled with its HPRC id, and its orange bars are the alleles it donated." src="/img/pangenome/hprc_mhc_sample_rows.png" />

The four windows above draw 8 to 15 such rows each, out of 464 haplotypes, and
that ratio is the thing to read carefully. A row is the haplotype minigraph took
the sequence **from**, the same attribution `discoveryRank` and `firstSeenIn`
carry, not the set of haplotypes carrying the allele. Collapsing is what let the
allele be found at all, so carriage stays the callset's job,
[below](#structure-not-sequence).

### Hovering one panel highlights the other

Hover a node in the graph and the reference interval it occupies is highlighted
in every linear view beside it; hover the linear view and the segment under the
cursor brightens in the graph. Nothing to configure, and it is the third thing a
reference axis can hold for a rank>0 allele: not the allele's own sequence, but
the interval between the two backbone segments it detaches from and rejoins.
Both directions are pictured in the
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#hovering-one-panel-highlights-the-other).

### From a node back to a coordinate

Hovering says where a node is while the cursor is on it. **Right-click a node**
to go there: the menu names the assembly the segment came from and opens it in
the linear view beside the graph, which scrolls rather than opening another
pane. The graph's own **Launch view** menu does the same for the whole window it
was cut from.

Both come from the tags rGFA puts on every segment — `SN` names the sequence the
segment came from, `SO` its offset there — so what the menu offers depends on
which segment you clicked:

- a **backbone (rank 0) segment** is on GRCh38, so its own coordinates are the
  ones you get, exactly.
- an **allele (rank>0) segment** is on some haplotype's own sequence, e.g.
  `HG02717#1#chr6` at its own offset. That coordinate is exact too, but no HPRC
  session loads 464 haplotypes as assemblies, so there is nothing to open it in.
  What the menu offers instead is the interval on GRCh38 between the two
  backbone segments the allele detaches from and rejoins — the same span the
  hover highlights.

The node's contributing haplotype is named either way: in the tooltip, and in
the details panel a left-click opens.

That makes a round trip out of the four lanes above. Rubberband a locus into a
graph, find the loop worth asking about, right-click it to put the linear view
on its GRCh38 interval, and read what the reference-anchored tracks say about
that interval: which bubble it belongs to ([bubble track](#the-bubble-track)),
how long the allele is and which haplotype it was first seen in
([allele inventory](#the-allele-inventory)), and whether the callset genotypes
anything there ([variant callset](#the-variant-callset)). The graph says what
sequence exists and where it attaches; those three say how common it is.

Where the contributing assemblies _are_ loaded — a bacterial pangenome, a
handful of genomes rather than hundreds — the same menu offers one linear view
per contributing assembly and a synteny view of all of them at once. See the
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#from-a-node-to-the-strains-that-carry-it).

## The bubble track

A bubble is where haplotypes diverge and rejoin; the bubble track shows _where_
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
allele: one bubble in the HLA class II window runs 4,046 to 78,051 bp depending
on the haplotype. Read the path count with care, since it counts routes
combinatorially rather than haplotypes observed, saturating at `2147483647` (the
track labels those bubbles uncountable). HPRC publishes no bubble file, so this
one is ours too, built with `gfatools bubble`.

## The allele inventory

The bubbles say where the graph varies. A third hosted file says what the
variation is: one row per allele the graph holds, anchored on GRCh38, derived
from the two indexes above with no assemblies, no VCF and no bubble caller.

```json
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

An `AlignmentsTrack` over a BED is the point, not a mistake. Each row carries a
`CIGAR` against the reference span it replaces (`2062M63348I`), and the
alignments display draws whatever has one, so the alleles pack into rows and
each insertion draws at its real magnitude instead of as a 1 bp box. The
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#when-all-you-have-is-the-graph)
walks through the columns and how the walk derives them.

<Figure caption="RefSeq genes, the rGFA segments track, and the allele inventory over the same MHC class II window. Grey bars are deletions at their true width; magenta markers are insertions, each drawn and labelled at its inserted bp rather than at the reference it does not cover." src="/img/pangenome/hprc_allele_inventory.png" />

Whole graph: 208,545 alleles, 112,995 of them insertions, 661 of those longer
than 50 kb. At that scale start from a size filter in **Edit filters**, e.g.
`jexl:get(feature,'delta')>10000`.

Read `discoveryRank` and `firstSeenIn` as the first haplotype to contribute an
allele, never as who carries it: minigraph collapses, so an allele many
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

`renderingMode: "phased"` is the setting that matters. The VCF carries 232
phased samples, so phased mode splits each into its two haplotypes: 464
independent rows instead of 232 diploid ones, which is what makes co-inherited
blocks visible.

The MHC class II region carries about **66 variants per kilobase** here, so a
200 kb window holds over fourteen thousand records, and all but a couple of
hundred are SNPs. The structural tier is the part a pangenome adds over a
short-read callset, and it is already in this file: add the filter

```
jexl:alleleLength(feature) >= 50
```

from **Edit filters** and the same window drops to 220 alleles, each a real
insertion or deletion. (`alleleLength` is the longest allele the record
describes; a filter on `end - start` would keep only deletions, since an
insertion consumes no reference.)

That same asymmetry is why an insertion would not draw at its true width, so the
display widens each insertion cell to a marker sized by the inserted bp, in that
haplotype's own genotype color
([`showInsertionGlyphs`](/docs/config/sharedvariantdisplay/#slot-showinsertionglyphs)).
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
ends: the graph states an allele and its length but cannot say whose it is,
because collapsing is what let it be found at all; the callset never lost the
samples, so it can. Stack them, pick an allele in the inventory, read down.

<Figure caption="One window, both routes. Above, the graph's allele inventory: each deletion at its width, each insertion at its inserted bp. Below, the same window's callset filtered to the same 50 bp tier, one row per haplotype, clustered. The block boundaries in the matrix line up with the alleles drawn above them." src="/img/pangenome/hprc_graph_vs_callset.png" />

## Local ancestry (PCLAI)

[PCLAI](https://github.com/AI-sandbox/hprc-pclai) (Point Cloud Local Ancestry
Inference) assigns each genomic window a continuous coordinate in PCA space
rather than a discrete ancestry label, and release 2 publishes those calls as
**one BED per haplotype**, already on GRCh38, with the PCA coordinate encoded as
an interpolated color in `itemRgb`.

`LinearMultiRowFeatureDisplay` wants the opposite shape: one file, with a column
naming each feature's row. Our ready-made 64-haplotype chr1 BED loads directly:

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc2_pclai_painting",
  "name": "HPRC2 local ancestry (PCLAI)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc2_pclai_chr1.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "legend": [
        { "label": "Yoruba (NA19240)", "color": "rgb(0,232,178)" },
        { "label": "Kinh Vietnamese (HG02135)", "color": "rgb(255,114,53)" },
        { "label": "Iberian (HG01530)", "color": "rgb(229,161,255)" }
      ]
    }
  ]
}
```

`partitionField` assigns each feature to a row, and `rowHeight` defaults to
auto-fit, so adding haplotypes shrinks the rows instead of overflowing the
track. The color is a continuous PCA interpolation, so the BED carries no
attribute to derive a key from and `legend` declares one instead: its three
entries name the extremes of that space by the sample sitting at each, and a
color between them is a position between them, not a fourth category.

[`build_hprc2_pclai.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc2_pclai.sh)
builds your own for a chromosome and sample count you pick
(`bash build_hprc2_pclai.sh out chr1 64`).

<Figure caption="HPRC2 haplotypes painted by PCLAI local ancestry over the end of chr1, one row per haplotype, colored by the published per-window PCA coordinate. The key names the three extremes of that space; a color between them is a position between them. Rows are in sample-id order here, so ancestry-similar haplotypes are scattered down the track." src="/img/hprc2/local_ancestry.png" />

**Clustering → Cluster rows by similarity** in the track menu reorders the
haplotype rows so ancestry-similar ones sit together:

<Figure caption="The same painting with the rows clustered and a dendrogram beside them. The scattered rows above collapse into solid bands, and what is left between the bands are the haplotypes that change color partway across the window." src="/img/hprc2/local_ancestry_clustered.png" />

## Reproduce it end to end

Three scripts rebuild the hosted files, for a different graph or a different
chromosome and sample count. Their provenance (source, size, exact commands,
build date) is in [README.txt](https://jbrowse.org/demos/hprc/README.txt) beside
them.

```bash
bash scripts/build_rgfa_tabix.sh hprc-v2.0-mc-grch38.sv.gfa.gz out
bash scripts/build_rgfa_alleles.sh out
bash scripts/build_hprc2_pclai.sh out chr1 64
```

[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
writes the two tabix indexes `RgfaTabixAdapter` reads, straight from the gzipped
rGFA (nothing to unpack). It needs an **rGFA**: `sv.gfa.gz` is one, the
`.gfa.gz` beside it is not (see [Regular GFA vs rGFA](#regular-gfa-vs-rgfa)).
Also needs gfatools, for the segment projection and for the bubbles.

[`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh)
reads only those two indexes, never the graph, and writes the allele inventory:
23 seconds off the 41 MB pair, against the 842 MB download they came from. That
is what makes it the route that survives having no assemblies, the normal
situation with someone else's graph. The E. coli tutorial's
[per-strain paths](/docs/tutorials/pangenome_ecoli#which-strain-takes-which-path)
answer the carriage question instead, at the cost of re-mapping every haplotype.

[`build_hprc2_pclai.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc2_pclai.sh)
fetches the per-haplotype PCLAI BEDs, keeps the columns the painting needs, and
concatenates them into one bgzipped, tabixed file. All three need htslib
(`bgzip`, `tabix`) on your `PATH`.
