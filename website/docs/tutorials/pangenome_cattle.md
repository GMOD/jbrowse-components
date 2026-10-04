---
title: Pangenome (cattle)
description:
  Open the bovine super-pangenome, deconstruct it into the callset that lists
  each assembly's alleles, and find published breed and species variants in it
guide_category: Tutorials
tutorial_category: Pangenomes
---

The bovine super-pangenome builds twelve assemblies into one graph on the
ARS-UCD1.2 cattle reference, a Hereford that is itself one of the twelve:
taurine and indicine breeds, yak, bison and gaur. Each assembly is a named path
through the graph, and `vg deconstruct` turns those paths into a VCF, so one
locus reads both as a graph of where sequence is present and absent and as a
callset listing which assemblies have it. We:

- read a whole chromosome with one node per variant region
- at _HSPA1A_, compare the graph's list of alleles with the callset
- find three published breed and species variants in the callset

Every step starts from the graph's page on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/bovine),
where it stays until the graph plugin's JBrowse 5 host ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- `python3` and htslib (`bgzip`, `tabix`), to build the
  [OMIA track](#the-celtic-polled-allele)
- [`vg`](https://github.com/vgteam/vg), to
  [deconstruct](#hspa1a-in-the-graph-and-the-callset) the graph into a callset

## Where the data comes from

The graph's index files, the callset and its sample table are hosted beside the
graph, and OMIA supplies the curated causal variants:

- the segment and link index:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.segs.bed.gz
  and
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.links.bed.gz
- the bubble index, where assemblies' paths split and rejoin:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.bubbles.bed.gz
- the allele inventory, one row per alternative sequence at a bubble:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.alleles.bed.gz
- the overview used for whole chromosomes, one node per bubble:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.tier10000.segs.bed.gz
  and
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.tier10000.links.bed.gz
- the deconstructed callset:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.vcf.gz
- the breed and lineage of each assembly in the callset:
  https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.samples.tsv
- OMIA's database dump, the source of the curated variant track:
  https://omia.org/static/omia.sql.gz

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) describes each
file and how to produce it.

## Load the genome and the graph

We'll load the reference the graph is anchored to, then the graph track. Swap
the prefix in `uri` for your own build of `build_pangenome_graph.sh`, which
writes the tabix-indexed segments and links and the overview.

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
      "uri": "https://jbrowse.org/demos/bovine_pangenome/bovine-arsucd12-minigraph.tier10000",
      "aboveBpPerPx": 880
    }
  },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

## Overview of chr23 with one node per variant region

