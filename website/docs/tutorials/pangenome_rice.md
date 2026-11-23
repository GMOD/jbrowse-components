---
title: Pangenome (rice)
description:
  Load a rice pangenome graph and a callset with one row per assembly, then read
  the Green Revolution semi-dwarf deletion, three grain-width alleles and a 90
  kb insertion that the reference lacks
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: Other species
---

Rice breeders have tracked a few structural variants for decades: the deletion
in _SD1_ that made the Green Revolution's semi-dwarf varieties, deletions
upstream of the grain-width gene _qSW5_, and the _Pup1_ insertion that lets some
varieties grow in phosphorus-poor soil. We find each one in 47 rice assemblies,
cultivated, weedy and wild, aligned with `minigraph` into a graph on AGIS-1.0,
the telomere-to-telomere assembly of the japonica variety Nipponbare. The graph
track draws each bubble, a place where the assemblies' sequences split and
rejoin, and a callset made by mapping every assembly back onto the graph lists
which allele each assembly has there, one VCF column per assembly. Nipponbare is
a temperate japonica, so where it has a derived allele, the other assemblies
appear as the change. We:

- load AGIS-1.0 with its RefSeq genes, the graph, its bubbles and the callset as
  tracks in JBrowse
- at _sd1_, sort the callset's rows by genotype at the semi-dwarf deletion
- at _qSW5_, tell three grain-width alleles apart by color in the callset
- at _Pup1_, read which assemblies have the 90 kb insertion
- build the graph and the callset from the NCBI assemblies

