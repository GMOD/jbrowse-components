---
title: Pangenome (HPRC) part 2, who carries what
sidebar_label: Pangenome (HPRC 2, who carries what)
description:
  Where HPRC release 2's graph varies and by how much, what each alternative is,
  and which of the 464 haplotypes carry it
guide_category: Tutorials
tutorial_category: Pangenomes
---

[Part 1](/docs/tutorials/pangenome_hprc) ends with one allele and the single
haplotype the graph records as contributing it. Here we use the rest of HPRC
release 2 to find everyone who carries that sequence, on the same GRCh38 axis.
Four tracks go in, one at a time, each answering one question about the window
part 1 left open: where the graph varies and by how much, what each alternative
is, and which of the 464 haplotypes walk it. Every track is a URL that JBrowse
reads a window at a time.

## Prerequisites

- the session from [part 1](/docs/tutorials/pangenome_hprc): hg38 with its
  genes, the rGFA segments track loaded on it, and the band that **Highlight in
  hg38** left across _HLA-DRB5_
- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  for the tracks that use `MinigraphBubbleAdapter` and `RgfaTabixAdapter`; both
  callsets are a URL you can paste and need no plugin

## Where the data comes from

The data is [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710).
JBrowse reads its wave callset and snarl-level carriage file directly from S3,
and reads the bubble and allele projections from our host.

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
- our bubble and allele projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt

## The route

Part 1's band marks 12 kb of GRCh38 that one haplotype replaces with 1.8 kb of
its own. The route below reads that same band against the rest of the release,
one lane at a time, then steps back to a whole chromosome and forward to the one
kind of variation the graph draws as neither node nor edge:

