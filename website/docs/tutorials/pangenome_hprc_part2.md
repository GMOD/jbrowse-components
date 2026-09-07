---
title: Pangenome (HPRC) part 2, who carries what
sidebar_label: Pangenome (HPRC, part 2)
description:
  Where HPRC release 2's graph varies and by how much, what each alternative is,
  which of the 464 haplotypes carry it, and the alignment underneath all of it
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** [part 1](/docs/tutorials/pangenome_hprc) ends holding one allele and
the single haplotype the graph credits it to, which is not the same as everyone
who carries it. This page reads that off the rest of HPRC release 2 on the same
GRCh38 axis: where the graph varies and by how much, what each alternative is,
which of the 464 haplotypes walk it, and the multiple alignment the graph and
the callset were both derived from.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, that is a current
limit rather than a settled design. We welcome your [feedback](/contact).

:::

## Prerequisites

- [part 1](/docs/tutorials/pangenome_hprc), whose session this page adds to:
  hg38 with its genes, and the rGFA segments track loaded on it
- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  for the tracks that use `MinigraphBubbleAdapter`, `RgfaTabixAdapter` and
  `GbzBaseSyntenyAdapter`; every other track here is a URL you can paste
- htslib (`bgzip`, `tabix`), to query the hosted indexes from the command line
  as the sections below do
- `bedtools`, for the repeat-density lanes
- UCSC's `bedGraphToBigWig`, for the repeat-density lanes
- UCSC's `bigBedToBed`, for the repeat-density lanes

