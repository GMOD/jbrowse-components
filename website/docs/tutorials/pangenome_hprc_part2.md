---
title: Pangenome (HPRC) part 2, who carries what
sidebar_label: Pangenome (HPRC 2, who carries what)
description:
  Which of HPRC release 2's 464 haplotypes carry each allele, read from the
  release's callset on the hosted HPRC page, beside where its graph varies and
  by how much
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A pangenome graph stores each allele once, credited to the first assembly that
contributed it, so the graph alone cannot say who else carries it. The Human
Pangenome Reference Consortium's release 2 publishes that answer beside its
graph as a callset, one genotype per haplotype for all 464. We open the callset
from the consortium's page on genomes.jbrowse.org at the MHC class II locus and
gather the haplotypes that share alleles, then read the graph's own lanes for
where it varies and by how much, and put the two products side by side.
[Part 1](/docs/tutorials/pangenome_hprc) reads the graph itself.

## Prerequisites

- the GraphGenomeView plugin, which the HPRC page's graph launches load; both
  callsets are a URL any JBrowse reads with no plugin

## Where the data comes from

The data is [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710).
JBrowse reads its callsets and its multiple alignment directly from S3, and
reads the bubble and allele projections from our host.

- the decomposed variant callset, 464 haplotypes, read straight off S3:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz
- the undecomposed, snarl-level carriage file, 462 haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz
- the multiple alignment the graph and the callset are both derived from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz
- the release's all-vs-GRCh38 alignment, sliced for the deletion and inversion
  figures:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz
- the CAT gene annotation index, one GFF3 per haplotype, which those figures'
  haplotype rows carry:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- our bubble and allele projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt

## The variant callset

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc) and
press **variants** on the HLA / MHC row. JBrowse opens genomes.jbrowse.org's
hg38 on the MHC class II window, `chr6:32,510,001-32,600,000`, with the RefSeq
genes, the release's decomposed callset as a matrix of haplotypes, and HPRC's
structural variant tracks from UCSC. The callset's `wave.vcf.gz` ships its index
beside it, so JBrowse reads only the slice in view out of the 2.3 GB file, and
the track is this config:

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

The VCF is fully decomposed, so this window holds over fourteen thousand
records, most of them SNPs and the rest small indels, and the launch filters the
lane to the structural tier. Open the track menu and choose **Edit filters** to
read the filter it applies:

```text
jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50
```

The filter needs both halves:

- `alleleLength` is the longest allele the record describes. A filter on
  `end - start` would keep only deletions, since an insertion consumes no
  reference.
- `LV` is the record's level in vg's snarl tree, and `LV==0` keeps the top-level
  sites. This file writes a nested child as a separate record beside its parent,
  with `PS` naming that parent. Without `LV==0` the panel paints some events
  twice, at two positions.

A couple of hundred sites remain, few enough to draw each at its genomic
position, lined up with the genes above. Open the track menu again and take
**Clustering → Cluster rows by genotype...**, then **Run clustering**. The rows
reorder by genotype similarity with a dendrogram beside them, and haplotypes
that share alleles gather into blocks.

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
Add it to the same session:

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
from **Edit filters** and the lane cuts to top-level sites, the tier the graph's
bubbles hold. A record matches a bubble by interval.[^integer-nodes]

This file adds the `AT` field, which records each allele as the **traversal** it
takes through the graph. A pggb VCF carries the same `AT` field. The wave file
drops it, and its header shows the `bcftools annotate -x INFO/AT` command that
did so. Click any record and its details list `AT` with the rest of `INFO`.

## Where the graph varies {#the-bubble-track}