The rice graph page on
[genomes.jbrowse.org](https://genomes.jbrowse.org/pangenomes/rice) loads the
same graph, bubbles and assemblies' alleles in the JBrowse 5 development build,
until JBrowse 5 ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the
  [portal page](https://genomes.jbrowse.org/pangenomes/rice) already loads it
- to make the callset and build the graph:
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

The reference is AGIS-1.0 (GCF_034140825.1) from UCSC GenArk, and the 47
assemblies are NCBI GenBank records, listed with their accessions in the
[README](https://jbrowse.org/demos/rice_pangenome/README.txt) beside the files.

Nothing to download: the track configs below read the files by URL.
[Building the rice graph](#building-the-rice-graph) and
[Making the callset](#making-the-callset) build them from assemblies of your
own.

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                                         | File                                                                                                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AGIS-1.0, as 2bit                                                                  | [GCF_034140825.1.2bit](https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/GCF_034140825.1.2bit)                   |
| The graph, as rGFA                                                                 | [rice-agis1-minigraph.rgfa.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.rgfa.gz)                               |
| Segments and links, the graph's nodes and edges at their reference coordinates     | [rice-agis1-minigraph.graph.bed.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.graph.bed.gz)                     |
| Bubbles, where the assemblies' paths split and rejoin                              | [rice-agis1-minigraph.bubbles.bed.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.bubbles.bed.gz)                 |
| The whole-chromosome overview, with variants under 10 kb folded into the reference | [rice-agis1-minigraph.fold10000.graph.bed.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.fold10000.graph.bed.gz) |
| The callset, each assembly's allele at every bubble                                | [rice-agis1-minigraph.vcf.gz](https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.vcf.gz)                                 |

</details>

## Load the genome, the graph and the callset

We'll load AGIS-1.0 and its RefSeq genes as the GenArk hub describes them. The
hub's alias table maps the RefSeq names (`NC_089035.1`) to `chr1` to `chr12`,
the names the graph uses, and `refNameColumnHeaderName` makes `chr1` the name
the view shows. The add-genome form has no field for it, so the entry goes in
the config's `assemblies` list as written:

```json
{
  "name": "GCF_034140825.1",
  "displayName": "Rice (AGIS-1.0)",
  "aliases": ["AGIS-1.0"],
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "GCF_034140825.1-ReferenceSequenceTrack",
    "adapter": {
      "type": "TwoBitAdapter",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/GCF_034140825.1.2bit",
      "chromSizes": "https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/GCF_034140825.1.chrom.sizes.txt"
    }
  },
  "refNameAliases": {
    "adapter": {
      "type": "RefNameAliasAdapter",
      "refNameColumnHeaderName": "ucsc",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/GCF_034140825.1.chromAlias.txt"
    }
  }
}
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "GCF_034140825.1-ncbiRefSeq",
  "name": "NCBI RefSeq genes (AGIS-1.0)",
  "assemblyNames": ["GCF_034140825.1"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/034/140/825/GCF_034140825.1/bbi/GCF_034140825.1_ASM3414082v1.ncbiRefSeq.bb",
    "aggregateField": "name2"
  }
}
```

The graph track's `uri` is the file prefix of the segment index and its
overview. The graph names the reference's sequences `Nipponbare#1#chr1`, so
`assemblyNameToPanSN` maps the assembly to that prefix. Swap the `uri`s for your
own build's:

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
    "assemblyNameToPanSN": { "GCF_034140825.1": "Nipponbare" },
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

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "rice_minigraph_bubbles",
  "name": "Rice pangenome bubbles",
  "assemblyNames": ["GCF_034140825.1"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.bubbles.bed.gz",
    "csi": true,
    "assemblyNameToPanSN": { "GCF_034140825.1": "Nipponbare" }
  }
}
```

The callset has one record per bubble and one haploid genotype per assembly. Its
alleles are symbolic (`<X:1>`, `<X:2>`), and the `ALEN` field lists each
allele's length, the reference's first. The display config:

- `rows.field: "haplotype"` draws one row per assembly and colors each record's
  commonest alternate allele blue and every other alternate allele red, so two
  alternate alleles at a site get different colors
- `records.labels.description` writes the allele lengths beside each record's ID
  in the band above the rows

```json addtrack loc=chr1:39,008,001-39,020,000
{
  "type": "VariantTrack",
  "trackId": "rice_pangenome_vcf",
  "name": "Rice pangenome callset",
  "assemblyNames": ["GCF_034140825.1"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/rice_pangenome/rice-agis1-minigraph.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearVariantDisplay",
      "rows": { "field": "haplotype" },
      "records": {
        "labels": { "description": "jexl:feature.INFO.ALEN + ' bp'" }
      }
    }
  ]
}
```

## sd1: the Green Revolution's semi-dwarf deletion

The semi-dwarf rice varieties of the Green Revolution have defective alleles of
_SD1_, which encodes an oxidase of gibberellin biosynthesis. Monna et al. (2002)
found that the allele from the Taiwanese variety Dee-geo-woo-gen, sd1-d, is a
383 bp deletion from the middle of exon 1 to upstream of exon 2, which shifts
the frame. IR64 has this allele, and Nipponbare is tall with the intact gene.
RefSeq names _SD1_ by its gene ID, LOC4325003. We'll open it with the genes, the
callset and the graph:

- Type `chr1:39,008,001-39,020,000` into the location box and turn on the gene
  track, the callset and the graph track.
- Right-click the 383 bp record in the callset and pick **Sort rows by genotype
  here**, which moves the assemblies with the deletion to the top.
- In the graph track's menu, open **Graph settings...** and set **Bubble
  spread** to **Compress lengths**, so the kb and bp segments fit one pane.

<Figure caption="SD1 (LOC4325003) with the callset sorted at the shaded 383 bp record, which runs from exon 1 into exon 2. Its carriers sit at the top; the column at the left is a commoner 237 bp deletion upstream of the gene." src="/img/pangenome/rice_sd1.png" />

IR64 and eight other assemblies have sd1-d. The upstream 237 bp deletion is in
most assemblies, those with sd1-d among them.

## qSW5: three grain-width alleles

A deletion upstream of the grain-width gene _qSW5_ (_GW5_, LOC4338011) lowers
its expression and widens the grain. Lee et al. (2015) distinguished three
alleles: Kasalath's, with no deletion; an indica allele with a 950 bp deletion;
and Nipponbare's, with a 1,212 bp deletion. AGIS-1.0 has the 1,212 bp deletion,
so the callset records the other two as alternate alleles of one record, with
lengths 504 (the reference's), 1,715 and 766 bp: 1.2 kb and 260 bp more sequence
than the reference has there.

- Type `chr5:5,374,001-5,390,000` into the location box.
- Right-click the record at `chr5:5,379,833` and pick **Sort rows by genotype
  here**.

<Figure caption="qSW5 (LOC4338011) with the callset sorted at the record upstream of the gene. Blue rows have the commonest allele, with no deletion; red rows have the 950 bp deletion; grey rows have AGIS-1.0's 1,212 bp deletion." src="/img/pangenome/rice_qsw5.png" />

Kasalath, IR64 and 9311 have no deletion. The three weedy rices, CX20, YZ-2 and
PI653432, are among the assemblies with the 950 bp deletion, and Balilla,
Udai21, Changxianggeng1813 and Wuyunjing8 share the reference's.

## Pup1: a 90 kb insertion the reference lacks

Kasalath's _Pup1_ locus, for tolerance of phosphorus-poor soil, holds the
protein kinase gene _PSTOL1_. Gamuyao et al. (2012) found that the gene is
absent from the reference genome and from other phosphorus-starvation-intolerant
modern varieties, and Vigueira et al. (2016) place it in an insertion of about
90 kb. The callset has one record at the insertion point, whose alleles are the
reference's 39 bp, a second 39 bp sequence, and insertions of 46 to 89 kb.

- Type `chr12:15,866,141-15,866,870` into the location box, a window between the
  bubbles on either side.
- Right-click the record and pick **Sort rows by genotype here**, which groups
  the rows by allele.
- Click a cell to read that assembly's allele and its length.

<Figure caption="Pup1 with the callset sorted at its one record. Blue rows have the commonest allele, 39 bp like the reference's; each red row has an insertion of 46 to 89 kb." src="/img/pangenome/rice_pup1.png" />

Kasalath and SL190 share the 89 kb insertion. Fifteen more assemblies have
insertions of 46 to 77 kb at the same point, and IR64 and most of the rest have
the 39 bp allele.

## Building the rice graph

The rice genome is small enough for one `minigraph` run over every chromosome at
once, reference first so that its segments take rank 0, the earliest build
order:

<!-- from: scripts/build_rice_pangenome.sh -->

```bash
# -xggs: incremental graph construction, adding each genome in turn
# -c: base-level alignment, which minigraph recommends for graph generation
minigraph -cxggs -t 8 Nipponbare.fa SL001.fa SL010.fa ... Wuyunjing8.fa > rice.rgfa
```

Three commands then write the files the tracks read. `gfa-to-tabix` writes the
segment and link index, with each segment at its coordinate on the reference:

<!-- from: scripts/build_rice_pangenome.sh -->

```bash
# --layout contig: each segment at its SN/SO coordinate; writes
#   rice.graph.bed.gz and its .tbi
gfa-to-tabix rice.rgfa.gz --layout contig -o rice
```

The bubbles come from gfatools:

<!-- from: scripts/build_rice_pangenome.sh -->

```bash
gfatools bubble rice.rgfa | sort -k1,1 -k2,2n | bgzip > rice.bubbles.bed.gz
tabix -C -p bed rice.bubbles.bed.gz
```

The overview folds every variant under 10 kb into the reference, for whole
chromosomes:

<!-- from: scripts/build_rice_pangenome.sh -->

```bash
# --below: the size to fold under; --layout matches the index's
gfa-to-tabix fold rice.rgfa.gz --below 10000 --layout contig -o rice.fold10000
```

[](/docs/tutorials/pangenome_prepare_graph) explains each file and the other
layouts.

## Making the callset

The callset comes from mapping each assembly back onto the graph, whose rGFA
holds no path lines. `minigraph --call` writes the walk one assembly takes
through every bubble:

<!-- from: scripts/build_rice_pangenome.sh -->

```bash
# -c: base-level alignment, which --call reads
# -xasm: the assembly-to-graph preset
# --call: one line per bubble, in the same order for every assembly
minigraph -cxasm --call -t 8 rice.rgfa.gz assembly.fa > assembly.call.bed
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
# sed: drop the PanSN prefix on the graph's sequence names, so CHROM is chr1
paste Nipponbare.call.bed assembly1.call.bed assembly2.call.bed \
  | k8 mgutils.js merge -s samples.txt - \
  | sed 's/^Nipponbare#1#//' | cat header.txt - > merged.bed
# -r0: the first column is the reference; -a: the most alternate alleles a
#   record can list, one per assembly
# bcftools view -s ^Nipponbare: drop the reference's own column
k8 mgutils-es6.js merge2vcf -r0 -a 3 merged.bed \
  | bcftools view -s ^Nipponbare -Oz -o rice.vcf.gz
tabix -p vcf rice.vcf.gz
```

The build script also writes each record's bubble as its ID, and drops the
records where AGIS-1.0's own call is not allele 0.

## Reproduce it end to end

[`build_rice_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rice_pangenome.sh)
runs every step on this page. It runs on Linux, since it needs GNU tools, and
takes most of a day: the graph took 5.5 hours of `minigraph` time on 8 threads,
and each assembly's call loads the graph's index, 15 to 19 GB. The script:

- downloads AGIS-1.0 and the 47 assemblies from NCBI with their sequence
  reports, and keeps each assembly's twelve chromosomes, renamed to PanSN
  (`sample#haplotype#contig`)
- builds the graph and stops if a segment has an `SN` tag naming no kept
  chromosome, if a segment id repeats, or if the rank-0 segments are not
  AGIS-1.0's twelve chromosomes at their full length
- writes the segment index, the bubbles and the overview
- maps each assembly back onto the graph and merges the calls into the callset

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rice_pangenome.sh
bash build_rice_pangenome.sh rice_pangenome   # writes ./rice_pangenome/
```

Point each track's `uri` at the files it writes to open your own run.

## See also

- [](/docs/tutorials/pangenome_fly)
- [](/docs/tutorials/pangenome_cattle)
- [](/docs/tutorials/pangenome_prepare_graph)

## Citations

- Li et al. (2020).
  [The design and construction of reference pangenome graphs with minigraph](https://doi.org/10.1186/s13059-020-02168-z)
- Monna et al. (2002).
  [Positional cloning of rice semidwarfing gene, sd-1: rice "green revolution gene" encodes a mutant enzyme involved in gibberellin synthesis](https://doi.org/10.1093/dnares/9.1.11)
- Lee et al. (2015).
  [Influence of multi-gene allele combinations on grain size of rice and development of a regression equation model to predict grain parameters](https://doi.org/10.1186/s12284-015-0066-1)
- Gamuyao et al. (2012).
  [The protein kinase Pstol1 from traditional rice confers tolerance of phosphorus deficiency](https://doi.org/10.1038/nature11346)
- Vigueira et al. (2016).
  [Long-term balancing selection at the Phosphorus Starvation Tolerance 1 (PSTOL1) locus in wild, domesticated and weedy rice (Oryza)](https://doi.org/10.1186/s12870-016-0783-7)
