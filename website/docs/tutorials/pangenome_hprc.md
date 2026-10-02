---
title: 'Pangenome (HPRC) part 1: the graph and who carries each allele'
sidebar_label: Pangenome (HPRC 1, the graph and allele carriers)
description:
  Open HPRC release 2's pangenome graph from genomes.jbrowse.org as a track of
  the linear view, follow an allele to the haplotype it came from and to every
  haplotype that carries it, and check both against the multiple alignment they
  derive from
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A pangenome graph records what a set of genomes share and where they diverge, so
sequence that one person carries and the reference lacks is an object in the
file. The Human Pangenome Reference Consortium's release 2 builds 464 human
haplotypes into one such graph, and publishes beside it a callset naming which
haplotypes carry each allele. We open both from the consortium's page on
genomes.jbrowse.org as tracks of a linear view of GRCh38, and:

- read a whole chromosome, one node per bubble
- at C4, read the graph's backbone, bubbles and alleles
- at MHC class II, follow an allele beside _HLA-DRB5_ to the haplotype it came
  from, then find every haplotype that carries it
- back at C4, check the graph and the callset against the multiple alignment
  both are derived from

Two more pages start from the same HPRC page:
[haplotypes against each other](/docs/tutorials/pangenome_hprc_haplotypes) and
[repeat lengths](/docs/tutorials/pangenome_hprc_repeats).

:::caution Experimental

The graph view is a beta plugin, and the HPRC page is on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/)
until JBrowse 5 ships. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, which every launch from the HPRC page loads;
  [hosting your own graph](/docs/tutorials/pangenome_prepare_graph) loads it
  into your own JBrowse
- for [Reproduce it end to end](#reproduce-it-end-to-end):
  [minigraph](https://github.com/lh3/minigraph)

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), with tabix
projections of its graph that we host.

- the SV-resolution graph (`sv.gfa`) the projections are cut from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt
- the config every launch on the HPRC page opens, which declares every release 2
  haplotype as an assembly with its CAT gene annotation:
  https://jbrowse.org/pangenome/hprc-grch38/config.json
- the decomposed variant callset, 464 haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz
- the undecomposed, snarl-level carriage file, 462 haplotypes:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz
- the multiple alignment the graph and the callset are both derived from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.full.maf.gz

## The HPRC page

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc). Each
row of its **Loci** table ends in launches: **graph**, **variants**,
**haplotypes** and **gene hub**.

<Figure caption="The HPRC page: the whole-chromosome links, then the head of the Loci table, where each row ends in its launches. The RHD / RHCE and SMN1 / SMN2 rows have no graph launch. The boxed link is the HLA / MHC graph launch." src="/img/pangenome/genomes_hprc_loci.png" />

## A whole chromosome {#a-chromosome-and-back}

Press **chr1** among the **Whole chromosome** links above the Loci table. Past a
zoom named in the graph adapter's `coarse` slot, JBrowse draws one node per
bubble, so the whole chromosome fits. A curve of segments per bubble shows how
much the haplotypes disagree at each locus.

<Figure caption="GRCh38 chr1 with the cytogenetic bands, three chr1 loci the HPRC pages open, and two lanes from one file. The blue curve is segments per bubble; the tier lane draws the same bubbles, one gold block per bubble. The blank column is 1q12, where nothing aligns." src="/img/pangenome/hprc_whole_chromosome.png" />

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
tier and writes the `coarse` slot.

## The C4 locus as a graph

Back on the HPRC page, press **graph** on the HLA / MHC row. Type `C4A` in the
location box, pick the chr6 hit, and zoom out twice to take in _C4B_. Open the
graph track's menu and pick **Layout → Force-directed layout**, which draws the
graph by its shape.

<Figure caption="The C4 locus as a force-directed graph under the hg38 genes for the same window, colored by reference position. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips one whole copy of the tandem C4-CYP21-TNX module." src="/img/pangenome/hprc_graph_anatomy.png" />

The graph has four kinds of object:

- the **backbone** is GRCh38's path, colored red to magenta by reference
  position
- a **bubble** is a place where haplotypes disagree
- an **allele** is sequence a haplotype carries in place of the reference, drawn
  in charcoal because it has no reference position