Both UCSC binaries are
[single-binary downloads](https://hgdownload.soe.ucsc.edu/admin/exe/), and
`build_repeat_density.sh`'s header carries the curl line for each.

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose wave
callset, snarl-level carriage file and the alignment underneath both are read
straight off S3, beside T2T-CHM13 and the projections we host.

**The callsets and the alignment**

- the decomposed variant callset, 464 haplotypes, read straight off S3:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz
- the undecomposed, snarl-level carriage file, 462 haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz
- the multiple alignment the graph and the callset are both derived from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.0/hprc-v2.0-mc-grch38/hprc-v2.0-mc-grch38.full.taf.gz
- the release's all-vs-GRCh38 alignment, sliced for the CFHR and inversion
  synteny figures:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz

**T2T-CHM13 and the repeat lanes**

- the T2T-CHM13v2.0 reference (hs1), loaded as its own donor assembly:
  https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit
- hs1's RefSeq genes, rehosted: https://jbrowse.org/ucsc/hs1/hs1.gff.gz
- GRCh38's RepeatMasker annotation, binned for the repeat-density lanes:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/rmsk.txt.gz
- hs1's RepeatMasker annotation, the same lanes' other assembly:
  https://hgdownload.soe.ucsc.edu/gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb

**The graph as a walk database**

- release 2.1's Minigraph-Cactus graph as a gbz-base database, 10 GB, read by
  range request and never downloaded:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- the `.gbz` that database was built from, which is also what names its
  haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz
- our companion haplotype index for that database, which HPRC does not publish:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db

**The annotations and our projections**

- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- our own bubble, allele and repeat-density projections, with the exact build
  recorded beside them: https://jbrowse.org/demos/hprc/README.txt

## What part 1 leaves open

minigraph credits a segment to the first assembly that contributed it, so a node
names one haplotype however many carry the sequence, and a deletion, being an
edge, names none. Where the graph varies is its own published bubble file; what
the variation is, an inventory built from the same two indexes; and who carries
it, the release's callsets. Each is one more lane on the axis part 1 already has
open.

## The bubble track

A bubble is where haplotypes diverge and rejoin. The bubble track reports where
the graph varies and by how much, in one file:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_bubbles",
  "name": "HPRC release 2 bubbles",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz",
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

The segments track [part 1 loads](/docs/tutorials/pangenome_hprc#load-the-graph)
draws one node per **segment**, and a window past a few hundred kilobases is
more nodes than anything can lay out.

The bubble file is also a level of detail. Collapsing each bubble to a single
node, with the invariant reference between bubbles as backbone, turns the same
graph into something that fits on a screen. We host that tier beside the fine
index, built from the bubble file in one pass by
[`build_bubble_tier.sh`](/docs/tutorials/pangenome_prepare_graph#a-whole-chromosome-the-bubble-tier)
at a threshold of 10,000.

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
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.tier10000",
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
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz",
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

The lane above the curve is what this view is for. Every chr1 locus these two
pages open is in it (the amylase bubble, the 1q21.1 inversion, the
_CFHR3_/_CFHR1_ deletion), and the curve is high at each. None of them is the
tallest peak on the lane, and the tallest sits at a locus neither page opens.
Scanning here and expanding what stands out is the working order.

This is the coarse end of a ladder: a tier node is a bubble, so it says where
the graph varies and by how much, and nothing about the alleles inside it. The
node id is the bubble's own source segment, so the same span in the fine index
is the expanded view of it.

The two granularities are read together, the tier to find an event and the fine
index to open it, and the move between them is the node's own menu. On a tier
node **Open in hg38** puts the linear view on the bubble's span, and a drag
across that span offers **Graph genome view (this selection)** as a submenu
naming both tracks, since both can cut one. The fine cut arrives as a second
pane under the tier's: a graph pane keeps the window it was cut from while the
linear view moves on. The clip takes the tier over two megabases of the MHC,
where a bubble is tens of pixels wide; on a whole chromosome a bubble is
narrower than a pixel, so find it in the tier lane or the variability curve
first and cut the tier around it.

<Video src="/media/pangenome/hprc_tier_to_fine.mp4" caption="The bubble tier over the MHC taken down to segment resolution: the class II node hovered and opened in the linear view, the fine segments lane drawing once the view lands on its span, and a drag across that span cut from the fine index into a second graph pane." />

### Inversions

Insertions are nodes and deletions are edges; an inversion is the same reference
sequence, walked backwards. The bubble file is where it is findable.
`gfatools bubble` sets a column when a bubble's paths disagree about
orientation, and the adapter exposes it as an `inversion` boolean, so **Edit
filters** on the bubble track cuts the lane to them:

```
jexl:feature.inversion
```

The _AMY1_ bubble row printed in
[part 1](/docs/tutorials/pangenome_hprc#insertions-deletions-and-their-sizes)
carries a `1` in that column, which few bubbles do. Their breakpoints are in the
links index, stated as an orientation disagreement between two backbone
segments, which makes them readable without the graph:

- columns 4 and 5 name the two endpoints, each id ending in the `+` or `-` it is
  entered on
- columns 9 and 13 give their ranks

So the test is: both ends on the backbone, and the two signs disagree.

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.links.bed.gz \
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
from the two indexes
[part 1 loads](/docs/tutorials/pangenome_hprc#load-the-graph).

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "hprc_minigraph_alleles",
  "name": "HPRC release 2 graph: allele inventory",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.alleles.bed.gz"
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
haplotypes. The one event worth looking at over this window, the 84,684 bp
deletion between _CFHR3_ and _CFHR1_, is
[drawn on the same coordinates by the graph](/docs/tutorials/pangenome_hprc#insertions-deletions-and-their-sizes).

The whole graph holds a few hundred thousand alleles, about half of them
insertions, so a wide window is dense. The
[graph genome view guide](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
walks through the columns, how the walk derives them, and the two filters that
make a lane this size readable: `jexl:abs(feature.delta)>10000` for size and
`jexl:feature.nested==0` before reading lengths in bulk. `nested` is common on
this graph, and `build_rgfa_alleles.sh`'s closing summary prints how many rows
carry it.

`discoveryRank` and `firstSeenIn` carry the same
[attribution](/docs/tutorials/pangenome_hprc#from-a-node-back-to-a-coordinate)
the node panel does, on the allele rather than the segment. minigraph collapses,
so one haplotype can end up named on half the rows in a dense window purely by
build order, and a high rank does not mean the earlier haplotypes lacked the
sequence. Carriage is
[a different file](#carriage-at-the-graphs-own-granularity).

## The variant callset

The `wave.vcf.gz` ships its index beside it, so JBrowse reads only the slice you
are viewing out of the 2.3 GB file. The S3 URL is the whole of the adapter, on a
`VariantTrack` with the multi-sample display:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc2_wave_grch38",
  "name": "HPRC2 pangenome",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz"
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
also publishes the undecomposed form, one record per **snarl**, as the
`pgbi.vcf.gz` beside each build. Read it when the question is who carries a
given bubble: its rows and the graph's alleles are the same objects.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc2_pgbi_grch38",
  "name": "HPRC2 pangenome carriage (snarl-level, 462 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz"
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

```json addtrack
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
[multi-way synteny track](/docs/tutorials/multiway_synteny_grape_peach_cacao#each-genome-in-its-own-coordinates)
is the other reading. One lane per haplotype, each in that assembly's own contig
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

Each kept haplotype's slice then reduces to one plain BED of its gene rows,
keyed on the CAT `Name` that every assembly shares:

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# one plain BED per genome, from the gene rows of its own annotation
gzip -dc hprc_cfhr_HG00099.1.genes.gff3.gz \
  | awk -F'\t' -v OFS='\t' '$3=="gene" {
      match($9, /Name=[^;]*/)
      print $1, $4 - 1, $5, substr($9, RSTART+5, RLENGTH-5), 0, $7
    }' > hprc_cfhr_HG00099.1.bed
```

Joining those BEDs on that fourth column gives the table the track loads: one
row per GRCh38 gene in the window, one column per haplotype, `.` where an
annotation has no copy.

### Reading it

The session below opens the CFH cluster at chr1:196,640,000-196,900,000, one
lane per haplotype:

```json session config=https://jbrowse.org/demos/hprc/config.json
{
  "defaultSession": {
    "name": "CFH cluster, one lane per haplotype",
    "views": [
      {
        "type": "LinearGenomeView",
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
    ]
  }
}
```

`rowOrder` puts every non-carrier above every carrier, and that ordering is what
makes the deletion readable. A ribbon joins adjacent lanes and bridges past one
that places nothing for the group, down to the next lane that does, so a chain
stops only where no lane below it kept the gene. With every carrier at the
bottom, that is the first carrier lane.

<Figure caption="The CFH cluster on chr1 as one multi-way synteny track: hg38 genes over a lane per HPRC haplotype, each on its own contig and carrying its own CAT gene models. The CFHR3 and CFHR1 chains run through the non-carrier lanes and stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/pangenome/hprc_cfhr_lane_stack.png" />

Every lane sits at a different coordinate on a different contig, which is what
the headers say, and the flanking genes still line up down the stack because a
lane is fitted to the orthologs rather than projected onto GRCh38. The two
chains that stop are _CFHR3_ and _CFHR1_: the carriers' own annotations have
neither gene, so there is nothing in those lanes for a ribbon to reach.

The same eight lanes over 500 kb bring in more flanking genes, which are the
control on that reading.

<Figure caption="The complement factor H cluster on chr1 over 500 kb: hg38 genes over a lane per HPRC haplotype, the ones homozygous reference at the CFHR3/CFHR1 site above the ones homozygous for the deletion, each carrying its own CAT gene models on its own contig. The CFHR3 and CFHR1 chains stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/multiway_synteny/hprc_cfhr_lanes.png" />

## Every haplotype's walk, straight from the graph {#walks-from-the-graph}

The lanes above were assembled before the session opened: one slice of the
release's PAF per haplotype, one CAT annotation each, and a genotype step to
choose the eight. The graph states the same thing already. A `.gbz` holds one
walk per haplotype, and release 2.1 publishes that graph as a **gbz-base
database**, which is the graph in SQLite with its tables laid out so a window is
a handful of range requests rather than a 10 GB download.

Every graph-derived track on this page reads release **2.1**, so a segment id in
the rGFA tracks and a node id in this database are the same graph's; only the
alignment underneath, the TAF, is release 2.0, which
[the last section](#the-alignment-underneath-both) says why.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hprc_v2_1_gbz_lanes",
  "name": "HPRC release 2.1 haplotypes vs GRCh38, read from the graph (gbz-base)",
  "assemblyNames": [
    "hg38",
    "HG00097.1",
    "HG00099.1",
    "HG00128.1",
    "HG00133.1",
    "HG01109.1",
    "HG01123.1",
    "HG01960.1",
    "HG02055.1"
  ],
  "adapter": {
    "type": "GbzBaseSyntenyAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db",
    "haplotypeIndexLocation": {
      "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db"
    },
    "assemblyNames": [
      "hg38",
      "HG00097.1",
      "HG00099.1",
      "HG00128.1",
      "HG00133.1",
      "HG01109.1",
      "HG01123.1",
      "HG01960.1",
      "HG02055.1"
    ],
    "assemblyNameToPanSN": {
      "hg38": "GRCh38#0",
      "HG00097.1": "HG00097#1",
      "HG00099.1": "HG00099#1",
      "HG00128.1": "HG00128#1",
      "HG00133.1": "HG00133#1",
      "HG01109.1": "HG01109#1",
      "HG01123.1": "HG01123#1",
      "HG01960.1": "HG01960#1",
      "HG02055.1": "HG02055#1"
    },
    "context": 1000,
    "nodeLimit": 50000
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "hprc_v2_1_gbz_lanes-MultiWaySyntenyDisplay",
      "height": 600,
      "lanes": [
        "HG00097.1",
        "HG00099.1",
        "HG00128.1",
        "HG00133.1",
        "HG01109.1",
        "HG01123.1",
        "HG01960.1",
        "HG02055.1"
      ]
    }
  ]
}
```

The eight lanes are the same eight as above, listed twice: in `assemblyNames` so
each lane is the assembly the session already holds (its gene annotation follows
it), and in the display's `lanes` so the track opens on them rather than on
all 464. **Choose lanes...** on the track menu lists every haplotype the graph
names, grouped by sample, so any other set is a tick away, and **Every lane** is
the whole cohort. The figure's stack is pinned by the same `rowOrder` as the
gene-table session above; a track pasted from the fence opens densest-first.

<Figure caption="The CFH cluster's eight lanes read from the graph at load time, in the same lane order as the gene-table stack above, from two hosted files and no offline step. Each lane is one haplotype's walk aligned to hg38 as a CIGAR, and because the eight assemblies are in the session, each draws that haplotype's own CAT genes at its own coordinates over it." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

`GbzBaseSyntenyAdapter` answers a window rather than reading a file. It locates
the window on GRCh38's own path through the graph, reads the subgraph over it,
and emits one record per haplotype walk, in that haplotype's contig coordinates
and carrying the walk's CIGAR (a walk that leaves the window's nodes and comes
back is joined, the private stretch its insertion and the reference it skipped
its deletion), which is the record a
[multi-way synteny](#every-haplotype-in-its-own-coordinates) lane is drawn from.
The reader's test suite checks those CIGARs against upstream gbz-base's own
query output, and on the E. coli graph they were read against the offline
converter the [E. coli tutorial](/docs/tutorials/pangenome_ecoli)'s alignments
come from: at 1,552 reference points across ten windows, 1,544 put a haplotype
base at the same coordinate, and the eight that differ are one divergent block
the reader scores as an insertion then a deletion where the converter writes
mismatches. No aligner is in the loop here either, and no offline step at all:
the lanes are the graph's own walks.

`haplotypeIndexLocation` is what names them. Upstream gbz-base cannot say which
haplotype a walk belongs to and reports `unknown#1`, `unknown#2`, so a companion
file beside the database names them, and carries anchors along GRCh38 and CHM13
from which a named set of haplotypes can be walked without touching the rest,
which is the route `--keep` and the graph cut take. A lane track does not take
it: the window comes back whole, so the display's `lanes` chooses what is drawn
rather than what is fetched, and the timings below are the ones that apply. What
the file holds and how it is built is in the
[gbz-base README](https://github.com/GMOD/gbz-base-js#readme).

### What a window costs {#gbz-window-cost}

A window comes back as one record per haplotype walk through it, whatever
`context` is set to: `@gmod/gbz-base` joins the pieces of a walk that leaves the
window's nodes and comes back, so a private bubble becomes the record's
insertion and the reference it skipped the deletion. What `context` trades is
nodes read against pieces joined. The C4 window below is 8,083 pieces at
`context: 0` and 463 walks at 1000, for the same 463 records; MHC class II sits
inside a snarl far larger than the window, so it is 1.1 million pieces at 0 and
takes three times as long as at 1000. The default is 1000. These are all at
1000, contained snarls, `@gmod/gbz-base` 2.5.0, reading both files over HTTP,
the database from HPRC's bucket and the companion from ours, timed around the
whole command, two runs each on 2026-09-06 and the median:

| Locus        | Window                         | Nodes  | Records | Companion read | Time   |
| ------------ | ------------------------------ | ------ | ------- | -------------- | ------ |
| C4           | `chr6:31,980,000-31,990,000`   | 1,173  | 463     | 8 req, 0.5 MB  | 17.8 s |
| C4           | `chr6:31,950,000-32,010,000`   | 4,236  | 463     | 9 req, 0.6 MB  | 31.5 s |
| CFH cluster  | `chr1:196,640,000-196,900,000` | 16,372 | 465     | 17 req, 1.1 MB | 31.9 s |
| LPA KIV-2    | `chr6:160,525,000-160,655,000` | 27,438 | 464     | 14 req, 0.9 MB | 33.8 s |
| MHC class II | `chr6:32,510,000-32,600,000`   | 43,540 | 463     | 11 req, 0.7 MB | 31.7 s |
| AMY1         | `chr1:103,690,000-103,780,000` | 12,240 | 1,395   | 24 req, 1.5 MB | 30.3 s |

Every record is named in all six, and the companion is barely touched, a
megabyte and a half at most out of its 7.9 GB. The first five are one record per
haplotype. The times are set by the network the command was timed from rather
than by the window: on the day of this table one 64 kB range request to the
bucket took 0.4-0.8 s, every window came back in about half a minute whatever
its node count, and 2.3.0 timed the same as 2.5.0 on the same connection (15.0
and 15.4 s against 14.9 and 15.4 s at the small C4 window), so the 5-13 s an
earlier run of this table showed were that day's network and not a reader that
has since slowed. A chosen set takes a different route: with `--keep`, the
tutorial's eight at KIV-2 are walked from the anchor before the window, 9
companion requests and 3 s on a fresh open against 3.8 s for all 464, and 0.4 s
cached; the four tutorial windows measured both ways are in the gbz-base README.

_AMY1_ is the row with more records than haplotypes, and it is the locus a
copy-number question would start from. The amylase repeat sends each haplotype
out of the window's nodes and back, so 490 haplotype walks arrive as 1,912
pieces; the pieces of one walk that follow each other along the reference are
joined, and the ones that do not, because an extra copy of the repeat unit
revisits the same stretch of GRCh38, stay separate. That is 1,395 records, and
those extra records, the ones whose reference interval falls on the repeat unit,
are where a copy count per haplotype would be read off the graph. Naming those
pieces is also the one place the companion is walked rather than looked up: a
piece shorter than the 16 kb it samples at holds no recorded position and is
walked to one, 78,506 steps here against zero at every other locus, and since
`@gmod/gbz-base` 2.3.0 that costs 24 requests rather than the 5,202 it did when
the index was scanned across the gaps between the repeat's node-id clusters.

`context` is also the wrong repair for a window like _AMY1_. `context` 20000 and
`overlapping` snarls each pull in enough of the repeat to exhaust a 4 GB heap
after about a minute, so the window that most wants a wider read is the one that
cannot afford it; the contained cut at 1000 is what the table shows.

`nodeLimit` is the guard on the other end. It fails a window rather than letting
the display sit on a whole chromosome, and the failure names a zoom that would
fit, so it has to clear the largest window you mean to open: 12,000 is enough
for C4 and refuses MHC class II. It bounds nodes, not time, and _AMY1_'s 12,240
nodes are under any limit that lets the other loci through.

### The graph view from the GBZ, for a chosen set {#gbz-graph-cut}

The same track feeds the graph view: **Launch → Graph genome view (this
region)** on a GBZ lane track cuts the window from the database, and the cut
carries one W line per haplotype walk, named through the companion. That is what
the rGFA cut cannot say: an rGFA segment names the one assembly that contributed
it, a GBZ cut says which haplotypes walk every node. A cut for every haplotype
names all 464 walks, 21,721 base-level nodes at KIV-2 and 12 s against the two
hosted files, for a Sample rows layout of 232 donors; a cut for the track's
chosen lanes walks only those from the anchor.

For a figure of a chosen set, cut once and load the file. `gbz-base-query`, the
reader's command line, takes `--keep` for each haplotype and writes the
reference walk, the kept walks and only the nodes those walks visit:

```bash
npx -p @gmod/gbz-base gbz-base-query \
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db \
  --haplotype-index https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db \
  --sample GRCh38 --contig chr6 --interval 160616002..160646753 \
  --context 1000 --snarls --format gfa \
  --keep HG00097#1 --keep HG00099#1 --keep HG00128#1 --keep HG00133#1 \
  --keep HG01109#1 --keep HG01123#1 --keep HG01960#1 --keep HG02055#1 \
  > hprc-v2.1-mc-grch38.kiv2.eight-haplotypes.gfa
```

That is the KIV-2 bubble for the eight, 3,140 nodes in 350 kB after 6 s, each
haplotype's walk in the pieces that stay inside the window, and the graph view
opens it as a file (**Add → Graph genome view**, then the file's URL in the load
form, or a session with `gfaLocation`), in Sample rows with `GRCh38` as the
reference path:

<Figure caption="The KIV-2 array cut from the GBZ for the eight haplotypes, in Sample rows over the same window as the rGFA segments lane. Each row is a haplotype of the eight; an allele is drawn in the row of the first of them to walk it, so a row holds what that haplotype is the first to carry, and the hover on any node lists every haplotype that walks it." src="/img/pangenome/hprc_kiv2_gbz_walks.png" />

One step short of carriage, and said plainly: the layout places each node once,
so an allele two of the eight share is drawn in the earlier row only. A layout
that draws a node in every row that walks it is what would turn this into the
carriage figure, and it is the graph view's next change on this route.

### Preparing a graph of your own {#preparing-a-gbz-base-database}

HPRC publishes the database this track reads, so nothing above builds one. For a
`.gbz` of your own, three commands stand between it and the same track, none of
them JBrowse: `vg chains` for the snarl decomposition, `gbz-base construct` for
the database, and `gbz-haplotype-index` for the companion that names the walks.
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database)
shows all three, and the same page builds every other file this one reads.

The companion HPRC does not publish is the one exception, and it has a script of
its own under [Reproduce it end to end](#reproduce-it-end-to-end).

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
  [attribution and the other carriage](/docs/tutorials/pangenome_hprc#from-a-node-back-to-a-coordinate),
  so a donor can appear on one haplotype in the graph and carry the same event
  on the other in the callset
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

<Figure caption="One window, both products. The band is one deletion site from the callset, 12 kb of HLA-DRB5 that 46 haplotypes replace with 1.8 kb, and the matrix below it, all 464 haplotypes clustered by genotype, colors the haplotypes carrying it. The force graph has no coordinate axis, so an arrow runs from the band to the 1.8 kb allele, which is the same deletion as the graph draws it." src="/img/pangenome/hprc_graph_vs_callset.png" />

## T2T-CHM13 as hs1 {#the-one-donor-worth-loading}

CHM13 is the contributor with a published reference behind it, T2T-CHM13v2.0,
which UCSC serves as `hs1` with RefSeq genes and RepeatMasker, so it loads from
that host rather than from GenArk; [](/docs/tutorials/hg002_haplotypes) loads
HG002, the other donor with a reference of its own. Its coordinates are that
assembly's: CHM13 segments on chr17 run past the end of GRCh38's chr17 and
inside hs1's.

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
[part 1 loads](/docs/tutorials/pangenome_hprc#load-the-graph), same `trackId`,
one more assembly:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38", "hs1"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38",
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

Read that lane for what the sequence is made of rather than for how much repeat
is in it. The elements are old L1 subfamilies, long past copying themselves, and
the CHM13 sequence either side of the node is made of the same thing. A
subtelomere built out of decayed L1 is the kind of sequence a BAC-and-Sanger
reference had no way to place, which is the answer to why GRCh38 ends where it
does here.

<Figure caption="A donor node on both coordinate systems: the GRCh38 window, the graph cut from it, then that node on hs1's own chr17 tiled by long L1 elements in red." src="/img/pangenome/hprc_chm13_allele.png" />

CHM13 entered this graph late, after most of the other haplotypes, so little is
credited to it: `tabix hprc-v2.1-mc-grch38.segs.bed.gz 'CHM13#0#chr1'` returns a
short list for the whole of chr1, most of it attaching only to other donors.
Finding one that touches GRCh38, like the node above, means scanning the links
index for CHM13 rows with a GRCh38 endpoint:

```bash
tabix https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.links.bed.gz \
  'CHM13#0#chr17' |
  awk -F'\t' '$6 ~ /^GRCh38/ || $10 ~ /^GRCh38/'
```

With two assemblies loaded the graph's own **Launch** menu offers **Linear
synteny view** as well, one panel per contributor at the locus each contributes
here, if the session holds a synteny track aligning them. UCSC's hg38-to-hs1
liftOver is one, rehosted as an indexed PAF:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hg38_hs1_synteny",
  "name": "hg38 vs T2T-CHM13 (UCSC liftOver)",
  "assemblyNames": ["hg38", "hs1"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz",
    "csi": true,
    "assemblyNames": ["hs1", "hg38"]
  }
}
```

Taken at the window above, it opens hg38 over hs1, each panel already at the
interval the graph states for it, with the liftOver ribbons between them.
Without such a track the entry stays, greyed out, and its tooltip says what is
missing. The launch opens every loaded contributor, so a session carrying
several haplotypes opens a panel for each one with a node in the window, whether
or not the track aligns it.

<Figure caption="The graph's own Launch menu at the CHM13 window, with hg38 and hs1 loaded and the liftOver between them in the session. Above, the hg38 window and the cut, the CHM13 node ringed. Below, the synteny view the Linear synteny view entry opened: hg38 over hs1, each panel framed on the locus the graph states for it, with the liftOver ribbons between." src="/img/pangenome/hprc_synteny_launch.png" />

## What kind of sequence GRCh38 was missing

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

That comparison is between two whole chromosome ends, which is why it holds. A
single interval is harder. Rank the insertion allele from
[the donor-node figure](#the-one-donor-worth-loading) against windows of its own
size and where it lands moves with the windows you rank it against, which is why
`build_repeat_density.sh` reports several scopes rather than one. Read these
lanes for which class changed, not for how much of it there is.

## Reproduce it end to end

Every graph-derived file this page reads is built by
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph), which runs
the same commands on any rGFA: the [bubble file](#the-bubble-track) and its
[coarse tier](#a-whole-chromosome-as-a-graph), the
[allele inventory](#the-allele-inventory), and the companion index behind the
[haplotype-walk lanes](#walks-from-the-graph). Point it at
`hprc-v2.1-mc-grch38.sv.gfa.gz` and it writes what we host. Their provenance
(source, size, exact commands, build date) is in
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them.

Carriage is not rebuilt at all here: it is
[a published file](#carriage-at-the-graphs-own-granularity), tabix-indexed like
the callset. The route that rebuilds it,
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh),
costs a 464-assembly download and a mapping run, and
[the same page](/docs/tutorials/pangenome_prepare_graph#who-carries-what) shows
the one call it makes per sample.

The figures are what is left, and three of them have a script of their own, with
the tools listed under [Prerequisites](#prerequisites). The
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

The [haplotype-walk lanes](#walks-from-the-graph) need one file HPRC does not
publish, the companion index that names the walks in its gbz-base database:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_gbz_index.sh
bash build_hprc_gbz_index.sh out
```

It downloads the 5.5 GB `.gbz`, builds `gbz-haplotype-index` from source and
runs the one command
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph#every-haplotypes-walk-a-gbz-base-database)
shows, which takes about a quarter of an hour on 24 cores. The database it
accompanies is read straight from HPRC's bucket and never downloaded.

The other two both read release 2's published all-vs-GRCh38 PAF:

```bash
BASE=https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts
curl -fO $BASE/build_hprc_cfhr_synteny.sh
curl -fO $BASE/build_hprc_inversion_synteny.sh
bash build_hprc_cfhr_synteny.sh       # writes ./hprc_cfhr_synteny_build/
bash build_hprc_inversion_synteny.sh  # writes ./hprc_inversion_synteny_build/
```

[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
picks four carriers and four non-carriers of the deletion out of the callset
(`CARRIERS` and `NONCARRIERS`), slices their alignments out of that PAF, and
slices each haplotype's CAT annotation to the same window.
[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
runs the [inversion classification](#inversions) over the same PAF and prints
the split it finds before slicing out one haplotype of each kind.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/hprc_multiway_synteny)
- [](/docs/tutorials/pangenome_prepare_graph)
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
  [gfatools](https://github.com/lh3/gfatools), whose `bubble` subcommand calls
  the bubbles this page reads.
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which writes the
  `.tai` index that makes the 5.9 GB alignment addressable by locus.
