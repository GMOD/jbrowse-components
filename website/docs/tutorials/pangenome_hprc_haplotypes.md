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
- for
  [Whole-genome synteny from a GFA's walks](#whole-genome-synteny-from-a-gfas-walks):
  `python3` and the [JBrowse CLI](/docs/cli) for `make-pif`

<!-- TUTORIAL_INSTALL jbrowse-cli START -->

```bash
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL jbrowse-cli END -->

## The data

You don't need these files to follow the page: the HPRC launches read the hosted
tabix indexes. The [build script](#reproduce-it-end-to-end) takes these files
from [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) by URL to
rebuild those indexes. The config under _Configuring the haplotype lanes track_
is the one to adapt for your own graph.

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
- **`assemblyNames`** lists an assembly per haplotype. The track finds each walk
  through the assembly's `sample#haplotype` alias (`HG00097.1` is aliased
  `HG00097#1`), which
  [one assembly entry](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
  declares.
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
    "walksUri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38-f5.GRCh38",
    "assemblyNames": ["hg38"],
    "assemblyNameToPanSN": { "hg38": "GRCh38#0" }
  },
  "displays": [
    { "type": "MultiWaySyntenyDisplay", "height": 600 },
    { "type": "LinearGraphDisplay" }
  ]
}
```

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
- **Filter by... → Edit filters...** on that track keeps the flagged ones with
  this filter:

  ```text
  jexl:feature.inversion
  ```

<Figure caption="FLNA / EMD with the bubbles track filtered to inversions. The band crosses in blue between HG00099's two haplotypes, and the inverted lanes' headers name the inversion." src="/img/pangenome/hprc_inversion.png" />

## What the lanes leave out {#limits}

These cases mislead; [part 1](/docs/tutorials/pangenome_hprc#limits) lists the
limits of the graph and the VCF behind them.

- **A haplotype the graph does not align has no lane.**
- **A lane can be empty and correct.** Where a haplotype's deletion is longer
  than the window, the graph has no walk for it there and the launch opens no
  row.
- **A lane can stop partway**, at the end of the graph's alignment of that
  haplotype; its sequence can run on past it.
- **One lane stands for many haplotypes.** The page picks one haplotype per
  structural form, grouped by structural variants of 50 bp or more, so two
  haplotypes in one form can still differ in everything smaller.
- **Near-identical gene copies share one path**, so a lane at RHD / RHCE or
  CYP2D6 cannot show how many copies a haplotype has.

## Whole-genome synteny from a GFA's walks

A GFA that records each haplotype's walk converts to PAF against the reference
walk, one record per stretch of shared nodes, for a whole-genome synteny view.

Convert the walks you want:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/cmdcolin/gfa-to-pairwise-paf/v1.0.0/gfa_to_pairwise_paf.py
# --contig-lengths: each assembly's .fai, since walks omit contig lengths
gzip -dc graph.gfa.gz | python3 gfa_to_pairwise_paf.py --reference GRCh38#0 \
  --queries HG01109#1,HG00099#1 --contig-lengths contigs.fai > graph.paf
```

Index the PAF for JBrowse:

<!-- from: scripts/build_hprc_multiway_synteny.sh -->

```bash
jbrowse make-pif graph.paf --csi --out graph.pif.gz
```

## Reproduce it end to end

The HPRC build runs that conversion on the release graph. It:

1. downloads the release graph
2. converts the haplotypes' walks against GRCh38's and indexes the PAF
3. fetches each haplotype's contig lengths and CAT genes
4. writes a `config.json` with one assembly per haplotype

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_multiway_synteny.sh
bash build_hprc_multiway_synteny.sh
```

[Its output is hosted](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/hprc_multiway/config.json)
and opens at the CFH deletion, one lane per haplotype under GRCh38.

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
- Hughes AE et al.
  [A common CFH haplotype, with deletion of CFHR1 and CFHR3, is associated with lower risk of age-related macular degeneration](https://doi.org/10.1038/ng1890).
  Nature Genetics, 2006.
- Small K, Iber J, Warren ST.
  [Emerin deletion reveals a common X-chromosome inversion mediated by inverted repeats](https://doi.org/10.1038/ng0597-96).
  Nature Genetics, 1997.
