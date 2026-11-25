---
title: Pangenome (cattle)
description:
  Open the bovine super-pangenome, deconstruct it into the callset that lists
  each assembly's alleles, and find published breed and species variants in it
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: Other species
---

The bovine super-pangenome
([Leonard et al. 2023](https://doi.org/10.1186/s13059-023-02969-y)) is one graph
of a set of assemblies on the ARS-UCD1.2 cattle reference, a Hereford that is
itself one of them: taurine and indicine breeds, yak, bison and gaur. Each
assembly is a named path through the graph, and `vg deconstruct` turns those
paths into a VCF, so JBrowse can show one locus both as a graph of where
sequence is present and absent and as a callset listing which assemblies have
it. We:

- load the graph as a graph track, and open a whole chromosome with small
  variants folded
- load the deconstructed callset as a variant track with one row per assembly,
  over the graph track, at _HSPA1A_
- add OMIA's curated variants as a track, and open the Celtic polled allele at
  the POLLED locus
- open a repeat upstream of _KIT_ and a deletion of _TAS2R46_ in the callset and
  the graph track

Each step loads its tracks into your own JBrowse. The graph's page on
[genomes.jbrowse.org](https://genomes.jbrowse.org/pangenomes/bovine) loads the
same graph, bubble and callset tracks with RefSeq genes, and launches the
JBrowse 5 development build until JBrowse 5 ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below, which needs JBrowse 5;
  until JBrowse 5 ships, that is the
  [development build](https://jbrowse.org/code/jb2/main/). In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the
  [portal page](https://genomes.jbrowse.org/pangenomes/bovine) already loads it
- `python3` and htslib (`bgzip`, `tabix`), to build the
  [OMIA track](#add-omias-cattle-variants-and-open-the-polled-locus)
- [`vg`](https://github.com/vgteam/vg), to
  [deconstruct](#load-the-callset-under-the-graph-at-hspa1a) the graph into a
  callset
- [`gfatools`](https://github.com/lh3/gfatools) and
  [`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix) 5.0.0 or later, to
  [index the graph](#build-the-bovine-graph)

<!-- BEGIN GENERATED TUTORIAL_INSTALL htslib,vg,gfatools,gfa-to-tabix -->

```bash
# Debian/Ubuntu
sudo apt install tabix
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib vg gfatools
# any platform
cargo install gfa-to-tabix
```

<!-- END GENERATED TUTORIAL_INSTALL htslib,vg,gfatools,gfa-to-tabix -->

## The data

The graph and callset tracks read the hosted files by URL. The OMIA track reads
a file you build from OMIA's dump with
[the script under the polled locus](#add-omias-cattle-variants-and-open-the-polled-locus).

| What it is                                                    | File                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| OMIA's database dump, the source of the curated variant track | [omia.sql.gz](https://omia.org/static/omia.sql.gz)       |
| The published graphs the build starts from, 12 GB             | [Zenodo 7737904](https://doi.org/10.5281/zenodo.7737904) |

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                                                   | File                                                                                                                                            |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| The segment and link index                                                                   | [bovine-arsucd12-minigraph.graph.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.graph.bed.gz)                     |
| The bubble index, where assemblies' paths split and rejoin                                   | [bovine-arsucd12-minigraph.bubbles.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.bubbles.bed.gz)                 |
| The overview used for whole chromosomes, with variants under 10 kb folded into the reference | [bovine-arsucd12-minigraph.fold10000.graph.bed.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.fold10000.graph.bed.gz) |
| The deconstructed callset, a genotype column for each assembly but the reference             | [bovine-arsucd12-minigraph.vcf.gz](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.vcf.gz)                                 |
| The callset's sample table, each assembly's breed and lineage                                | [bovine-arsucd12-minigraph.samples.tsv](https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.samples.tsv)                       |

</details>

## Load the genome and the graph

We'll load the reference the graph is anchored to, then the graph track. Swap
the prefix in `uri` for the one your
[indexing commands](#build-the-bovine-graph) wrote, which name the tabix-indexed
segments and links and the overview.

```json addassembly genome=bosTau9
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
    "format": 2,
    "coarse": {
      "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.fold10000",
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

The RefSeq genes and the number of segments in each bubble, as a curve, go above
the graph:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "bosTau9_ncbiRefSeq_ucsc",
  "name": "NCBI RefSeq genes (bosTau9)",
  "assemblyNames": ["bosTau9"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/ucsc/bosTau9/ncbiRefSeq.gff.gz",
    "csi": true
  }
}
```

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "bovine_bubble_score",
  "name": "Bovine super-pangenome: variability (segments per bubble)",
  "assemblyNames": ["bosTau9"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.bubbles.bed.gz",
    "csi": true
  }
}
```

## Open chr23 with small variants folded {#overview-of-chr23-with-one-node-per-variant-region}

Turn on **NCBI RefSeq genes (bosTau9)**, **Bovine super-pangenome: variability
(segments per bubble)** and **Bovine super-pangenome (rGFA segments)** in the
track selector, then type `chr23` into the location box. Over the whole
chromosome, the graph track reads its coarse tier, in which every variant under
10 kb is folded into the reference. As it draws, it also folds each variant
narrower than 10 pixels, which at this zoom leaves chr23 as one line with its
genes. The curve of segments per bubble marks where the assemblies differ most.

<Figure caption="Chromosome 23 with RefSeq genes, segments per bubble as a curve, and the graph track." src="/img/pangenome/bovine_whole_chromosome.png" />

## Load the callset under the graph at HSPA1A

ARS-UCD1.2 lacks an 11 kb segment beside the heat shock gene _HSPA1A_, which
contains _HSPA1B_, its near-identical copy. The graph track draws the segment as
a loop off the reference.

The callset has a genotype for each assembly but the reference. We ran
`vg deconstruct` once per chromosome over the same graph:

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
# rename the reference path (HER, Hereford) to the assembly's refName, so
# deconstruct writes CHROM as chr1
awk -F'\t' -v OFS='\t' '$1 == "P" && $2 == "HER" { $2 = "chr1" } { print }' \
  1.gfa > chr1.gfa
# -p: vg's PackedGraph format, which deconstruct reads
vg convert -g chr1.gfa -p > chr1.vg
# -p: the reference path to decompose against
# -a: nested snarls too, so a bubble inside a bubble gets a record
vg deconstruct -p chr1 -a -t 8 chr1.vg > chr1.vcf
```

`vg deconstruct` reads each assembly's path from a P line, which these published
graphs hold. A minigraph rGFA has no P lines, so for one of your own,
`minigraph --call` maps each assembly back through the graph and writes its
allele at every bubble.

The VCF's CHROM column is the `-p` path name, which has to equal the assembly's
refName. Its sample names are the three-letter codes on each assembly's path,
and the sample table's first column has to match them. On a mismatch JBrowse
leaves the row unlabelled and raises no error:

```text
name	breed	lineage
ANG	Angus	taurine
BIS	Bison	bison
```

The display config below gives each assembly a row, a color, a label and its
breed order:

- `rows.field: "haplotype"` draws one row per assembly, each alternate allele in
  a color by its frequency: blue for the commonest, then red, then dark green
- `rows.sort` lists the cattle breeds above the wild species, and `rows.labels`
  writes each breed beside its row
- `rows.color` is a
  [grammar-of-graphics color scale](/docs/config_guides/mark_display) on each
  row's label bar, mapping the sample table's `lineage` column through `domain`
  to `range`
- `records.labels.name.show: false` hides each record's ID, which names the
  bubble's end segments

```json addtrack loc=chr23:27,508,000-27,536,000
{
  "type": "VariantTrack",
  "trackId": "bovine_pangenome_vcf",
  "name": "Bovine super-pangenome variants (12 assemblies)",
  "assemblyNames": ["bosTau9"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.vcf.gz",
    "csi": true,
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.samples.tsv"
    }
  },
  "displayDefaults": {
    "rows": {
      "field": "haplotype",
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
      },
      "color": {
        "field": "lineage",
        "scale": {
          "domain": ["taurine", "indicine", "gaur", "bison", "yak"],
          "range": ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00"]
        }
      }
    },
    "records": {
      "labels": {
        "name": { "show": false }
      }
    }
  }
}
```

Type `chr23:27,508,000-27,536,000` to draw the graph around _HSPA1A_. Then:

- Turn on the RefSeq genes and the callset in the track selector.
- Open **Graph settings...** in the graph track's menu and set **Bubble spread**
  to **Compress lengths**, which pulls the longest and shortest nodes towards
  the mean so a cut spanning kb and bp nodes fits one pane.

<Figure caption="HSPA1A with the deconstructed callset, one row per assembly, over the graph track. The graph draws the insertion as the charcoal loop. At its record, bison's cell is red and gaur's dark green, two more alleles of the insertion, which the key names with their lengths." src="/img/pangenome/bovine_bola.png" />

## Open published variants in the callset

Each locus below is a structural variant a paper reported in one of these breeds
or species. The rows of assemblies without it are the control.

### Add OMIA's cattle variants and open the polled locus

Medugorac et al. (2012) traced the Celtic form of polledness to a 202 bp
duplication and insertion on chromosome 1, which OMIA, the Online Mendelian
Inheritance in Animals database, curates as OMIA 000483-9913.[^friesian]

To add OMIA to your own JBrowse,
[`build_omia_cattle_variants.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_omia_cattle_variants.sh)
writes `omia_cattle_variants.gff3.gz` from OMIA's nightly database dump. It
keeps the cattle records published on ARS-UCD1.2 or ARS-UCD1.3, which share
every chromosome's coordinates:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_omia_cattle_variants.sh
# .: write the file and its index here, beside your config, instead of omia_cattle_build/
bash build_omia_cattle_variants.sh .
```

Add the records as a track:

```json addtrack
{
  "trackId": "omia_cattle_variants",
  "name": "OMIA causal variants (cattle)",
  "uri": "omia_cattle_variants.gff3.gz",
  "csi": true,
  "assemblyNames": ["bosTau9"],
  "displayDefaults": {
    "labels": {
      "description": "jexl:feature.inheritance"
    }
  }
}
```

Then open `chr1:2,428,800-2,429,800`.

<Figure caption="The POLLED locus with OMIA's record of the Celtic polled allele above the callset, in which Angus alone has the 202 bp insertion." src="/img/pangenome/bovine_polled.png" />

### Open the repeat upstream of KIT

Simmental and Hereford cattle have white heads. Milia et al. (2025) tied the
trait to a 14.3 kb segment repeated in tandem upstream of _KIT_: white-headed
breeds have extra copies, and color-headed breeds have a deletion. The Hereford
reference holds one collapsed copy. Open `chr6:70,080,000-70,180,000`.

<Figure caption="Upstream of KIT with the callset and the graph track, which draws the deletion as a dashed arc." src="/img/pangenome/bovine_kit.png" />

### Open the TAS2R46 deletion in gaur

_TAS2R46_ encodes a bitter taste receptor. Leonard et al. (2022) found a 17 kb
deletion in gaur that removes it. Open `chr5:98,575,000-98,615,000`.

<Figure caption="TAS2R46 with the callset and the graph track, which draws the deletion as a dashed arc." src="/img/pangenome/bovine_tas2r46.png" />

## Build the bovine graph

The Zenodo archive (Leonard et al. 2023) holds one
[minigraph](https://github.com/lh3/minigraph) graph (Li et al. 2020) per
autosome. Before indexing, the build script joins them and recovers their rGFA
tags:

- **Joining the autosomes**: each graph numbers its segments from 1, so the
  script renumbers and concatenates them.
- **Recovering rGFA tags**: the graphs hold their coordinates in P lines, and
  [`gfa_paths_to_rgfa.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/gfa_paths_to_rgfa.py)
  converts them back into `SN`/`SO`/`SR` tags (each segment's contig, offset and
  rank).

The commands below write the segment and link index and the coarse tier, in the
contig layout, and the bubbles. The graph track's `uri` is the prefix the first
command writes.

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
# --layout contig: each segment under its coordinate on its source contig
gfa-to-tabix bovine-arsucd12-minigraph.rgfa.gz --layout contig -o bovine-arsucd12-minigraph
```

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
# gfatools bubble writes the bubbles unsorted
gzip -dc bovine-arsucd12-minigraph.rgfa.gz | gfatools bubble - | sort -k1,1 -k2,2n |
  bgzip > bovine-arsucd12-minigraph.bubbles.bed.gz
tabix -f -C -p bed bovine-arsucd12-minigraph.bubbles.bed.gz
```

<!-- from: scripts/build_bovine_pangenome.sh -->

```bash
# --below: fold variants under 10 kb into the reference, in the same layout
gfa-to-tabix fold bovine-arsucd12-minigraph.rgfa.gz --below 10000 --layout contig -o bovine-arsucd12-minigraph.fold10000
```

## Reproduce it end to end

[`build_bovine_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bovine_pangenome.sh)
builds every hosted file on Linux, since it needs GNU tools. It downloads the 12
GB Zenodo archive, then:

- joins the autosomes' graphs and recovers their rGFA tags, and stops if the
  reference path's chromosome lengths differ from bosTau9's
- indexes the graph, its bubbles and the coarse tier with the commands above
- deconstructs the callset with the `vg deconstruct` call above, one chromosome
  at a time

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_bovine_pangenome.sh
bash build_bovine_pangenome.sh
```

A [README.txt](https://jbrowse.org/demos/bovine_pangenome/README.txt) beside the
hosted files lists the source and every modification.

## See also

- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_rice)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_prepare_graph)

## Citations

- Leonard et al. (2022).
  [Structural variant-based pangenome construction has low sensitivity to variability of haplotype-resolved bovine assemblies](https://doi.org/10.1038/s41467-022-30680-2)
- Leonard et al. (2023).
  [Graph construction method impacts variation representation and analyses in a bovine super-pangenome](https://doi.org/10.1186/s13059-023-02969-y),
  with its graphs on [Zenodo](https://doi.org/10.5281/zenodo.7737904)
- Li et al. (2020).
  [The design and construction of reference pangenome graphs with minigraph](https://doi.org/10.1186/s13059-020-02168-z)
- Medugorac et al. (2012).
  [Bovine polledness: an autosomal dominant trait with allelic heterogeneity](https://doi.org/10.1371/journal.pone.0039477)
- Milia et al. (2025).
  [Taurine pangenome uncovers a segmental duplication upstream of KIT associated with depigmentation in white-headed cattle](https://doi.org/10.1101/gr.279064.124)

[^friesian]:
    OMIA also records the Friesian polled allele, a larger duplication further
    along, which Holstein cattle have, but the panel has no Holstein assembly.
