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
2 side by side, one lane per haplotype drawn in the coordinates of its own
assembly, and use the pangenome graph to show where neighbouring lanes match.
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

- for
  [Whole-genome synteny from a GFA's walks](#whole-genome-synteny-from-a-gfas-walks):
  `python3` and the [JBrowse CLI](/docs/cli) for `make-pif`

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710).

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- the release's minigraph-cactus graph as a GFA:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz
- the assemblies:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/assemblies_release2_v1.0.index.csv
- the CAT gene annotation index, one GFF3 per haplotype:
  https://raw.githubusercontent.com/human-pangenomics/hprc_intermediate_assembly/main/data_tables/annotation/cat/cat_genes_hprc_r2_v1.3.index.csv

<details>
<summary>Read by URL (no download needed)</summary>

- our tabix index files of the graph's haplotype walks and bubbles, with the
  exact build recorded beside them: https://jbrowse.org/demos/hprc/README.txt

</details>

## Configuring the haplotype lanes track

One track draws the lanes, reading each haplotype's walk from tabix-indexed
files we built from the release's graph. The HPRC page's **Haplotypes** launch
adds it, and the config below is the one to adapt for your own graph:

- **A lane** is one haplotype's walk, its route through the graph.
- **`assemblyNames`** lists an assembly per haplotype. The track finds each walk
  through the assembly's `sample#haplotype` alias (`HG00097.1` is aliased
  `HG00097#1`), which
  [one assembly entry](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
  declares.
- **`assemblyNameToPanSN`** names the walk of an assembly with no such alias,
  here GRCh38's.
- **The walk files** for a graph of your own come from
  [Hosting your own graph](/docs/tutorials/pangenome_prepare_graph#haplotype-walks-tabix).

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "hprc_v2_1_walk_lanes",
  "name": "HPRC v2.1 haplotypes vs GRCh38, read from the walk files",
  "assemblyNames": ["hg38", "HG00097.1", "HG00099.1"],
  "adapter": {
    "type": "WalkTabixSyntenyAdapter",
    "walksUri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.GRCh38",
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
**CFH / CFHR** example, the complement factor H gene cluster, then
**Haplotypes**. A lane missing _CFHR3_ and _CFHR1_ (Hughes et al. 2006), such as
HG00253's second haplotype, breaks across both genes.

<Figure caption="The CFH cluster from the haplotypes launch: RefSeq genes over one lane per structural configuration, each lane a haplotype's contig read from the graph, under its CAT genes. HG00253's second haplotype lacks CFHR3 and CFHR1, and its lane breaks across both." src="/img/pangenome/hprc_gbz_cfhr_lanes.png" />

## GSTT1: a gene GRCh38's chromosome lacks

GRCh38's chromosome 22 carries the common _GSTT1_ deletion, so the gene sits on
an alternate contig and no chr22 track draws it. From any **Haplotypes** launch,
we'll move to `chr22:23,950,001-24,060,000`, choose `HG00128.2`, `HG01960.1`,
`HG00146.2`, `HG01109.1`, `HG00099.1`, `HG00232.1`, `HG00133.1`, `HG00126.2`,
`HG00146.1` and `HG00097.1` under **Lanes → Choose lanes...**, and then:

- **Lanes → Order lanes by structure** stacks each lane beside the one whose
  deletions and insertions against GRCh38 are most alike, so the haplotypes
  carrying _GSTT1_ sit as one block.
- **The band between two lanes** aligns the two haplotypes to each other, read
  off the nodes both walks share. It fans open where the lower lane carries
  sequence the upper one lacks, and runs unbroken between two carriers.

<Figure caption="The GSTT1 window from the haplotypes launch with ten lanes ordered by structure, under the RefSeq genes. The lanes that match GRCh38 come first; under the last of them the band fans open across the inserted sequence, and the carriers below join in unbroken bands." src="/img/multiway_synteny/hprc_gstt1_lanes.png" />

## FLNA / EMD: two genes in the opposite order {#inversions}

An inversion keeps the same sequence and reverses it, so no lane changes length.
_FLNA_ and _EMD_ sit between two inverted repeats on Xq28, and the block between
them is inverted on many X chromosomes (Small et al. 1997). From any
**Haplotypes** launch, we'll move to `chrX:154,320,001-154,410,000`, choose
`HG00097.1`, `HG00099.1`, `HG00099.2` and `HG01978.1` under **Lanes → Choose
lanes...**, and then:

- **The band between two lanes** crosses itself where the lower lane runs the
  block in the other direction.
- **HPRC release 2 bubbles** in the track selector adds the graph's bubbles, the
  places where haplotype paths split and rejoin. `gfatools bubble` flags one as
  `inversion` when its paths disagree about orientation, and **Filter by... →
  Edit filters...** on that track keeps the flagged ones:

  ```text
  jexl:feature.inversion
  ```

- **HPRC v2.1 graph (rGFA segments)** in the track selector draws the window's
  graph in the force-directed layout.

<Figure caption="The FLNA / EMD window with the RefSeq genes, the bubbles track filtered to inversions, four lanes and the force-directed graph, the flagged bubble shaded. The band crosses between HG00099's two haplotypes and runs straight between the two lanes under it, which both carry EMD ahead of FLNA. The graph draws the block as a loop off the backbone." src="/img/pangenome/hprc_inversion.png" />

## What the lanes leave out {#limits}

The three loci above are ones the lanes draw well. These are the cases where
they mislead, each measured on HPRC release 2.1 in October 2026;
[part 1](/docs/tutorials/pangenome_hprc#limits) lists the limits of the graph
and the VCF behind them.

- **A haplotype the graph does not align has no lane.** The page says how many:
  116 at FLNA / EMD, the haplotypes without an X chromosome. At other loci the
  assembly has the sequence and the graph leaves it out, so a missing lane is
  not a deletion.
- **A lane can be empty and correct.** Where a haplotype's deletion is longer
  than the window, the graph has no walk for it there and the launch opens no
  row. Around SMN1 / SMN2 four of eight lanes are 190 to 250 kb deletions that
  draw nothing in a 60 kb window.
- **A lane can stop partway.** A haplotype aligned for part of a window draws
  that part and ends. The gap after it is where the graph's alignment stops, not
  where the sequence does.
- **One lane stands for many haplotypes.** The page picks one haplotype per
  structural form, and a form groups haplotypes by their structural variants of
  50 bp or more. Two haplotypes in one form can still differ in everything
  smaller.
- **Near-identical gene copies are not told apart.** The graph puts the copies
  at RHD / RHCE and CYP2D6 on one path, so a lane there cannot show how many
  copies a haplotype carries.

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

1. downloads the 63 GB release graph
2. converts eight haplotypes' walks against GRCh38's and indexes the PAF
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

## External links

- Li H. [gfatools](https://github.com/lh3/gfatools), whose `bubble` subcommand
  flags the inversion.
- [gfa-to-tabix](https://github.com/GMOD/gfa-to-tabix#walks), which files each
  haplotype's walk under the reference so a window is one range request.

## Citations

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose graph, assemblies and CAT annotations this page reads.
- Hughes AE et al.
  [A common CFH haplotype, with deletion of CFHR1 and CFHR3, is associated with lower risk of age-related macular degeneration](https://doi.org/10.1038/ng1890).
  Nature Genetics, 2006.
- Small K, Iber J, Warren ST.
  [Emerin deletion reveals a common X-chromosome inversion mediated by inverted repeats](https://doi.org/10.1038/ng0597-96).
  Nature Genetics, 1997.
