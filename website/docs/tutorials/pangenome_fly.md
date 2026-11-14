---
title: Pangenome (fly)
description:
  Open the Drosophila melanogaster pangenome, read six duplication alleles of a
  nicotine resistance gene in one bubble, find the transposons behind classic
  visible mutants, then load the graph in your own JBrowse
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: Other species
---

The fly pangenome aligns 29 NCBI assemblies of _Drosophila melanogaster_ onto
the dm6 reference with `minigraph`: the 14 strains of Chakraborty et al. (2019),
the founders of the Drosophila Synthetic Population Resource (DSPR) and
Oregon-R; 11 Bloomington stocks carrying classical visible mutations, which
Samano et al. (2026) assembled to find the structural variants behind them; and
three single-fly PacBio HiFi strains and a Canton S. dm6 is ISO1, itself a
laboratory strain, so where it carries a transposon the strains without one
appear as a deletion. No graph had been published for these assemblies, so we
built one. We:

- at _Cyp28d1_, read six duplication alleles of one gene in a single bubble
- at _Strn-Mlck_, find the transposon behind the Curved wing mutant in one
  Bloomington stock
- at _CHKov1_, read a resistance allele that the reference carries
- load the graph and its bubbles as tracks on dm6 in your own JBrowse
- build a minigraph graph from the assemblies

