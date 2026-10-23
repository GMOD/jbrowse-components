---
title: Pangenome (cattle)
description:
  Open the bovine super-pangenome, deconstruct it into the callset that lists
  each assembly's alleles, and find published breed and species variants in it
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: Mouse and cattle
---

The bovine super-pangenome builds a set of assemblies into one graph on the
ARS-UCD1.2 cattle reference, a Hereford that is itself one of them: taurine and
indicine breeds, yak, bison and gaur. Each assembly is a named path through the
graph, and `vg deconstruct` turns those paths into a VCF, so one locus reads
both as a graph of where sequence is present and absent and as a callset listing
which assemblies have it. We:

- read a whole chromosome with one node per variant region
- at _HSPA1A_, compare the graph's list of alleles with the callset
- find three published breed and species variants in the callset

Every step starts from the graph's page on
[genomes.jbrowse.org](https://genomes.jbrowse.org/pangenomes/bovine), which
launches the JBrowse 5 development build until JBrowse 5 ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the
  [portal page](https://genomes.jbrowse.org/pangenomes/bovine) already loads it
- `python3` and htslib (`bgzip`, `tabix`), to build the
  [OMIA track](#the-celtic-polled-allele)
- [`vg`](https://github.com/vgteam/vg), to
  [deconstruct](#hspa1a-in-the-graph-and-the-callset) the graph into a callset

<!-- TUTORIAL_INSTALL htslib,vg START -->

```bash
# Debian/Ubuntu
sudo apt install tabix
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib vg
```

<!-- TUTORIAL_INSTALL htslib,vg END -->

## The data

The [OMIA build script](#the-celtic-polled-allele) fetches OMIA's dump, and the
track configs below read the hosted files by URL. For a graph of your own, swap
the prefix in `uri` for your `gfa-to-tabix build`, as _Load the genome and the
graph_ shows.

| What it is                                                    | File                                               |
| ------------------------------------------------------------- | -------------------------------------------------- |
| OMIA's database dump, the source of the curated variant track | [omia.sql.gz](https://omia.org/static/omia.sql.gz) |

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                                                   | File                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The segment and link index                                                                   | [bovine-arsucd12-minigraph.segs.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.segs.bed.gz)<br>[bovine-arsucd12-minigraph.links.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.links.bed.gz)                                         |
| The bubble index, where assemblies' paths split and rejoin                                   | [bovine-arsucd12-minigraph.bubbles.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.bubbles.bed.gz)                                                                                                                                                                  |
| The allele inventory, one row per alternative sequence at a bubble                           | [bovine-arsucd12-minigraph.alleles.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.alleles.bed.gz)                                                                                                                                                                  |
| The overview used for whole chromosomes, with variants under 10 kb folded into the reference | [bovine-arsucd12-minigraph.fold10000.segs.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.fold10000.segs.bed.gz)<br>[bovine-arsucd12-minigraph.fold10000.links.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.fold10000.links.bed.gz) |

</details>

## Load the genome and the graph

We'll load the reference the graph is anchored to, then the graph track. Swap
the prefix in `uri` for your own `gfa-to-tabix build`, which writes the
tabix-indexed segments and links and the overview.

```json addassembly
{
  "name": "bosTau9",
  "aliases": ["ARS-UCD1.2"],
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/bosTau9/bigZips/bosTau9.2bit",
  "refNameAliases": {
    "uri": "https://jbrowse.org/ucsc/bosTau9/bosTau9.chromAlias.txt"
  }
}
```

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "bovine_minigraph_segments",
  "name": "Bovine super-pangenome (rGFA segments)",
  "assemblyNames": ["bosTau9"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph",
    "coarse": {
      "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.fold10000",
      "aboveBpPerPx": 1000
    }
  },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

## Overview of chr23 with small variants folded {#overview-of-chr23-with-one-node-per-variant-region}

Open
[chr23 on the portal page](https://genomes.jbrowse.org/pangenomes/bovine/?region=chr23)
and press **Open in JBrowse**. The whole chromosome opens with the graph's
coarse tier, which folds every variant under 10 kb into the reference.

<Figure caption="Chromosome 23 with RefSeq genes, segments per bubble as a curve, and the graph with variants under 10 kb folded into the reference." src="/img/pangenome/bovine_whole_chromosome.png" />

BoLA, the cattle major histocompatibility complex (immune genes that vary a lot
between breeds), contains the heat shock gene _HSPA1A_, the subject of the next
section.

## HSPA1A in the graph and the callset

ARS-UCD1.2 lacks an 11 kb segment beside the heat shock gene _HSPA1A_, which
contains _HSPA1B_, its near-identical copy. Leonard et al. (2022) recovered it
in every assembly they built. The **graph** lists that segment in the allele
inventory. These graphs record no build order, so its `firstSeenIn` column names
the first assembly in a fixed list, which need not contain the segment.

The **callset** gives a genotype per assembly. We ran `vg deconstruct` once per
chromosome over the same graph:

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
# -p: vg's PackedGraph format, which deconstruct reads
vg convert -g chr1.gfa -p > chr1.vg
# -p: the reference path to decompose against
# -a: nested snarls too, so a bubble inside a bubble gets a record
vg deconstruct -p chr1 -a -t 8 chr1.vg > chr1.vcf
```

The VCF's CHROM column is the `-p` path name, which has to equal the assembly's
refName. Its sample names are the three-letter codes on each assembly's path,
and the sample table's first column has to match them. A mismatch leaves the row
unlabelled and raises no error:

```text
name	breed	lineage
ANG	Angus	taurine
BIS	Bison	bison
```

In [grammar-of-graphics](/docs/config_guides/mark_display) terms, `rowColor` in
the track config is a color scale on each row's label bar, mapping the sample
table's `lineage` column through `domain` to `range`. The config also sets:

- `rows.sort` lists the cattle breeds above the wild species, and `rows.labels`
  writes each breed beside its row
- `unit: "haplotype"` draws one row per assembly, each being one haplotype, with
  a second alternate allele in a separate color
- `variants` draws each call once in a band above the rows, across the reference
  span it replaces, labelled with its VCF ID (the graph nodes that bound it) and
  the allele change

```json addtrack loc=chr23:27,508,000-27,536,000
{
  "type": "VariantTrack",
  "trackId": "bovine_pangenome_vcf",
  "name": "Bovine super-pangenome variants (12 assemblies)",
  "assemblyNames": ["bosTau9"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.samples.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "unit": "haplotype",
      "variants": { "show": true },
      "rows": {
        "sort": [
          "ANG",
          "BSW",
          "HIG",
          "OBV",
          "PIE",
          "SIM",
          "BRA",
          "NEL",
          "GAU",
          "BIS",
          "YAK"
        ],
        "labels": {
          "ANG": "Angus",
          "BSW": "Brown Swiss",
          "HIG": "Highland",
          "OBV": "Original Braunvieh",
          "PIE": "Piedmontese",
          "SIM": "Simmental",
          "BRA": "Brahman",
          "NEL": "Nellore",
          "GAU": "Gaur",
          "BIS": "Bison",
          "YAK": "Yak"
        }
      },
      "rowColor": {
        "field": "lineage",
        "scale": {
          "domain": ["taurine", "indicine", "gaur", "bison", "yak"],
          "range": ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00"]
        }
      }
    }
  ]
}
```

In the chr23 view the portal opened, type `chr23:27,508,000-27,536,000` to draw
the graph around _HSPA1A_. Then:

- Turn on the callset and the allele inventory in the track selector.
- Open **Graph settings...** in the graph track's menu and set **Bubble spread**
  to **Compress lengths**. An insertion has no reference span to draw along, and
  the portal opens the graph force-directed, which draws it by its shape.

<Figure caption="HSPA1A with the deconstructed callset, one row per assembly, the allele inventory and the graph track. The graph draws the insertion as the charcoal loop." src="/img/pangenome/bovine_bola.png" />

## Published variants in the callset

Each locus below is a structural variant a paper reported in one of these breeds
or species. The rows without it are the control.

### The Celtic polled allele

Angus cattle are born without horns. Medugorac et al. (2012) traced the Celtic
form of polledness to a 202 bp duplication and insertion on chromosome 1, which
OMIA, the Online Mendelian Inheritance in Animals database, curates as OMIA
000483-9913.[^friesian]

[`build_omia_cattle_variants.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_omia_cattle_variants.sh)
writes `omia_cattle_variants.gff3.gz` from OMIA's nightly database dump. It
keeps the cattle records published on ARS-UCD1.2 or ARS-UCD1.3, which share
every chromosome's coordinates:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_omia_cattle_variants.sh
bash build_omia_cattle_variants.sh
```

Add the records as a track:

```json addtrack
{
  "trackId": "omia_cattle_variants",
  "name": "OMIA causal variants (cattle)",
  "uri": "omia_cattle_variants.gff3.gz",
  "assemblyNames": ["bosTau9"],
  "displayDefaults": {
    "labels": {
      "description": "jexl:feature.inheritance"
    }
  }
}
```

Then open `chr1:2,428,800-2,429,800`. The figure shades
`chr1:2,429,109-2,429,320`, the stretch OMIA records as duplicated by the
allele.

<Figure caption="The POLLED locus with OMIA's record of the Celtic polled allele above the callset." src="/img/pangenome/bovine_polled.png" />

### A repeat upstream of KIT in white-headed cattle

Simmental and Hereford cattle have white heads. Milia et al. (2025) tied the
trait to a 14.3 kb segment repeated in tandem upstream of _KIT_: white-headed
breeds have extra copies, color-headed breeds a deletion. The Hereford reference
holds one collapsed copy. Open `chr6:70,080,000-70,180,000`, and put the graph
track back on the reference's coordinates under the callset with **Anchored**
under the **Layout** row of its menu.

<Figure caption="Upstream of KIT with the callset and the graph track, which draws the deletion as a dashed arc." src="/img/pangenome/bovine_kit.png" />

The larger box at the left of the Simmental row is an insertion the length of
the 14.3 kb segment: Simmental has one more copy than the Hereford reference.

### A deletion of TAS2R46 in gaur

_TAS2R46_ encodes a bitter taste receptor. Leonard et al. (2022) found a 17 kb
deletion in gaur that removes it. Open `chr5:98,575,000-98,615,000`.

<Figure caption="TAS2R46 with the callset and the graph track, which draws the deletion as a dashed arc." src="/img/pangenome/bovine_tas2r46.png" />

Angus, Piedmontese, Brahman and Nellore, two taurine and two indicine breeds,
share that allele, and only the gaur's deletes the span. The insertion boxed in
each of the four rows, between _TAS2R46_ and the next gene, is most of the
difference.

## Building the bovine graph files

[](/docs/tutorials/pangenome_prepare_graph) turns a graph into the files above
with one command, `gfa-to-tabix build`. The published bovine graphs need three
steps beyond it, which
[`build_bovine_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bovine_pangenome.sh)
runs:

- Join the autosomes. The archive holds one graph per autosome, each numbering
  its segments from 1, so the script renumbers and concatenates them.
- Recover rGFA tags. The graphs state their coordinates in P lines, and
  [`gfa_paths_to_rgfa.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/gfa_paths_to_rgfa.py)
  converts them back into `SN`/`SO`/`SR` tags (each segment's contig, offset and
  rank).
- Deconstruct the callset with the `vg deconstruct` call above.

The script stops if the reference path does not reproduce bosTau9's chromosome
lengths, and a
[README.txt](https://jbrowse.org/demos/bovine_pangenome/README.txt) beside the
hosted files records the source and every modification.

Leonard et al. also built pggb and Minigraph-Cactus graphs of the same twelve
assemblies, base-level GFAs with path lines and no rGFA tags.
`gfa-to-tabix build` writes an `SM:Z:` tag per segment listing the assemblies
that pass through it.

## See also

- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_prepare_graph)

## Citations

- Leonard AS, Crysnanto D, Fang ZH, Heaton MP, Vander Ley BL, Herrera C,
  Bollwein H, Bickhart DM, Kuhn KL, Smith TPL, Rosen BD, Pausch H. Structural
  variant-based pangenome construction has low sensitivity to variability of
  haplotype-resolved bovine assemblies. Nature Communications. 2022;13:3012.
  https://doi.org/10.1038/s41467-022-30680-2
- Leonard AS, Crysnanto D, Mapel XM, Bhati M, Pausch H. Graph construction
  method impacts variation representation and analyses in a bovine
  super-pangenome. Genome Biology. 2023;24:124.
  https://doi.org/10.1186/s13059-023-02969-y
- Li H, Feng X, Chu C. The design and construction of reference pangenome graphs
  with minigraph. Genome Biology. 2020;21:265.
  https://doi.org/10.1186/s13059-020-02168-z
- Medugorac I, Seichter D, Graf A, Russ I, Blum H, Göpel KH, Rothammer S,
  Förster M, Krebs S. Bovine polledness: an autosomal dominant trait with
  allelic heterogeneity. PLoS ONE. 2012;7(6):e39477.
  https://doi.org/10.1371/journal.pone.0039477
- Milia S, Leonard AS, Mapel XM, Bernal Ulloa SM, Drögemüller C, Pausch H.
  Taurine pangenome uncovers a segmental duplication upstream of KIT associated
  with depigmentation in white-headed cattle. Genome Research.
  2025;35(4):1041-1052. https://doi.org/10.1101/gr.279064.124

[^friesian]:
    OMIA also records the Friesian polled allele, a larger duplication further
    along, which Holstein cattle have. The panel has no Holstein.
