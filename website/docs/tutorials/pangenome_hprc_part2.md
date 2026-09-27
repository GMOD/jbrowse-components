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
graph as a callset, one genotype per haplotype for all 464, and we open both
from the consortium's page on genomes.jbrowse.org at the MHC class II locus. We:

- cluster the callset's haplotypes by the alleles they share
- read the graph's lanes for where it varies and by how much
- put the two products side by side, at the CFH deletion and a 1q21.1 inversion

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
press **variants** on the HLA / MHC row. JBrowse opens on the MHC class II
window, `chr6:32,510,001-32,600,000`, with the release's decomposed callset as a
matrix of haplotypes. Indexed alongside the 2.3 GB VCF, the track is this
config:

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

`renderingMode: "phased"` splits each sample into its two haplotypes, one row
each. The launch filters the fully decomposed VCF to the structural tier; open
the track menu's **Edit filters** to read it:

```text
jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50
```

`alleleLength` is the longest allele the record describes, over `end - start`
since an insertion consumes no reference; `LV==0` keeps the top-level sites of
vg's snarl tree, so a nested child does not paint twice.

Open the track menu again and take **Clustering → Cluster rows by genotype...**,
then **Run clustering**: the rows reorder by genotype similarity with a
dendrogram beside them, and haplotypes that share alleles gather into blocks.

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="The 464-haplotype lane clustered from the track menu: Clustering, Cluster rows by genotype, Run clustering, and the rows arriving in their new order with a dendrogram beside them." />

## Carriage at the graph's own granularity

Release 2 also publishes an undecomposed form, one record per **snarl**, as the
`pgbi.vcf.gz` beside each build: read it to find who carries a given bubble,
since its rows are the graph's own alleles. Add it to the same session:

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

