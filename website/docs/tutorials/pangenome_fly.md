---
title: Pangenome (fly)
description:
  Load a Drosophila melanogaster pangenome graph and a callset with one row per
  assembly, then read the duplication alleles of a nicotine resistance gene, the
  transposon behind a classic wing mutant and a resistance allele the reference
  has
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: Other species
---

Fly geneticists have traced several traits to structural variants: duplications
of a cytochrome P450 gene that resist nicotine, a transposon that bends the wing
of the Curved mutant, and a transposon in _CHKov1_ that protects against an
insecticide and a virus. We find each one in 29 _Drosophila melanogaster_
assemblies aligned with `minigraph` into a graph on the dm6 reference: the
founders of the Drosophila Synthetic Population Resource (DSPR) and other
strains of Chakraborty et al. (2019), 11 Bloomington stocks with classical
visible mutations that Samano et al. (2026) assembled, three single-fly PacBio
HiFi strains and a Canton S. The graph track draws each bubble, a place where
the assemblies' sequences split and rejoin, and a callset made by mapping every
assembly back onto the graph lists which allele each assembly has there, one VCF
column per assembly. dm6 is ISO1, itself a laboratory strain, so where it has a
transposon the strains without one appear as a deletion. We:

- load dm6 with its RefSeq genes, the graph, its bubbles and the callset as
  tracks in JBrowse
- at _Cyp28d1_, sort the callset's rows by genotype to group the duplication
  alleles
- at _Strn-Mlck_, find the one Bloomington stock with the Curved insertion
- at _CHKov1_, read which assemblies lack the reference's transposon
- build the graph and the callset from the NCBI assemblies

