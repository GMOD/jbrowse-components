---
title: Graph genome view
guide_category: Views
description:
  Draw a pangenome graph as a graph, from an rGFA, a plain GFA or a gbz-base
  database, as a track of the linear genome view at any locus
---

The graph genome view plugin draws a pangenome graph **as a graph**, as a track
of the linear genome view. The graph sits under the view's other tracks, on the
view's coordinates, and moves when the view moves. The reference's path through
the graph is the **backbone**, and every segment off that path is an alternate
allele from another assembly. Most other pangenome tracks are **projections**,
which flatten the graph onto one reference's coordinates as synteny, variants,
alignment, or depth.

**Prerequisites:** the plugin (below), a graph in rGFA or GFA, and the
contributing assemblies if you want to open a node on them.

<Figure caption="50 kb of K12 with the graph as its bottom track. The segments lane and the graph share a color ramp, so a block and its node share a hue; charcoal nodes are alternate alleles." src="/img/pangenome/rgfa_subgraph_launch.png" />

:::info Requires the graph genome view plugin

The graph track comes from a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
left out of JBrowse Web because its layout engine,
[Bandage](https://github.com/rrwick/Bandage)'s, is GPL-licensed. The plugin is
in **beta**, and the [plugin store](/docs/user_guides/plugin_store) lists it as
GraphGenomeView. A config names it with the entry below
([configuring plugins](/docs/config_guides/plugins)).

<!-- BEGIN GENERATED GRAPH_PLUGIN_CONFIG -->

```json
{
  "plugins": [
    {
      "name": "GraphGenomeView",
      "storePlugin": "GraphGenomeView",
      "esmUrl": "https://jbrowse.org/plugins/jbrowse-plugin-graphgenomeviewer/latest/dist/jbrowse-plugin-graphgenomeviewer.esm.js"
    }
  ]
}
```

<!-- END GENERATED GRAPH_PLUGIN_CONFIG -->

The plugin, which also holds `RgfaTabixAdapter` and `MinigraphBubbleAdapter`,
needs JBrowse 5 (v5.0.0-beta.20 or later). A JBrowse 4 host opens a config
naming it with no graph track and neither adapter.

:::

## Quick start

Index the graph once with `gfa-to-tabix build`, which writes `.graph.bed.gz`, a
tabix-indexed BED file of the segments and the links between them, and a track
config for it ([Route 1](#route-1-a-graph-track-browsable-by-locus)). Then **Add
track** with that config, whose adapter is `RgfaTabixAdapter`, and the track
opens as the graph. [Route 2](#route-2-a-gfa-file) opens a GFA as a file, with
no index. Skip to [Layouts](#three-layouts) for what the track menu's items do.

The graph opens force-directed under the other tracks. Typing in the location
box, a gene search, a click on the cytoband and a drag-zoom move the view. The
track holds its drawing while the view stays inside the cut it drew, and cuts
the subgraph for the new window and lays it out again once the view leaves it. A
track with a coarse tier, the same graph with one node per bubble, cuts the tier
when zoomed out past the handover its config names, so a whole chromosome draws
as a graph.

`WalkTabixSyntenyAdapter` also cuts a subgraph, from `gfa-to-tabix --walks`
files, and its cut includes the haplotypes' walks. A `BedTabixAdapter` over the
`RgfaTabixAdapter` index draws only as a lane.

## Segment coordinates by format

A graph is a set of segments and links, which is all force-directed layout
needs. Drawing it **as a track of a linear view** also needs each segment's
position on a reference, and the formats differ on where that position is
stored.

| Format                                                        | Where positions live                 | Opening a locus                          |
| ------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **rGFA** (minigraph, the minigraph stage of Minigraph-Cactus) | `SN`/`SO`/`SR` tags on every segment | direct, the file has them                |
| **plain GFA** (pggb, odgi, base-level Minigraph-Cactus)       | inside the P/W path lines            | walk a path first, in the app or offline |
| **assembly graph** (SPAdes, Flye, Velvet)                     | nowhere, there is no reference       | not possible                             |

rGFA and plain GFA both produce a segment track on the reference and a graph
that lines up under it. Every feature below except the force layout reads those
coordinates, so an assembly graph gets no locus cut, neither anchored layout, no
hover sync and no graph track. Open one in
[Bandage](https://github.com/rrwick/Bandage), which was built for assembly
graphs.

## Route 1: a graph track, browsable by locus

Once indexed, the graph loads as a `GraphTrack` that draws whatever window is on
screen as a graph.
[`gfa-to-tabix build`](https://github.com/GMOD/gfa-to-tabix/blob/main/docs/subcommands.md#build)
2.0.0 or later builds the index from either format; an rGFA's bubbles also need
[`gfatools`](https://github.com/lh3/gfatools) on PATH.
[Indexing a graph](/docs/tutorials/pangenome_prepare_graph#what-your-graph-can-produce)
covers how it places a plain GFA's segments, the files it writes and the coarse
tier.

```bash
# or a binary from https://github.com/GMOD/gfa-to-tabix/releases
cargo install gfa-to-tabix

# rGFA: the tags are already coordinates, so this is a projection
gfa-to-tabix build ecoli_minigraph.rgfa -o ecoli_minigraph

# plain GFA: walk the P (or W) lines to derive the same thing, with K12 as the
# backbone, and take the bubbles from the snarl VCF that pggb -V wrote
gfa=$(ls pggb/*.smooth.final.gfa)
vcf=$(ls pggb/*.smooth.final.K12.vcf)
gfa-to-tabix build "$gfa" -o ecoli_pggb --reference K12 --snarls "$vcf"
```

The rGFA in these figures is a minigraph graph of five strains, built by the
[pangenome tutorials](/docs/tutorials/pangenome_ecoli). The command writes
`<prefix>.graph.bed.gz` with its tabix index, a coarse tier with every variant
under 10 kb folded into the reference, and `<prefix>.config.json` with the
track:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph",
    "format": 2,
    "coarse": {
      "uri": "ecoli_minigraph.fold10000",
      "format": 2,
      "foldBelowBp": 10000
    }
  },
  "displays": [
    {
      "type": "LinearGraphDisplay",
      "displayId": "ecoli_minigraph_segments-LinearGraphDisplay"
    },
    {
      "type": "LinearBasicDisplay",
      "displayId": "ecoli_minigraph_segments-LinearBasicDisplay"
    }
  ]
}
```

[Configuring the graph track](/docs/tutorials/pangenome_prepare_graph#the-two-indexes-a-graph-track-reads)
explains the adapter's keys, including the `assemblyNameToPanSN` mapping that
HPRC's graph needs because it calls the reference `GRCh38` while the assembly is
`hg38`. The E. coli graph's stable names are PanSN (`K12#1#chr`), with the
assembly name as the sample, so it needs no mapping.

The config lists the graph display first, so the track opens as the graph, and
**Track menu → Display types → Feature display** draws the same segments as a
lane instead, one block each. As a graph:

- **Cut:** the track cuts the window on screen out of the index, on the graph's
  reference (the first assembly the track names), with a window-width of margin
  on each side, and cuts again whenever the view leaves that stretch
- **Limit:** a cut of segments spans at most 5 Mb; past that the track keeps its
  last cut and asks you to zoom in, unless the track has a coarse tier
- **Folding:** variants smaller than ten of the linear view's pixels fold into
  the reference, the legend gives the size, and zooming in restores them. The
  coarse tier is built by the same fold
  ([`gfa-to-tabix fold`](https://github.com/GMOD/gfa-to-tabix/blob/main/docs/subcommands.md#fold)),
  so the drawing barely changes across the handover
- **Links:** each line is one graph link, drawn only when both endpoints are
  inside the cut, so an allele near the window's edge draws only the link that
  stays inside it
- **Legible width:** a minigraph graph has nodes for structural variation and
  merges everything smaller, so a legible window is hundreds of kb; a pggb graph
  puts a node at every SNP, so a legible window is hundreds of bp
- **Whole chromosome as a lane:** load the tier's prefix as a separate track
  too; its lane draws a whole chromosome, where the segments lane does not draw

## Route 2: a GFA file

With no index, **Add → Graph genome view** opens a GFA by file or URL in a
separate view and draws all of it, with pan and zoom in that view and the same
layouts the track has. The file is the whole graph, with no index to cut another
window from. Use this route for a window someone cut for you, and for a graph
too large to index:

```bash
odgi extract -i graph.og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O | odgi view -i - -g > window.gfa
# vg equivalent, for a Minigraph-Cactus graph
vg chunk -x graph.xg -p K12#1#chr:1004500-1004900 -c 20 > window.vg
```

- **Reference path:** **View menu → Graph settings... → Reference path** picks
  the path to anchor on, since a plain GFA has no reference. The view takes the
  offsets from a path name that `odgi extract` writes the window into
  (`K12#1#chr:1004500-1004961`); a whole-genome path starts at zero
- **Samples:** **Node details** lists under `samples` every path the `P` and `W`
  lines send through a node. A true rGFA has no traversals, so there `samples`
  is empty and the panel reports `contributingAssembly`, the one assembly `SN`
  gives for the segment. A Route 1 index built from a plain GFA holds the same
  list as `SB:H:` bits; one built from a minigraph rGFA lacks it
- **Sample rows:** draws a row per contributing assembly. Each node is drawn
  once, on the row of the first path that reaches it, so a segment several
  haplotypes share appears on one of their rows and the others stay in `samples`

## On JBrowse Desktop

[JBrowse Desktop](/docs/quickstart_desktop) opens your own graph from files on
disk, with no server and no config file, by either route. Desktop reads a file
by its path, so a graph track finds the files `gfa-to-tabix build` wrote beside
the one you pick: the tabix index, the coarse tier and `<prefix>.graph.json`.
JBrowse Web's file picker hands over only the file picked, so there an indexed
graph opens by URL.

Install the plugin and open a genome first:

- **Install the plugin once.** Open **Global plugins...** in the start screen
  menu and click **Install** beside GraphGenomeView under **Available plugins**
- **Open a genome.** Desktop starts a session only by opening one. For a graph
  track, open the graph's reference, the assembly its backbone comes from (K12
  in the figures above, hg38 for HPRC)

A GFA small enough for the view to draw whole opens in a separate view
([Route 2](#route-2-a-gfa-file)):

- **Add → Graph genome view**, then **Choose file**. Any genome works, because
  the view lays out the GFA from its P/W lines

A graph indexed once on the command line opens as a track that cuts each window
as you browse ([Route 1](#route-1-a-graph-track-browsable-by-locus)):

- **Index** the graph with `gfa-to-tabix build`, as Route 1 shows, and its
  haplotype walks with `gfa-to-tabix --walks`, as
  [](/docs/tutorials/pangenome_prepare_graph) does. Keep the output files
  together in one folder
- **File → Open track...**, then pick **Add pangenome graph track** from the
  dropdown at the top of the form
- **Choose the file type**, then **Choose File** for the one file it names:
  - **Indexed GFA (gfa-to-tabix .segs.bed.gz or .graph.bed.gz):**
    `<prefix>.graph.bed.gz`, for an rGFA or a plain GFA, or the
    `<prefix>.segs.bed.gz` of a format 1 pair. The form also reads
    `<prefix>.graph.json`, so the track gets the coarse tier
  - **Haplotype walks (.walks.gz):** `<prefix>.<sample>.walks.gz`, from
    `gfa-to-tabix --walks` 5.0 or later, with its `.walks.gz.idx` beside it
  - **GBZ database (.gbz.db):** the database, with the haplotype index from
    `gbz-haplotype-index` beside it, and optionally reads aligned to the graph
    as GAF
- **Sample name in the graph:** the graph's name for the open genome where the
  two differ, `GRCh38` for an HPRC graph opened on hg38. Leave it blank where
  they match
- **Submit**, then type a locus. Zoomed out past what the track can cut, it asks
  you to zoom in, unless the graph has a coarse tier

The general **Add a track from file or URL** form opens the same three files as
a graph track too, with no coarse tier and no sample name field.

Desktop autosaves the session, local paths included, so it reopens from the
start screen with the graph as long as the files stay where they were.

## Layouts {#three-layouts}

The track menu's **Layout** submenu picks one of these ways to draw the same
subgraph, and the axes mean something different in each:

| Layout                | x                                        | y                       |
| --------------------- | ---------------------------------------- | ----------------------- |
| Anchored              | reference bp                             | one row per stable rank |
| Sample rows           | reference bp                             | one row per assembly    |
| Walk rows             | per-walk bp                              | one bar per haplotype   |
| Ordered               | reference order                          | a lane per allele       |
| Tube map              | node order                               | a tube per path         |
| Tube map on reference | reference bp                             | a tube per path         |
| **Force-directed**    | nothing (FMMM), reference order (stress) | nothing                 |

- **Force-directed (FMMM):** the layout the track opens in, and the one a graph
  opened from a file starts in. It is Bandage's layout, which draws each allele
  as a loop or a bubble and can turn the drawing between cuts
- **Force-directed (stress):** the stress engine lays the backbone out straight
  in reference order, with each allele as a loop off it, and keeps the drawing
  in place when the view moves to a new cut. A track config picks it with
  `"layoutEngine": "stress"` on its `LinearGraphDisplay`
- **Ordered:** x is monotone in reference order, ignoring bp, so a SNP allele
  gets the same room as the kilobase segment beside it, and a bubble draws as a
  lens
- **Anchored:** x stays on the view's coordinate, so the graph lines up column
  for column under the other tracks. Both routes through a locus flatten onto
  the reference axis, so an allele looks like a stub hanging under a line
- **Walk rows:** needs a graph with walks, and draws each haplotype's route as a
  bar
- **Tube map** and **Tube map on reference:** need P or W lines, and draw each
  path as a colored tube through boxed nodes

Force-directed and **Ordered** draw in coordinates fitted to the track, the way
a variant matrix does, and add **Zoom in**, **Zoom out** and **Zoom to fit** to
the track menu; moving the view still cuts the new window. A strip along the top
of such a track draws each reference segment at its bp in the view, in the color
its node has below, so under the **Reference position** scheme you can match a
hue on the strip to its node in the drawing. A triangle at either end of the
strip marks reference the graph draws past that edge of the window, and
**Reference strip at bp** in the track menu turns the strip off.

Anchored and Sample rows both need a backbone, from rGFA tags or from a
reference path, and a graph with neither greys them out. Force-directed is then
the only layout available, and it draws the Bandage picture with alternate
alleles as bubbles. The
[MHC figure](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
shows it under the lanes of the same window.

**Rank** is minigraph's `SR` tag, and it counts build order. Rank 0 is the first
assembly on the command line, rank 1 is sequence first added with the second,
and so on, so a high-rank segment is sequence none of the earlier assemblies
had. Only rank 0 has reference coordinates, so rank 0 is the only rank that a
lane on the reference can show. At a dense locus one rank holds alleles from
many haplotypes, so a rank row has no biological meaning.

**Sample rows** groups rows by the assembly each allele came from. The backbone
sits on top, and each strain's charcoal marks sit under it, tied by grey threads
to where they attach, so a row shows that strain's differences from the
reference.

<Figure caption="90 bp of the pggb graph in Sample rows, under the genes and MAF lanes for the same window." src="/img/pangenome/pggb_locus_sample_rows.png" />

The assembly an allele "came from" depends on the format. On rGFA it is the
strain that _first contributed_ the sequence, the only assembly the file lists
for the segment. A path GFA lists every path that visits a segment, so a row
shows which haplotypes have it and the node popup lists the rest.

Anchored and Sample rows both draw an allele across **the reference it
replaces**. An insertion replaces no reference, so it draws as a mark where it
attaches, with its size in the tooltip.

## Bubbles, genes and walks on the drawing

The track menu adds these to every node layout:

- **Bubble halos:** **Show → Show bubble halos** draws each bubble as a halo
  along its nodes, colored by its type, with a label naming the type and each
  color in the legend. Halos start off, and come from the bubble index beside an
  rGFA where there is one; otherwise the track derives them from the drawing's
  layering, which covers a GBZ cut, a plain GFA and the inside of an opened
  bubble
- **Opening a bubble:** click a halo's label to open that bubble alone inside
  the track, with a button back. A superbubble opens level by level
- **Genes:** the session's gene track draws onto the backbone, exons as dark
  stretches along their reference nodes and each gene's name pinned under the
  backbone at its midpoint. An allele has no reference coordinates and shows no
  exon. **Show → Show genes on the backbone** turns the genes off, and **Gene
  track** in **Graph settings...** picks the track when the assembly has more
  than one

<Figure caption="LPA force-directed, its bubbles haloed and named. Clicking a halo label opens its bubble." src="/img/pangenome/hprc_lpa_kiv2.png" />

A graph with walks, such as a GBZ cut or a GFA with P or W lines, adds:

- **Node width** in **Graph settings...** draws a node thicker the more walks
  visit it, scaled by the square root of its depth against the mean, which is
  Bandage's rule. **Uniform** turns that off
- **Route chips:** while the halos are on, in a bubble with a route over a
  kilobase, every route has a chip at the far point of its loop listing the
  walks that take it and the route's length
- **Haplotypes**, in the track's key and in the track menu, highlights walks.
  One highlighted walk is shaded light to dark along itself, and several each
  take one color, their threads side by side through the nodes they share, so a
  loop in one color is sequence only that haplotype passes through. Everything
  else fades, on the reference strip too, so the stretches of reference a walk
  skips read at their bp. The key names each walk, and for a walk highlighted
  alone gives the stretch of its contig it covers and its length
- **Haplotypes → A panel per haplotype** <!-- menu-path-ok --> draws the layout
  once for each highlighted walk, and **Haplotypes → Color highlighted...**
  <!-- menu-path-ok --> sets what each thread's color follows: progress along
  the walk, one color, reference position, or each pass through repeated nodes

For three haplotypes' threads at one locus, see
[Following haplotypes through C4](/docs/tutorials/pangenome_hprc#haplotype-threads).

A gbz-base track draws one lane per haplotype, and **Display types → Graph** in
its track menu draws the same track as a graph of the haplotypes' walks:

- **Haplotypes** in **Graph settings...** lists the haplotypes the cut holds
  beside the reference; with the field empty the track cuts every haplotype in
  the graph
- **Limit:** past 5 Mb, or for a cut over the adapter's `nodeLimit`, the track
  asks you to zoom in. A variant track over the graph's VCF covers a wider
  window

For a repeat array read this way, see
[Repeat lengths across HPRC haplotypes](/docs/tutorials/pangenome_hprc_repeats#one-haplotypes-copies).

## Bubble spread and graph context {#two-settings-that-decide-what-is-drawn}

**Bubble spread** in the track menu's **Graph settings...** sets how a node's bp
becomes its drawn length in the force layout; the anchored layouts place a node
from its coordinates and ignore it. Bandage's engine maps length linearly with a
tiny floor, so a pangenome allele of a few bases clamps to a stub. The settings:

- **Proportional:** the unmodified Bandage map. Keep it when a figure is about
  relative length
- **Open bubbles** and **Wide bubbles:** raise the floor, so every allele gets a
  drawn length while everything above the floor stays proportional. Pick one
  when a long node has to stay long, such as when a path ribbon runs along it.
  The floor also lengthens a graph's non-branching chain nodes, so the drawing
  grows with node count
- **Compress lengths:** pulls both ends towards the graph's mean with Bandage's
  power law, so a cut spanning kilobases and single bases fits one drawing at
  any node count. A long node no longer looks long

**Graph context**, in the same **Graph settings...**, sets how far the cut
follows links past the region, and defaults to **1 hop**. It is the in-app
counterpart of `odgi extract -c N`. An allele's interior segments are indexed
under the sequence of their haplotype, so a reference query never reaches them,
and a detour that leaves the backbone before the window and rejoins after it
draws as two stubs. A hop closes those stubs, at the cost of one query per
off-reference segment already reached. **None** shows what the region query
alone reaches; **2 hops** handles a graph with alleles nested inside alleles.

The two halves of the figure below share the genes and segments lanes and color
each node the same way. A hop is one step and expands only over off-reference
segments, so the right half still ends in a loose end and does not pull in the
backbone on either side of the window.

<Figure caption="The same graph cut at Graph context None (left) and 1 hop (right). The red ring marks the nodes the extra queries fetched." src="/img/pangenome/graph_context.png" links="None=pangenome/graph_context_none,1 hop=pangenome/graph_context_hop1" />

An index in the anchored layout, which
[`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix) writes by default and the
HPRC track reads, gives an exact cut. It files each allele under the reference
interval its bubble attaches to, so one query returns every bubble under the
region whole, and **Graph context** changes nothing there. The E. coli index in
the figure above is in the older layout, where each segment is filed under its
coordinate.

## Color schemes and matching a linear track {#colors-that-mean-the-same-thing-in-both-panels}

The track menu's **Color** submenu opens on **Auto**, which is Reference
position on any graph with reference coordinates and Uniform on one with none.
Three of its schemes:

- **Reference position** ramps hue over the window the subgraph was cut from,
  red at its start to magenta at its end, with a key in the top right naming the
  interval. A segment off the backbone draws flat charcoal, outside the ramp, so
  a hue always marks a position on the reference. It is the one scheme a linear
  track can reproduce exactly
- **Stable rank** is the rank ladder above: rank 0 blue, then a ramp for the
  rest
- **Depth** is how many paths walk each segment, which is core-versus-accessory
  at the segment level

A segments lane shares the graph's hues when its track's `encoding.color` holds
the matching expression as its `value`. The `encoding.color` for Reference
position, over the 50 kb window from 4,050,000 that the figures above are cut
from, is:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph",
    "format": 2,
    "coarse": {
      "uri": "ecoli_minigraph.fold10000",
      "format": 2,
      "foldBelowBp": 10000
    }
  },
  "displayDefaults": {
    "encoding": {
      "color": {
        "value": "jexl:feature.rank>0 ? 'rgb(60,65,72)' : `hsl(${min(300, max(0, ((feature.start+feature.end)/2 - 4050000) / 50000 * 300))},70%,50%)`"
      }
    }
  },
  "displays": [
    {
      "type": "LinearGraphDisplay",
      "displayId": "ecoli_minigraph_segments-LinearGraphDisplay"
    },
    {
      "type": "LinearBasicDisplay",
      "displayId": "ecoli_minigraph_segments-LinearBasicDisplay"
    }
  ]
}
```

The `rank` branch matches the graph's charcoal for off-reference segments. It
applies only on a lane opened on a contributing assembly, where rank>0 segments
have coordinates.

Stable rank needs no window, so it is the only scheme a hosted config can use.
For the same track, set this `encoding.color.value`:

```jexl
jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'
```

## Hover sync between the graph and the lanes {#hovering-one-panel-highlights-the-other}

Hover a node, and the lanes above it highlight the reference interval the node
occupies; above a force-directed or ordered drawing, the reference strip boxes
the same interval and draws a line to the node. Hovering a bubble's label does
the same for the bubble's span. Hovering is the only way to locate a rank>0
allele, because those alleles have no reference coordinates.

**Show → Hover highlight → Everything** turns on the reverse direction, a lane's
pointer lighting the segment under it, along with edge hover. It is off by
default, and once on it works from any track.

The alignment lane below shows CFT073's 65 kb insertion from the other side.
CFT073 has no aligned bases across the band, and neither do IAI39 or Sakai,
while NCTC86 aligns straight through it. The lane has a column for each K12
base, so it cannot draw 65 kb that exists only in CFT073; the ringed node in the
graph track is that 65 kb.

<Figure caption="Hovering an allele in the graph highlights its reference interval across every lane above." src="/img/pangenome/rgfa_hover_sync.png" />

A whole-genome alignment made without the graph shows the same insertion as
independent evidence:

<Figure caption="The same insertion as an alignment, K12 above and CFT073 below." src="/img/pangenome/rgfa_insertion_synteny.png" />

The [all-vs-all tutorial](/docs/tutorials/allvsall_synteny) puts the same kind
of alignment beside a graph track.

A hover highlight disappears when the pointer moves, whereas **Right-click a
node → Highlight in &lt;assembly&gt;** <!-- menu-path-ok --> writes the same
interval into the linear view's highlight list, where it stays. The label shows
the assembly the item will mark, so it reads **Highlight in hg38** on an HPRC
session.

## From a node back to a genome

Every segment has tags that give the sequence it came from and its offset in
that sequence. A node's right-click menu offers **Open in**:

- **The reference**, around the node, which moves the view the graph is drawn in
- **The strain that contributed the node**, when that assembly is loaded, which
  opens a linear view of the strain framed on the segment in its coordinates,
  with the session's annotation for it. A CFT073 allele opens CFT073 at the
  offset in its tags

A graph opened as a separate view has a **Launch** menu in its view menu that
does the same for the whole window: one linear view per contributing strain, and
a synteny view of all of them, one panel per strain, which needs a synteny track
in the session that aligns the strains. An alignment in a
[synteny track](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at)
offers the same jump from its right-click menu, **Open \<strain\> at the
matching region**.

On HPRC's graph the contributors are its 464 haplotypes, and the config the HPRC
page on genomes.jbrowse.org opens declares every one as an assembly under its
PanSN name, so a node there offers the haplotype that contributed it.
[Browsing the HPRC graph](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
opens one this way.

<Figure caption="Top: the graph view's Launch menu, each strain's entry naming its locus. Bottom: the synteny view the entry opens, one panel per strain." src="/img/pangenome/rgfa_launch_out_menu.png" />

The per-strain entries show each strain's sequence at the locus. K12's
`asnW`/`asnU`/`asnV` tRNA genes are integration sites for E. coli pathogenicity
islands, and in that window the graph gives CFT073 tens of kilobases that the
reference lacks. Clicking CFT073's entry opens that sequence on CFT073's
coordinates, from the segments' `SN`/`SO` tags, where CFT073's gene track names
it: `clbA` to `clbS`, the colibactin island.

In the figure below, the graph on the left opens a linear view of a strain, and
on the right a linear view draws the graph, around segment `s1277` of the
[Route 1](#route-1-a-graph-track-browsable-by-locus) track. The halves use
different colorings: stable rank shows _whose_ sequence an arm is, and the
reference-position ramp shows _where_ each segment sits.

<Figure caption="Left: the graph's CFT073 entry boxed, above the view it opens. Right: the segments lane's Display types → Graph, above the graph the lane turns into." src="/img/pangenome/rgfa_launch_roundtrip.png" links="Graph → linear=pangenome/rgfa_strain_launch,Linear → graph=pangenome/rgfa_segment_neighbourhood" />

## See also

- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_cactus)
- [Configuring plugins](/docs/config_guides/plugins)
