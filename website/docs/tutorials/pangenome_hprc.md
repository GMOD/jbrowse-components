---
title: Pangenome (HPRC)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, then
  its 464-haplotype variant callset, all from hosted files with no pipeline to
  run
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

:::info Requires the graph genome view plugin

The graph genome view is a separate beta plugin, and so are the two adapters
these tracks use. The
[pangenome graph view tutorial](/docs/user_guides/graph_genome_view) has the
one-line config that loads it, and covers the view's layouts, colors and menus
on a smaller graph than this one.

:::

The graph draws a window at a time rather than a whole viewport. To pick one,
**drag across the ruler** to rubberband a region and choose **Graph genome view
(this selection)**. This needs no graph track in the view: the item appears
whenever the session holds a track whose adapter can cut a subgraph. Selecting
more than the view will draw greys the item out and displays its limit.

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

The **Layout** dropdown trades that picture for an **anchored** layout, which
puts the x axis back on GRCh38:

<Figure caption="The same subgraph in the anchored layout. Every x is now a GRCh38 coordinate, so the backbone is one straight line and each alternate allele hangs directly below the position it attaches to, stacked by rank. Sharing an axis is not the same as being seen to share one, so the reference-position colors stay on: the block above and the node below it are the same color at the same bp." src="/img/pangenome/hprc_mhc_anchored.png" />

Each locus below is named with a window small enough to draw. The counts are
what the [allele inventory](#the-allele-inventory) holds in each:

| Locus        | Window                         | In the graph              |
| ------------ | ------------------------------ | ------------------------- |
| MHC class II | `chr6:32,510,000-32,600,000`   | 56 alleles, longest 94 kb |
| KIR          | `chr19:54,750,000-54,840,000`  | 42 alleles, longest 79 kb |
| AMY1         | `chr1:103,690,000-103,780,000` | 19 alleles, longest 94 kb |
| C4           | `chr6:31,980,000-32,050,000`   | 9 alleles, longest 39 kb  |
| LPA KIV-2    | `chr6:160,525,000-160,655,000` | 33 segments, up to 176 kb |

The table cannot show two things that matter before reading a window as empty.
Copy number is not in the graph, because minigraph records the distinct sequence
a bubble can hold rather than how many times a haplotype repeats it. AMY1 and C4
are therefore long alternate alleles, and length is the only proxy for a copy
count.

Near-identical duplications also collapse. The window over SMN1 holds only two
short alleles, because minigraph merged SMN1 and SMN2 onto one path. A quiet
window here means collapsed or invariant rather than checked and found nothing.

### Which haplotype an allele came from

The **Layout** dropdown's third mode, **Sample rows**, keeps x on GRCh38 and
gives each contributing assembly its own row. This matters at a dense locus,
because rank is build order: one rank holds alleles from a dozen different
haplotypes, so an anchored rank row means nothing biological while a sample row
is one haplotype.

LPA is a useful case, since its KIV-2 repeat sets Lp(a) level and copy number
there is not callable from short reads.

<Figure caption="The KIV-2 repeat inside LPA in the Sample rows layout, under the RefSeq genes and rGFA segments for the same window. The top row is the GRCh38 backbone; each row below it is one haplotype that donated sequence here, labelled with its HPRC id, and its marks are the alleles it donated, colored by the reference position they attach to. The bubbles lane states the length range the graph found across the cohort." src="/img/pangenome/hprc_lpa_kiv2.png" />

A window like this draws a dozen or so rows out of 464 haplotypes. A row is the
haplotype minigraph took the sequence from, the same attribution `discoveryRank`
and `firstSeenIn` carry, and not the set of haplotypes carrying the allele.
Collapsing is what let the allele be found at all, so carriage remains the
callset's job, [below](#structure-not-sequence).

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

<Figure caption="Right-clicking one haplotype's allele in the sample-rows layout, over the band Highlight in hg38 left in the linear view above. The menu works in the GRCh38 interval the allele attaches to, not the haplotype's own coordinates: that assembly is not loaded, and no session loads all 464. The band stays until it is removed, so the answer survives letting go of the mouse." src="/img/pangenome/hprc_node_menu.png" />

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
draws at its real magnitude instead of as a 1 bp box. The
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

The MHC class II region is dense enough that a 200 kb window holds over fourteen
thousand records, nearly all of them SNPs. The structural tier is what a
pangenome adds over a short-read callset, and it is already in this file. Add
the filter

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
the samples. Putting both in sample rows makes the difference explicit: the
graph names the haplotype an allele came from, and the callset names every
haplotype that carries it.

<Figure caption="One window, both products, restricted to the same 10 donors so the rows line up: the callset (top) is filtered to the same 50 bp tier the graph holds, both haplotypes of each donor labeled by name; the graph (bottom) rows only the haplotypes that donated sequence here, colored by where on the reference their alleles attach. The callset numbers a donor's haplotypes HP0/HP1, the graph .1/.2. A block in the matrix and a row in the graph answer different questions about the same bp." src="/img/pangenome/hprc_graph_vs_callset.png" />

## Reproduce it end to end

Two scripts rebuild the hosted files, for a different graph. Their provenance
(source, size, exact commands, build date) is in
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_tabix.sh
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_alleles.sh
bash build_rgfa_tabix.sh hprc-v2.0-mc-grch38.sv.gfa.gz out
bash build_rgfa_alleles.sh out
```

[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
writes the two tabix indexes `RgfaTabixAdapter` reads, straight from the gzipped
rGFA (nothing to unpack). It needs an **rGFA**: `sv.gfa.gz` is one, the
`.gfa.gz` beside it is not (see [Regular GFA vs rGFA](#regular-gfa-vs-rgfa)).
Also needs gfatools, for the segment projection and for the bubbles.

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