The first three start from the fly graph page on
[genomes.jbrowse.org](https://genomes.jbrowse.org/pangenomes/fly), which
launches the JBrowse 5 development build until JBrowse 5 ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the
  [portal page](https://genomes.jbrowse.org/pangenomes/fly) already loads it
- [`minigraph`](https://github.com/lh3/minigraph), to build a graph like this
  one

<!-- BEGIN GENERATED TUTORIAL_INSTALL minigraph -->

```bash
# conda
conda install -c bioconda -c conda-forge minigraph
```

<!-- END GENERATED TUTORIAL_INSTALL minigraph -->

## The data

The reference is UCSC's dm6, and the 29 assemblies are NCBI GenBank records,
listed with their accessions in the
[README](https://jbrowse.org/demos/fly_pangenome/README.txt) beside the files.

Nothing to download: the track configs below read the index files by URL.
[Building the graph](#building-the-fly-graph) builds the files for assemblies of
your own.

<details>
<summary>The files</summary>

| What it is                                                                         | File                                                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| dm6 (BDGP Release 6)                                                               | [dm6.fa.gz](https://hgdownload.soe.ucsc.edu/goldenPath/dm6/bigZips/dm6.fa.gz)                                                |
| The graph, as rGFA                                                                 | [fly-dm6-minigraph.rgfa.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.rgfa.gz)                               |
| Segments and links, the graph's nodes and edges at their reference coordinates     | [fly-dm6-minigraph.graph.bed.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.graph.bed.gz)                     |
| Bubbles, where the assemblies' paths split and rejoin                              | [fly-dm6-minigraph.bubbles.bed.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.bubbles.bed.gz)                 |
| The whole-chromosome overview, with variants under 10 kb folded into the reference | [fly-dm6-minigraph.fold10000.graph.bed.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.fold10000.graph.bed.gz) |

</details>

The graph holds no path per assembly, so the portal page reads which assemblies
carry each bubble's allele from a separate file, made by mapping each assembly
back onto the graph with `minigraph --call`.

## Cyp28d1: six duplication alleles in one bubble

A nicotine resistance QTL mapped in the DSPR holds two cytochrome P450 genes,
_Cyp28d1_ and _Cyp28d2_. Chakraborty et al. (2019) found that the founders carry
different duplications there: A2 has two copies of a 15 kb segment holding both
genes, B1 three, and B4 a 6 kb duplication. A1 has B4's duplication with a
transposon inside the second _Cyp28d1_ copy. The A2 and B4 alleles resist
nicotine best and express _Cyp28d1_ most. dm6 has the single-copy allele.

- Open the portal page's
  [Cyp28d1 example](https://genomes.jbrowse.org/pangenomes/fly/?region=chr2L:5,200,000-5,220,000).
- Read the map: one bubble over both genes, with a form per allele. BOG1_A2 is
  15 kb longer than dm6, BER1_B1 38 kb, RVC3_B4 6.1 kb and Canton-S_A1 11 kb.
- Press **Graph** to open the bubble in the graph view.

The map also draws alleles the paper did not describe: KSA2 and A4_HiFi 5.3 kb
longer, SAM_HiFi 3.3 kb. Two Bloomington stocks share Canton-S_A1's 11 kb form,
and CantonS_Yunnan shares BOG1_A2's 15 kb.

## Strn-Mlck: the Curved wing mutant

The Curved (c¹) wing mutation was described a century ago and never placed in
the genome. Samano et al. (2026) traced it to a 7.5 kb DM412 retrotransposon
inside an exon of the muscle gene _Strn-Mlck_, which truncates its transcript.

- Open the portal page's
  [Strn-Mlck example](https://genomes.jbrowse.org/pangenomes/fly/?region=chr2R:15,940,000-15,995,000).
- Find the 7.5 kb insertion at `chr2R:15,953,909`, carried by BDSC_156 alone.

The bubbles to its right are copy-number variants in the gene's PEVK repeats:
almost every assembly differs from dm6 there, by up to 2.7 kb. The same stock,
BDSC_156, carries the plexus (px¹) wing-vein allele, a 1.5 kb duplication split
by a second DM412, which the portal's **plexus** example opens.

## CHKov1: an allele the reference carries

Aminetzach et al. (2005) found a Doc transposon in the coding sequence of
_CHKov1_ that truncates the protein and raises resistance to an organophosphate
insecticide. Magwire et al. (2011) found that the same insertion protects
against the sigma virus, and that it is now the commonest form of the gene. dm6
carries the Doc, so the assemblies without it appear as a 4.5 kb deletion.

- Open the portal page's
  [CHKov1 example](https://genomes.jbrowse.org/pangenomes/fly/?region=chr3R:25,320,000-25,335,000).
- Read the deletion's carriers: Oregon-R, BOG1_A2, three Bloomington stocks and
  two of the HiFi strains lack the Doc; the other 22 assemblies have it.

The portal's **Jheh** example reads the same way: dm6 carries Bari-Jheh, a 1.7
kb Bari1 transposon that adds antioxidant response elements upstream of _Jheh1_
and _Jheh2_ (Guio et al. 2014), and six assemblies lack it.

## Loading the graph in your own JBrowse {#load-the-graph}

The portal's launches load these tracks for you. In your own JBrowse, we'll load
the reference, then the graph and its bubbles. The graph track names the file
prefix `gfa-to-tabix build` writes, and the `uri`s below are our hosted copy, so
swap the prefix for your own build.

```json addassembly
{
  "name": "dm6",
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/dm6/bigZips/dm6.2bit",
  "refNameAliases": {
    "uri": "https://jbrowse.org/ucsc/dm6/dm6.chromAlias.txt"
  }
}
```

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "fly_minigraph_segments",
  "name": "Fly pangenome (rGFA segments)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph",
    "format": 2,
    "coarse": {
      "uri": "https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.fold10000",
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
  "trackId": "fly_minigraph_bubbles",
  "name": "Fly pangenome bubbles",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.bubbles.bed.gz",
    "csi": true
  }
}
```

## Building the fly graph

The fly genome is small enough for one `minigraph` run over every chromosome at
once, reference first so that its segments take rank 0, the earliest build
order:

<!-- from: scripts/build_fly_pangenome.sh -->

```bash
# -xggs: incremental graph construction, adding each genome in turn
# -c: base-level alignment, which minigraph recommends for graph generation
minigraph -cxggs -t 8 dm6.fa KSA2.fa QI2.fa ... CantonS_Yunnan.fa > fly.gfa
```

[](/docs/tutorials/pangenome_prepare_graph) then turns the graph into the files
above with one command, `gfa-to-tabix build`.
[`build_fly_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_fly_pangenome.sh)
runs the whole build on Linux, since it needs GNU tools. It downloads the 30
assemblies from NCBI with the `datasets` CLI and took 19 hours of `minigraph`
time on 8 threads. It:

- downloads each assembly with its sequence report
- keeps each assembly's chromosomes, renamed to PanSN
  (`sample#haplotype#contig`) from the report, and drops unplaced scaffolds
- runs `minigraph` over all of them
- writes the index files

Three assemblies hold chromosome 3 as one sequence where dm6 has the arms 3L and
3R; the script keeps it whole, and `minigraph` aligns it to both arms. The
script stops if:

- a segment has an `SN` tag that names no kept chromosome
- a segment id repeats
- the rank-0 segments are not dm6's eight chromosomes at their full length

A graph that fails any of these has wrong coordinates that every later check
accepts, so copy these audits into your own build.

## See also

- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_prepare_graph)

## Citations

- Li et al. (2020).
  [The design and construction of reference pangenome graphs with minigraph](https://doi.org/10.1186/s13059-020-02168-z)
- Chakraborty et al. (2019).
  [Structural variants exhibit widespread allelic heterogeneity and shape variation in complex traits](https://doi.org/10.1038/s41467-019-12884-1)
- Samano et al. (2026).
  [Structural variants are enriched in deleterious visible phenotypes in Drosophila](https://doi.org/10.1101/gr.281434.125)
- Aminetzach et al. (2005).
  [Pesticide resistance via transposition-mediated adaptive gene truncation in Drosophila](https://doi.org/10.1126/science.1112699)
- Magwire et al. (2011).
  [Successive increases in the resistance of Drosophila to viral infection through a transposon insertion followed by a Duplication](https://doi.org/10.1371/journal.pgen.1002337)
- Guio et al. (2014).
  [The transposable element Bari-Jheh mediates oxidative stress response in Drosophila](https://doi.org/10.1111/mec.12711)