Click **chr23** on the **Whole chromosome** line of the
[portal page](https://staging.genomes.jbrowse.org/pangenomes/bovine). The whole
chromosome opens with the graph drawn as one node per bubble, a stretch where
the assemblies' paths split and rejoin.

<Figure caption="Chromosome 23 on ARS-UCD1.2, one axis: RefSeq genes, a curve of how many segments each bubble holds (higher means more variation), and the graph with one node per bubble. The curve peaks over BoLA." src="/img/pangenome/bovine_whole_chromosome.png" />

The curve peaks over BoLA, the cattle major histocompatibility complex (immune
genes that vary a lot between breeds). The heat shock gene _HSPA1A_, the subject
of the next section, lies inside it. The portal's **Loci** table ranks the
genome's most variable stretches this way; see
[Ranking the graph's bubbles](/docs/tutorials/pangenome_mouse#finding-the-loci).

## HSPA1A in the graph and the callset

ARS-UCD1.2 lacks an 11 kb segment beside the heat shock gene _HSPA1A_, which
contains _HSPA1B_, its near-identical copy. Leonard et al. (2022) recovered it
in every assembly they built. The **graph** lists that segment in the allele
inventory. Its `firstSeenIn` column names the first assembly in a fixed list,
because these graphs record no build order; that assembly may lack the sequence.

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
and the sample table's first column has to match them; a mismatch leaves the row
unlabelled without an error:

```text
name	breed	lineage
ANG	Angus	taurine
BIS	Bison	bison
```

The track config uses the other columns, a breed and a lineage per code:

- `rows.labels` writes the breed beside each row
- `rowColor` tints each row by lineage
- `rows.domain` lists the cattle breeds above the wild species
- `renderingMode: "phased"` draws one row per assembly, each being one
  haplotype, with a second alternate allele in a separate colour
- `showVariantLane` draws each call once in a lane above the rows, across the
  reference span it replaces, labelled with its VCF ID (the graph nodes that
  bound it) and the allele change

```json addtrack
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
      "renderingMode": "phased",
      "showVariantLane": true,
      "rows": {
        "domain": [
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
        "domain": ["taurine", "indicine", "gaur", "bison", "yak"],
        "range": ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00"]
      }
    }
  ]
}
```

In the chr23 view the portal opened, type `chr23:27,508,000-27,536,000`, and the
graph track cuts the segments around _HSPA1A_. Turn on the callset and the
allele inventory in the track selector. An insertion has no reference span to
draw along, so pick **Layout → Force-directed layout** and **Bubble spread →
Compress lengths** from the graph track's menu; the figure shows all three
tracks under the RefSeq genes.

<Figure caption="HSPA1A on ARS-UCD1.2: RefSeq genes, the deconstructed callset with one row per assembly, the allele inventory, and the graph track. The variant lane over the rows marks the insertion beside HSPA1A. Every row but the yak has the insertion, which the inventory lists once, and the graph draws it as the charcoal loop off the backbone at HSPA1A." src="/img/pangenome/bovine_bola.png" />

The yak row has the reference allele. Leonard et al. built no yak assembly, so
their result does not cover it.

Leonard et al. published the bovine graph with a path line per assembly, and
`vg deconstruct` reads those paths. A graph straight out of `minigraph` has no
path lines and so no callset to deconstruct; [](/docs/tutorials/pangenome_mouse)
starts from such a graph.

## Published variants in the callset

Each locus below is a structural variant a paper reported in one of these breeds
or species. The rows without it are the control.

### The Celtic polled allele

Angus cattle are born without horns. Medugorac et al. (2012) traced the Celtic
form of polledness to a 202 bp duplication and insertion on chromosome 1, which
OMIA, the Online Mendelian Inheritance in Animals database, curates as OMIA
000483-9913.

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

Then open `chr1:2,424,000-2,436,000`.

<Figure caption="The POLLED locus on ARS-UCD1.2: OMIA's record of the Celtic polled allele, and the callset, whose variant lane names the call and its allele change. Only the Angus row has the insertion under the record." src="/img/pangenome/bovine_polled.png" />

OMIA also records the Friesian polled allele, an 80 kb duplication 200 kb
further along, which Holstein cattle have. The panel has no Holstein, and the
callset holds nothing that size there.

### A repeat upstream of KIT in white-headed cattle

Simmental and Hereford cattle have white heads. Milia et al. (2025) tied the
trait to a 14.3 kb segment repeated in tandem upstream of _KIT_: white-headed
breeds have extra copies, colour-headed breeds a deletion. The Hereford
reference holds one collapsed copy. Open `chr6:70,080,000-70,180,000`.

<Figure caption="Upstream of KIT on ARS-UCD1.2: RefSeq genes and the callset, whose variant lane draws the record across the repeat and names its alleles. The Simmental row has a distinct allele across the repeat, and every other row has the deletion." src="/img/pangenome/bovine_kit.png" />

The larger box at the left of the Simmental row is an insertion the length of
the 14.3 kb segment: Simmental has one more copy than the Hereford reference.

### A deletion of TAS2R46 in gaur

_TAS2R46_ encodes a bitter taste receptor. Leonard et al. (2022) found a 17 kb
deletion in gaur that removes it. Open `chr5:98,575,000-98,615,000`.

<Figure caption="TAS2R46 on ARS-UCD1.2: RefSeq genes and the callset, whose variant lane draws the record over the deleted span and names its alleles. The gaur row has the deletion, and four cattle rows have a different allele across the same span." src="/img/pangenome/bovine_tas2r46.png" />

The four cattle rows, Angus, Piedmontese, Brahman and Nellore, hold an allele
slightly longer than the reference, and the insertion boxed in each row, between
TAS2R46 and the next gene, is most of the difference. Two taurine and two
indicine breeds share that allele, and only the gaur's deletes the span.

## Building the bovine graph files

[](/docs/tutorials/pangenome_prepare_graph) turns a graph into the files above
with one command, `build_pangenome_graph.sh`. The published bovine graphs need
three steps beyond it, which
[`build_bovine_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bovine_pangenome.sh)
runs:

- **Join the autosomes.** The archive holds one graph per autosome, each
  numbering its segments from 1, so the script renumbers and concatenates them.
- **Recover rGFA tags.** The graphs state their coordinates in P lines, and
  [`gfa_paths_to_rgfa.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/gfa_paths_to_rgfa.py)
  converts them back into `SN`/`SO`/`SR` tags (each segment's contig, offset and
  rank).
- **Deconstruct the callset**, with the `vg deconstruct` call above.

The whole build takes about half an hour after the download.

The script stops if the reference path does not reproduce bosTau9's chromosome
lengths, and a
[README.txt](https://jbrowse.org/demos/bovine_pangenome/README.txt) beside the
hosted files records the source and every modification.

Leonard et al. also built pggb and Minigraph-Cactus graphs of the same twelve
assemblies, base-level GFAs with path lines and no rGFA tags.
`build_pangenome_graph.sh` reads their paths and writes an `SM:Z:` tag per
segment listing the assemblies that pass through it, which the graph track
shows.

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