Apply the [same `LV==0` filter](#the-variant-callset) from **Edit filters**, and
the lane cuts to the tier the graph's bubbles hold, matched to a bubble by
interval.

## Where the graph varies {#the-bubble-track}

A **bubble** is a place where haplotypes diverge and rejoin. Press **graph** on
the same HLA / MHC row for the session holding the graph's lanes: the RefSeq
genes, the bubbles and the allele inventory over the graph track.
[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds these
files, which we built here with `gfatools bubble` since HPRC publishes none.

The bubbles lane draws one block per bubble; hover the widest, covering
_HLA-DRB5_ and more, for its shortest and longest allele.

## A whole chromosome, one node per bubble {#a-whole-chromosome-as-a-graph}

A window past a few hundred kilobases holds more segments than any layout can
place, so the same bubble file also collapses each bubble to a node and plots a
curve of segments per bubble. Press **chr1** among the **Whole chromosome**
links above the loci table for the whole chromosome, the curve and the tier lane
under the genes.

<Figure caption="All 249 Mb of GRCh38 chr1 with the cytogenetic bands on the same axis, then three chr1 loci these pages open, then two lanes from one file. The blue curve is segments per bubble, how much the haplotypes disagree at each locus; the tier lane draws the same bubbles, one gold block per bubble. The blank column is 1q12, where nothing aligns." src="/img/pangenome/hprc_whole_chromosome.png" />

Back in the tab the HLA / MHC **graph** link opened, type
`chr6:31,500,001-33,500,000`, past the graph track's handover to one node per
bubble. Hover the widest node for its span, and right-click it for **Open in
hg38**, which puts the view on that bubble; under the handover the graph track
cuts the same span again from the fine index.

<Video src="/media/pangenome/hprc_tier_to_fine.mp4" caption="The bubble tier over the MHC taken down to segment resolution: the class II node hovered and opened in hg38, and once the view lands on its span, the graph track cutting the same span again from the fine index." />

## The allele inventory

The bubbles report where the graph varies; the allele inventory, packed into the
same tab's lane, reports what it is: one row per allele, anchored on GRCh38. A
wide window is dense, so the
[graph genome view guide](/docs/user_guides/graph_genome_view#when-all-you-have-is-the-graph)
gives two filters: `jexl:abs(feature.delta)>10000` for size, and
`jexl:feature.nested==0` before reading lengths in bulk.

Type the CFH cluster on chr1, `chr1:196,700,000-196,900,000`. One row there is
the 84,684 bp deletion of _CFHR3_ and _CFHR1_, and the graph track below cuts
the same window, where the deletion is an edge.

<Figure caption="The complement factor H cluster: a carrier and a non-carrier haplotype aligned to GRCh38, above the same window as an anchored graph. The carrier's ribbon narrows where it has nothing to align, over CFHR3 and CFHR1, and the dashed arc under the graph's reference row spans the same stretch." src="/img/pangenome/hprc_cfhr_deletion.png" />

## Comparing the graph with the callset

minigraph collapses variation under about 50 bp, so filter the callset to that
same tier: the graph records an allele and its length, the callset who carries
it.

Back on `chr6:32,510,001-32,600,000`, turn on **HPRC2 pangenome callset (464
haplotypes)** from the track selector and filter it as before, admitting the
_HLA-DRB5_ deletion by position since vcfwave nests it one level down:

```text
jexl:(feature.INFO.LV[0]==0 || feature.start==32517421) && alleleLength(feature)>=50
```

Cluster it, hide the bubbles and the allele inventory, pick **Layout →
Force-directed layout**, and right-click the charcoal allele beside _HLA-DRB5_
for **Highlight in hg38**.

<Figure caption="One window, both products. The band is the HLA-DRB5 deletion site from the callset, over every haplotype clustered by genotype: grey where a haplotype matches the reference, teal where it carries the alt allele, magenta for another alt. Below, the force-directed graph, where an arrow runs from the band to the same deletion as the graph draws it, alleles in charcoal." src="/img/pangenome/hprc_graph_vs_callset.png" />

## The alignment underneath both {#the-alignment-underneath-both}

The graph and the callset both derive from the multiple alignment, and release
2.1 publishes it too: `hprc-v2.1-mc-grch38.full.maf.gz`, 53 GB, beside a `.tai`
index written by [taffy](https://github.com/ComparativeGenomicsToolkit/taffy)
that makes a locus one ranged read:

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

The `uri` shorthand resolves the sibling `.tai`. Release 2.0 publishes the same
alignment as a 5.9 GB TAF, read by `BgzipTaffyAdapter` with the same shorthand:
a quarter of the bytes per locus, but an earlier build with more underalignment
and unpatched centromeres.

Type the C4 window, `chr6:31,980,000-32,050,000`, and show three lanes over the
graph track: the genes, the filtered callset and this alignment. A row that
drops out belongs to a haplotype that does not carry that segment.

Order the rows with **Clustering → Cluster rows by genotype...** on the callset
and **Clustering → Cluster rows by identity...** on the alignment (computed over
the window in view, since HPRC's file ships no guide tree); **Reset row order**
puts back the file's own order.

<Figure caption="C4 on one axis: the RefSeq genes, the callset's haplotypes clustered by genotype, a subtree of them as alignment rows clustered by identity, white where a haplotype has no aligned sequence, and the graph track drawing the window force-directed. The band marks the pseudogene pair between C4A and C4B, and the haplotypes with no sequence across the module gather into one block." src="/img/maf_hprc_pangenome.png" />

The figure keeps thirty-two haplotype rows so each has the height for its name
beside it; the track as configured above draws every haplotype.

## Inversions

An inversion is the same reference sequence, walked backwards. `gfatools bubble`
flags it as an `inversion` boolean when a bubble's paths disagree about
orientation. Show the bubbles lane again, open **Edit filters**, and enter:

```text
jexl:feature.inversion
```

Type `chr1:144,260,000-144,610,000`, the 1q21.1 locus. The lane's one flagged
bubble cannot distinguish a polymorphic inversion from an inverted paralog in a
segmental duplication, and the graph draws its breakpoints as two deletion arcs
since its edges carry no orientation. The alignments settle it: the figure below
comes from
[`build_hprc_inversion_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_inversion_synteny.sh)
under [Reproduce it end to end](#reproduce-it-end-to-end), which classifies
every haplotype at the bubble from HPRC's all-vs-GRCh38 PAF and slices out a
carrier and a non-carrier, each with its CAT annotation. The hg38 row between
them agrees with the non-carrier.

<Figure caption="The 1q21.1 bubble the graph flags as an inversion, drawn as alignments. The pink ribbons are each haplotype's alignment to hg38, and a ribbon that crosses itself is an inversion. Between the two haplotype rows are the RefSeq genes, the bubble lane cut to inversion-flagged bubbles, and the rGFA segments. The boxed pair on each row is PPIAL4F and PPIAL4E, in opposite orders on the two haplotypes." src="/img/pangenome/hprc_inversion.png" />

## Reproduce it end to end

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
bubble file, its [coarse tier](#a-whole-chromosome-as-a-graph) and the
[allele inventory](#the-allele-inventory) in one command that runs on any rGFA;
pointed at `hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host, and
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them records
their provenance.

We do not rebuild carriage here, since HPRC publishes it as
[a file](#carriage-at-the-graphs-own-granularity). Rebuilding it takes a
464-assembly download and a mapping run, one call per sample:

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
keeps the haplotypes whose alignments reverse the block while the flanks stay
forward, then slices out one haplotype of each kind: the alignment, the contig
length and the CAT genes.
[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
does the same for the deletion figure's carrier and non-carrier.

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
