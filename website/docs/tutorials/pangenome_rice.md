---
title: Pangenome (rice)
description:
  Open the rice pangenome, read the Green Revolution semi-dwarf deletion, three
  grain-width alleles and a 90 kb insertion that the reference lacks, then load
  the graph in your own JBrowse
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: Other species
---

The rice pangenome aligns 47 NCBI assemblies of Asian rice onto AGIS-1.0, the
telomere-to-telomere assembly of the japonica variety Nipponbare, with
`minigraph`. Most come from a 2025 set of HiFi and Nanopore assemblies of
cultivated, weedy and wild rice (_Oryza rufipogon_); the rest add the aus
variety Kasalath, the indica IR64 and complete indica and japonica genomes.
Nipponbare is a temperate japonica, so where it carries a derived allele, the
other assemblies appear as the change. No graph had been published for these
assemblies, so we built one. We:

- at _sd1_, find the Green Revolution's semi-dwarf deletion in IR64
- at _qSW5_, read three grain-width alleles, one of them the reference's
- at _Pup1_, read a 90 kb insertion that the reference lacks
- load the graph and its bubbles as tracks on AGIS-1.0 in your own JBrowse
- build a minigraph graph from the assemblies

The first three start from the rice graph page on
[genomes.jbrowse.org](https://genomes.jbrowse.org/pangenomes/rice), which
launches the JBrowse 5 development build until JBrowse 5 ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the
  [portal page](https://genomes.jbrowse.org/pangenomes/rice) already loads it
- [`minigraph`](https://github.com/lh3/minigraph), to build a graph like this
  one

<!-- BEGIN GENERATED TUTORIAL_INSTALL minigraph -->

```bash
# conda
conda install -c bioconda -c conda-forge minigraph
```

<!-- END GENERATED TUTORIAL_INSTALL minigraph -->

## The data

The reference is AGIS-1.0 (GCF_034140825.1) from UCSC GenArk, and the 47
assemblies are NCBI GenBank records, listed with their accessions in the
[README](https://jbrowse.org/demos/rice_pangenome/README.txt) beside the files.

Nothing to download: the track configs below read the index files by URL.
[Building the graph](#building-the-rice-graph) builds the files for assemblies
of your own.

<details>
<summary>The files</summary>

| What it is                                                                         | File                                                                                                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AGIS-1.0, as 2bit                                                                  | [GCF_034140825.1.2bit](https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/GCF_034140825.1.2bit)                   |
| The graph, as rGFA                                                                 | [rice-agis1-minigraph.rgfa.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.rgfa.gz)                               |
| Segments and links, the graph's nodes and edges at their reference coordinates     | [rice-agis1-minigraph.graph.bed.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.graph.bed.gz)                     |
| Bubbles, where the assemblies' paths split and rejoin                              | [rice-agis1-minigraph.bubbles.bed.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.bubbles.bed.gz)                 |
| The whole-chromosome overview, with variants under 10 kb folded into the reference | [rice-agis1-minigraph.fold10000.graph.bed.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.fold10000.graph.bed.gz) |

</details>

The graph holds no path per assembly, so the portal page reads which assemblies
carry each bubble's allele from a separate file, made by mapping each assembly
back onto the graph with `minigraph --call`.

## sd1: the Green Revolution's semi-dwarf deletion

The semi-dwarf rice varieties of the Green Revolution carry defective alleles of
_SD1_, which encodes an oxidase of gibberellin biosynthesis. Monna et al. (2002)
found that the allele from the Taiwanese variety Dee-geo-woo-gen is a 383 bp
deletion from the middle of exon 1 to upstream of exon 2, which shifts the
frame. IR64 carries it. Nipponbare is tall and has the intact gene.

- Open the [portal page](https://genomes.jbrowse.org/pangenomes/rice), which
  starts on **sd1**, or type `chr1:39,008,000-39,020,000` into its box and press
  **Show**.
- Read the map's sd1-d row: IR64 and eight more assemblies share the 383 bp
  deletion inside the gene.

<Figure caption="The portal page at sd1. The sd1-d row is the 383 bp deletion inside the gene; the commoner 240 bp deletion lies upstream." src="/img/pangenome/genomes_rice_sd1.png" />

The commoner 240 bp deletion, in a third of the assemblies, lies upstream of the
gene.

## qSW5: three grain-width alleles

A deletion upstream of the grain-width gene _qSW5_ (_GW5_) lowers its expression
and widens the grain. Lee et al. (2015) distinguished three alleles: Kasalath's,
with no deletion; an indica allele with a 950 bp deletion; and Nipponbare's,
with a 1,212 bp deletion. AGIS-1.0 carries the 1,212 bp deletion, so the map
draws the other two as longer sequence than the reference's at that site.

- Type `chr5:5,374,000-5,390,000` into the
  [portal page](https://genomes.jbrowse.org/pangenomes/rice)'s box and press
  **Show**, or pick **qSW5 / GW5** from its examples.
- Read the forms: the **qSW5, no deletion** rows, about half the assemblies with
  Kasalath, IR64 and 9311 among them, have the 1.2 kb Nipponbare lacks. The
  **qSW5, 950 bp deletion** row, a quarter with the three weedy rices among
  them, has 260 bp of it. Balilla, Udai21, Changxianggeng1813, Wuyunjing8 and
  eight more share the reference's deletion, the row **AGIS-1.0's structure**.

<Figure caption="The portal page at qSW5. The reference carries the 1,212 bp deletion, so the other two alleles are drawn as longer sequence at its site: 1.2 kb longer without a deletion, 260 bp longer with the 950 bp one." src="/img/pangenome/genomes_rice_qsw5.png" />

## Pup1: a 90 kb insertion the reference lacks

Kasalath's _Pup1_ locus, for tolerance of phosphorus-poor soil, holds the
protein kinase gene _PSTOL1_. Gamuyao et al. (2012) found that the gene is
absent from the reference genome and from other phosphorus-starvation-intolerant
modern varieties, and Vigueira et al. (2016) place it in an insertion of about
90 kb.

- Type `chr12:15,866,140-15,866,870` into the
  [portal page](https://genomes.jbrowse.org/pangenomes/rice)'s box and press
  **Show**, or pick **Pup1 / PSTOL1** from its examples.
- Read the forms: Kasalath and SL190 insert 89 kb at one point, named Pup1.
  Fifteen more assemblies insert 46 to 77 kb at the same point, and IR64 and
  most of the rest have the reference's structure.

<Figure caption="The portal page at Pup1. Every form is an insertion at one point, of 46 to 89 kb; Kasalath's 89 kb form is named Pup1." src="/img/pangenome/genomes_rice_pup1.png" />

The window is 730 bp wide, between the bubbles on either side, so that every
form is one insertion. Wider windows take in the 20 kb deletions around the
locus, which split the panel into more forms than the map can show.

## Loading the graph in your own JBrowse {#load-the-graph}

The portal's launches load these tracks for you. In your own JBrowse, we'll load
the reference, then the graph and its bubbles. The graph track names the file
prefix `gfa-to-tabix build` writes, and the `uri`s below are our hosted copy, so
swap the prefix for your own build. The alias file maps the graph's `chr1` to
`chr12` onto GenArk's RefSeq names.

```json addassembly
{
  "name": "GCF_034140825.1",
  "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/GCF_034140825.1.2bit",
  "refNameAliases": {
    "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/GCF_034140825.1.chromAlias.txt"
  }
}
```

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "rice_minigraph_segments",
  "name": "Rice pangenome (rGFA segments)",
  "assemblyNames": ["GCF_034140825.1"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph",
    "format": 2,
    "coarse": {
      "uri": "https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.fold10000",
      "format": 2,
      "aboveBpPerPx": 1000
    }
  },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

The bubbles track reads the same build's bubble index:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "rice_minigraph_bubbles",
  "name": "Rice pangenome bubbles",
  "assemblyNames": ["GCF_034140825.1"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.bubbles.bed.gz",
    "csi": true
  }
}
```

## Building the rice graph

The rice genome is small enough for one `minigraph` run over every chromosome at
once, reference first so that its segments take rank 0, the earliest build
order:

<!-- from: scripts/build_rice_pangenome.sh -->

```bash
# -xggs: incremental graph construction, adding each genome in turn
# -c: base-level alignment, which minigraph recommends for graph generation
minigraph -cxggs -t 8 Nipponbare.fa SL001.fa SL010.fa ... Wuyunjing8.fa > rice.gfa
```

[](/docs/tutorials/pangenome_prepare_graph) then turns the graph into the files
above with one command, `gfa-to-tabix build`.
[`build_rice_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rice_pangenome.sh)
runs the whole build on Linux, since it needs GNU tools. It downloads the 48
assemblies from NCBI with the `datasets` CLI and took 5.5 hours of `minigraph`
time on 8 threads. It:

- downloads each assembly with its sequence report
- keeps each assembly's twelve chromosomes, renamed to PanSN
  (`sample#haplotype#contig`) from the report, and drops organelles and unplaced
  scaffolds
- runs `minigraph` over all of them
- writes the index files

The script stops if:

- a segment has an `SN` tag that names no kept chromosome
- a segment id repeats
- the rank-0 segments are not AGIS-1.0's twelve chromosomes at their full length

A graph that fails any of these has wrong coordinates that every later check
accepts, so copy these audits into your own build.

## See also

- [](/docs/tutorials/pangenome_fly)
- [](/docs/tutorials/pangenome_prepare_graph)

## Citations

- Li et al. (2020).
  [The design and construction of reference pangenome graphs with minigraph](https://doi.org/10.1186/s13059-020-02168-z)
- Monna et al. (2002).
  [Positional cloning of rice semidwarfing gene, sd-1: rice "green revolution gene" encodes a mutant enzyme involved in gibberellin synthesis](https://doi.org/10.1093/dnares/9.1.11)
- Bhuvaneswari et al. (2020).
  [Discovery of a novel induced polymorphism in SD1 gene governing semi-dwarfism in rice and development of a functional marker for marker-assisted selection](https://doi.org/10.3390/plants9091198)
- Lee et al. (2015).
  [Influence of multi-gene allele combinations on grain size of rice and development of a regression equation model to predict grain parameters](https://doi.org/10.1186/s12284-015-0066-1)
- Gamuyao et al. (2012).
  [The protein kinase Pstol1 from traditional rice confers tolerance of phosphorus deficiency](https://doi.org/10.1038/nature11346)
- Vigueira et al. (2016).
  [Long-term balancing selection at the Phosphorus Starvation Tolerance 1 (PSTOL1) locus in wild, domesticated and weedy rice (Oryza)](https://doi.org/10.1186/s12870-016-0783-7)