- an **edge** that skips sequence is a deletion, drawn as a dashed arc

The dashed arc in the labelled bubble is the route of a haplotype with one fewer
C4 copy than GRCh38.

## From an allele to its haplotype

Type `chr6:32,500,000-32,560,000`, the MHC class II window. The charcoal node
beside _HLA-DRB5_ is an allele much shorter than the stretch of backbone it
hangs across. Right-click it and take **Highlight in hg38**: a band marks the
span of GRCh38 it replaces, which covers most of _HLA-DRB5_.

<Figure caption="MHC class II with the graph track in the force-directed layout, colored by reference position. The ringed charcoal node is the allele beside HLA-DRB5, with its right-click menu open on Highlight in hg38." src="/img/pangenome/hprc_mhc_layout_force.png" />

## Check it on the haplotype

Left-click the allele. Its details give `contributingHaplotype`, `NA20809#2`,
the first assembly the graph saw the allele in. **Open in** appears when the
session holds an assembly named or aliased `sample#haplotype`. The launch's
config declares every release 2 haplotype that way; to declare one yourself,
load its contig sizes, or its FASTA, under a name the browser shows and an alias
that is the graph's name:

```json addassembly
{
  "name": "NA20809.2",
  "aliases": ["NA20809#2"],
  "uri": "https://jbrowse.org/pangenome/hprc-grch38/NA20809.2.chrom.sizes"
}
```

Right-click the allele again and take **Open in NA20809.2**. A second linear
view opens below the first, on that haplotype's chromosome 6, framed on the
allele with its CAT gene annotation. Zoom out a few steps.

<Figure caption="The same launch in two frames. First, the MHC class II cut in the force-directed layout, with the NA20809.2 allele ringed and its right-click menu open on Open in NA20809.2. Second, the view that entry opens: NA20809 haplotype 2's chromosome 6 with its CAT genes." src="/img/pangenome/hprc_haplotype_launch.png" />

The haplotype's CAT annotation has _HLA-DRB9_ and _HLA-DRB6_ either side of the
allele and no _HLA-DRB5_, the gene its band covered on hg38.

## Who else carries it

The graph credits each allele to one haplotype. Release 2 publishes who carries
it as a callset, one genotype per haplotype for all 464. Back on the HPRC page,
press **variants** on the HLA / MHC row. JBrowse opens on the MHC class II
window, `chr6:32,510,001-32,600,000`, with the release's decomposed callset as a
matrix of haplotypes. The same 2.3 GB VCF as a track:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc2_wave_grch38",
  "name": "HPRC2 pangenome callset (464 haplotypes)",
  "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "renderingMode": "phased"
    }
  ]
}
```

`renderingMode: "phased"` splits each sample into its two haplotypes, one row
each. The launch filters the VCF to the structural tier; open **Filter by... →
Edit filters...** in the track menu to read the filter:

```text
jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50
```

`alleleLength` is the length of the record's longest allele, which counts an
insertion's inserted bases. `LV==0` keeps the top-level sites of vg's snarl
tree, so each site paints once.

Open the track menu again and take **Clustering → Cluster rows by genotype...**,
then **Run clustering**: the rows reorder by genotype similarity with a
dendrogram beside them, and haplotypes that share alleles gather into blocks.

<Video src="/media/pangenome/hprc_cluster_callset.mp4" caption="The 464-haplotype lane clustered from the track menu: Clustering, Cluster rows by genotype, Run clustering, and the rows arriving in their new order with a dendrogram beside them." />

## The callset beside the graph

minigraph collapses variation under about 50 bp, so the callset filtered to 50
bp and up holds the same tier as the graph. The graph records an allele and its
length, the callset who carries it.

Return to the graph launch. Turn on **HPRC2 pangenome callset (464 haplotypes)**
from the track selector and give it this filter from **Filter by... → Edit
filters...**, which admits the _HLA-DRB5_ deletion by position since vcfwave
nests it one level down:

```text
jexl:(feature.INFO.LV[0]==0 || feature.start==32517421) && alleleLength(feature)>=50
```

Cluster it, hide the bubbles and the allele inventory, and right-click the
charcoal allele beside _HLA-DRB5_ in the force-directed graph for **Highlight in
hg38**.

<Figure caption="The callset and the graph in one window. The band is the HLA-DRB5 deletion site from the callset, over every haplotype clustered by genotype: grey where a haplotype matches the reference, blue where it carries the alt allele, red for another alt. Below, the force-directed graph, where an arrow runs from the band to the same deletion as the graph draws it, alleles in charcoal." src="/img/pangenome/hprc_graph_vs_callset.png" />

The blue rows carry the deletion, the allele the graph credits to `NA20809#2`.

