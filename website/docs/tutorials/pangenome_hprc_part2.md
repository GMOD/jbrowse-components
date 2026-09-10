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
the single haplotype the graph credits it to. This page reads everyone who
carries that sequence off the rest of HPRC release 2, on the same GRCh38 axis:
where the graph varies and by how much, what each alternative is, and which of
the 464 haplotypes walk it. Every track here is a URL, read a window at a time.

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
at a threshold of 10,000. A tier is a prefix, so choosing a level of detail is
choosing a file:

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

The view refuses a cut over 5 Mb, a proxy for node count that holds at segment
granularity and breaks on a tier, so a `GraphGenomeView` pointed at one carries
**`maxRegionBp`** raised to the span it is drawing, which the figure below links
a session for. The real ceiling is unchanged: `maxGraphNodes` counts what
actually came back.

The same bubble file also plots as a curve of where the graph varies and by how
much. `MinigraphBubbleAdapter` already reports each bubble's segment count as
its `score`, so the only change is the track type:

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

The two granularities are read together, the tier to find an event and the fine
index to open it, and the move between them is the node's own menu. On a tier
node **Open in hg38** puts the linear view on the bubble's span, and a drag
across that span offers **Graph genome view (this selection)** as a submenu
naming both tracks. The fine cut arrives as a second pane under the tier's. On a
whole chromosome a bubble is narrower than a pixel, so find it in the tier lane
or the variability curve first and cut the tier around it.

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
each insertion draws at its real magnitude. The rows are that packing, and one
event over this window, the 84,684 bp deletion between _CFHR3_ and _CFHR1_, is
[drawn on the same coordinates by the graph](/docs/tutorials/pangenome_hprc#insertions-deletions-and-their-sizes).

The whole graph holds a few hundred thousand alleles, so a wide window is dense.
The
[graph genome view guide](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
walks through the columns, how the walk derives them, and the two filters that
make a lane this size readable: `jexl:abs(feature.delta)>10000` for size and
`jexl:feature.nested==0` before reading lengths in bulk.

## Inversions

Insertions are nodes and deletions are edges; an inversion is the same reference
sequence, walked backwards. `gfatools bubble` sets a column when a bubble's
paths disagree about orientation, and the adapter exposes it as an `inversion`
boolean, so **Edit filters** on the bubble track cuts the lane to them:

```
jexl:feature.inversion
```

[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
takes the 1q21.1 bubble down to two haplotype rows, one carrying the inversion
and one not, out of HPRC's published all-vs-GRCh38 PAF. Each row carries its own
CAT gene annotation, and the pair boxed on each is the same two genes, _PPIAL4F_
and _PPIAL4E_: on the carrier _PPIAL4F_ comes first, on the non-carrier
_PPIAL4E_ does, and the hg38 row between them agrees with the non-carrier.

<Figure caption="The 1q21.1 bubble the graph flags as an inversion, drawn as alignments. Between the two haplotype rows are the RefSeq genes, the bubble lane cut to inversion-flagged bubbles, and the rGFA segments. The boxed pair on each row is PPIAL4F and PPIAL4E." src="/img/pangenome/hprc_inversion.png" />

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

`renderingMode: "phased"` splits each phased sample column into its two
haplotypes, drawing one row per haplotype. Co-inherited blocks are visible only
in that form.

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

Frequency is in the file. `AC`, `AF`, `AN` and `NS` are on every record, so
`jexl:feature.INFO.AF[0]>0.05` selects the common alleles without clustering
anything.

The display widens each insertion cell to a marker sized by the inserted bp, in
that haplotype's own genotype color
([`showInsertionGlyphs`](/docs/config/linearmultisamplevariantdisplay/#slot-showinsertionglyphs)),
since an insertion consumes no reference. Only haplotypes carrying the allele
widen.

That leaves few enough alleles to draw each at its own genomic position, lined
up with the genes above. **Clustering → Cluster rows by genotype... → Run
clustering** in the track menu reorders the rows by genotype similarity and
draws a dendrogram beside them. That matrix is what
[Comparing the graph with the callset](#comparing-the-graph-with-the-callset)
puts beside the graph the same alleles came out of.

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="The 464-haplotype lane clustered from the track menu: Clustering, Cluster rows by genotype, Run clustering, and the rows arriving in their new order with a dendrogram beside them." />

## Carriage at the graph's own granularity

The callset above is decomposed, so one graph bubble arrives as many records and
a column is a primitive variant. Release 2 also publishes the undecomposed form,
one record per **snarl**, as the `pgbi.vcf.gz` beside each build. Read it when
the question is who carries a given bubble: its rows and the graph's alleles are
the same objects.

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
columns, CHM13 not being among them, so phased mode draws 462 rows and `AN` tops
out there too.

`AT` is what this file adds: it states each allele as the **traversal** it takes
through the graph, the same statement the `AT` in a pggb VCF makes, which the
wave file drops (`bcftools annotate -x INFO/AT` is in its own header). The
[same `LV==0` filter](#the-variant-callset) cuts this lane to top-level sites,
the tier the [bubble track](#the-bubble-track) holds.

`ID` and `AT` name **base-level integer nodes** (`>161001867>161004536`), where
`sv.gfa` uses `sNNNNN` segment ids, so match a record to a bubble by interval.

With this lane loaded the two readings sit over one coordinate and say
different, compatible things: the [allele inventory](#the-allele-inventory)
gives the haplotype the graph credits an allele to, and a genotype column here
gives the haplotypes that walk it.

## Comparing the graph with the callset

The graph and the callset are the same object at two resolutions. minigraph
records structural variation (roughly >50 bp) and collapses everything smaller,
so SNPs are absent from the graph even though every one is in the VCF. Filter
the callset to that same tier and the two describe the same events from opposite
ends. The graph states an allele and its length, and collapsing is what let it
be found at all. The callset never lost the samples, so it states whose.

What lines up is the event: mark an interval in the linear view and it crosses
the genes, the segments lane and the genotype matrix in one column, and the
reference-position ramp gives the graph's backbone at that position the same hue
as the segments above it.

<Figure caption="One window, both products. The band is one deletion site from the callset, the stretch of HLA-DRB5 that many haplotypes replace with their own shorter sequence, and the matrix below it, every haplotype clustered by genotype, colors the ones carrying it. The force graph has no coordinate axis, so an arrow runs from the band to the allele, which is the same deletion as the graph draws it." src="/img/pangenome/hprc_graph_vs_callset.png" />

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
classifies each haplotype at that bubble, keeping the ones whose alignments
reverse the block while the sequence either side stays forward, and prints the
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