The fly graph page on
[genomes.jbrowse.org](https://genomes.jbrowse.org/pangenomes/fly) loads the same
graph, bubbles and assemblies' alleles in the JBrowse 5 development build, until
JBrowse 5 ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the
  [portal page](https://genomes.jbrowse.org/pangenomes/fly) already loads it
- to build the graph and the callset:
  [`minigraph`](https://github.com/lh3/minigraph), the `k8` JavaScript shell
  that runs minigraph's `mgutils` scripts, bcftools, htslib (`bgzip`, `tabix`),
  gfatools, [`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix) 5.0 or later
  and NCBI's `datasets`

<!-- BEGIN GENERATED TUTORIAL_INSTALL minigraph,k8,bcftools,htslib,gfatools,gfa-to-tabix,datasets -->

```bash
# Debian/Ubuntu
sudo apt install bcftools tabix
# or conda, which has every tool above
conda install -c bioconda -c conda-forge minigraph k8 bcftools htslib \
  gfatools ncbi-datasets-cli
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/datasets \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/dataformat
chmod +x ~/.local/bin/datasets ~/.local/bin/dataformat
# any platform
cargo install gfa-to-tabix
```

<!-- END GENERATED TUTORIAL_INSTALL minigraph,k8,bcftools,htslib,gfatools,gfa-to-tabix,datasets -->

## The data

The reference is dm6, which the build takes from NCBI as GCF_000001215.4 and
JBrowse reads as UCSC's copy, and the 29 assemblies are NCBI GenBank records,
listed with their accessions in the
[README](https://jbrowse.org/demos/fly_pangenome/README.txt) beside the files.

Nothing to download: the track configs below read the files by URL.
[Building the fly graph](#building-the-fly-graph) and
[Making the callset](#making-the-callset) build them from assemblies of your
own.

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                                         | File                                                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| dm6 (BDGP Release 6), as 2bit                                                      | [dm6.2bit](https://hgdownload.soe.ucsc.edu/goldenPath/dm6/bigZips/dm6.2bit)                                                  |
| The graph, as rGFA                                                                 | [fly-dm6-minigraph.rgfa.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.rgfa.gz)                               |
| Segments and links, the graph's nodes and edges at their reference coordinates     | [fly-dm6-minigraph.graph.bed.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.graph.bed.gz)                     |
| Bubbles, where the assemblies' paths split and rejoin                              | [fly-dm6-minigraph.bubbles.bed.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.bubbles.bed.gz)                 |
| The whole-chromosome overview, with variants under 10 kb folded into the reference | [fly-dm6-minigraph.fold10000.graph.bed.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.fold10000.graph.bed.gz) |
| The callset, each assembly's allele at every bubble                                | [fly-dm6-minigraph.vcf.gz](https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.vcf.gz)                                 |

</details>

## Load the genome, the graph and the callset

We'll load dm6 and its RefSeq genes from the UCSC hub on jbrowse.org, whose
alias table maps dm6's NCBI names onto `chr2L` and the rest:

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
  "type": "FeatureTrack",
  "trackId": "dm6_ncbiRefSeq_ucsc",
  "name": "NCBI RefSeq genes (dm6)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/ucsc/dm6/ncbiRefSeq.gff.gz",
    "csi": true
  }
}
```

The graph track's `uri` is the file prefix of the segment index and its
overview. The graph names the reference's sequences `dm6#1#chr2L`, so
`assemblyNameToPanSN` maps the assembly to that prefix. Swap the `uri`s for your
own build's:

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
    "assemblyNameToPanSN": { "dm6": "dm6" },
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

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "fly_minigraph_bubbles",
  "name": "Fly pangenome bubbles",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.bubbles.bed.gz",
    "csi": true,
    "assemblyNameToPanSN": { "dm6": "dm6" }
  }
}
```

The callset has a record for each bubble where dm6's own call is the reference
allele, and one haploid genotype per assembly. Its alleles are symbolic
(`<X:1>`, `<X:2>`), and the `ALEN` field lists each allele's length, the
reference's first. The display config:

- `rows.field: "haplotype"` draws one row per assembly and colors each record's
  commonest alternate allele blue, and the other alternate alleles a color each
  in order of frequency, red for the second. The legend labels a color with its
  allele and `ALEN` path length while one record on screen paints it, and by
  rank ("2nd most common") while alleles of several records share it
- `records.labels.name.show: false` hides each record's ID, which names the
  bubble's end segments
- `records.labels.description` writes the allele lengths on each record in the
  band above the rows, followed by the share of the assemblies with an alternate
  allele

```json addtrack loc=chr2L:5,200,001-5,220,000
{
  "type": "VariantTrack",
  "trackId": "fly_pangenome_vcf",
  "name": "Fly pangenome callset",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/fly_pangenome/fly-dm6-minigraph.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearVariantDisplay",
      "rows": { "field": "haplotype" },
      "records": {
        "labels": {
          "name": { "show": false },
          "description": "jexl:feature.INFO.ALEN + ' bp'"
        }
      }
    }
  ]
}
```

## Cyp28d1: duplication alleles in one bubble

A nicotine resistance QTL mapped in the DSPR holds two cytochrome P450 genes,
_Cyp28d1_ and _Cyp28d2_. Chakraborty et al. (2019) found that the founders have
different duplications there: A2 has two copies of a 15 kb segment holding both
genes, B1 has three, and B4 has a 6 kb duplication. A1 has B4's duplication with
a transposon inside the second _Cyp28d1_ copy. The A2 and B4 alleles resist
nicotine best and express _Cyp28d1_ most. dm6 has the single-copy allele, and
the callset has one record over _Cyp28d1_ with six alternate alleles besides
dm6's.

- Type `chr2L:5,200,001-5,220,000` into the location box and turn on the gene
  track, the callset and the graph track.
- Right-click the record over _Cyp28d1_ and pick **Sort rows by genotype here**,
  which groups the rows by allele.
- In the graph track's menu, open **Graph settings...** and set **Bubble
  spread** to **Compress lengths**, so the kb and bp segments fit one pane.

<Figure caption="Cyp28d1 with the callset sorted at its record over the gene, above the graph track. The callouts name each DSPR founder's allele and how much longer it is than dm6's." src="/img/pangenome/fly_cyp28d1.png" />

Two Bloomington stocks share Canton-S_A1's allele, and CantonS_Yunnan shares
BOG1_A2's. Three alleles the paper did not describe are 5.3 kb longer than dm6's
in KSA2 and A4_HiFi, and 3.3 kb longer in SAM_HiFi.

## Strn-Mlck: the Curved wing mutant

The Curved (c¹) wing mutation was described a century ago and never placed in
the genome. Samano et al. (2026) traced it to a 7.5 kb DM412 retrotransposon
inside an exon of the muscle gene _Strn-Mlck_, which truncates its transcript.

- Type `chr2R:15,953,860-15,953,960` into the location box, where the record at
  `chr2R:15,953,909` is wide enough to click.
- Right-click the record and pick **Sort rows by genotype here**.
- Type `chr2R:15,940,001-15,966,000` to zoom back out; the rows keep their
  order.

<Figure caption="Strn-Mlck with the callset sorted at the 7,511 bp insertion, which BDSC_156 alone has. The graph track draws it as the 7.5 kb loop." src="/img/pangenome/fly_strn_mlck.png" />

The window stops short of the gene's PEVK repeats, where almost every assembly
differs from dm6 in copy number, by up to 2.7 kb. Type
`chr2R:15,940,001-15,995,000` to see them.

## CHKov1: a resistance allele in the reference

Aminetzach et al. (2005) found a Doc transposon in the coding sequence of
_CHKov1_ that truncates the protein and raises resistance to an organophosphate
insecticide. Magwire et al. (2011) found that the same insertion protects
against the sigma virus, and that it is now the commonest form of the gene. dm6
has the Doc, so the assemblies without it have a 4.5 kb deletion in the callset.

- Type `chr3R:25,320,001-25,335,000` into the location box.
- Right-click the record over _CHKov1_ and pick **Sort rows by genotype here**.

<Figure caption="CHKov1 with the callset sorted at the 4.5 kb record. Blue rows lack the Doc that dm6 has; the graph track draws the Doc as the arc over the 1 bp path." src="/img/pangenome/fly_chkov1.png" />

Oregon-R, BOG1_A2, three Bloomington stocks and two of the HiFi strains lack the
Doc, and the other 22 assemblies have it.

## Building the fly graph

The fly genome is small enough for one `minigraph` run over every chromosome at
once, reference first so that its segments take rank 0, the earliest build
order:

<!-- from: scripts/build_fly_pangenome.sh -->

```bash
# -xggs: incremental graph construction, adding each genome in turn
# -c: base-level alignment, which minigraph recommends for graph generation
minigraph -cxggs -t 8 dm6.fa KSA2.fa QI2.fa ... CantonS_Yunnan.fa > fly.rgfa
```

Three commands then write the files the tracks read. `gfa-to-tabix` writes the
segment and link index, with each segment at its coordinate on the reference:

<!-- from: scripts/build_fly_pangenome.sh -->

```bash
# --layout contig: each segment at its SN/SO coordinate; writes
#   fly.graph.bed.gz and its .tbi
gfa-to-tabix fly.rgfa.gz --layout contig -o fly
```

The bubbles come from gfatools:

<!-- from: scripts/build_fly_pangenome.sh -->

```bash
gfatools bubble fly.rgfa | sort -k1,1 -k2,2n | bgzip > fly.bubbles.bed.gz
tabix -C -p bed fly.bubbles.bed.gz
```

The overview folds every variant under 10 kb into the reference, for whole
chromosomes:

<!-- from: scripts/build_fly_pangenome.sh -->

```bash
# --below: the size to fold under; --layout matches the index's
gfa-to-tabix fold fly.rgfa.gz --below 10000 --layout contig -o fly.fold10000
```

[](/docs/tutorials/pangenome_prepare_graph) explains each file and the other
layouts.

## Making the callset

The callset comes from mapping each assembly back onto the graph, whose rGFA
holds no path lines. `minigraph --call` writes the walk one assembly takes
through every bubble:

<!-- from: scripts/build_fly_pangenome.sh -->

```bash
# -c: base-level alignment, which --call reads
# -xasm: the assembly-to-graph preset
# --call: one line per bubble, in the same order for every assembly
minigraph -cxasm --call -t 8 fly.rgfa.gz assembly.fa > assembly.call.bed
```

Two scripts in minigraph's
[`misc/`](https://github.com/lh3/minigraph/tree/master/misc) folder, which the
bioconda package leaves out, merge the calls into a VCF. `mgutils.js merge`
pastes the call files into one row per bubble, and `mgutils-es6.js merge2vcf`
turns that into the VCF, with the reference's column as allele 0:

```bash
# samples.txt: one name per line, in the order of the call files, the
#   reference's first. header.txt: a ##contig line per reference chromosome,
#   which merge2vcf copies into the VCF header
# sed: drop the PanSN prefix on the graph's sequence names, so CHROM is chr2L
paste dm6.call.bed assembly1.call.bed assembly2.call.bed \
  | k8 mgutils.js merge -s samples.txt - \
  | sed 's/^dm6#1#//' | cat header.txt - > merged.bed