## Snarl-level carriage

vcfwave splits a snarl's alleles into smaller records, so a callset record may
cover part of a bubble. Release 2 also publishes the undecomposed form, one
record per **snarl**, as the `pgbi.vcf.gz` beside each build. Its records are
the graph's alleles, so it answers who carries a given bubble. Add it to the
same session:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc2_pgbi_grch38",
  "name": "HPRC2 pangenome carriage (snarl-level, 462 haplotypes)",
  "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.pgbi.vcf.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "renderingMode": "phased"
    }
  ]
}
```

With one record per snarl, size alone cuts the lane to the tier the graph's
bubbles hold. Enter this from **Filter by... → Edit filters...**:

```text
jexl:alleleLength(feature)>=50
```

## The alignment underneath both

The graph and the callset both derive from a multiple alignment, which release
2.1 publishes as `hprc-v2.1-mc-grch38.full.maf.gz`, 53 GB, beside a `.tai` index
written by [taffy](https://github.com/ComparativeGenomicsToolkit/taffy) that
makes a locus one ranged read:

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

The `uri` shorthand resolves the sibling `.tai`.[^taf]

Go back to the C4 window, `chr6:31,980,000-32,050,000`, and show three lanes
over the graph track: the genes, the callset and this alignment. Clear the
callset's filters from **Filter by... → Clear all filters**: the structural tier
at C4 is nearly empty, and every record across _CYP21A1P_ and _TNXA_ nests under
one top-level bubble, so both clauses blank the lane here. A white stretch in an
alignment row is a segment that haplotype lacks.

Order the rows with **Clustering → Cluster rows by genotype...** on the callset
and **Clustering → Cluster rows by identity...** on the alignment, which
clusters over the window in view because HPRC's file ships no guide tree.
**Reset row order** restores the order in the file.

<Figure caption="C4 with the RefSeq genes, the callset's haplotypes clustered by genotype, a subtree of them as alignment rows clustered by identity, and the graph track in the force-directed layout. The band marks the pseudogene pair between C4A and C4B, and the haplotypes with no sequence across the module gather into one block." src="/img/maf_hprc_pangenome.png" />

That block is the haplotypes with one fewer copy of the module, whose route is
the dashed arc in the C4 graph. The figure keeps thirty-two alignment rows so
each has room for its name; the track as configured above draws every haplotype.

## Reproduce it end to end

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
projections and the bubbles lane in one command that runs on any rGFA; pointed
at `hprc-v2.1-mc-grch38.sv.gfa.gz`, it writes the files we host, and
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them records
their provenance.

HPRC publishes carriage as [a file](#snarl-level-carriage). Rebuilding it takes
a 464-assembly download and a mapping run, one call per sample:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call asks, at every bubble, which path this assembly takes through the graph
minigraph -cxasm --call -t"$(getconf _NPROCESSORS_ONLN)" graph.gfa assembly.fa > sample.call.bed
```

[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs that call once per assembly and joins the answers into one table of which
path each haplotype takes at every bubble, and
[hosting your own graph](/docs/tutorials/pangenome_prepare_graph#who-carries-what)
walks through the script.

## See also

- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_hprc_repeats)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/maf_track)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_cattle)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph, the multiple alignment and the two
  callsets deconstructed from it.
- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), which define the `SN`/`SO`/`SR`
  tags this page opens the graph by, and whose `bubble` subcommand calls the
  bubbles it reads.
- [taffy](https://github.com/ComparativeGenomicsToolkit/taffy), which writes the
  `.tai` index that makes the alignment addressable by locus.

[^taf]:
    Release 2.0 publishes an earlier build of the alignment as a 5.9 GB TAF,
    which `BgzipTaffyAdapter` reads with the same shorthand. The TAF reads fewer
    bytes per locus, and has more underalignment and unpatched centromeres.