1. [Add the bubble track](#the-bubble-track) and read the bubble under the band.
2. [Add the bubble tier and the variability curve](#a-whole-chromosome-as-a-graph),
   draw a whole chromosome, and come back down to the fine cut.
3. [Add the allele inventory](#the-allele-inventory) and read the band's
   alternatives as sized rows.
4. [Add the callset](#the-variant-callset), filter it to structural sites,
   cluster the 464 haplotypes and read who carries the band's allele.
5. [Add the snarl-level file](#carriage-at-the-graphs-own-granularity) for
   carriage at the graph's own resolution.
6. [Put the graph and the callset side by side](#comparing-the-graph-with-the-callset)
   on the band.
7. [Filter the bubbles to inversions](#inversions) and see one as an alignment.

Every step opens on `chr6:32,510,000-32,600,000`, the MHC class II window with
the band inside it, unless it says otherwise.

## The bubble track

A bubble is a place where haplotypes diverge and rejoin. The bubble track reads
one file and reports where the graph varies and by how much:

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

With the track showing on the MHC class II window, the lane draws one block per
bubble, and the widest block covers the band and a good deal more. Hover it.
`MinigraphBubbleAdapter` labels each bubble with its shortest and longest
allele, and this one spans tens of kilobases depending on the
haplotype.[^path-count] HPRC publishes no bubble file, so we built this one too,
with `gfatools bubble`.

## A whole chromosome, one node per bubble {#a-whole-chromosome-as-a-graph}

The segments track
[part 1 loads](/docs/tutorials/pangenome_hprc#add-the-graph-track) draws one
node per **segment**. A window past a few hundred kilobases holds more nodes
than any layout can place.

The bubble file also gives a coarser level of detail. We collapse each bubble to
a single node and keep the invariant reference between bubbles as backbone, and
the same graph then fits on a screen. We host that tier beside the fine index.
[`build_bubble_tier.sh`](/docs/tutorials/pangenome_prepare_graph#a-whole-chromosome-the-bubble-tier)
builds it from the bubble file in one pass, at a threshold of 10,000. A tier is
a prefix, so you choose a level of detail by choosing a file:

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

The same bubble file also plots as a curve of where the graph varies and by how
much. `MinigraphBubbleAdapter` already reports each bubble's segment count as
its `score`, so only the track type changes:

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

With both showing, type `chr1` into the location box. The fine segments lane
goes blank at that width, and these two lanes carry the chromosome instead: the
curve shows where the graph varies, and the tier lane places each bubble as one
block.

<Figure caption="All 249 Mb of GRCh38 chr1 with the cytogenetic bands on the same axis, then the three chr1 loci this page opens, then two lanes from two files. The bubble file draws as a blue curve of segments per bubble, which measures how much the haplotypes disagree at each locus. The tier's segments lane draws the same bubbles, one gold block per bubble. The blank column is 1q12, where nothing aligns." src="/img/pangenome/hprc_whole_chromosome.png" />

Use the two granularities together: the tier to find an event, and the fine
index to open it. Type `chr6:31,500,001-33,500,000`, the whole MHC, and cut it
from the tier track's menu with **Launch → Graph genome view (this region)**.
One node per bubble draws the two megabases. Hover the widest node in the middle
for its span, and right-click it for **Open in hg38**, which puts the linear
view on that bubble. Drag across the band of the ruler the bubble now fills and
choose **Graph genome view (this selection)**; the submenu names both graph
tracks, and the fine cut opens as a second pane under the tier's. On a whole
chromosome a bubble is narrower than a pixel, so find it in the tier lane or the
variability curve first and cut the tier around it.[^max-region-bp]

<Video src="/media/pangenome/hprc_tier_to_fine.mp4" caption="The bubble tier over the MHC taken down to segment resolution: the class II node hovered and opened in the linear view, the fine segments lane drawing once the view lands on its span, and a drag across that span cut from the fine index into a second graph pane." />

## The allele inventory

The bubbles report where the graph varies. A third hosted file reports what the
variation is. It has one row per allele in the graph, anchored on GRCh38, and we
derived it from the two indexes
[part 1 loads](/docs/tutorials/pangenome_hprc#add-the-graph-track).

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

Back on `chr6:32,510,000-32,600,000`, the lane packs the window's alleles into
rows. An `AlignmentsTrack` over a BED draws the allele sizes: each row carries a
`CIGAR` against the reference span it replaces (`2062M63348I`), the alignments
display draws any row that has a CIGAR, and each insertion draws at its real
magnitude. Under the band, one row is part 1's allele, 1.8 kb standing in for 12
kb. At the CFH cluster on chr1, `chr1:196,700,000-196,900,000`, one of those
rows is the 84,684 bp deletion between _CFHR3_ and _CFHR1_, which part 1
[draws on the same coordinates as a graph edge](/docs/tutorials/pangenome_hprc#other-windows-to-cut).

The whole graph holds a few hundred thousand alleles, so a wide window is dense.
The
[graph genome view guide](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
explains the columns and how the walk derives them. It also gives two filters
that make a lane this size readable: `jexl:abs(feature.delta)>10000` for size,
and `jexl:feature.nested==0` before reading lengths in bulk.

## The variant callset

The `wave.vcf.gz` ships its index beside it, so JBrowse reads only the slice you
are viewing out of the 2.3 GB file. The adapter needs only the S3 URL, on a
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

`renderingMode: "phased"` splits each phased sample column into its two
haplotypes, drawing one row per haplotype. Co-inherited blocks are visible only
in that form.

On the MHC class II window the lane draws as a wall. The VCF is fully
decomposed, so this window holds over fourteen thousand records, most of them
SNPs and the rest small indels. This file already contains the structural tier.
Open the track menu, choose **Edit filters**, and enter:

```
jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50
```

The same window then drops to a couple of hundred sites, and one column sits
under the band.

The filter needs both halves:

- `alleleLength` is the longest allele the record describes. A filter on
  `end - start` would keep only deletions, since an insertion consumes no
  reference.
- `LV` is the record's level in vg's snarl tree, and `LV==0` keeps the top-level
  sites. This file writes a nested child as a separate record beside its parent,
  with `PS` naming that parent. Without `LV==0` the panel paints some events
  twice, at two positions.

With the filter on, few enough alleles remain to draw each at its genomic
position, lined up with the genes above. Now open the track menu again and take
**Clustering → Cluster rows by genotype...**, then **Run clustering**. The rows
reorder by genotype similarity with a dendrogram beside them, and the haplotypes
that carry the band's allele gather into one block.

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="The 464-haplotype lane clustered from the track menu: Clustering, Cluster rows by genotype, Run clustering, and the rows arriving in their new order with a dendrogram beside them." />

Frequency is in the file. `AC`, `AF`, `AN` and `NS` are on every record, so
`jexl:feature.INFO.AF[0]>0.05` in the same filter box selects the common alleles
without clustering anything.

The display widens each insertion cell to a marker sized by the inserted bp, in
that haplotype's genotype color
([`showInsertionGlyphs`](/docs/config/linearmultisamplevariantdisplay/#slot-showinsertionglyphs)).
Only haplotypes carrying the allele widen.

## Carriage at the graph's own granularity

The callset above is decomposed, so one graph bubble becomes many records, and a
column is a primitive variant. Release 2 also publishes the undecomposed form,
one record per **snarl**, as the `pgbi.vcf.gz` beside each build. Read that file
to find who carries a given bubble, because its rows are the graph's alleles.

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
    {
      "type": "LinearMultiSampleVariantDisplay",
      "renderingMode": "phased"
    }
  ]
}
```

The snarl file ships with an index, so JBrowse downloads only the slice in view,
and the MHC class II window loads in a couple of seconds over HTTP. The file
carries 231 sample columns, without CHM13, so phased mode draws 462 rows and
`AN` tops out at 462 too. Apply the [same `LV==0` filter](#the-variant-callset)
from **Edit filters** and the lane cuts to top-level sites, the tier that the
[bubble track](#the-bubble-track) holds. A record matches a bubble by
interval,[^integer-nodes] and the record under the band is the bubble the bubble
lane drew there.

This file adds the `AT` field, which records each allele as the **traversal** it
takes through the graph. A pggb VCF carries the same `AT` field. The wave file
drops it, and its header shows the `bcftools annotate -x INFO/AT` command that
did so. Click the record under the band and its details list `AT` with the rest
of `INFO`.

With this lane loaded, two compatible readings sit over one coordinate. The
[allele inventory](#the-allele-inventory) gives the haplotype the graph records
as contributing an allele. A genotype column here gives the haplotypes that walk
the allele.

## Comparing the graph with the callset

The graph and the callset describe the same variation at two resolutions.
minigraph records structural variation (roughly >50 bp) and collapses everything
smaller, so SNPs are absent from the graph even though every one is in the VCF.
Filter the callset to that same tier, and the two describe the same events from
opposite ends. The graph records an allele and its length, and collapsing the
smaller variation makes the allele easy to find. The callset kept the samples,
so it records who carries each allele.

Leave the genes, the segments lane and the filtered, clustered callset in the
view, hide the other lanes from their track menus, and cut
`chr6:32,510,000-32,600,000` from the segments track with **Launch → Graph
genome view (this region)**. The band crosses the genes, the segments lane and
the genotype matrix in one column, and in the graph pane below the
reference-position ramp gives the backbone at that position the same hue as the
segments above it. The allele that column's carriers walk is the charcoal node
beside that stretch of backbone, the one part 1 rang.

<Figure caption="One window, both products. The band is one deletion site from the callset, the stretch of HLA-DRB5 that many haplotypes replace with a shorter sequence. The matrix below it is every haplotype clustered by genotype, one row each, grey where a haplotype matches the reference, teal where it carries the alt allele, magenta where it carries another alt and tan for a no call; an insertion is the cell widened to the inserted length with that bp count inside, and the variant lane above the rows is teal. The force graph beneath has no coordinate axis, so an arrow runs from the band to the allele, which is the same deletion as the graph draws it: nodes colored by reference position, alleles charcoal, each lavender halo one bubble with its kind in the purple label." src="/img/pangenome/hprc_graph_vs_callset.png" />

## Inversions

Insertions are nodes and deletions are edges. An inversion is the same reference
sequence, walked backwards. `gfatools bubble` sets a column when a bubble's
paths disagree about orientation, and the adapter exposes that column as an
`inversion` boolean. Open the bubble track's menu, choose **Edit filters**, and
enter:

```
jexl:feature.inversion
```

Type `chr1:144,260,000-144,610,000`, the 1q21.1 locus. The lane holds one block
there, a bubble whose paths disagree about orientation, and clicking it opens
the flag in its details. The flag marks that the paths disagree, and cannot
distinguish a polymorphic inversion from an inverted paralog inside a segmental
duplication. The graph cut from the bubble draws its breakpoints as two deletion
arcs, because the view's edges carry no orientation. The alignments settle it.

The figure below is the same bubble as an alignment, and it takes one build
script to make, because nothing in the session so far carries the haplotypes'
own sequence.
[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
under [Reproduce it end to end](#reproduce-it-end-to-end) classifies every
haplotype at the bubble from HPRC's published all-vs-GRCh38 PAF and slices out
one carrier and one non-carrier, each with its CAT annotation. Loading what it
writes is one assembly, one synteny track and one gene track per haplotype, the
shape [Synteny from a pangenome graph](/docs/tutorials/hprc_multiway_synteny)
builds. The boxed pair on each row is the same two genes, _PPIAL4F_ and
_PPIAL4E_. On the carrier _PPIAL4F_ comes first, and on the non-carrier
_PPIAL4E_ does. The hg38 row between them agrees with the non-carrier.

<Figure caption="The 1q21.1 bubble the graph flags as an inversion, drawn as alignments. The pink ribbons are each haplotype's alignment to hg38, and a ribbon that crosses itself is an inversion. Between the two haplotype rows are the RefSeq genes, the bubble lane cut to inversion-flagged bubbles, and the rGFA segments colored by reference position. The boxed pair on each row is PPIAL4F and PPIAL4E, in opposite orders on the two haplotypes." src="/img/pangenome/hprc_inversion.png" />

## Reproduce it end to end

[Preparing your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
bubble file, its [coarse tier](#a-whole-chromosome-as-a-graph) and the
[allele inventory](#the-allele-inventory), and its commands run on any rGFA.
Pointed at `hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host.
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside those files
records their provenance: source, size, exact commands and build date.

We do not rebuild carriage here, because HPRC publishes it as
[a file](#carriage-at-the-graphs-own-granularity), tabix-indexed like the
callset. Rebuilding it takes a 464-assembly download and a mapping run. The run
makes this one call per sample:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call asks, at every bubble, which path this assembly takes through the graph
minigraph -cxasm --call -t"$(nproc)" graph.gfa assembly.fa > sample.call.bed
```

[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
wraps that call in the per-sample loop and the join, and
[the same page](/docs/tutorials/pangenome_prepare_graph#who-carries-what) walks
through the script.

A separate script builds the [inversion figure](#inversions) from release 2's
published all-vs-GRCh38 PAF:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_inversion_synteny.sh
bash build_hprc_inversion_synteny.sh  # writes ./hprc_inversion_synteny_build/
```

[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
classifies each haplotype at that bubble. It keeps the haplotypes whose
alignments reverse the block while the sequence on either side stays forward. It
prints the split it finds, then slices out one haplotype of each kind: the
alignment, the contig length and the CAT genes for each.

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

[^path-count]:
    Each bubble's description also carries a path count, which counts the routes
    through the bubble and not the haplotypes observed. gfatools saturates the
    count at `2147483647`, and the track describes those bubbles as having more
    paths than gfatools counts.

[^max-region-bp]:
    The view refuses a cut over 5 Mb. That width limit stands in for node count,
    which works at segment granularity and fails on a tier. A `GraphGenomeView`
    pointed at a tier therefore raises **`maxRegionBp`** to the span it draws.
    The node limit still applies: `maxGraphNodes` counts the nodes that actually
    came back.

[^integer-nodes]:
    `ID` and `AT` name base-level integer nodes (`>161001867>161004536`), where
    `sv.gfa` uses `sNNNNN` segment ids.
