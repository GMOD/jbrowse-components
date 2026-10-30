---
title: 'Pangenome (HPRC) part 2: haplotypes against each other'
sidebar_label: Pangenome (HPRC pt 2, haplotypes against each other)
description:
  Draw HPRC haplotypes as lanes in assembly coordinates, aligned to each other
  by the release's pangenome graph, at a CFH deletion, the GSTT1 gene GRCh38
  lacks and the FLNA / EMD inversion
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

We draw human haplotypes from the Human Pangenome Reference Consortium's release
2 side by side, one lane per haplotype drawn in that haplotype's assembly
coordinates, and use the pangenome graph to show where neighbouring lanes match.
With that view we:

- at CFH, find haplotypes missing two genes
- at GSTT1, find haplotypes with a gene GRCh38's chromosome lacks
- at FLNA / EMD, find haplotypes with two genes in the opposite order

:::caution Experimental

The graph view is a beta plugin, and the
[HPRC page](https://genomes.jbrowse.org/pangenomes/) launches it on the JBrowse
5 development build until JBrowse 5 ships. We welcome your [feedback](/contact).

A lane shows only what the graph aligned, and some haplotypes get no lane at
all. Read [what the lanes leave out](#limits) before reading an absent or empty
lane as a deletion.

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the HPRC
  page's launches and the hosted config already load it

## The data

You don't need these files to follow the page: the HPRC launches read the hosted
tabix indexes, built from these files of
[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710).
[Reproduce it end to end](#reproduce-it-end-to-end) names the build. The config
under _Configuring the haplotype lanes track_ is the one to adapt for your own
graph.

| What it is                                            | File                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The release's minigraph-cactus graph as a GFA         | [hprc-v2.1-mc-grch38.gfa.gz](https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz)  |
| The assemblies                                        | [assemblies_release2_v1.0.index.csv](https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv)            |
| The CAT gene annotation index, one GFF3 per haplotype | [cat_genes_hprc_r2_v1.3.index.csv](https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv) |

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                                                                  | File                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Our tabix index files of the graph's haplotype walks and bubbles, with the exact build recorded beside them | [README.txt](https://jbrowse.org/demos/hprc/README.txt) |

</details>

## Configuring the haplotype lanes track

One track draws the lanes, reading each haplotype's walk from tabix-indexed
files we built from the release's graph. The HPRC page's **Haplotypes** launch
adds it, and the config below is the one to adapt for your own graph:

- **A lane** is one haplotype's walk, which lists in order the nodes that
  haplotype passes through.
- **`assemblyNames`** starts with the anchor, the assembly the walk file's
  reference is loaded as. A haplotype needs no entry: its lane draws on an
  assembly whose `sample#haplotype` alias matches it (`HG00097.1` is aliased
  `HG00097#1`), which
  [one assembly entry](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
  declares, and a haplotype with no assembly is still a lane.
- **`assemblyNameToPanSN`** names the walk of an assembly with no such alias,
  here GRCh38's.
- The walk files for a graph of your own come from
  [Hosting your own graph](/docs/tutorials/pangenome_prepare_graph#haplotype-walks-tabix).

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "hprc_v2_1_walk_lanes",
  "name": "HPRC v2.1 haplotypes vs GRCh38, read from the walk files",
  "assemblyNames": ["hg38", "HG00097.1", "HG00099.1"],
  "adapter": {
    "type": "WalkTabixSyntenyAdapter",
    "walksUri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38-f5s.GRCh38",
    "assemblyNames": ["hg38"],
    "assemblyNameToPanSN": { "hg38": "GRCh38#0" }
  },
  "displays": [
    { "type": "MultiWaySyntenyDisplay", "height": 600 },
    { "type": "LinearGraphDisplay" }
  ]
}
```

## Where each haplotype's genes come from {#haplotype-genes}

JBrowse draws each lane, and each bar under **Walk rows**, with the genes of
that haplotype's own assembly, at its own coordinates. It does not lift GRCh38's
genes across the graph.

- **The source:** HPRC annotated each release 2 assembly with CAT (the
  Comparative Annotation Toolkit), which projects GENCODE's GRCh38 genes onto
  it, in the [CAT index](#the-data) above.
- **What we host:** one gene model per named gene for each haplotype, as
  `https://jbrowse.org/pangenome/hprc-grch38/genes/<sample>.<haplotype>.genes.bed.gz`.
  A haplotype keeps about 43,500 of CAT's 83,000 genes:
  - Each model is the gene's Ensembl canonical transcript as CAT projected it,
    else its longest coding transcript.
  - A gene with no symbol is dropped, and so is one spanning over 5 Mb.
  - Where CAT projected two paralogs onto one locus, such as _GSTM1_ onto
    _GSTM2_, we keep the gene whose GRCh38 span the haplotype's walk crosses
    there, in the -f5s walk file the lanes read.
  - CAT misses genes that only GRCh38's alternate contigs hold. We splice
    GENCODE's models of _GSTT1_, _LILRA3_, _HLA-DRB3_, _HLA-DRB4_ and _HLA-DRB5_
    onto each haplotype's assembly instead, where its walk crosses them.
  - [README.txt](https://jbrowse.org/pangenome/hprc-grch38/genes/README.txt)
    beside the files gives every rule and what CAT still misses.
- **How a lane finds them:** each haplotype is an assembly, such as `HG00097.1`
  aliased `HG00097#1`, holding one track, **CAT genes (HG00097 haplotype 1, HPRC
  release 2)**. JBrowse draws that track in the haplotype's lane, and for each
  of the first 40 walk-row bars reads it over the bar's span on the haplotype's
  contig and boxes each gene where it falls along the bar.
- **Reading them:**
  - A gene missing from a lane is missing from that haplotype's annotation,
    through a deletion, a copy CAT did not project, or a gene the rules above
    dropped.
  - CAT names each copy of a duplicated gene after the GRCh38 copy it projected,
    so HG00232.1, with seven _AMY1_ copies, reads _AMY1C_ five times. The number
    of _AMY1_ boxes gives the copy number, unless CAT missed a copy.
  - HG002's two haplotypes have no CAT annotation, so their lanes and bars draw
    no genes.

## CFH: haplotypes missing two genes

Open the [HPRC page](https://genomes.jbrowse.org/pangenomes/hprc) and click the
**CFH / CFHR** example, the complement factor H gene cluster. Under **More about
this window**, click **Haplotypes**. A lane missing _CFHR3_ and _CFHR1_ (Hughes
et al. 2006) opens a hole across both.

<Figure caption="The CFH cluster from the haplotypes launch. The HG00253 haplotype 2 lane opens a hole where its walk skips CFHR3 and CFHR1." src="/img/pangenome/hprc_cfhr_lanes.png" />

## GSTT1: a gene GRCh38's chromosome lacks

GRCh38's chromosome 22 has the common _GSTT1_ deletion, so the gene sits on an
alternate contig and no chr22 track draws it. From any **Haplotypes** launch,
we'll move to `chr22:23,950,001-24,060,000`, choose `HG00128.2`, `HG01960.1`,
`HG00146.2`, `HG01109.1`, `HG00099.1`, `HG00232.1`, `HG00133.1`, `HG00126.2`,
`HG00146.1` and `HG00097.1` under **Lanes → Choose lanes...**, and then:

- **Lanes → Order lanes by structure** stacks each lane beside the one whose
  deletions and insertions against GRCh38 are most alike.
- **The band between two lanes** aligns the two haplotypes on the nodes both
  walks share, and fans open where the lower lane has sequence the upper lacks.

<Figure caption="GSTT1 with ten lanes ordered by structure." src="/img/multiway_synteny/hprc_gstt1_lanes.png" />

## FLNA / EMD: two genes in the opposite order {#inversions}

_FLNA_ and _EMD_ sit between two inverted repeats on Xq28, and the block between
them is inverted on many X chromosomes (Small et al. 1997). From any
**Haplotypes** launch, we'll move to `chrX:154,320,001-154,410,000`.

**Lanes → Choose lanes...** takes `HG00097.1`, `HG00099.1`, `HG00099.2` and
`HG01978.1`. Then:

- **The band between two lanes** crosses itself, in blue, where the lower lane
  runs the block in the other direction, and that lane's header names the
  inversion.
- **HPRC release 2 bubbles** in the track selector adds the graph's bubbles.
  `gfatools bubble` flags one as `inversion` when its paths disagree about
  orientation.
- **Filter by → Edit filters...** on that track keeps the flagged ones with this
  filter:

  ```text
  jexl:feature.inversion
  ```

<Figure caption="FLNA / EMD with the bubbles track filtered to inversions. The band crosses in blue between HG00099's two haplotypes, and the inverted lanes' headers name the inversion." src="/img/pangenome/hprc_inversion.png" />

## What the lanes leave out {#limits}

These cases mislead; [part 1](/docs/tutorials/pangenome_hprc#limits) lists the
limits of the graph and the VCF behind them.

- **A haplotype the graph does not align has no lane.**
- **A lane can stand for a deletion.** Where a haplotype's deletion covers at
  least one whole 64 kb chunk of the walk file and spans the window, up to about
  2 Mb, the -f5s file's skip rows still give it a lane. The lane centres where
  the haplotype crosses the deletion, and the window's ribbon narrows to that
  point. Walk rows, which
  [part 3](/docs/tutorials/pangenome_hprc_repeats#amylase) opens, draw it as a
  deletion row. A shorter or longer deletion opens no lane for that haplotype.
  At IGH, IGK and IGL such a lane is often the cell line's deletion, as
  [part 1's limits](/docs/tutorials/pangenome_hprc#limits) explain.
- **A lane can stop partway**, at the end of the graph's alignment of that
  haplotype; its sequence can run on past it.
- **One lane stands for many haplotypes.** The page picks one haplotype per
  structural form, grouped by structural variants of 50 bp or more, so two
  haplotypes in one form can still differ in everything smaller.
- **Near-identical gene copies share one path**, so a lane at RHD / RHCE or
  CYP2D6 cannot show how many copies a haplotype has.

## Reproduce it end to end

[Indexing haplotype walks](/docs/tutorials/pangenome_prepare_graph#haplotype-walks-tabix)
builds the walk files the lanes read, with one command on the release's GFA, and
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside the hosted files
records their provenance. The same page converts the walks to PAF for a
whole-genome synteny view.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_repeats)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/config_guides/grouping_and_ordering)
- [BandageJS](https://jbrowse.org/demos/bandagejs/)

## External links

- Li H. [gfatools](https://github.com/lh3/gfatools), whose `bubble` subcommand
  flags the inversion.
- [gfa-to-tabix](https://github.com/GMOD/gfa-to-tabix/blob/main/docs/walks-format.md),
  which files each haplotype's walk under the reference so a window is one range
  request.
- [ggbandage](https://github.com/GMOD/ggbandage), which draws
  [RHD and CYP2D6 deletions](https://github.com/GMOD/ggbandage/blob/main/docs/gallery.md#rhd-and-cyp2d6-gene-deletions-as-arches)
  as arches over GRCh38 in ggplot2.
- [ggtubemap](https://github.com/GMOD/ggtubemap), which draws haplotypes against
  each other as a tube map in ggplot2,
  [colored by phase](https://github.com/GMOD/ggtubemap#colour-by-anything).

## Citations

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose graph, assemblies and CAT annotations this page reads.
- Hughes et al. (2006).
  [A common CFH haplotype, with deletion of CFHR1 and CFHR3, is associated with lower risk of age-related macular degeneration](https://doi.org/10.1038/ng1890)
- Small et al. (1997).
  [Emerin deletion reveals a common X-chromosome inversion mediated by inverted repeats](https://doi.org/10.1038/ng0597-96)
