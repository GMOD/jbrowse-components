---
title: 'Pangenome (HPRC): who carries each allele'
sidebar_label: Pangenome (HPRC, who carries each allele)
description:
  Which of HPRC release 2's 464 haplotypes carry each allele, read from the
  release's callsets beside its graph, and checked against the multiple
  alignment both are derived from
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
- find who carries the _HLA-DRB5_ allele in the callset and the graph at once
- read carriage at the graph's own granularity
- check both against the multiple alignment they come from, and settle a 1q21.1
  inversion the graph cannot

[Browsing the graph](/docs/tutorials/pangenome_hprc) traces that allele to the
one haplotype the graph credits it to.

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
- the release's all-vs-GRCh38 alignment, sliced for the inversion figure:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/impg/pafs/hprc465vsgrch38.aln.paf.gz
- the CAT gene annotation index, one GFF3 per haplotype, which that figure's
  haplotype rows carry:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv
- our bubble projections, with the exact build recorded beside them:
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

## The graph beside the callset

minigraph collapses variation under about 50 bp, so the callset's structural
tier is the graph's own: the graph records an allele and its length, the callset
who carries it.

Press **graph** on the same HLA / MHC row for the graph track under the genes,
the bubbles and the allele inventory. Turn on **HPRC2 pangenome callset (464
haplotypes)** from the track selector and filter it as before, admitting the
_HLA-DRB5_ deletion by position since vcfwave nests it one level down:

```text
jexl:(feature.INFO.LV[0]==0 || feature.start==32517421) && alleleLength(feature)>=50
```

Cluster it, hide the bubbles and the allele inventory, pick **Layout →
Force-directed layout**, and right-click the charcoal allele beside _HLA-DRB5_
for **Highlight in hg38**.

<Figure caption="One window, both products. The band is the HLA-DRB5 deletion site from the callset, over every haplotype clustered by genotype: grey where a haplotype matches the reference, teal where it carries the alt allele, magenta for another alt. Below, the force-directed graph, where an arrow runs from the band to the same deletion as the graph draws it, alleles in charcoal." src="/img/pangenome/hprc_graph_vs_callset.png" />

## Carriage at the graph's own granularity

vcfwave splits a snarl's alleles into smaller records, so a callset record need
not line up with a bubble. Release 2 also publishes the undecomposed form, one
record per **snarl**, as the `pgbi.vcf.gz` beside each build: read it to find
who carries a given bubble, since its rows are the graph's own alleles. Add it
to the same session:

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
bubbles lane in one command that runs on any rGFA; pointed at
`hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host, and
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

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_chrm)
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
