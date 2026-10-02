---
title: Pangenome (hosting your own graph)
description:
  One command turns your pangenome graph into the indexed files JBrowse browses
  by locus, plus the config that carries them
guide_category: Tutorials
tutorial_category: Pangenomes
---

To let people browse a pangenome graph in JBrowse, from a whole chromosome down
to single nodes, the graph has to be cut into small indexed files that answer
one window at a time. One command writes those files and the config that puts
them on tracks. We run it on HPRC release 2, and:

- load the plugin and run the command
- open the track as a graph and as a lane of segments
- check the index against the graph
- add two optional layers: carriage per segment, and the walk of each haplotype

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](#the-graphgenomeview-plugin)
- htslib (`bgzip`, `tabix`), `bcftools`, `python3`, `sort`
- [`gfatools`](https://github.com/lh3/gfatools) and GNU awk, for an rGFA
- [`minigraph`](https://github.com/lh3/minigraph), for carriage
- [`vg`](https://github.com/vgteam/vg) 1.69.0+,
  [`gbz-base`](https://github.com/jltsiren/gbz-base) and
  [`gbz-haplotype-index`](https://crates.io/crates/gbz-haplotype-index), for
  haplotype walks

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)'s Minigraph-Cactus
graph, which every HPRC page on this site reads.

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

GraphGenomeView loads by URL, from a `plugins` array at the top of `config.json`
([configuring plugins](/docs/config_guides/plugins)). The config the command
writes carries this entry:

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

## One command {#what-your-graph-can-produce}

Fetch the script:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh
```

An **rGFA**, from minigraph or the minigraph stage of Minigraph-Cactus, needs an
output prefix and the assembly name your config uses:

```bash
bash build_pangenome_graph.sh graph.rgfa.gz out --assembly hg38
```

A **plain GFA**, from pggb, odgi, vg or base-level Minigraph-Cactus, also needs
the backbone sample and its bubbles. `vg deconstruct` writes the snarl VCF the
bubbles come from, one record per top-level snarl against the reference path
(`pggb -V` writes the same file). The VCF's CHROM must be the assembly's
refName, so rename the PanSN path as the
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

The rGFA route runs GNU awk, which is `brew install gawk` on macOS with `gnubin`
first on `PATH`.[^awk] At human-chromosome scale, index the SV-resolution rGFA;
a pggb graph's index does not finish there. An assembly graph from SPAdes or
Flye has no reference to index against; open it in Bandage.

The command writes these files beside the prefix:

| file                     | what it holds                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `.segs.bed.gz`           | one row per segment, at its reference coordinate                                    |
| `.links.bed.gz`          | one row per link per endpoint, both ends stated in full                             |
| `.bubbles.bed.gz`        | where haplotypes diverge and rejoin, with each bubble's shortest and longest allele |
| `.tier10000.segs.bed.gz` | one node per bubble, so a whole chromosome draws                                    |
| `.alleles.bed.gz`        | one row per allele, with a CIGAR that states its size                               |
| `.config.json`           | the tracks below, with the plugin entry                                             |

### The bubble tier {#a-whole-chromosome-the-bubble-tier}

The tier draws each bubble as one node on the reference backbone, and folds
bubbles under its threshold into the backbone. A bubble's size for that test is
the larger of its reference span and its longest allele. The threshold is in the
file name, 10,000 bp by default; `--tier` sets it, and a pggb graph defaults to
50, since most of its bubbles are single bases.

## The graph track {#the-two-indexes-a-graph-track-reads}

The config's first track is the graph. `uri` is the prefix, and `coarse` names
the tier the track draws past `aboveBpPerPx` bp per pixel. `assemblyNameToPanSN`
maps your assembly name to the graph's PanSN sample, and the command writes it
only when the two differ.

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
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

Turned on, the track draws as a graph. **Display types → Feature display** in
its track menu draws the same segments as a lane.

<Figure caption="The HPRC graph's segment index drawn over the C4 region on hg38. The segments tile the window end to end and break where the graph branches. The slivers fall among the C4 and CYP21 copies, with long unbroken segments either side." src="/img/pangenome/prepare_graph_segments.png" />

The command writes `out.config.json`. Merge its `plugins` and `tracks` entries
into your own config.

The other three tracks in the config draw the bubbles as a lane and as a curve,
and the allele inventory as an alignments track. Turn them on and switch the
graph back with **Display types → Graph**.

<Figure caption="The four tracks the command writes, over the C4 region on hg38: the bubbles as a lane and as a curve, the allele inventory, and the graph track at the bottom." src="/img/pangenome/host_your_own.png" />

A node's right-click menu offers **Open in** the haplotype named in its rGFA id,
such as `NA20809#2#CM094351.1`, when the session holds an assembly named or
aliased `sample#haplotype`, here `NA20809#2`.
[The HPRC tutorial](/docs/tutorials/pangenome_hprc#check-it-on-the-haplotype)
takes that route.

## Checking the index against the graph

Query a locus out of the index, by the graph's PanSN name for the reference
contig:

```bash
tabix hprc.segs.bed.gz 'GRCh38#0#chr1:103,690,000-103,700,000' | head -3
```

Columns one to three are the contig and span, four is the segment id, and five
is its rank. Ask the graph about one of those segments:

```bash
gfatools view -l s12829 -r 0 hprc-v2.1-mc-grch38.sv.gfa.gz
```

The S-line's `SN` and `SO` tags match the row's first two columns, and `SR`
matches the fifth.

- **An empty result** over a tiled reference means the query used the wrong
  name: `chr1` finds nothing where `GRCh38#0#chr1` finds every segment.
- **Backbone rows with no alleles** mark a place where the graph collapsed,
  which minigraph does to near-identical segmental duplications.

## Who carries what

The rank in an rGFA is build order, so it names the first assembly that
contributed a segment. Carriage comes from one of two sources.

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
bubble per sample, drawn as one lane per haplotype.

With a **plain GFA**, the command records who visits each segment as an `SM:Z:`
tag while it walks the paths. The node panel shows it as `carriedBy`, and a
track reads it as `feature.samples` and `feature.carriers`. **Color by... →
Attribute...** with `carriers` gives each count a separate colour. Past a
handful of haplotypes a ramp reads better; **Edit plot...** in the same dialog
takes one, here red for a segment one haplotype carries to grey for the most
widely carried:

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

[The E. coli pggb tutorial](/docs/tutorials/pangenome_ecoli#carriage-as-a-linear-lane)
draws carriage over an IS5 insertion.

Carriage is per haplotype (`HG002.1`), so a diploid sample's two copies count
separately.
[Snarl-level carriage](/docs/tutorials/pangenome_hprc#the-callset-beside-the-graph)
reads HPRC's published carriage file.

## Haplotype walks: a gbz-base database

A `.gbz` is vg's indexed form of a graph, with one walk per haplotype. The
browser reads it as a **gbz-base database**, the graph in SQLite, which three
commands build.

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
`unknown#2`, and `gbz-haplotype-index` writes their names to a companion file:

<!-- from: scripts/build_hprc_gbz_index.sh -->

```bash
# --interval: bp between recorded GBWT positions per path; denser is bigger
#   and faster
# --anchor-spacing: bp between anchor nodes on the reference path, so a window
#   walks only the chosen lanes
gbz-haplotype-index --interval 16384 --anchor-spacing 131072 \
  graph.gbz graph.haplotype-index.db
```

`cargo install gbz-base` and `cargo install gbz-haplotype-index` install the two
tools.[^gbz-cost]

Serve the database and the companion from URLs that answer range requests, and
point the track's `uri` and `haplotypeIndexLocation` at them:

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
    { "type": "MultiWaySyntenyDisplay", "height": 600 },
    { "type": "LinearGraphDisplay" }
  ]
}
```

The adapter rejects a companion built from a graph with a different path count.
`nodeLimit` fails a window with too many nodes and names a zoom that fits.
[Haplotypes against each other](/docs/tutorials/pangenome_hprc_haplotypes) draws
the lanes this track produces.

## Reproduce it end to end

The one command builds the graph track, the bubbles, the tier and the allele
inventory, with the tools under [Prerequisites](#prerequisites). It:

1. places every segment on a genome. An rGFA states each segment's sequence and
   offset in its own tags. For a plain GFA the command walks the backbone's
   paths first, so every segment they visit lands on the reference, and places
   each remaining segment on the first other haplotype that walks it
2. finds the bubbles, with `gfatools bubble` on an rGFA or from the snarl VCF on
   a plain GFA, and builds the tier from them
3. reads each allele out of the links, following it from where it leaves the
   backbone to where it rejoins. The reference between those two points and the
   sequence the allele walks give the CIGAR its size

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
each runnable alone. HPRC publishes the gbz-base database itself, so a separate
script builds only the
[haplotype-walk companion](#haplotype-walks-a-gbz-base-database), from the 5.5
GB `.gbz`:

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

## References

- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools): the `SN`/`SO`/`SR` tags and the
  bubble calls.
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the worked
  example here.
- [gbz-base](https://github.com/jltsiren/gbz-base): a GBZ as a SQLite database,
  range-requested per window.

[^awk]:
    BSD awk, the macOS default, takes hours on a large table where GNU awk takes
    minutes.

[^gbz-cost]:
    Over HPRC's 464 haplotypes the companion is 7.9 GB, built in about a quarter
    of an hour on 24 cores with a 12 GB memory peak. On a 16-thread Intel Mac
    the build aborts inside libmalloc's nano zone; `MallocNanoZone=0` or
    `--threads 8` avoids it.
