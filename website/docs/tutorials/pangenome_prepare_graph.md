---
title: Pangenome (hosting your own graph)
description:
  One command turns your pangenome graph into the indexed files JBrowse browses
  by locus, plus the config that carries them
guide_category: Tutorials
tutorial_category: Pangenomes
---

You have a pangenome graph and want people to browse it in JBrowse: open a
locus, zoom to a chromosome, to the nodes, and to the haplotypes that carry a
variant. One command converts the graph into small indexed files that answer a
window at a time, and writes the config that puts them on a track. We:

- runs that command on HPRC release 2, checked against a published output
- opens the track as a graph and as tiled features
- checks the index against the graph
- adds two optional layers: carriage per segment, and each haplotype's walk

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](#the-graphgenomeview-plugin)
- htslib (`bgzip`, `tabix`), `python3`, `sort`
- [`gfatools`](https://github.com/lh3/gfatools) and GNU awk, for an rGFA
- [`minigraph`](https://github.com/lh3/minigraph), for carriage
- [`vg`](https://github.com/vgteam/vg) 1.69.0+,
  [`gbz-base`](https://github.com/jltsiren/gbz-base) and
  [`gbz-haplotype-index`](https://crates.io/crates/gbz-haplotype-index), for the
  haplotype-walk layer

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)'s Minigraph-Cactus
graph is the one every HPRC page on this site reads.

- the SV-resolution rGFA:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the base-level GFA:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz
- the same graph in vg's format:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz
- the finished files, for comparison: https://jbrowse.org/demos/hprc/README.txt
- the config the HPRC page opens:
  https://jbrowse.org/pangenome/hprc-grch38/config.json

## The GraphGenomeView plugin

GraphGenomeView isn't in the [plugin store](/docs/user_guides/plugin_store) yet,
so it loads by URL: a `plugins` array at the top of `config.json`, beside
`assemblies` and `tracks` ([configuring plugins](/docs/config_guides/plugins)).
The config below carries this entry:

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

On [JBrowse Desktop](/docs/quickstart_desktop), install it once at **Global
plugins... → Add custom plugin**: paste that `esmUrl` into **Advanced options →
ESM build URL** and leave the rest empty. Needs JBrowse 5, v5.0.0-beta.1+.

## One command {#what-your-graph-can-produce}

Two kinds of graph turn up: an **rGFA** (minigraph, or Minigraph-Cactus's
minigraph stage) needs no flags, and a **plain GFA** (pggb, odgi, vg, or
base-level Minigraph-Cactus) needs `--reference` for the backbone sample and
`--snarls` for its bubbles (from `vg deconstruct`). An assembly graph (SPAdes,
Flye) has no reference; Bandage is the tool for it.

Fetch the script once:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh
```

An rGFA needs only a prefix and the assembly name your config uses:

```bash
# --assembly is the name your JBrowse config gives the reference
bash build_pangenome_graph.sh graph.rgfa.gz out --assembly hg38
```

A plain GFA also needs the backbone sample and its snarl VCF:

```bash
# --reference names the backbone sample
# --snarls is its bubble VCF from `vg deconstruct`
bash build_pangenome_graph.sh graph.gfa out --reference K12 --assembly K12 --snarls graph.snarls.vcf.gz
```

The rGFA route needs GNU awk (BSD awk, macOS's default, takes hours on a large
table): `brew install gawk`, `gnubin` first on `PATH`. A pggb graph's index does
not finish at human-chromosome scale; index the SV-resolution rGFA there.

What comes out, beside the prefix you named:

| file                     | what it holds                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `.segs.bed.gz`           | one row per segment, at its reference coordinate                                    |
| `.links.bed.gz`          | one row per link per endpoint, both ends stated in full                             |
| `.bubbles.bed.gz`        | where haplotypes diverge and rejoin, with each bubble's shortest and longest allele |
| `.tier10000.segs.bed.gz` | one node per bubble, so a whole chromosome draws                                    |
| `.alleles.bed.gz`        | one row per allele, with a CIGAR that states its size                               |
| `.config.json`           | the tracks below, with the plugin entry                                             |

## The graph track {#the-two-indexes-a-graph-track-reads}

The config's first track is the graph. `uri` is the prefix; `coarse` names the
bubble tier the graph cuts to past `aboveBpPerPx` bp per pixel.

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
    "coarse": { "uri": "hprc.tier10000", "aboveBpPerPx": 1014 }
  },
  "displayDefaults": { "showLabels": "none" },
  "displays": [
    {
      "type": "LinearGraphDisplay"
    },
    {
      "type": "LinearBasicDisplay"
    }
  ]
}
```

`assemblyNameToPanSN` maps your assembly to the graph's PanSN sample (`GRCh38`
here), written only when the names differ.

Turned on, the track draws as a graph. **Display types → Feature display** draws
the same segments as a lane, tiling the window and breaking where the graph
branches.

<Figure caption="The HPRC graph's segment index drawn over the C4 region on hg38. The segments tile the window end to end and break where the graph branches. The slivers fall among the C4 and CYP21 copies, with long unbroken segments either side." src="/img/pangenome/prepare_graph_segments.png" />

The other three tracks read the files beside the pair: bubbles as a lane and as
a curve, and the allele inventory as an alignments track. With all four showing
and the graph back on **Display types → Graph**, the window draws as a graph
anchored on the view's coordinates.

<Figure caption="The four tracks the command writes, over the C4 region on hg38: the bubbles as a lane and as a curve, the allele inventory, and the graph track at the bottom, drawn as a graph anchored on the view's coordinates." src="/img/pangenome/host_your_own.png" />

## Opening a node on the haplotype that contributed it

Right-click a node for **Open in** the haplotype named in its rGFA id
(`NA20809#2#CM094351.1`), when the session holds an assembly named or aliased to
`sample#haplotype`.
[Browsing the graph](/docs/tutorials/pangenome_hprc#check-it-on-the-haplotype)
takes that route.

## Checking the index against the graph

Query a locus out of the index (same coordinates as the graph):

```bash
# the first three columns are the stable sequence and the span, the fourth the
# segment id and the fifth its rank
tabix hprc.segs.bed.gz 'GRCh38#0#chr1:103,690,000-103,700,000' | head -3
```

Ask the graph about one of the segments it returned:

```bash
gfatools view -l s12829 -r 0 hprc-v2.1-mc-grch38.sv.gfa.gz
```

`SN`/`SO` on that S-line are the BED row's first two columns; `SR` is the fifth.
An **empty result** where the reference is tiled means the wrong namespace:
segments are indexed under the graph's PanSN names, so `chr1` alone finds
nothing where `GRCh38#0#chr1` finds everything. **Backbone rows with no
alleles** mean the graph collapsed there, which minigraph does to near-identical
segmental duplications.

## A whole chromosome {#a-whole-chromosome-the-bubble-tier}

The tier collapses each bubble to one node, the invariant reference as backbone,
on a **content** threshold: the larger of the reference span and the longest
allele. HPRC's 130,510 bubbles reduce chr1 (249 Mb) to 474 nodes at 10,000,
against about 751,000 segments in the fine index. `--tier` moves it; a pggb
graph defaults to 50, since its bubbles are mostly single bases.

## Who carries what

An rGFA does not record who carries a segment: its rank is build order, naming
only its first contributor. Two ways to get carriage back, depending on what
sits beside the graph.

With the **assemblies**, map each one back through the graph and ask for its
path:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call: the path each sample takes through every bubble, one line per
#   `gfatools bubble` line, in the same order for every sample
# -xasm: the assembly-to-graph preset
# -c: the base-level alignment the call is read off
minigraph -cxasm --call -t 8 graph.rgfa.gz sample.fa > sample.call.bed
```

Run it once per assembly, reference first.
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
writes one tabix-indexed row per bubble per sample, drawn as one lane per
haplotype.

With a **plain GFA**, the path walk that built the index recorded who visits
each segment, as an `SM:Z:` tag: it reaches the node panel as `carriedBy` and a
track as `feature.samples`/`feature.carriers`, so the graph track can be colored
by carriage. **Color by... → Attribute...** with `carriers` gives each count a
colour of its own and a key. Past a handful of haplotypes a ramp reads better,
and **Edit as JSON...** in the same dialog takes one, here from red for a
segment one haplotype carries to grey for the most widely carried:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "graph_carriage",
  "name": "graph: carriage per segment",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "graph"
  },
  "displayDefaults": {
    "color": {
      "field": "carriers",
      "scale": "linear",
      "domainMin": 1,
      "range": ["#e31a1c", "#bdbdbd"],
      "title": "Haplotypes carrying"
    }
  }
}
```

<Figure caption="The carriage ramp on the E. coli pggb graph over an IS5 insertion in K12. The segment K12 alone walks is red; the segments all five strains share are grey." src="/img/pangenome/prepare_graph_carriage.png" links="Open this view=pangenome/prepare_graph_carriage" />

Carriage is per haplotype (`HG002.1`); the sample alone merges a diploid's two
copies.
[Who carries each allele](/docs/tutorials/pangenome_hprc_carriers#carriage-at-the-graphs-own-granularity)
reads carriage from a file built this way.

## Every haplotype's walk: a gbz-base database

A `.gbz` is vg's indexed form of a graph, with one walk per haplotype. Reading
it in the browser means converting it to a **gbz-base database** (the graph in
SQLite). Three commands stand between them, none of them JBrowse.

Build the distance-index chains:

```bash
# vg 1.69.0 or newer reads the chains out of a distance index; a top-level
# index (vg index --no-nested-distance) is enough
vg chains graph.gbz graph.dist > graph.chains
```

Build the database itself, one row per node and per path, plus those chains:

```bash
# without --chains a window comes back as the reference walk alone
gbz-base construct --chains graph.chains graph.gbz
```

`gbz-base` is `cargo install gbz-base`, writing `graph.gbz.db` beside the input.
Then name the haplotypes: upstream reports `unknown#1`, `unknown#2` for the
walks in a subgraph. `cargo install gbz-haplotype-index` installs the tool that
writes the names to a companion file.

<!-- from: scripts/build_hprc_gbz_index.sh -->

```bash
# --interval: how often a GBWT position is recorded per path, in bp; denser
#   means a bigger file and faster haplotype lookup
# --anchor-spacing: how often an anchor node is chosen on the reference path,
#   letting a window walk only the chosen lanes
gbz-haplotype-index --interval 16384 --anchor-spacing 131072 \
  graph.gbz graph.haplotype-index.db
```

Over HPRC's 464 haplotypes that's a 7.9 GB companion, built in about 13 minutes
on 24 cores with a 12 GB memory peak. On a 16-thread Intel Mac the walk aborts
inside libmalloc's nano zone, fixed by `MallocNanoZone=0` or `--threads 8`.

The database and companion need URLs that serve range requests: the track's
`uri` and `haplotypeIndexLocation`:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "my_graph_lanes",
  "name": "My graph: haplotypes vs the reference, read from the graph",
  "assemblyNames": ["hg38", "HG00097.1", "HG00099.1"],
  "adapter": {
    "type": "GbzBaseSyntenyAdapter",
    "uri": "https://example.com/graphs/my_graph.gbz.db",
    "haplotypeIndexLocation": {
      "uri": "https://example.com/graphs/my_graph.haplotype-index.db"
    },
    "assemblyNames": ["hg38"],
    "assemblyNameToPanSN": {
      "hg38": "GRCh38#0",
      "HG00097.1": "HG00097#1",
      "HG00099.1": "HG00099#1"
    },
    "context": 1000,
    "nodeLimit": 50000
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "height": 600
    },
    {
      "type": "LinearGraphDisplay"
    }
  ]
}
```

The companion records the graph's path count; the adapter refuses a mismatched
one. `nodeLimit` fails an over-large window, naming a zoom that would fit. What
the track does with the lanes is the subject of
[haplotypes against each other](/docs/tutorials/pangenome_hprc_haplotypes).

## Reproduce it end to end

The command at the top builds the graph track, the bubbles, the tier and the
allele inventory, with the tools under [Prerequisites](#prerequisites):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh
bash build_pangenome_graph.sh hprc-v2.1-mc-grch38.sv.gfa.gz hprc --assembly hg38
```

[`build_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pangenome_graph.sh)
fetches and runs
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
or
[`build_pggb_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pggb_tabix.sh),
then
[`build_bubble_tier.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bubble_tier.sh)
and
[`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh),
each runnable alone. The gbz-base companion has its own script, which downloads
the 5.5 GB `.gbz`, installs `gbz-haplotype-index` and runs the command
[above](#every-haplotypes-walk-a-gbz-base-database):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_gbz_index.sh
bash build_hprc_gbz_index.sh out
```

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_carriers)
- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/user_guides/graph_genome_view)

## References

- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools): the `SN`/`SO`/`SR` tags and the
  bubble calls.
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the worked
  example here.
- [gbz-base](https://github.com/jltsiren/gbz-base): a GBZ as a SQLite database,
  range-requested per window.
