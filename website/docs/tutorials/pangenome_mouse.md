---
title: Pangenome (mouse)
description:
  Open the mouse strain pangenome, read Nnt against a reference that is itself
  one of the strains, then rank the graph's bubbles and open the densest
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: Other species
---

The mouse strain pangenome is a `minigraph` alignment of eighteen assemblies of
seventeen inbred and wild-derived strains onto the GRCm39 reference. GRCm39 is
itself a strain, C57BL/6J, so the panel's best-known variant, a C57BL/6J
deletion, appears as an insertion. The strain assemblies are those of
[Helmy et al. (2026)](https://doi.org/10.1016/j.xgen.2025.101074), who released
no graph file, so we built this one. To pick a locus from it, we rank the
graph's bubbles, the regions where the strains' paths split and rejoin, by how
many segments each holds, and open the densest that fits a window. We:

- at _Nnt_, open the graph track with bubble halos, then the liftOver lanes that
  show which strains have the gene
- rank the bubbles file by segment count and open the densest that fits a
  window, at _Dock2_
- load the graph and its bubbles as tracks on mm39 in your own JBrowse
- build a minigraph graph from strain assemblies of your own

The first two start from the mouse graph page on
[genomes.jbrowse.org](https://genomes.jbrowse.org/pangenomes/mouse), which
launches the JBrowse 5 development build until JBrowse 5 ships.

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, for the `GraphTrack` below. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the
  [portal page](https://genomes.jbrowse.org/pangenomes/mouse) already loads it
- [`samtools`](https://www.htslib.org/) and htslib (`bgzip`, `tabix`), to
  extract each chromosome and index the files
- [`minigraph`](https://github.com/lh3/minigraph), to build a graph like this
  one
- [`gfatools`](https://github.com/lh3/gfatools), for the graph's bubbles
- [`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix) 5.0.0 or later, for the
  segment index and the coarse tier

<!-- BEGIN GENERATED TUTORIAL_INSTALL samtools,htslib,minigraph,gfatools,gfa-to-tabix -->

```bash
# Debian/Ubuntu
sudo apt install samtools tabix
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools htslib minigraph gfatools
# any platform
cargo install gfa-to-tabix
```

<!-- END GENERATED TUTORIAL_INSTALL samtools,htslib,minigraph,gfatools,gfa-to-tabix -->

## The data

The reference is UCSC's mm39 and the strains are the Mouse Genomes Project
assemblies plus T2T builds of C57BL/6J and CAST/EiJ, as UCSC GenArk rehosts
them.

Nothing to download: the track configs below read the index files by URL, and
the ranking step streams the bubbles file.
[Building a minigraph graph](#building-a-minigraph-graph-from-the-strain-assemblies)
builds the files for strains of your own.

<details>
<summary>The files</summary>

| What it is                                                                         | File                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Mm39 (GRCm39)                                                                      | [mm39.fa.gz](https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.fa.gz)                                                     |
| The eighteen assemblies, one GenArk folder per GenBank accession                   | [GCA/](https://hgdownload.soe.ucsc.edu/hubs/GCA/)                                                                                    |
| Segments and links, the graph's nodes and edges at their reference coordinates     | [mouse-mm39-minigraph.graph.bed.gz](https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.graph.bed.gz)                     |
| Bubbles, where the strains' paths split and rejoin                                 | [mouse-mm39-minigraph.bubbles.bed.gz](https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz)                 |
| The whole-chromosome overview, with variants under 10 kb folded into the reference | [mouse-mm39-minigraph.fold10000.graph.bed.gz](https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.fold10000.graph.bed.gz) |

</details>

## Nnt: a C57BL/6J deletion that appears as an insertion

C57BL/6J has a multi-exon deletion at _Nnt_ (nicotinamide nucleotide
transhydrogenase) that abolishes the protein and makes C57BL/6J mice glucose
intolerant (Toye et al. 2005). **GRCm39 is C57BL/6J**, so the backbone of this
graph, the reference path, is the strain with the deletion, and the other
strains' intact gene is an insertion. To see it:

- Open
  [chr13 on the portal page](https://genomes.jbrowse.org/pangenomes/mouse/?region=chr13)
  and press **Open in JBrowse**, which opens the whole chromosome with the
  graph's variants under 10 kb folded into the reference.
- Type `chr13:119,440,000-119,600,000` to draw the segments there.
- In the graph track's menu, tick **Show → Show bubble halos**.
- Turn on the bubbles track in the track selector.

In the portal's **Nnt** example, the deletion's name is above the map, the other
strains' insertion is labelled "intact Nnt", and each launch opens a **Known
alleles** row over the site.

<Figure caption="Nnt with the RefSeq genes and the bubbles track above the force-directed graph track. Of its four haloed bubbles, the one inside Nnt, labelled as a 16.8 kb insertion with five alleles, is the sequence the other strains have and C57BL/6J lacks." src="/img/pangenome/graph_mouse_nnt_halos.png" />

The graph has no path per strain, so the strains with the exons are read from
mm39's liftOver chains, one lane per strain assembly. We'll open them at the
same gene:

- Open
  [mm39 on staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/ucsc/mm39/)
  and turn on **mm39 vs 76 genomes (liftOver, multi-way)** under **Pairwise
  alignments**.
- Type `Nnt` into the location box.
- In the track menu, pick **Lanes → Choose lanes...**, type `house mouse` into
  the filter and tick the strains, the C57BL/6J T2T assembly among them.

<Figure caption="mm39 at Nnt over the Mus assemblies the liftOver track holds, the C57BL/6J T2T assembly first." src="/img/genomes_synteny/mouse_strains_nnt.png" />

## Ranking the graph's bubbles to find Dock2 {#finding-the-loci}

The bubbles file's fourth column holds the number of segments in each bubble.
Ranked by that count, the bubbles that overlap a gene include the vomeronasal
receptor and Speer families and the immunoglobulin heavy chain locus, each too
wide for one window. The densest bubble that fits in one, and the locus this
page opens, is inside an intron of _Dock2_, at `chr11:34,516,045-34,560,497`.
Rank the bubbles that fit in a 100 kb window, streaming the hosted file, or swap
in the `.bubbles.bed.gz` your own build wrote:

```bash
# $4: the bubble's segment count, printed second; the densest come first
# the file names contigs in PanSN (mm39#0#chr11) with 0-based starts, so the
#   sub() drops the PanSN prefix and $2 + 1 gives the 1-based start the
#   location box takes
curl -s https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz \
  | gzip -dc \
  | awk -v OFS='\t' '$3 - $2 < 100000 { sub(/^.*#/, "", $1); print $1 ":" $2 + 1 "-" $3, $4 }' \
  | sort -t "$(printf '\t')" -k2,2nr | head -20
```

To open the _Dock2_ bubble:

- Paste the top region into the portal page's **Gene or region** box and click
  **Graph**.
- In the graph track's menu, tick **Show → Show bubble halos**.

<Figure caption="The Dock2 intron bubble in the bubbles track and the graph. Each charcoal loop is sequence the reference lacks, and each dashed arc skips mm39 sequence, a deletion in another strain." src="/img/pangenome/mouse_dock2.png" />

## Loading the graph in your own JBrowse {#load-the-graph}

The portal's launches load these tracks for you. In your own JBrowse, we'll load
the reference, then the graph and its bubbles. The graph track's `uri` is the
file prefix the indexing commands under
[Building a minigraph graph](#building-a-minigraph-graph-from-the-strain-assemblies)
write, and the `uri`s below are our hosted copy, so swap the prefix for your own
build.

```json addassembly
{
  "name": "mm39",
  "aliases": ["GRCm39"],
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.2bit",
  "refNameAliases": {
    "uri": "https://jbrowse.org/ucsc/mm39/mm39.chromAlias.txt"
  }
}
```

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "mouse_minigraph_segments",
  "name": "Mouse strain pangenome (rGFA segments)",
  "assemblyNames": ["mm39"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph",
    "format": 2,
    "coarse": {
      "uri": "https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.fold10000",
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
  "trackId": "mouse_minigraph_bubbles",
  "name": "Mouse strain pangenome bubbles",
  "assemblyNames": ["mm39"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/mouse_pangenome/mouse-mm39-minigraph.bubbles.bed.gz",
    "csi": true
  }
}
```

## Building a minigraph graph from the strain assemblies

To build a graph like this one, we'll first extract each chromosome from each
assembly, renamed to PanSN (`sample#haplotype#contig`), since minigraph takes
each segment's stable name from the FASTA headers. `samtools faidx` needs a
bgzip-compressed or plain FASTA:

```bash
# the awk renames the record; the reference takes haplotype 0 (mm39#0#chr13)
samtools faidx strain1.fa.gz chr13 | awk 'NR == 1 { print ">strain1#1#chr13"; next } { print }' > strain1.chr13.fa
```

Then run `minigraph` once per chromosome over those files, reference first so
that its segments take rank 0, the earliest build order:

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
# -xggs: incremental graph construction, adding each genome in turn
# -c: base-level alignment, which minigraph recommends for graph generation
minigraph -cxggs -t 8 mm39.chr13.fa strain1.chr13.fa strain2.chr13.fa > chr13.gfa
```

Three commands turn the joined graph into the files above: the segment and link
index, the bubbles, and the coarse tier, all in the contig layout. The track's
`uri` is the prefix the first command writes.
[](/docs/tutorials/pangenome_prepare_graph#rgfa-contig-layout) lists how these
files differ from the ones `gfa-to-tabix build` writes.

<!-- from: scripts/build_mouse_pangenome.sh -->

```bash
# --layout contig: each segment under its coordinate on its source contig
gfa-to-tabix mouse-mm39-minigraph.rgfa.gz --layout contig -o mouse-mm39-minigraph
# gfatools bubble writes the bubbles unsorted
gzip -dc mouse-mm39-minigraph.rgfa.gz | gfatools bubble - | sort -k1,1 -k2,2n |
  bgzip > mouse-mm39-minigraph.bubbles.bed.gz
tabix -f -C -p bed mouse-mm39-minigraph.bubbles.bed.gz
# --below: fold variants under 10 kb into the reference, in the same layout
gfa-to-tabix fold mouse-mm39-minigraph.rgfa.gz --below 10000 --layout contig -o mouse-mm39-minigraph.fold10000
```

[`build_mouse_pangenome.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_mouse_pangenome.sh)
runs the whole build on Linux, since it needs GNU tools. It downloads about 30
GB, writes about 50 GB of per-chromosome FASTA, holds 30 GB of memory free for
each `minigraph` job, and takes about 27 hours of `minigraph` time at two
chromosomes at once on 8 threads each. It:

- downloads the assemblies
- extracts each chromosome, renamed to PanSN (`sample#haplotype#contig`)
- runs `minigraph` per chromosome
- joins the chromosomes with segment ids renumbered
- indexes the joined graph with the three commands above

The script runs two audits on the joined graph and stops if:

- a segment has an `SN` tag that is neither `mm39#0#chr*` nor `<strain>#1#chr*`
- renumbering leaves a duplicate segment id

A segment with a bad `SN` tag or a duplicate id produces a graph with wrong
coordinates that every later check accepts, so copy these audits into your own
build.

## See also

- [](/docs/tutorials/pangenome_cattle)
- [](/docs/tutorials/pangenome_fly)
- [](/docs/tutorials/pangenome_prepare_graph)

## Citations

- Helmy et al. (2026).
  [High-quality mouse reference genomes reveal the structural complexity of the murine protein-coding landscape](https://doi.org/10.1016/j.xgen.2025.101074),
  the strain assemblies.
- Li et al. (2020).
  [The design and construction of reference pangenome graphs with minigraph](https://doi.org/10.1186/s13059-020-02168-z)
- Toye et al. (2005).
  [A genetic and physiological study of impaired glucose homeostasis control in C57BL/6J mice](https://doi.org/10.1007/s00125-005-1680-z)
