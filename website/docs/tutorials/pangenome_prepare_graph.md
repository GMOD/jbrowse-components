---
title: Pangenome (hosting your own graph)
description:
  One command turns your pangenome graph into the indexed files JBrowse browses
  by locus, plus the config that puts them on tracks
guide_category: Tutorials
tutorial_category: Pangenomes
---

To let people browse a pangenome graph in JBrowse, from a whole chromosome down
to single nodes, the graph has to be cut into small indexed files that JBrowse
reads one window at a time. One command writes those files and the config that
puts them on tracks. We run it on HPRC release 2, and:

- load the plugin and run the command
- open the track as a graph and as a row of segments
- check the index against the graph
- add two optional layers: haplotypes per segment, and haplotype routes

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](#the-graphgenomeview-plugin)
- htslib (`bgzip`, `tabix`), `bcftools`, `python3`, `sort`, `pigz`, and `node`
  for the coarse tier
- [`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix), for the segment and
  link indexes, and 0.5.0 or later for the walk index
- [`gfatools`](https://github.com/lh3/gfatools), for an rGFA's bubbles
- [`minigraph`](https://github.com/lh3/minigraph), for each assembly's path
  through the graph
- [`vg`](https://github.com/vgteam/vg) 1.69.0+, for haplotype walks, and
  [`gbz-base`](https://github.com/jltsiren/gbz-base) with
  [`gbz-haplotype-index`](https://crates.io/crates/gbz-haplotype-index) to serve
  them from a gbz-base database

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)'s Minigraph-Cactus
graph, which every HPRC page on this site reads.

Download the SV-resolution rGFA before starting: `build_pangenome_graph.sh`
takes the graph as a local file.

- the SV-resolution rGFA:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz

`build_hprc_gbz_index.sh`, under
[Reproduce it end to end](#reproduce-it-end-to-end), fetches the graph in vg's
format and its gbz-base database itself.

- the same graph in vg's format:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz
- the same graph as a gbz-base database:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db

<details>
<summary>Other files (no download needed)</summary>

- the base-level GFA:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz
- the finished files, for comparison: https://jbrowse.org/demos/hprc/README.txt

</details>

## The GraphGenomeView plugin

GraphGenomeView loads by URL, from a `plugins` array at the top of `config.json`
([configuring plugins](/docs/config_guides/plugins)). The config the command
writes holds this entry:

<!-- GRAPH_PLUGIN_CONFIG START -->

```json
{
  "plugins": [
    {
      "name": "GraphGenomeView",
      "esmUrl": "https://jbrowse.org/plugins/jbrowse-plugin-graphgenomeviewer/latest/dist/jbrowse-plugin-graphgenomeviewer.esm.js"
    }
  ]
}
```

<!-- GRAPH_PLUGIN_CONFIG END -->

On [JBrowse Desktop](/docs/quickstart_desktop) v5.0.0-beta.1 or later, install
it once at **Global plugins... → Add custom plugin**: open **Advanced options**,
paste that `esmUrl` into **ESM build URL** and leave the rest empty.

## Indexing a graph with build_pangenome_graph.sh {#what-your-graph-can-produce}

Install [`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix), which writes the
segment and link indexes (its
[releases](https://github.com/GMOD/gfa-to-tabix/releases) have Linux and macOS
binaries if you have no Rust toolchain), and fetch the script:

```bash
cargo install gfa-to-tabix
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh
```

An **rGFA**, from minigraph or the minigraph stage of Minigraph-Cactus, needs an
output prefix and the assembly name your config uses:

```bash
bash build_pangenome_graph.sh graph.rgfa.gz out --assembly hg38
```

A **plain GFA**, from pggb, odgi, vg or base-level Minigraph-Cactus, also needs
the backbone sample and its bubbles. The bubbles come from a snarl VCF (vg's
word for a bubble is snarl):

- `vg deconstruct` writes one record per top-level snarl against the reference
  path, and `pggb -V` writes the same file.
- The VCF's CHROM must be the assembly's refName, so rename the PanSN path
  (`sample#haplotype#contig`) as the
  [pggb tutorial](/docs/tutorials/pangenome_ecoli#opening-the-graph-in-the-graph-genome-view)
  does:

```bash
# -p: the reference path to decompose against
vg deconstruct -p K12#1#chr graph.gbz > graph.snarls.vcf
printf 'K12#1#chr\tchr\n' > rename_chrs.tsv
bcftools annotate --rename-chrs rename_chrs.tsv graph.snarls.vcf \
  | bcftools sort -Oz -o graph.snarls.vcf.gz
```

```bash
bash build_pangenome_graph.sh graph.gfa out --reference K12 --assembly K12 --snarls graph.snarls.vcf.gz
```

At human-chromosome scale, index the SV-resolution rGFA; a pggb graph's index
does not finish there.

The command writes these files beside the prefix:

| file                                          | what it holds                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.segs.bed.gz`                                | one row per segment, at its reference coordinate                                                |
| `.links.bed.gz`                               | one row per link per endpoint, both ends stated in full                                         |
| `.bubbles.bed.gz`                             | where haplotypes diverge and rejoin, with each bubble's shortest and longest allele             |
| `.fold10000.segs.bed.gz`                      | the graph with variants under 10 kb folded into the reference, so a whole chromosome draws      |
| `.fold10000.links.bed.gz`                     | the tier's links                                                                                |
| `.contig.segs.bed.gz`, `.contig.links.bed.gz` | the segment and link rows under each segment's own coordinate, which the allele inventory reads |
| `.alleles.bed.gz`                             | one row per allele, with a CIGAR that states its size                                           |
| `.config.json`                                | the tracks below, with the plugin entry                                                         |

### The coarse tier for whole-chromosome views {#a-whole-chromosome-the-bubble-tier}

The coarse tier is a copy of the graph with every variant under a threshold
folded into the reference. It keeps each allele whose length, or the reference
it replaces, reaches the threshold, and the way back to the reference from both
of its ends. The graph track folds what it draws the same way at ten of the
linear view's pixels, so zooming out onto the tier keeps every loop the fine cut
drew. The threshold is in the file name, 10,000 bp by default for an rGFA;
`--tier` sets it, and a plain GFA defaults to 50, since most of its variants are
single bases.

## Configuring the graph track {#the-two-indexes-a-graph-track-reads}

The config's first track is the graph. Its adapter holds:

- `uri`, the prefix
- `coarse`, which names the tier the track draws past `aboveBpPerPx` bp per
  pixel, the tier's threshold over ten
- `assemblyNameToPanSN`, which maps your assembly name to the graph's PanSN
  sample; the command writes it only when the two differ

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "hprc_graph",
  "name": "hprc graph",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "hprc",
    "assemblyNameToPanSN": { "hg38": "GRCh38" },
    "coarse": { "uri": "hprc.fold10000", "aboveBpPerPx": 1000 }
  },
  "displayDefaults": { "showLabels": "none" },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

Turned on, the track draws as a graph. **Display types → Feature display** in
its track menu draws the same segments as a row.

<Figure caption="The HPRC graph's segment index drawn over the C4 region on hg38. The segments tile the window end to end and break where the graph branches. The slivers fall among the C4 and CYP21 copies, with long unbroken segments either side." src="/img/pangenome/prepare_graph_segments.png" />

The command writes `out.config.json`. Merge its `plugins` and `tracks` entries
into your own config, then run `jbrowse validate config.json`, which reports a
misspelled or undeclared slot JBrowse otherwise ignores.

The other three tracks in the config draw the bubbles as a row and as a curve,
and the allele inventory, one row per alternative path, as an alignments track.
Turn them on and switch the graph back with **Display types → Graph**.

<Figure caption="The four tracks the command writes, over the C4 region on hg38: the bubbles as a row and as a curve, the allele inventory, and the graph track at the bottom." src="/img/pangenome/host_your_own.png" />

A node's right-click menu offers **Open in** the haplotype its rGFA id names
(`NA20809#2#CM094351.1` opens `NA20809#2`), when the session holds an assembly
named or aliased `sample#haplotype`.
[The HPRC tutorial](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
takes that route.

## Checking the index against the graph

Query a locus out of the index, by the graph's PanSN name for the reference
contig:

```bash
tabix hprc.segs.bed.gz 'GRCh38#0#chr1:103,690,000-103,700,000' | head -3
```

Columns one to three are the contig and span, four is the segment id, and five
is its rank (build order). Ask the graph about one of those segments:

```bash
gfatools view -l s12829 -r 0 hprc-v2.1-mc-grch38.sv.gfa.gz
```

The S-line's `SN` and `SO` tags match the row's first two columns, and `SR`
matches the fifth.

- **An empty result** over a tiled reference means the query used the wrong
  name: `chr1` finds nothing where `GRCh38#0#chr1` finds every segment.
- **Backbone rows with no alleles** mark a place where the graph collapsed,
  which minigraph does to near-identical segmental duplications.

## Recording which haplotypes pass through each segment {#which-haplotypes-walk-each-segment}

The rank in an rGFA is build order, so it names the first assembly a segment
came from. The full list of haplotypes whose paths pass through each segment
comes from one of two sources.

With the **assemblies**, map each one back through the graph, reference first,
and read the path it takes:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call: the path this sample takes through every bubble, one line per
#   `gfatools bubble` line, in the same order for every sample
# -xasm: the assembly-to-graph preset
# -c: base-level alignment, which --call reads
minigraph -cxasm --call -t 8 graph.rgfa.gz sample.fa > sample.call.bed
```

[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs that per assembly and joins the output into one tabix-indexed row per
bubble per sample, drawn as one row per haplotype.

With a **plain GFA**, the command records the haplotypes whose paths visit each
segment as an `SM:Z:` tag while it reads the paths.

- The node panel lists them as `samples`; a track reads them as
  `feature.samples` and their count as `feature.sampleCount`.
- **Color by... → Attribute...** with `sampleCount` gives each count a separate
  color.
- For more than a handful of haplotypes, **Edit plot...** in the same dialog
  takes a ramp, here red for a segment on one haplotype to grey for a segment on
  most:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "graph_haplotypes_per_segment",
  "name": "graph: haplotypes per segment",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "graph"
  },
  "displayDefaults": {
    "color": {
      "field": "sampleCount",
      "scale": "linear",
      "domainMin": 1,
      "range": ["#e31a1c", "#bdbdbd"],
      "title": "Haplotypes"
    }
  }
}
```

The `color` block is a color scale that maps the `sampleCount` field linearly
from `domainMin` onto the two colors of `range`. The count is per haplotype
(`HG002.1`), so a diploid sample's two copies count separately.

## Indexing haplotype walks with gfa-to-tabix {#haplotype-walks-tabix}

A **walk** is one haplotype's route through the graph. `gfa-to-tabix --walks`
(0.5.0 or later) writes every walk to tabix-indexed files, which the browser
reads for the graph track and for the haplotype lanes. It cuts each walk into
pieces, one for each stretch the walk spends in a 64 kb chunk of a reference,
and files each piece under its chunk, so the browser reads one range of each
file per window.

`vg convert` writes the GBZ as a GFA whose W lines are the walks. Index that GFA
against both of HPRC's references:[^walks-cost]

```bash
vg convert -f hprc-v2.1-mc-grch38.gbz | pigz > hprc-v2.1-mc-grch38.W.gfa.gz
gfa-to-tabix hprc-v2.1-mc-grch38.W.gfa.gz --walks --refs GRCh38,CHM13 \
  -o hprc-v2.1-mc-grch38
```

The tool writes three files and their `.tbi` indexes for each sample in
`--refs`, named `<prefix>.<sample>.<kind>.bed.gz`, so a track on GRCh38 reads an
index that covers GRCh38 alone:

| file                   | what it holds                                              |
| ---------------------- | ---------------------------------------------------------- |
| `.GRCh38.walks.bed.gz` | each walk's steps through each 64 kb chunk of GRCh38       |
| `.GRCh38.nodes.bed.gz` | the nodes those steps visit, filed under the same chunks   |
| `.GRCh38.links.bed.gz` | the links between those steps, filed under the same chunks |
| `.CHM13.*.bed.gz`      | the same three files, filed under the chunks of T2T-CHM13  |

Each file opens with header lines, which `tabix -H` prints:

```bash
tabix -H hprc-v2.1-mc-grch38.CHM13.walks.bed.gz | head -4
```

```text
#walks	chunk:i:65536	maxnode:i:1024	cap:i:8192
#reference	CHM13
#haplotype	GRCh38#0
#haplotype	HG00097#1
```

The first line gives the chunk size, the longest node in bp, which sets how far
before a window the browser starts reading, and the most steps in one row. The
walk file then lists its reference sample and every other haplotype with rows in
it, the other reference included, once each.

A track's `walksUri` names one reference's set by its prefix,
`<prefix>.<sample>`. The track below draws the graph and, as a second display,
one lane per haplotype. Each haplotype in `assemblyNames` is an assembly whose
aliases include its `sample#haplotype` name, as
[the HPRC tutorial](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
declares one; `assemblyNameToPanSN` covers the reference, which has none:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "my_graph_lanes",
  "name": "My graph: haplotypes vs the reference",
  "assemblyNames": ["hg38", "HG00097.1", "HG00099.1"],
  "adapter": {
    "type": "WalkTabixSyntenyAdapter",
    "walksUri": "https://example.com/graphs/my_graph.GRCh38",
    "assemblyNames": ["hg38"],
    "assemblyNameToPanSN": { "hg38": "GRCh38#0" }
  },
  "displays": [
    { "type": "MultiWaySyntenyDisplay", "height": 600 },
    { "type": "LinearGraphDisplay" }
  ]
}
```

The lanes align each walk to the reference's on the nodes both visit, so the
track needs no sequence beyond the three files.

A graph track with no lanes names the same set through `RgfaTabixAdapter`, here
T2T-CHM13's:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "hprc_walks_chm13",
  "name": "HPRC v2.1 haplotype walks",
  "assemblyNames": ["hs1"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "walksUri": "hprc-v2.1-mc-grch38.CHM13",
    "assemblyNameToPanSN": { "hs1": "CHM13" },
    "defaultHaplotypes": [
      "HG00097#1",
      "HG00099#1",
      "HG00128#1",
      "HG00133#1",
      "HG01109#1",
      "HG01123#1",
      "HG01960#1",
      "HG02055#1"
    ]
  }
}
```

- `assemblyNameToPanSN` maps the assembly name to the set's reference sample,
  here `hs1` to `CHM13`
- `defaultHaplotypes` lists the haplotypes the track draws until the reader
  picks others, as `sample#haplotype`, or a bare sample for both of its
  haplotypes

The HPRC tracks built this way open at chr22:20,000,000-20,100,000 on
[hs1, from the CHM13 set](https://jbrowse.org/code/jb2/main/?config=test_data/graphgenomeview/hprc.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hs1%22%2C%22loc%22%3A%22chr22%3A20%2C000%2C000-20%2C100%2C000%22%2C%22tracks%22%3A%5B%22hprc_v2_1_walks_hs1%22%5D%7D%5D%7D)
and
[hg38, from the GRCh38 set](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/hprc/config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr22%3A20%2C000%2C000-20%2C100%2C000%22%2C%22tracks%22%3A%5B%22hprc_v2_1_walks%22%5D%7D%5D%7D).

The track menu's **Haplotypes** submenu switches the track between **The track's
default haplotypes**, **Every haplotype in the graph** and **Chosen in
Settings...**, whose dialog offers the names from the walk file's header. A
graph view opened from the track draws the same set. Where the graph collapses
the copies of a repeat onto one set of nodes, the track draws a walk through
them where the reference places those nodes.

Two budgets in the
[adapter's config](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer/blob/main/src/RgfaTabixAdapter/configSchema.ts)
refuse a window with a notice to zoom in. `walkByteBudget` caps the compressed
bytes that the three indexes estimate a window would fetch. The estimate is the
same for any set of haplotypes, because the browser downloads every haplotype's
rows and drops the unwanted ones by name. `walkStepBudget` caps the walk steps a
window keeps, counting only the haplotypes the track draws, so fewer haplotypes
draw a wider window.

## Building a gbz-base database of haplotype walks {#haplotype-walks-a-gbz-base-database}

A `.gbz` is vg's indexed form of a graph, with one walk per haplotype. The
browser also reads it as a **gbz-base database**, the graph in SQLite, which
three commands build. The same lanes take more requests this way: 27 against 5
for eight haplotypes across the 260 kb CFH cluster.

Build the distance-index chains. vg 1.69.0 or newer reads them out of a distance
index, and a top-level one (`vg index --no-nested-distance`) is enough:

```bash
vg chains graph.gbz graph.dist > graph.chains
```

Build the database, one row per node and per path, plus the chains. Without
`--chains`, a window comes back as the reference walk alone.

```bash
gbz-base construct --chains graph.chains graph.gbz
```

Name the haplotypes. `gbz-base` reports the walks in a subgraph as `unknown#1`,
`unknown#2`, and `gbz-haplotype-index` writes their names to a companion file.
It reads the database beside the GBZ to check that the two match:

<!-- from: scripts/build_hprc_gbz_index.sh -->

```bash
# --interval: bp between recorded GBWT positions per path; denser is bigger
#   and faster
# --anchor-spacing: bp between anchor nodes on the reference path, so a window
#   reads the chosen haplotypes' paths
gbz-haplotype-index --interval 16384 --anchor-spacing 131072 \
  graph.gbz graph.gbz.db graph.haplotype-index.db
```

`cargo install gbz-base` and `cargo install gbz-haplotype-index` install the two
tools. The browser reads only the format 3 companion that `gbz-haplotype-index`
0.3.0 and later writes.[^gbz-cost]

Serve the database and the companion from URLs that answer range requests, and
point the track's `uri` and `haplotypeIndexLocation` at them. `assemblyNames`
and `assemblyNameToPanSN` work as in the walk-file track above:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "my_graph_gbz_lanes",
  "name": "My graph: haplotypes vs the reference, read from the graph",
  "assemblyNames": ["hg38", "HG00097.1", "HG00099.1"],
  "adapter": {
    "type": "GbzBaseSyntenyAdapter",
    "uri": "https://example.com/graphs/my_graph.gbz.db",
    "haplotypeIndexLocation": {
      "uri": "https://example.com/graphs/my_graph.haplotype-index.db"
    },
    "assemblyNames": ["hg38"],
    "assemblyNameToPanSN": { "hg38": "GRCh38#0" },
    "context": 1000
  },
  "displays": [
    { "type": "MultiWaySyntenyDisplay", "height": 600 },
    { "type": "LinearGraphDisplay" }
  ]
}
```

The adapter rejects a companion built from a graph with a different path count.
Past `nodeLimit` nodes, or 5 Mb for the Graph display, both displays ask the
reader to zoom in.

## Reproduce it end to end

The one command builds the graph track, the bubbles, the tier and the allele
inventory, with the tools under [Prerequisites](#prerequisites). It:

1. places every segment on a genome: an rGFA states each position in its own
   tags, and for a plain GFA the command follows the backbone's paths first,
   then places each remaining segment on the first other haplotype whose path
   visits it
2. finds the bubbles, with `gfatools bubble` on an rGFA or from the snarl VCF on
   a plain GFA, and builds the tier from them
3. reads each allele out of the links, following it from where it leaves the
   backbone to where it rejoins. The reference between those two points and the
   sequence the allele passes through give the CIGAR its size

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh
bash build_pangenome_graph.sh hprc-v2.1-mc-grch38.sv.gfa.gz hprc --assembly hg38
```

[`build_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pangenome_graph.sh)
runs [`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix) for the segments and
links, and `gfa-to-tabix alleles` for the allele inventory, then fetches and
runs
[`build_fold_tier.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_fold_tier.sh),
which runs alone too. The walk files come from the two commands under
[Indexing haplotype walks](#haplotype-walks-tabix). A separate script builds the
[gbz-base companion](#haplotype-walks-a-gbz-base-database) from HPRC's 5.5 GB
`.gbz` and 10 GB gbz-base database:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_gbz_index.sh
bash build_hprc_gbz_index.sh out
```

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/user_guides/graph_genome_view)

## External links

- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools): the `SN`/`SO`/`SR` tags and the
  bubble calls.
- [gbz-base](https://github.com/jltsiren/gbz-base): a GBZ as a SQLite database,
  range-requested per window.
- [gfa-to-tabix](https://github.com/GMOD/gfa-to-tabix#walks): the walk, node and
  link row formats `--walks` writes.

## Citations

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the worked
  example here.

[^walks-cost]:
    On a 24-core machine `gfa-to-tabix` took 44 minutes and 16 GB of memory, and
    wrote 18 GB for the two references.

[^gbz-cost]:
    Over HPRC's 464 haplotypes the companion is 5.1 GB, built in 35 minutes on
    22 threads of a 125 GB machine. On a 16-thread Intel Mac the build aborts
    inside libmalloc's nano zone; `MallocNanoZone=0` or `--threads 8` avoids it.
