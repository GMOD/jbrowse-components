---
title: Pangenome (hosting your own graph)
description:
  One command turns the pangenome graph you already have into the indexed files
  JBrowse browses by locus, and writes the config that carries them
guide_category: Tutorials
tutorial_category: Pangenomes
---

You have a pangenome graph and want people to browse it in JBrowse: open a
locus, zoom out to a chromosome, zoom in to the nodes, and open the haplotypes
that carry a variant. A graph file is not something a browser can seek into, so
one command converts it, once, into small indexed files that answer a window at
a time, and writes the config that puts them on one track. This page runs that
command on HPRC release 2 so every output can be checked against a published
one, then covers the two optional layers the command does not build: who carries
each segment, and every haplotype's own walk.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](#the-graphgenomeview-plugin), which supplies the
  adapters every track here uses
- htslib (`bgzip`, `tabix`), `python3`, and `sort`
- [`gfatools`](https://github.com/lh3/gfatools) and GNU awk, for an rGFA
- [`minigraph`](https://github.com/lh3/minigraph), for the optional carriage
  layer, which needs the assemblies as well
- [`vg`](https://github.com/vgteam/vg) 1.69.0 or newer,
  [`gbz-base`](https://github.com/jltsiren/gbz-base) and `gbz-haplotype-index`
  from [`@gmod/gbz-base`](https://github.com/GMOD/gbz-base-js), for the optional
  haplotype-walk layer, which applies to a graph published in vg's format

## Where the data comes from

The worked example is
[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose
Minigraph-Cactus graph is the one every HPRC page on this site reads through the
files built here.

- the SV-resolution graph, an rGFA and the input to the command:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the base-level graph beside it, a plain GFA that takes the other route through
  the same command:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz
- the same graph in vg's format, the input to the haplotype-walk layer:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz
- the finished files, hosted so a build can be compared against one that worked,
  with the exact commands recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt
- the config the HPRC page on genomes.jbrowse.org opens, which carries every
  track built here: https://jbrowse.org/pangenome/hprc-grch38/config.json

## The GraphGenomeView plugin

GraphGenomeView is beta and not in the
[plugin store](/docs/user_guides/plugin_store) yet, so it loads by URL. In
JBrowse Web that is a `plugins` array at the top level of `config.json`, beside
`assemblies` and `tracks` (see
[configuring plugins](/docs/config_guides/plugins)), and the config the command
below writes carries the same entry:

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

On [JBrowse Desktop](/docs/quickstart_desktop), install it once from the start
screen at **Global plugins... → Add custom plugin**, putting that `esmUrl` under
**Advanced options** in **ESM build URL** and leaving the two fields above it
empty. The plugin reads two things core first exported in v5.0.0-beta.1, so it
needs a JBrowse 5 build.

## One command {#what-your-graph-can-produce}

Two kinds of graph turn up. An **rGFA** (minigraph, and the minigraph stage of
Minigraph-Cactus) tags every segment with where it sits on a reference, and a
**plain GFA** (pggb, odgi, vg, base-level Minigraph-Cactus) states the same
thing in its P or W path lines. The command tells them apart by the first
segment's tags. A plain GFA also needs `--reference` to say which sample is the
backbone, and `--snarls` for its bubbles, which come from the `vg deconstruct`
VCF pggb already wrote. An assembly graph (SPAdes, Flye) has no reference at
all, and Bandage is the tool for it.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh

# an rGFA; --assembly is what your JBrowse config calls the reference
bash build_pangenome_graph.sh hprc-v2.1-mc-grch38.sv.gfa.gz hprc --assembly hg38

# a plain GFA: name the backbone sample, and hand over the snarl VCF for bubbles
bash build_pangenome_graph.sh graph.gfa graph --reference K12 --assembly K12 --snarls graph.snarls.vcf.gz
```

The script fetches the four builders it runs. HPRC's 759,000 segments index in
about 45 seconds, peaking near 3.7 GB, and the rGFA route wants GNU awk: the BSD
awk macOS ships builds the same links table in hours, so `brew install gawk` and
put its `gnubin` first on `PATH`. A pggb graph runs about 17 bp per segment, so
its index grows with total sequence rather than with variation: five E. coli
strains are 606,000 segments and build in about a minute, and a human chromosome
does not finish. At human scale, index the SV-resolution rGFA.

What comes out, beside the prefix you named:

| file                     | what it holds                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `.segs.bed.gz`           | one row per segment, at its reference coordinate                                    |
| `.links.bed.gz`          | one row per link per endpoint, both ends stated in full                             |
| `.bubbles.bed.gz`        | where haplotypes diverge and rejoin, with each bubble's shortest and longest allele |
| `.tier10000.segs.bed.gz` | one node per bubble, so a whole chromosome draws                                    |
| `.alleles.bed.gz`        | one row per allele, with a CIGAR that states its size                               |
| `.config.json`           | the tracks below, with the plugin entry                                             |

Each is a tabix-indexed BED, so a window is a range request and the graph file
itself never has to be served.

## The graph track {#the-two-indexes-a-graph-track-reads}

The config's first track is the graph. Its `uri` is the prefix, from which the
adapter resolves the segment and link pair, and `coarse` names the bubble tier
beside it, which the graph pane cuts from instead once the window is wider than
`aboveBpPerPx` bp per pixel. The script derives that handover from the graph's
mean backbone segment: about 1,000 for HPRC, where a segment is 10 kb, and 1 for
a pggb graph, where a segment is 17 bp.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hprc_graph",
  "name": "hprc graph",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "hprc",
    "assemblyNameToPanSN": { "hg38": "GRCh38" },
    "coarse": { "uri": "hprc.tier10000", "aboveBpPerPx": 1014 }
  },
  "displayDefaults": { "showLabels": "none" }
}
```

`assemblyNameToPanSN` ties your assembly to the graph's PanSN sample. The script
reads the sample off the index, `GRCh38` here, and writes the map only when your
assembly's name differs from it. The contig half of a PanSN name is ordinary
refName aliasing your assembly already does, so an hg38 spelling chr6 as `6`
needs nothing further.

With the track showing, the segments tile the window and break where the graph
branches.

<Figure caption="The HPRC graph's segment index drawn over the C4 region on hg38. The segments tile the window end to end and break where the graph branches. The slivers fall among the C4 and CYP21 copies, with long unbroken segments either side." src="/img/pangenome/prepare_graph_segments.png" />

The other three tracks the script writes read the files beside the pair: the
bubbles as a feature lane and again as a curve of segments per bubble, and the
allele inventory as an alignments track, whose CIGAR draws a 63 kb insertion at
its real magnitude where a feature track would draw it one pixel wide. With all
four showing, the graph track's menu **Launch → Graph genome view (this
region)** opens the window as a graph under the linear view, anchored to its
coordinates, and the graph follows the linear view from then on.

<Figure caption="The four tracks the command writes, over the C4 region on hg38: the graph track, the bubbles as a lane and as a curve, and the allele inventory, above the graph launched from the graph track's menu, anchored under the linear view and following it." src="/img/pangenome/host_your_own.png" />

## Opening a node on its own haplotype

An allele's rGFA name places it on the haplotype that contributed it, as in
`NA20809#2#CM094351.1`, and the node's right-click menu offers **Open in** that
haplotype when the session holds an assembly whose name or alias is its
`sample#haplotype`. The launched view shows whatever the session annotates that
assembly with. The config the HPRC page opens is the worked example: it declares
each release 2 haplotype as its chromosome lengths alone, named `NA20809.2` with
`NA20809#2` as an alias, beside that haplotype's CAT genes as a tabix-indexed
BED, which is enough for a view that draws annotation and no sequence.
[Browsing the graph](/docs/tutorials/pangenome_hprc#from-an-allele-to-its-haplotype)
takes that route.

## Checking the index against the graph

The index carries coordinates the graph file also carries, so the two can be
compared directly. Query a locus out of the index, then ask the graph about one
of the segments it returned:

```bash
# the first three columns are the stable sequence and the span, the fourth the
# segment id and the fifth its rank
tabix hprc.segs.bed.gz 'GRCh38#0#chr1:103,690,000-103,700,000' | head -3

# the same segment's S-line, straight out of the graph
gfatools view -l s12829 -r 0 hprc-v2.1-mc-grch38.sv.gfa.gz
```

The `SN` and `SO` on that S-line are the BED row's first two columns, and its
`SR` is the fifth. An **empty result** where the reference is tiled means the
query used the wrong namespace: segments are indexed under the graph's PanSN
names, so a bare `chr1` finds nothing where `GRCh38#0#chr1` finds everything. A
window with **backbone rows and no alleles** is a locus where the graph
collapsed rather than one it holds nothing for; minigraph does that to
near-identical segmental duplications.

## A whole chromosome {#a-whole-chromosome-the-bubble-tier}

The tier the script wrote collapses each bubble to one node, with the invariant
reference between bubbles as backbone. Its threshold is on **content**, the
larger of the reference span and the longest allele, because a pure insertion is
an alternative to nothing and a threshold on span would drop every one. On
HPRC's 130,510 bubbles a whole 249 Mb chr1 comes back as 474 nodes at 10,000,
against about 751,000 segments in the fine index. `--tier` moves it; a pggb
graph defaults to 50, since its bubbles are mostly single bases.

## Who carries what

An rGFA does not record who carries a segment. Its rank is build order, so a
segment names the assembly that contributed it first and never the rest. Two
ways to get carriage back, depending on what sits beside the graph.

With the **assemblies**, map each one back through the graph and ask for its
path rather than an alignment:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call asks for the path each sample takes through every bubble rather than an
# alignment. It emits one line per `gfatools bubble` line, in the same order for
# every sample, so line N of one sample and line N of another are the same
# bubble. -xasm is the assembly-to-graph preset, and -c asks for the base-level
# alignment the call is read off.
minigraph -cxasm --call -t 8 graph.rgfa.gz sample.fa > sample.call.bed
```

Run it once per assembly with the reference first.
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs the loop and writes one tabix-indexed row per bubble per sample, which
draws as one lane per haplotype.

With a **plain GFA** you already have it: the path walk that built the index
recorded who visits each segment as an `SM:Z:` tag, which reaches the node
details panel as `carriedBy` and a linear track as `feature.samples` and
`feature.carriers`, so the graph track can be colored by how many haplotypes
carry each segment:

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
    "color": "jexl:feature.carriers>3 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

Carriage is per haplotype, written `HG002.1`, because keying it on the sample
alone merges a diploid sample's two copies.
[Part 2 reads carriage at the graph's own granularity](/docs/tutorials/pangenome_hprc_part2#carriage-at-the-graphs-own-granularity)
from a file built this way.

## Every haplotype's walk: a gbz-base database

A `.gbz` is vg's indexed form of a graph and holds one walk per haplotype, which
is a copy count at a repeat and a carriage answer everywhere else. Reading it in
the browser means converting it to a **gbz-base database**, the graph in SQLite
laid out so a window is a handful of range requests. Three commands stand
between a `.gbz` and the track, none of them JBrowse:

```bash
# vg 1.69.0 or newer reads the chains out of a distance index; a top-level
# index (vg index --no-nested-distance) is enough
vg chains graph.gbz graph.dist > graph.chains

# the database itself: one row per node and per path, plus those chains.
# Without --chains a window comes back as the reference walk alone.
gbz-base construct --chains graph.chains graph.gbz
```

`gbz-base` is `cargo install gbz-base`, and writes `graph.gbz.db` beside the
input. Then name the haplotypes, which the database cannot do on its own:
upstream gbz-base reports `unknown#1`, `unknown#2` for the walks in a subgraph.

<!-- from: scripts/build_hprc_gbz_index.sh -->

```bash
# --interval is how often a GBWT position is recorded along each path, in bp.
# Denser means a bigger file and a shorter walk at query time to identify a
# haplotype. --anchor-spacing is how often an anchor node is chosen along each
# reference path, the node most haplotypes pass in the half spacing before each
# multiple; every haplotype's visit through it is recorded, which is what lets a
# window for a chosen set of lanes walk only those haplotypes. --output writes
# a companion file instead of adding tables to the database, the form to use on
# a database you did not build.
gbz-haplotype-index --interval 16384 --anchor-spacing 131072 \
  --output graph.haplotype-index.db graph.gbz
```

Over HPRC's 464 haplotypes that is a 7.9 GB companion written in about 13
minutes on 24 cores. The sort holds every recorded position in memory, so give
it room; on a 16-thread Intel Mac the walk aborts inside libmalloc's nano zone,
and `MallocNanoZone=0` or `--threads 8` gets past it.

The database and the companion go somewhere that serves range requests, and
their two URLs are the `uri` and the `haplotypeIndexLocation` of the track:

```json addtrack
{
  "type": "SyntenyTrack",
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
      "displayId": "my_graph_lanes-MultiWaySyntenyDisplay",
      "height": 600
    }
  ]
}
```

The companion records the graph's path count and the reader refuses one built
for a different graph. `nodeLimit` fails a window rather than letting the
display sit on a whole chromosome, and the failure names a zoom that would fit.
What the track then does with the lanes is
[part 3's](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph) subject.

## Reproduce it end to end

The command at the top is the whole build for the graph track, the bubbles, the
tier and the allele inventory, with the tools under
[Prerequisites](#prerequisites):

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
each of which runs on its own too. The gbz-base companion for HPRC's own
database has a script of its own, which downloads the 5.5 GB `.gbz`, builds
`gbz-haplotype-index` from source and runs the one command
[above](#every-haplotypes-walk-a-gbz-base-database):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_gbz_index.sh
bash build_hprc_gbz_index.sh out
```

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/user_guides/graph_genome_view)

## References

- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), which define the `SN`/`SO`/`SR`
  tags the projection reads and call the bubbles.
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  whose graph is the worked example here.
- [gbz-base](https://github.com/jltsiren/gbz-base), which stores a GBZ as the
  SQLite database a window is range-requested out of.
