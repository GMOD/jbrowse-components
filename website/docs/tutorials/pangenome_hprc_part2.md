---
title: Pangenome (HPRC) part 2, who carries what
sidebar_label: Pangenome (HPRC, part 2)
description:
  Where HPRC release 2's graph varies and by how much, what each alternative is,
  and which of the 464 haplotypes carry it
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: hosted
---

**TL;DR:** [part 1](/docs/tutorials/pangenome_hprc) ends holding one allele and
the single haplotype the graph credits it to, which is not the same as everyone
who carries it. This page reads that off the rest of HPRC release 2 on the same
GRCh38 axis: where the graph varies and by how much, what each alternative is,
and which of the 464 haplotypes walk it. Every track here is a URL, read a
window at a time.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas.
Where a step below says the view works a particular way today, that is a current
limit rather than a settled design. We welcome your [feedback](/contact).

:::

## Prerequisites

- [part 1](/docs/tutorials/pangenome_hprc), whose session this page adds to:
  hg38 with its genes, and the rGFA segments track loaded on it
- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  for the tracks that use `MinigraphBubbleAdapter` and `RgfaTabixAdapter`; both
  callsets are a URL you can paste and need no plugin
- htslib (`bgzip`, `tabix`), to query the hosted indexes from the command line
  as the sections below do

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose wave callset
and snarl-level carriage file are read straight off S3, beside the bubble and
allele projections we host.

- the decomposed variant callset, 464 haplotypes, read straight off S3:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz
- the undecomposed, snarl-level carriage file, 462 haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz
- the release's all-vs-GRCh38 alignment, sliced for the inversion synteny
  figure:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz
- the CAT gene annotation index, one GFF3 per haplotype, which the inversion
  figure's lanes carry:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- our own bubble and allele projections, with the exact build recorded beside
  them: https://jbrowse.org/demos/hprc/README.txt

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

## A whole chromosome as a graph

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

## Inversions

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
links index, as a pair of backbone segments entered in opposite orientations,
which makes them readable without the graph:

- columns 4 and 5 name the two endpoints, each id ending in the `+` or `-` it is
  entered on
- columns 9 and 13 give their ranks

A breakpoint link has rank 0 at both ends, one ending in `+` and the other in
`-`.

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
rest small indels. The structural tier is already in this file. Add this filter
from **Edit filters**:

```
jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50
```

The same window then drops to a couple of hundred sites.

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
draws a dendrogram beside them. That matrix is what
[Comparing the graph with the callset](#comparing-the-graph-with-the-callset)
puts beside the graph the same alleles came out of.

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

## What part 3 adds

Everything so far is drawn on GRCh38's axis, which is what makes 464 haplotypes
comparable in one lane and what leaves each assembly's own coordinates out of
the picture. [Part 3](/docs/tutorials/pangenome_hprc_part3) takes them off that
axis: the alignment all three pages rest on, then each haplotype on its own
contigs, and then a donor with a published reference of its own.

## Reproduce it end to end

The bubble file, its [coarse tier](#a-whole-chromosome-as-a-graph) and the
[allele inventory](#the-allele-inventory) are built by
[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph), which runs
the same commands on any rGFA. Point it at `hprc-v2.1-mc-grch38.sv.gfa.gz` and
it writes what we host. Their provenance (source, size, exact commands, build
date) is in [README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them.

Carriage is not rebuilt at all here: it is
[a published file](#carriage-at-the-graphs-own-granularity), tabix-indexed like
the callset. Rebuilding it costs a 464-assembly download and a mapping run, and
this is the one call that run makes per sample:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call asks, at every bubble, which path this assembly takes through the graph
minigraph -cxasm --call -t"$(nproc)" graph.gfa assembly.fa > sample.call.bed
```

[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
wraps that in the per-sample loop and the join, and
[the same page](/docs/tutorials/pangenome_prepare_graph#who-carries-what) walks
it.

The [inversion figure](#inversions) has a script of its own, which reads release
2's published all-vs-GRCh38 PAF:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_inversion_synteny.sh
bash build_hprc_inversion_synteny.sh  # writes ./hprc_inversion_synteny_build/
```

[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
runs the [inversion classification](#inversions) over that PAF and prints the
split it finds before slicing out one haplotype of each kind.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/multivariant_track)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph and the two callsets deconstructed from
  it.
- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), whose `bubble` subcommand calls
  the bubbles this page reads.
