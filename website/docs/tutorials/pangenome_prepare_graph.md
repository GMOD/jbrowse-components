---
title: Pangenome (preparing your own graph)
description:
  Turn a pangenome graph you already have into the small indexed files JBrowse
  opens by locus, and the database that holds every haplotype's walk
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** you have a pangenome graph of your own and want to look at it a locus
at a time. A graph file is not something a browser can seek into, so this page
converts one, once, into a handful of small indexed files: the segments and
links a window is cut from, a list of where the graph varies, a list of what the
variation is, and a database holding each haplotype's walk. Every step is one
command over the file you already have, and the output is plain BED and SQLite
that anything can read.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- [the GraphGenomeView plugin](/docs/tutorials/pangenome_hprc#the-graphgenomeview-plugin),
  which supplies the adapters every track here uses
- htslib (`bgzip`, `tabix`), for every index on this page
- [`gfatools`](https://github.com/lh3/gfatools), for the rGFA projection and the
  bubble file
- `python3`, for the plain-GFA path walk and the bubble tier
- [`minigraph`](https://github.com/lh3/minigraph), to call carriage against the
  graph, which needs the assemblies as well
- [`vg`](https://github.com/vgteam/vg) 1.69.0 or newer, and
  [`gbz-base`](https://github.com/jltsiren/gbz-base), to turn a `.gbz` into a
  range-requestable database
- `gbz-haplotype-index`, from
  [`@gmod/gbz-base`](https://github.com/GMOD/gbz-base-js), to name the
  haplotypes in such a database

Only the first three are needed for the graph track itself. `minigraph` wants
every assembly the graph was built from, and the three `gbz` tools apply only to
a graph published in vg's format.

## Where the data comes from

The worked example is
[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), whose
Minigraph-Cactus graph is the one
[the HPRC page](/docs/tutorials/pangenome_hprc) reads through the files built
here, so every command below can be checked against a published result.

- the SV-resolution graph, an rGFA and the input to most of this page:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the base-level graph beside it, which is a plain GFA and takes the other
  route:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gfa.gz
- the same graph in vg's format, the input to the database at the end:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz
- the finished files this page builds, hosted so a build can be compared against
  one that worked, with the exact commands recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt

## What your graph can produce

Everything on this page rests on one question: does your graph state where each
segment sits on a reference. The formats answer it differently, and the answer
decides which of the two builders you run, not what you get afterwards.

| Your file                                                     | Where positions live                 | Builder               |
| ------------------------------------------------------------- | ------------------------------------ | --------------------- |
| **rGFA** (minigraph, the minigraph stage of Minigraph-Cactus) | `SN`/`SO`/`SR` tags on every segment | `build_rgfa_tabix.sh` |
| **plain GFA** (pggb, odgi, vg, base-level Minigraph-Cactus)   | inside the P/W path lines            | `build_pggb_tabix.sh` |
| **assembly graph** (SPAdes, Flye, Velvet)                     | nowhere, there is no reference       | none, use Bandage     |

An rGFA tags every segment with three fields, which is the whole of the
[spec](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md):

```
S  s3  TTGCAA  LN:i:6  SN:Z:GRCh38#0#chr1  SO:i:10621  SR:i:0
```

`SN` is the stable sequence the segment sits on, `SO` its offset there, and `SR`
its rank, `0` on the reference backbone. A plain GFA states the same three
things in path order instead: walking a P or W line assigns every segment it
visits an interval on that path's own sequence.

The label on the file is not the answer. Release 2 labels nothing "rGFA", yet
`sv.gfa.gz` is one, because it is the minigraph stage of the build; the `gfa.gz`
beside it is base-level and is not. Point the wrong builder at a file and
`build_rgfa_tabix.sh` says so rather than writing an empty index, because
`gfatools` projects a tagless graph to no segments at all.

A third format turns up on published human graphs. A `.gbz` is vg's indexed form
and carries a walk per haplotype rather than tags, so it answers a different
question and gets [its own section](#every-haplotypes-walk-a-gbz-base-database)
at the end.

## The two indexes a graph track reads

JBrowse reads a graph as two tabix-indexed BED projections of it,
`<prefix>.segs.bed.gz` for the segments and `<prefix>.links.bed.gz` for the
links between them. Both builders emit that identical pair, so the format
question is settled once and nothing downstream knows which route the file took.

For an rGFA the tags are already coordinates, so the build is a projection:

<!-- from: scripts/build_rgfa_tabix.sh -->

```bash
# -m keeps the segment's rGFA tags on each BED row, which is what carries rank
# and stable name through to the index
gfatools gfa2bed -m graph.sv.gfa.gz
```

For a plain GFA a python helper walks the P and W lines and stands in for those
tags, deriving the same intervals from path order.

Neither is run by hand. Each is wrapped in a script that sorts, compresses and
indexes both files, and fetches the python helper it needs:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_tabix.sh
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh

# rGFA, straight from the gzipped file with nothing to unpack
bash build_rgfa_tabix.sh hprc-v2.1-mc-grch38.sv.gfa.gz out

# plain GFA, the same pair by the other route. The third argument names the
# ASSEMBLY to anchor on, not a path, so every contig that assembly contributes
# walks first at rank 0. A diploid reference wants the haplotype (HG002#1); a
# bare sample is enough where the reference is haploid, and leaving it off lets
# file order pick, which the script reports on stderr.
bash build_pggb_tabix.sh graph.gfa graph K12
```

A plain GFA states no reference of its own, which is why that third argument
exists and why an rGFA needs no equivalent: `SR` already says which segments are
the backbone.

The rGFA route wants **GNU awk**. Its links pass builds a hash table with about
760,000 keys, which gawk does in seconds and the BSD awk macOS ships does in
hours; `brew install gawk` and putting its `gnubin` first on `PATH` is the
difference. HPRC's 751,000 segments then index in about 45 seconds, peaking near
3.7 GB.

Scale is worth checking before pointing the plain-GFA route at a human graph. A
pggb graph runs about 17 bp per segment, so its index grows with total sequence
rather than with variation: five E. coli strains are 606,000 segments and build
in about a minute, while release 2's per-chromosome pggb graph for chrY, the
smallest of the 25, is 4.12 million segments and does not finish. At human
scale, index the SV-resolution rGFA instead.

The pair loads as an ordinary `FeatureTrack`, pointed at the shared prefix
rather than at either file. The adapter resolves `<uri>.segs.bed.gz`,
`<uri>.links.bed.gz` and both `.tbi`:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "my_graph_segments",
  "name": "My graph (rGFA segments)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://example.com/graphs/my_graph",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

`assemblyNameToPanSN` ties your assembly to the graph's PanSN prefix. A PanSN
name has two halves and only the first needs configuring: the **sample** half is
this map, disambiguating an `hg38` assembly against a graph that also carries
`CHM13#0#chr1`, and the **contig** half is ordinary refName aliasing your
assembly already does, so an hg38 spelling chr6 as `6` needs nothing further.

`RgfaTabixAdapter` is the adapter that cuts a subgraph from this pair of
indexes, as `GbzBaseSyntenyAdapter` does from a database. The same pair behind a
`BedTabixAdapter` draws as a feature track whose menu offers no graph.

## Checking the index against the graph

The index states coordinates the graph file also states, so the two can be
compared directly. Query a locus out of the index, then ask the graph about one
of the segments it returned:

```bash
# the first three columns are the stable sequence and the span, the fourth the
# segment id and the fifth its rank
tabix out.segs.bed.gz 'GRCh38#0#chr1:103,690,000-103,700,000' | head -3

# the same segment's S-line, straight out of the graph
gfatools view -l s12829 -r 0 graph.sv.gfa.gz
```

The `SN` and `SO` on that S-line are the BED row's first two columns, and its
`SR` is the fifth. Where the graph is a plain GFA there is no S-line to compare
against, and the check is that the segment's interval falls inside the path the
walk anchored on.

Two answers are worth reading rather than treating as failures. An **empty
result** where the reference is tiled means the query used the wrong namespace:
segments are indexed under the graph's PanSN names, so a bare `chr1` finds
nothing where `GRCh38#0#chr1` finds everything. A window that comes back with
**backbone rows and no alleles** is a locus where the graph collapsed rather
than one it holds nothing for, which is what minigraph does to near-identical
segmental duplications.

## Where the graph varies: the bubble file

A bubble is where haplotypes diverge and rejoin. One `gfatools` call over the
same graph writes them all, with the shortest and longest allele each holds:

```bash
gzip -dc graph.sv.gfa.gz | gfatools bubble - \
  | sort -k1,1 -k2,2n | bgzip > graph.bubbles.bed.gz
tabix -p bed graph.bubbles.bed.gz
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "my_graph_bubbles",
  "name": "My graph bubbles",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://example.com/graphs/my_graph.bubbles.bed.gz",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  }
}
```

Bubbles are indexed under the graph's PanSN names, which is why this config
carries `assemblyNameToPanSN` where the allele inventory below does not.

`gfatools bubble` reads rGFA tags to place a bubble on a reference, so it
returns nothing at all on a plain GFA that states the same thing in its paths.
There, run `snarls_to_bubble_bed.py` over the snarl VCF `pggb -V` or
`vg deconstruct` already produced, which writes this same BED from that
decomposition:

```bash
python3 snarls_to_bubble_bed.py graph_snarls.vcf.gz graph.bubbles.bed
```

The path count in the file needs care whichever route wrote it: it counts routes
combinatorially rather than haplotypes observed, and saturates at `2147483647`,
which the track labels uncountable.

## A whole chromosome: the bubble tier

The track above draws one node per segment, so a window past a few hundred
kilobases is more nodes than anything can lay out. Collapsing each bubble to a
single node, with the invariant reference between bubbles as backbone, turns the
same graph into something that fits on a screen. The bubble file is the input,
so this needs no second pass over the graph:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_bubble_tier.sh
bash build_bubble_tier.sh graph.bubbles.bed.gz graph.tier10000 10000
```

The threshold is on **content**, the larger of the reference span and the
longest allele, rather than on `end - start`. A pure insertion is an alternative
to nothing, so a large share of bubbles are zero-length on the reference and a
threshold on span alone would drop every one of them, the graph's largest
insertions among them.

On HPRC's 130,510 bubbles, a whole 249 Mb chr1 comes back as 18,888 nodes at a
threshold of 0, 3,342 at 1000 and 474 at 10000, against about 751,000 segments
for the fine index over the same span. Pick the threshold for the widest window
you mean to draw; a pggb graph wants a much lower one, its bubbles being mostly
small.

The result reads through the same adapter as the fine index, so choosing a level
of detail is choosing a prefix:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "my_graph_tier",
  "name": "My graph: bubble tier (one node per bubble)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://example.com/graphs/my_graph.tier10000",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  }
}
```

One setting has to move with it. The view refuses a cut over 5 Mb, which is a
proxy for node count and a fair one at segment granularity, but a tier breaks
the proxy: 5 Mb of a fine index is a few thousand segments where the same span
is a few dozen tier nodes. A `GraphGenomeView` pointed at a tier carries
**`maxRegionBp`** raised to the span it is drawing. The real ceiling is
unchanged, since `maxGraphNodes` counts what actually came back.

## What the variation is: the allele inventory

The bubbles say where the graph varies. One row per allele, anchored on the
reference and carrying its size, says what the variation is. It is derived from
the two indexes rather than from the graph, so it costs seconds off a small pair
rather than a re-read of the whole file, and it works on somebody else's hosted
index with no graph in hand at all:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_alleles.sh
bash build_rgfa_alleles.sh out
```

Each row carries a `CIGAR` against the reference span it replaces
(`2062M63348I`), which is what makes the lane legible: an insertion consumes no
reference, so its start and end cannot state its size, and a plain feature track
would draw a 63 kb allele one pixel wide. An `AlignmentsTrack` walks the CIGAR
instead and draws the insertion at its real magnitude, with the same glyph it
draws for a read:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_graph_alleles",
  "name": "My graph: allele inventory",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://example.com/graphs/my_graph.alleles.bed.gz"
  }
}
```

The magnitude is measured and the position inside the span is not. A bubble
states what sequence replaces a reference interval, never where inside that
interval it sits, so the CIGAR puts the indel at the end of the span by
convention.

`discoveryRank` and `firstSeenIn` on each row are the lowest `SR` on the
allele's path and the assembly that goes with it. Read them as attribution
rather than as rarity: `SR` is construction order, so a haplotype earlier in
that order may lack the sequence, may have had its copy merged into an existing
path, or may simply not have aligned there. The script's closing summary prints
how many rows are nested, which is the filter (`jexl:feature.nested==0`) to
apply before reading lengths in bulk.

## Who carries what

An rGFA cannot say who carries a segment. `SR` is build order, so a segment
names the assembly that contributed it first and never the rest, and this is the
one thing the format leaves out. There are two ways to get it back, and which
one is open to you depends on what you have beside the graph.

If you have the **assemblies**, map each one back through the graph and ask for
its path rather than an alignment. One call per sample is the whole of it:

<!-- from: scripts/build_minigraph_paths.sh -->

```bash
# --call asks for the path each sample takes through every bubble rather than an
# alignment. It emits one line per `gfatools bubble` line above, in the same
# order for every sample, so line N of one sample and line N of another are the
# same bubble and can be joined on line number alone.
# -xasm is the assembly-to-graph preset, and -c asks for the base-level
# alignment the call is read off.
minigraph -cxasm --call -t 8 graph.rgfa.gz sample.fa > sample.call.bed
```

Run it once per assembly with the reference first: the reference's path through
a bubble is the allele every other sample's path is compared against.
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs the loop and writes one tabix-indexed row per bubble per sample, which
draws as one lane per haplotype.

If your graph is a **plain GFA**, you already have it and need no assemblies:
the path walk that built the index recorded who visits each segment, written
into the index as an `SM:Z:` tag. That reaches the node details panel as
`carriedBy`, and reaches a linear track as `feature.samples` and
`feature.carriers`, so a lane can be colored by how many haplotypes carry each
segment:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "my_graph_carriage",
  "name": "My graph: carriage per segment",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://example.com/graphs/my_graph",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  },
  "displayDefaults": {
    "color": "jexl:feature.carriers>3 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}
```

Carriage is per haplotype, written `HG002.1`, because keying it on the sample
alone merges a diploid sample's two copies and reports a segment carried only on
the maternal one as "HG002 carries it". `feature.carriers` is absent rather than
`0` on an rGFA-derived index, which is the difference between the two routes
showing up in a jexl.

## Every haplotype's walk: a gbz-base database

A `.gbz` is vg's indexed form of a graph and holds one walk per haplotype, which
is a copy count at a repeat and a carriage answer everywhere else. Reading it in
the browser means converting it to a **gbz-base database**, the graph in SQLite
with its tables laid out so a window is a handful of range requests rather than
a whole-file download.

Three commands stand between a `.gbz` and the track, none of them JBrowse. The
chains come first, because a query that reaches the variation around a window
rather than only the reference walk through it needs the snarl decomposition,
and gbz-base stores it as links on the boundary nodes:

```bash
# vg 1.69.0 or newer reads the chains out of a distance index. A top-level
# index (vg index --no-nested-distance) is enough; the nested one is not needed
# and is far more expensive on a human graph.
vg chains graph.gbz graph.dist > graph.chains

# the database itself: one row per node and per path, plus those chains.
# Without --chains it still builds and a window comes back as the reference
# walk alone.
gbz-base construct --chains graph.chains graph.gbz
```

`gbz-base` is `cargo install gbz-base`, and writes `graph.gbz.db` beside the
input. Then name the haplotypes, which the database cannot do on its own:
upstream gbz-base reports `unknown#1`, `unknown#2` for the walks in a subgraph,
because it stores no map from a GBWT position back to a sample.

<!-- from: scripts/build_hprc_gbz_index.sh -->

```bash
# --interval is how often a GBWT position is recorded along each path, in bp.
# Denser means a bigger file and a shorter walk at query time to identify a
# haplotype. 16384 over the 464 haplotypes of the HPRC graph, with the anchor
# rows below, is 178.5M recorded positions and a 7.9 GB companion, written in
# about 13 minutes on 24 cores.
# --anchor-spacing is how often an anchor node is chosen along each reference
# path, the node most haplotypes pass in the half spacing before each multiple;
# every haplotype's visit through it is recorded, which is what lets a window
# for a chosen set of lanes walk only those haplotypes. 131072 is the default.
# --output writes a companion file instead of adding the tables to the
# database, which is the form to use on a database you did not build.
gbz-haplotype-index --interval 16384 --anchor-spacing 131072 \
  --output graph.haplotype-index.db graph.gbz
```

The sort holds every recorded position in memory, so give it room. On a
16-thread Intel Mac the walk aborts inside libmalloc's nano zone;
`MallocNanoZone=0` or `--threads 8` gets past it, at over an hour of walking.

Both files go somewhere that serves range requests, and their two URLs are the
`uri` and the `haplotypeIndexLocation` of the track:

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
    "assemblyNames": ["hg38", "HG00097.1", "HG00099.1"],
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
      "height": 600,
      "lanes": ["HG00097.1", "HG00099.1"]
    }
  ]
}
```

The companion records the graph's path count and the reader refuses one built
for a different graph, so a mismatched pair fails rather than drawing the wrong
walks. `nodeLimit` is the guard on the other end: it fails a window rather than
letting the display sit on a whole chromosome, and the failure names a zoom that
would fit, so it has to clear the largest window you mean to open.

What that track then does with the lanes, and what a window costs to read, is
[the HPRC page's](/docs/tutorials/pangenome_hprc_part2#walks-from-the-graph)
subject.

## Reproduce it end to end

Two scripts and one `gfatools` call build the graph track, the bubbles and the
allele inventory for any rGFA, with the tools listed under
[Prerequisites](#prerequisites):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_tabix.sh
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_alleles.sh
bash build_rgfa_tabix.sh hprc-v2.1-mc-grch38.sv.gfa.gz out
bash build_rgfa_alleles.sh out
```

- [`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
  writes the two tabix indexes `RgfaTabixAdapter` reads, straight from the
  gzipped rGFA with nothing to unpack.
- [`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh)
  reads only those two indexes and never the graph.
- [`build_pggb_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pggb_tabix.sh)
  is the same first step for a plain GFA, and
  [`build_bubble_tier.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_bubble_tier.sh)
  the coarse tier for either.

`build_rgfa_tabix.sh` takes an optional third argument, the reference's PanSN
sample, and writes a second index pair keyed only under that sample's sequences
(`<prefix>.ref.*`). It is a fraction of the full pair's index size and returns
byte-identical rows, and it is for a segments track drawn on the reference. **Do
not point a graph cut at it**: **Graph context** defaults to 1 hop, a hop
follows an allele's interior segments, and those are indexed under the donor
contigs the small pair drops, so the graph comes back as though the setting were
**None**.

The gbz-base companion index for HPRC's own database has a script of its own,
which downloads the 5.5 GB `.gbz`, builds `gbz-haplotype-index` from source and
runs the one command [above](#every-haplotypes-walk-a-gbz-base-database):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_gbz_index.sh
bash build_hprc_gbz_index.sh out
```

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
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