# -r0: the first column is the reference; -a: the most alternate alleles a
#   record can list, one per assembly
# bcftools view -s ^dm6: drop the reference's own column
k8 mgutils-es6.js merge2vcf -r0 -a 3 merged.bed \
  | bcftools view -s ^dm6 -Oz -o fly.vcf.gz
tabix -p vcf fly.vcf.gz
```

An assembly with no copy of a chromosome, such as the strains without a chrY,
gets a no-call there. The build script also writes each record's bubble as its
ID, and drops the records where dm6's own call is not allele 0.

## Reproduce it end to end

[`build_fly_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_fly_pangenome.sh)
runs every step on this page. It runs on Linux, since it needs GNU tools, and
takes about a day: the graph took 19 hours of `minigraph` time on 8 threads, and
each assembly's call loads the graph's index, 6 to 10 GB of RAM. `CALL_MAX_GB`
(16 by default) caps each call's memory, so a call that outgrows it stops the
script with an error. The script:

- downloads dm6 and the 29 assemblies from NCBI with their sequence reports, and
  keeps each assembly's chromosomes, renamed to PanSN
  (`sample#haplotype#contig`). Three assemblies hold chromosome 3 as one
  sequence where dm6 has the arms 3L and 3R; the script keeps it whole, and
  `minigraph` aligns it to both arms
- builds the graph and stops if a segment has an `SN` tag naming no kept
  chromosome, if a segment id repeats, or if the rank-0 segments are not dm6's
  eight chromosomes at their full length
- writes the segment index, the bubbles and the overview
- maps each assembly back onto the graph and merges the calls into the callset

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_fly_pangenome.sh
bash build_fly_pangenome.sh fly_pangenome   # writes ./fly_pangenome/
```

Point each track's `uri` at the files it writes to open your own run.

## See also

- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_rice)
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