A **bubble** is a place where haplotypes diverge and rejoin. Press **graph** on
the same HLA / MHC row of the HPRC page for the session that holds the graph's
own lanes: the RefSeq genes, the bubbles, the allele inventory and the rGFA
segments over the same window, with the graph under them.
[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds each of
these files and writes their tracks.

The bubbles lane draws one block per bubble, and the widest block covers
_HLA-DRB5_ and a good deal more. Hover it. `MinigraphBubbleAdapter` labels each
bubble with its shortest and longest allele, and this one spans tens of
kilobases depending on the haplotype.[^path-count] HPRC publishes no bubble
file, so we built this one with `gfatools bubble`.

## A whole chromosome, one node per bubble {#a-whole-chromosome-as-a-graph}

A window past a few hundred kilobases holds more segments than any layout can
place. The bubble file gives a coarser level of detail: each bubble collapses to
a single node, and the invariant reference between bubbles stays as backbone.
The same bubble file also plots as a curve of segments per bubble, which says
where the graph varies and by how much.

Press **chr1** among the **Whole chromosome** links above the HPRC page's loci
table. The session opens the whole chromosome with two lanes under the genes:
the curve, and the tier lane with one block per bubble.

<Figure caption="All 249 Mb of GRCh38 chr1 with the cytogenetic bands on the same axis, then three chr1 loci these pages open, then two lanes from one file. The blue curve is segments per bubble, how much the haplotypes disagree at each locus; the tier lane draws the same bubbles, one gold block per bubble. The blank column is 1q12, where nothing aligns." src="/img/pangenome/hprc_whole_chromosome.png" />

Use the two granularities together: the tier to find an event, and the fine
index to open it. Close the chromosome's graph pane from its title bar, type
`chr6:31,500,001-33,500,000`, the whole MHC, and cut it from the tier lane's own
menu with **Launch → Graph genome view (this region)**. One node per bubble
draws the two megabases. Press **Pin** in that graph's toolbar so it holds this
cut. Hover the widest node in the middle for its span, and right-click it for
**Open in hg38**, which puts the linear view on that bubble. Drag across the
band of the ruler the bubble now fills and choose **Graph genome view (this
selection)**; the submenu names the session's graph tracks, and the rGFA
segments' entry opens the fine cut as a second pane under the pinned one.

<Video src="/media/pangenome/hprc_tier_to_fine.mp4" caption="The bubble tier over the MHC taken down to segment resolution: the class II node hovered and opened in the linear view, the fine segments lane drawing once the view lands on its span, and a drag across that span cut from the fine index into a second graph pane." />

## The allele inventory

The bubbles report where the graph varies. The allele inventory reports what the
variation is: one row per allele in the graph, anchored on GRCh38, derived from
the graph's segment and link indexes. Back in the tab the HLA / MHC graph launch
opened, the allele inventory lane packs the window's alleles into rows. It is an
`AlignmentsTrack` over a BED: each row carries a `CIGAR` against the reference
span it replaces (`2062M63348I`), the alignments display draws any row that has
a CIGAR, and each insertion draws at its real magnitude.

The whole graph holds a few hundred thousand alleles, so a wide window is dense.
The
[graph genome view guide](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
explains the columns and how the walk derives them. It also gives two filters
that make a lane this size readable: `jexl:abs(feature.delta)>10000` for size,
and `jexl:feature.nested==0` before reading lengths in bulk.

Type the CFH cluster on chr1, `chr1:196,700,000-196,900,000`. One of the lane's
rows there is the 84,684 bp deletion of _CFHR3_ and _CFHR1_, and the graph below
follows to the same window, where the same deletion is an edge: under the
anchored layout its dashed arc spans exactly the bases it removes. The figure
sets two haplotypes from the release's own alignment beside it, one that carries
the deletion and one that does not.

<Figure caption="The complement factor H cluster: a carrier and a non-carrier haplotype aligned to GRCh38, above the same window as an anchored graph. The carrier's ribbon narrows where it has nothing to align, over CFHR3 and CFHR1, and the dashed arc under the graph's reference row spans the same stretch." src="/img/pangenome/hprc_cfhr_deletion.png" />

With the inventory and a genotype column over one coordinate, two compatible
readings sit together. The inventory gives the haplotype the graph records as
contributing an allele, and a genotype column gives every haplotype that walks
it.

## Comparing the graph with the callset

The graph and the callset describe the same variation at two resolutions.
minigraph records structural variation (roughly >50 bp) and collapses everything
smaller, so SNPs are absent from the graph even though every one is in the VCF.
Filter the callset to that same tier, and the two describe the same events from
opposite ends: the graph records an allele and its length, and the callset
records who carries it.

Back on `chr6:32,510,001-32,600,000`, turn on the callset lane in the graph
session from the track selector, where it is **HPRC2 pangenome callset (464
haplotypes)**. Filter it the way the variants launch does, with one exception:
vcfwave nests the record for the deletion across _HLA-DRB5_ one level down in
this release, so admit it by position:

```text
jexl:(feature.INFO.LV[0]==0 || feature.start==32517421) && alleleLength(feature)>=50
```

Cluster it as above, hide the bubbles and the allele inventory from their track
menus, pick **Force-directed layout** in the graph's **Layout** dropdown, and
right-click the charcoal allele beside _HLA-DRB5_ for **Highlight in hg38**. The
band crosses the genes, the segments lane and the genotype matrix in one column.
The reference-position ramp gives the backbone at that position the same hue as
the segments above it, and the allele the column's carriers walk is the charcoal
node beside that stretch of backbone.

<Figure caption="One window, both products. The band is the HLA-DRB5 deletion site from the callset, over every haplotype clustered by genotype: grey where a haplotype matches the reference, teal where it carries the alt allele, magenta for another alt. Below, the force-directed graph, where an arrow runs from the band to the same deletion as the graph draws it, alleles in charcoal." src="/img/pangenome/hprc_graph_vs_callset.png" />

## The alignment underneath both {#the-alignment-underneath-both}

The graph and the callset are both derived from the multiple alignment, and
release 2.1 publishes that too: `hprc-v2.1-mc-grch38.full.maf.gz`, 53 GB, 464
haplotypes, beside a `.tai` index written by
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy). The index makes it
addressable, so a locus is a ranged read rather than a 53 GB download:

```json addtrack
{
  "type": "MafTrack",
  "trackId": "hprc_v2_0_mc_grch38",
  "name": "HPRC release 2 pangenome alignment (464 haplotypes)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BgzipMafAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz"
  }
}
```

The `uri` shorthand resolves the sibling `.tai`, which downloads once. Release
2.0 publishes the same alignment as a 5.9 GB TAF, which `BgzipTaffyAdapter`
reads with the same shorthand: a quarter of the bytes per locus, but an earlier
build, with more underalignment and unpatched centromeres.

Type the C4 window, `chr6:31,980,000-32,050,000`, and show four lanes: the
genes, the segments, the filtered callset and this alignment. Every alignment
row is a human haplotype, so a row that drops out belongs to a person who does
not carry that segment. Read down a column for who carries what, across for
where each segment starts and stops. C4 is the locus
[HPRCv2](https://github.com/pangenome/HPRCv2) itself opens with.

Two clustering runs order the rows: **Clustering → Cluster rows by genotype...**
on the callset, and **Clustering → Cluster rows by identity...** on the
alignment, which computes over the window in view, since HPRC's file ships no
guide tree; **Reset row order** puts back whatever the file supplied. The graph
under all four is still pinned on MHC class II: pick **Anchored** and it follows
to C4, then **Force-directed layout** to draw that cut by its shape.

<Figure caption="C4 on one axis: the RefSeq genes, the rGFA segments, the callset's haplotypes clustered by genotype, a subtree of them as alignment rows clustered by identity, white where a haplotype has no aligned sequence, and the window as a force-directed graph. The band marks the pseudogene pair between C4A and C4B, and the haplotypes with no sequence across the module gather into one block." src="/img/maf_hprc_pangenome.png" />

The figure keeps thirty-two haplotype rows so each has the height for its name
beside it; the track as configured above draws every haplotype. The
[MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity and codon view, all derived from the alignment with no extra
files.

## Inversions

Insertions are nodes and deletions are edges. An inversion is the same reference
sequence, walked backwards. `gfatools bubble` sets a column when a bubble's
paths disagree about orientation, and the adapter exposes that column as an
`inversion` boolean. Show the bubbles lane again, open its menu, choose **Edit
filters**, and enter:

```text
jexl:feature.inversion
```

Type `chr1:144,260,000-144,610,000`, the 1q21.1 locus. The lane holds one block
there, a bubble whose paths disagree about orientation, and clicking it opens
the flag in its details. The flag marks that the paths disagree, and cannot
distinguish a polymorphic inversion from an inverted paralog inside a segmental
duplication. The graph draws the bubble's breakpoints as two deletion arcs,
because the view's edges carry no orientation. The alignments settle it.

The figure below is the same bubble as an alignment, and it takes one build
script to make, because nothing in the session so far carries the haplotypes'
own sequence.
[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
under [Reproduce it end to end](#reproduce-it-end-to-end) classifies every
haplotype at the bubble from HPRC's published all-vs-GRCh38 PAF and slices out
one carrier and one non-carrier, each with its CAT annotation. The boxed pair on
each row is the same two genes, _PPIAL4F_ and _PPIAL4E_. On the carrier
_PPIAL4F_ comes first, and on the non-carrier _PPIAL4E_ does. The hg38 row
between them agrees with the non-carrier.

<Figure caption="The 1q21.1 bubble the graph flags as an inversion, drawn as alignments. The pink ribbons are each haplotype's alignment to hg38, and a ribbon that crosses itself is an inversion. Between the two haplotype rows are the RefSeq genes, the bubble lane cut to inversion-flagged bubbles, and the rGFA segments. The boxed pair on each row is PPIAL4F and PPIAL4E, in opposite orders on the two haplotypes." src="/img/pangenome/hprc_inversion.png" />

## Reproduce it end to end

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
bubble file, its [coarse tier](#a-whole-chromosome-as-a-graph) and the
[allele inventory](#the-allele-inventory) in one command, which runs on any
rGFA. Pointed at `hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host.
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
[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
does the same for the carrier and non-carrier in the deletion figure.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/maf_track)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph, the multiple alignment and the two
  callsets deconstructed from it.
- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), whose `bubble` subcommand calls
  the bubbles this page reads.
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which writes the
  `.tai` index that makes the alignment addressable by locus.

[^path-count]:
    Each bubble's description also carries a path count, which counts the routes
    through the bubble and not the haplotypes observed. gfatools saturates the
    count at `2147483647`, and the track describes those bubbles as having more
    paths than gfatools counts.

[^integer-nodes]:
    `ID` and `AT` name base-level integer nodes (`>161001867>161004536`), where
    `sv.gfa` uses `sNNNNN` segment ids.
