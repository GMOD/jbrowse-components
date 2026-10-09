---
title: Graph genome view
guide_category: Views
description:
  Draw a pangenome graph as a graph, from an rGFA, a plain GFA or a gbz-base
  database, as a track of the linear genome view at any locus
---

The graph genome view plugin draws a pangenome graph **as a graph**, as a track
of the linear genome view. The graph sits under the view's other tracks, on the
view's own coordinates, and moves when the view moves. The reference's path
through the graph is the **backbone**, and every segment off that path is an
alternate allele from another assembly. Most other pangenome tracks are
**projections**, which flatten the graph onto one reference's coordinates as
synteny, variants, alignment, or depth.

**Prerequisites:** the plugin (below), a graph in rGFA or GFA, and the
contributing assemblies if you want to open a node on them.

<Figure caption="50 kb of K12 with the graph as its bottom track. The segments lane and the graph share the reference-position ramp, so a block and its node share a hue: the blue boxes are one segment in both. The charcoal nodes are alternate alleles, like the ringed one CFT073 has in place of the boxed segment; with no K12 coordinates, the lane does not draw them." src="/img/pangenome/rgfa_subgraph_launch.png" />

:::info Requires the graph genome view plugin

The graph track comes from a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web, because its force-directed layout uses the
GPL-licensed [Bandage](https://github.com/rrwick/Bandage) engine (its
[OGDF](https://ogdf.github.io/) FMMM layout). The plugin is in **beta**. The
[plugin store](/docs/user_guides/plugin_store) lists it as GraphGenomeView, and
as a native ES module it also loads from any config (see
[configuring plugins](/docs/config_guides/plugins)):

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

`RgfaTabixAdapter` and `MinigraphBubbleAdapter` ship in the same plugin. The
plugin needs a JBrowse 5 build (v5.0.0-beta.9 or later). A JBrowse 4 host does
not load it, and a config naming it opens with no graph track and neither
adapter.

:::

## Quick start

To index a graph, convert it once into tabix-indexed BED files that JBrowse can
query by locus: `.segs.bed.gz` for the segments and `.links.bed.gz` for the
links between them. One command, `build_pangenome_graph.sh`, builds them and
writes a track config for them, as [](/docs/tutorials/pangenome_prepare_graph)
describes. Then **Add track** with that config, whose adapter is
`RgfaTabixAdapter`, and the track opens as the graph.
[Route 1](#route-1-a-graph-track-browsable-by-locus) builds the index. Skip to
[Seven layouts](#three-layouts) if you just need to know what the track menu's
items do.

The graph opens in the **Anchored** layout, on the view's own coordinates, so
typing in the location box, a gene search, a click on the cytoband and a
drag-zoom move it as they move every other track. When the view moves past the
stretch the graph was cut from, the track cuts the new window.

A graph track can also name a coarse tier, the same graph with one node per
bubble. Zoomed out past the handover the track names, the track cuts the tier,
so a whole chromosome draws as a graph, and zoomed back in it cuts the segments
again.

Two adapters cut a subgraph: `RgfaTabixAdapter` over the index, and
`GbzBaseSyntenyAdapter` over a gbz-base database, whose cut includes the
haplotypes' walks. The same index pair behind a `BedTabixAdapter` draws only as
a lane. To skip indexing entirely, [Route 2](#route-2-a-gfa-file) opens a GFA as
a file.

## Where a segment's coordinates come from

A graph is a set of segments and links, which is all force-directed layout
needs. Drawing it **as a track of a linear view** also needs each segment's
position on a reference, and the formats differ on where that position lives.

| Format                                                        | Where positions live                 | Opening a locus                          |
| ------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **rGFA** (minigraph, the minigraph stage of Minigraph-Cactus) | `SN`/`SO`/`SR` tags on every segment | direct, the file states them             |
| **plain GFA** (pggb, odgi, base-level Minigraph-Cactus)       | inside the P/W path lines            | walk a path first, in the app or offline |
| **assembly graph** (SPAdes, Flye, Velvet)                     | nowhere, there is no reference       | not possible                             |

rGFA and plain GFA both produce a segment track on the reference and a graph
that lines up under it. Every feature below except the force layout reads those
coordinates. An assembly graph therefore gets no locus cut, neither anchored
layout, no hover sync and no graph track.
[Bandage](https://github.com/rrwick/Bandage), whose engine draws the force
layout here, was built for assembly graphs. Use Bandage for one.

## Route 1: a graph track, browsable by locus

Once indexed, the graph loads as a `GraphTrack` that draws whatever window is on
screen as a graph.
[`build_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_pangenome_graph.sh)
builds the index, the format decides which route it takes, and every step after
that is the same. It needs
[`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix), `bgzip`, `tabix` and
`python3`, plus [`gfatools`](https://github.com/lh3/gfatools) for an rGFA's
bubbles:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pangenome_graph.sh

# rGFA: the tags are already coordinates, so this is a projection
bash build_pangenome_graph.sh ecoli_minigraph.rgfa ecoli_minigraph

# plain GFA: walk the P (or W) lines to derive the same thing, with K12 as the
# backbone, and take the bubbles from the snarl VCF that pggb -V wrote
gfa=$(ls pggb/*.smooth.final.gfa)
vcf=$(ls pggb/*.smooth.final.K12.vcf)
bash build_pangenome_graph.sh "$gfa" ecoli_pggb --reference K12 --snarls "$vcf"
```

The rGFA in these figures is a minigraph graph of five strains, built by the
[pangenome tutorials](/docs/tutorials/pangenome_ecoli). To build your own,
minigraph needs PanSN-named records. It takes its stable names from the input
FASTA headers, and the per-strain files call their contig `chr` in all five. Fed
those files, minigraph puts every segment on an ambiguous `chr` that no later
command can query by strain.

The plain-GFA walk makes four choices:

- `--reference` names an **assembly**, not a path. Every contig that assembly
  contributes is reference, and the script walks those contigs first, at rank 0.
  A genome with more than one contig has one reference path per contig.
  Anchoring on only one of those paths would leave the other contigs' segments
  to whichever donor path reaches them first. A bare sample (`GRCh38`) is enough
  where the reference is haploid. For a diploid reference, write the haplotype
  (`HG002#1`), or the script picks one and names it on stderr.
- The walk also records **which haplotypes visit each segment**, as `SM:Z:` in
  the index. rGFA has no field for them. On this route that value fills
  `samples` in the node popup.
- When a path reaches a segment twice, **the first visit wins**, and the node
  draws as one tube at one x. The repeat stays visible as depth.
- A segment the reference never visits is placed on **the coordinates of the
  assembly it comes from**. rGFA places such segments the same way, which is why
  a reference query reaches them through the links file.

Both routes write `<prefix>.segs.bed.gz` and `<prefix>.links.bed.gz` with their
tabix indexes, and a second such pair for the bubble tier, one node per bubble.
One adapter reads all four, and `<prefix>.config.json` holds the track:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph",
    "coarse": { "uri": "ecoli_minigraph.tier10000", "aboveBpPerPx": 307 }
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

The `uri` is the shared prefix, from which the adapter resolves `.segs.bed.gz`,
`.links.bed.gz` and both `.tbi` files. `coarse` names the tier by a prefix of
its own, and `aboveBpPerPx` is the handover, the linear view's zoom in bp per
pixel past which the graph track cuts the tier. The script derives it from the
graph's mean backbone segment. These stable names are PanSN (`K12#1#chr`), and
their sample prefix is already the assembly name, so the track needs no
`assemblyNameToPanSN` mapping.
[HPRC's graph track](/docs/tutorials/pangenome_prepare_graph#the-two-indexes-a-graph-track-reads)
needs one, because that graph calls the reference `GRCh38` while the assembly is
`hg38`.

The config lists the graph display first, so the track opens as the graph, and
**Track menu → Display types → Feature display** draws the same segments as a
lane instead, one block each. As the graph, the track cuts the window on screen
out of the index with a window-width of margin on each side, and cuts again
whenever the view leaves that stretch. A cut of segments spans at most 5 Mb;
past that the track keeps its last cut and says so. The track cuts on the
graph's reference, which is the first assembly the track names.

The legible window width depends on the graph. A minigraph graph records
structural variation and collapses everything smaller, so a legible window is
hundreds of kb. A pggb graph puts a node at every SNP, so a legible window is
hundreds of bp.

A track whose adapter names `coarse` gives the graph a second tier to cut. Once
the linear view is zoomed out past `aboveBpPerPx`, the graph track cuts the
tier, one node per bubble, and the size limit no longer applies; zooming back in
cuts the segments again. The segments lane draws segments at every zoom, so load
the tier's prefix as a track of its own too, a lane that draws a whole
chromosome where the segments lane refuses.

Each line in the graph is one graph link. The track draws a link only when both
endpoints are inside the cut, so an allele near the window's edge draws only the
link that stays inside it.

## Route 2: a GFA file

With no index, **Add → Graph genome view** opens a GFA by file or URL in a view
of its own and draws all of it, with its own pan and zoom and the same layouts
the track has. The file is the whole graph, with no index to cut another window
from. Use this route for a window someone cut for you, and for a graph too large
to index:

```bash
odgi extract -i graph.og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O | odgi view -i - -g > window.gfa
# vg equivalent, for a Minigraph-Cactus graph
vg chunk -x graph.xg -p K12#1#chr:1004500-1004900 -c 20 > window.vg
```

A plain GFA states no reference, so pick the path to anchor on under **View menu
→ Settings → Reference path**. `odgi extract` writes the window into the path
name (`K12#1#chr:1004500-1004961`), and the view takes the offsets from that
name. A whole-genome path starts at zero.

The paths also show which samples go through a node. The `P` and `W` lines state
every traversal, and **Node details** lists them under `samples`. A true rGFA
has no traversals to read. There `samples` is empty, and the panel reports
`contributingAssembly`, the one assembly `SN` names for the segment.

Route 1 gives the same answer without the GFA file when the index came from a
plain GFA. On that route `build_pangenome_graph.sh` does the traversal walk
offline and writes each segment's haplotypes into the index as `SM:Z:`. Only an
index built from a minigraph rGFA lacks them.

**Sample rows** draws a row per contributing assembly. Each node is drawn once,
on the row of the first path that reaches it, and the other haplotypes stay in
`samples`. A row shows what one assembly does to the reference. A segment that
several haplotypes share appears on only one of their rows.

## On JBrowse Desktop

[JBrowse Desktop](/docs/quickstart_desktop) runs Route 2 with no server, config
or index. Install the plugin once from the start screen menu, at **Global
plugins... → Add custom plugin**. Expand **Advanced options** and put the
`esmUrl` from the top of this page in **ESM build URL**. Leave the two fields
above it empty: they are the UMD pair, and a value in either one takes
precedence. Then **Add → Graph genome view** offers **Choose file**.

Desktop starts a session only by opening a genome, so pick a genome before
looking for the **Add** menu. Any genome works, because the view lays out a GFA
opened this way from the GFA's P/W lines.

## Seven layouts {#three-layouts}

The track menu's **Layout** submenu draws the same subgraph seven ways, and the
axes mean something different in each:

| Layout                    | x                  | y                       |
| ------------------------- | ------------------ | ----------------------- |
| Anchored                  | reference bp       | one row per stable rank |
| Sample rows               | reference bp       | one row per assembly    |
| Walk rows                 | each walk's own bp | one bar per haplotype   |
| Ordered                   | reference order    | a lane per allele       |
| Tube map                  | node order         | a tube per path         |
| Tube map on reference     | reference bp       | a tube per path         |
| **Force-directed layout** | nothing (FMMM)     | nothing                 |

**Ordered** keeps x monotone in reference order, ignoring bp. A SNP allele gets
the same room as the kilobase segment beside it, and a bubble draws as a lens.
**Walk rows** needs a graph with walks, and draws each haplotype's route as a
bar. **Tube map** and **Tube map on reference** need P or W lines, and draw each
path as a colored tube through boxed nodes.

The track opens in **Anchored**, whose x is the view's own coordinate, so the
graph lines up under the other tracks and pans and zooms with them. **Ordered**
and **Force-directed layout** give x another meaning, so the track draws them in
coordinates of their own, fitted to it, the way a variant matrix does, and adds
**Zoom in**, **Zoom out** and **Zoom to fit** to its menu; moving the view still
cuts the new window. A strip along the top of such a track draws each reference
segment at its bp in the view, in the color its node has below, so under the
**Reference position** scheme a hue on the strip finds its node in the drawing.
A triangle at either end of the strip marks reference the graph draws past that
edge of the window, and **Reference strip at bp** in the track menu turns the
strip off. Force-directed is the picture of a locus for when the shape matters.
An anchored drawing flattens both routes through a locus onto the reference
axis, and an allele then looks like a stub hanging under a line. A graph opened
from a file starts in the force layout.

Anchored and Sample rows both need a backbone, from rGFA tags or from a
reference path. A graph with neither greys them out. Force-directed is then the
only layout available, and it draws the classic Bandage picture with alternate
alleles as bubbles. The
[MHC figure](/docs/tutorials/pangenome_hprc#the-stretch-of-grch38-an-allele-replaces)
shows it under the lanes of the same window.

**Rank** is minigraph's `SR` tag, and it counts build order. Rank 0 is the first
assembly on the command line, rank 1 is sequence first added with the second,
and so on. A high-rank segment is sequence none of the earlier assemblies had.
Only rank 0 has reference coordinates, so rank 0 is the only rank that a lane on
the reference can show.

Rank comes from how the graph was built. At a dense locus one rank holds alleles
from many haplotypes, so a rank row has no biological meaning. **Sample rows**
groups rows by the assembly each allele came from. A row then shows what that
strain does to the reference: the backbone sits on top, and each strain's
charcoal marks sit under it, tied by grey threads to where they attach.

<Figure caption="460 bp of the pggb graph in Sample rows, under the genes and MAF lanes for the same window. CFT073's row is one long bar over the K12 span its segment bypasses, where the other strains' rows hold only short alleles." src="/img/pangenome/pggb_locus_sample_rows.png" />

The assembly an allele "came from" depends on the format. On rGFA it is the
strain that _first contributed_ the sequence, because `SR` is build order and
the file records no other assemblies. A path GFA states every path that visits a
segment, so a row shows which haplotypes have it and the node popup lists the
rest.

Anchored and Sample rows both draw an allele across **the reference it
replaces**. An insertion replaces no reference, so it draws as a mark where it
attaches, with its size in the tooltip.

## Bubbles, genes and walks on the drawing

**Show... → Show bubble halos** in the track menu draws the graph's bubbles on
every node layout. Each bubble is a halo along the bubble's nodes, colored by
its type, with a label naming the type, and the legend names each color. The
option starts off, because on a base-level cut every SNP's halo is a blob. The
bubbles come from the bubble index beside an rGFA where there is one. Otherwise
the graph derives them from the drawing's layering, which covers a GBZ cut, a
plain GFA and the inside of an opened bubble. Click a label to open that bubble
alone inside the track, with a button back. An opened bubble derives the bubbles
inside it, so a superbubble opens level by level.

<Figure caption="The LPA window force-directed with its bubbles haloed and named, LPA pinned under the backbone with its exons along the reference nodes, and clicking a halo label opens its bubble." src="/img/pangenome/hprc_lpa_kiv2.png" />

The graph draws the session's gene track onto the backbone. Exons are dark
stretches along their reference nodes, and each gene's name is pinned under the
backbone at the gene's midpoint. An allele has no reference coordinates and
shows no exon. **Show... → Show genes on the backbone** in the track menu turns
the genes off, and **Gene track** in its **Settings** picks the track when the
assembly has more than one.

A graph with walks, such as a GBZ cut or a GFA with P or W lines, supports three
more displays. **Node width** in the track menu's **Settings** draws a node
thicker the more walks visit it, scaled by the square root of its depth against
the mean, which is Bandage's rule. **Uniform** turns that off. In a bubble with
a route over a kilobase, every route has a chip at the far point of its loop
while the halos are on. The chip names the walks that take the route and gives
the route's length. The track menu's **Haplotypes** submenu highlights one walk.
Its nodes keep their color, its links draw dark, and everything else fades, on
the reference strip too, so the stretches of reference the walk skips read at
their bp. A readout beside the legend compares the walk's length with the
reference walk's.

A gbz-base track draws one lane per haplotype, and **Display types → Graph** in
its track menu draws the same track as a graph of the haplotypes' walks. The
**Haplotypes** field in **Settings** lists the haplotypes the cut holds beside
the reference, and with the field empty the track cuts every haplotype in the
graph. Past 5 Mb, or for a cut over the adapter's `nodeLimit`, the track asks
you to zoom in. A variant track over the graph's VCF covers a wider window.
[Repeat lengths across HPRC haplotypes](/docs/tutorials/pangenome_hprc_repeats#one-haplotypes-copies)
reads a repeat array this way.

## Bubble spread and graph context {#two-settings-that-decide-what-is-drawn}

**Bubble spread** in the track menu's **Settings** sets how a node's bp becomes
its drawn length in the force layout. The anchored layouts place a node from its
coordinates, so the setting has no effect there. The engine comes from Bandage,
whose graphs are assembled contigs of kb to Mb. It maps length linearly with a
tiny floor, so a pangenome allele of a few bases clamps to a stub.

Two alternative settings fix that:

- **Open bubbles** and **Wide bubbles** raise the floor, so every allele gets a
  drawn length while everything above the floor stays proportional. Pick one of
  these when a long node has to stay long, such as when a path ribbon runs along
  it. The floor applies per node, so it also lengthens a graph's non-branching
  chain nodes, and the drawing grows with node count.
- **Compress lengths** pulls both ends towards the graph's mean, so a cut
  spanning kilobases and single bases fits one drawing at any node count. It
  uses Bandage's power law, moved onto the axis a pangenome needs it on. The
  cost is at the top end: a long node no longer looks long.

**Proportional** is the unmodified Bandage map. Keep it when a figure is about
relative length.

**Graph context**, in the same **Settings**, sets how far the cut follows links
past the region, and defaults to **1 hop**. It is the in-app counterpart of
`odgi extract -c N`. An allele's interior segments are indexed under the
sequence of their haplotype, so a reference query never reaches them. A detour
that leaves the backbone before the window and rejoins after it therefore
arrives as two stubs. A hop closes those stubs, at the cost of one query per
off-reference segment already reached. **None** shows what the region query
alone reaches.

Both halves below share the genes and segments lanes and color each node the
same way, so a segment can be found in either. A hop is one step, so the right
half still ends in a loose end. The hop expands only over off-reference
segments, so it does not pull in the backbone on either side of the window.

<Figure caption="The paa island cut from the same graph track twice, each under the lanes of its own linear view. Left, at Graph context None, each of the two boxed nodes has an unlinked end. Right, at 1 hop, the red ring marks the interior nodes the extra queries fetched, which link the two into a bubble." src="/img/pangenome/graph_context.png" links="None=pangenome/graph_context_none,1 hop=pangenome/graph_context_hop1" />

A **2 hops** setting handles a graph with alleles nested inside alleles. On this
window 1 hop already closes the cut. The setting stops at two, because hops only
grow a neighbourhood: in HPRC's graph, half of the off-reference segments sit
three or more links from the backbone.

An exact cut comes from an index in the anchored layout, which
[`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix) writes by default and the
HPRC track reads. It files each allele under the reference interval its bubble
hangs from, so one query returns every bubble under the region whole, and
**Graph context** changes nothing there. The E. coli index in the figure above
is in the older layout, where each segment is filed under its own coordinate.

## Color schemes and matching a linear track {#colors-that-mean-the-same-thing-in-both-panels}

The track menu's **Color** submenu opens on **Auto**, which is Reference
position on any graph with reference coordinates and Uniform on one with none.
Three of its schemes are described here:

- **Reference position** ramps hue over the window the subgraph was cut from,
  red at its start to magenta at its end, with a key in the top right naming the
  interval. A segment with no reference coordinate draws flat charcoal, outside
  the ramp, so a hue always marks a position on the reference. A linear track
  can reproduce only this scheme exactly, because it is a function of two
  numbers and a midpoint.
- **Stable rank** is the rank ladder above: rank 0 blue, then a ramp for the
  rest.
- **Depth** is how many paths walk each segment, which is core-versus-accessory
  at the segment level.

A segments lane shares the graph's hues when its track's `color` holds the
matching expression. Reference position, over the 50 kb window from 4,050,000
that the figures above are cut from:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph",
    "coarse": { "uri": "ecoli_minigraph.tier10000", "aboveBpPerPx": 307 }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank>0 ? 'rgb(60,65,72)' : `hsl(${min(300, max(0, ((feature.start+feature.end)/2 - 4050000) / 50000 * 300))},70%,50%)`"
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
For the same track, set this `color`:

```text
jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'
```

## Hover sync between the graph and the lanes {#hovering-one-panel-highlights-the-other}

Hover a node, and the lanes above it highlight the reference interval the node
occupies; above a force-directed or ordered drawing, the reference strip boxes
the same interval and draws a line to the node. Hovering a bubble's label does
the same for the bubble's span. This needs no configuration, and it is the only
way to locate a rank>0 allele, because those alleles have no reference
coordinates.

The reverse direction, a lane's pointer lighting the segment under it, is off by
default, since every track's pointer crosses some segment. **Show... → Hover
highlight → Everything** turns it on, along with edge hover. It then works from
any track: a gene gives a coordinate, and that is enough, because rGFA segments
do not overlap on a stable sequence and one backbone segment covers the
coordinate.

The alignment lane below shows the same event from the other side. CFT073 has no
aligned bases across the band, and neither do IAI39 or Sakai, while NCTC86
aligns straight through it.

The lane is a projection onto K12's coordinates. It has a column for every base
K12 has and none for a base K12 lacks, so it cannot draw 65 kb that exists only
in CFT073. The graph holds both, and the ringed node in the graph track is that
65 kb.

<Figure caption="Hovering CFT073's allele in the graph highlights the reference interval it occupies across every lane above it. The ringed node is 65.4 kb only CFT073 has, and it leaves and rejoins K12 at either end of the 2.1 kb band, which is the pair of teal K12 segments boxed in blue in the graph." src="/img/pangenome/rgfa_hover_sync.png" />

The same event drawn as an alignment is independent evidence. The graph's
insertion comes from the graph's segment and link indexes. The alignment below
comes from a whole-genome alignment made without the graph.

<Figure caption="The same insertion as an alignment, K12 above and CFT073 below, the two panels at different scales. The flanking chains align ribbon to ribbon at both frame edges, and the CFT073 sequence between them has no alignment to K12." src="/img/pangenome/rgfa_insertion_synteny.png" />

The [all-vs-all tutorial](/docs/tutorials/allvsall_synteny) sets the same kind
of alignment beside its own graph track.

A hover highlight disappears when the pointer moves. **Right-click a node →
Highlight in &lt;assembly&gt;** <!-- menu-path-ok --> writes the same interval
into the linear view's highlight list, where it stays. The item names the
assembly it will mark, so it reads **Highlight in hg38** on an HPRC session.

## From a node back to a genome

Every segment records the sequence it came from and its offset in that sequence.
With only the reference loaded, that takes you back to the reference: a node's
right-click menu offers **Open in** the reference around the node, which moves
the view the graph is drawn in. With the contributing assemblies loaded, the
same menu offers **Open in** the strain that contributed the node, which opens a
linear view of that strain framed on the segment's own coordinates. A CFT073
allele opens CFT073 at the offset its tags state.

The menu offers only loaded assemblies. The view it opens shows the session's
annotation for the assembly it opens on, so each strain opens with its genes. A
graph opened as a view of its own has a **Launch** menu in its view menu that
does the same for the whole window: one linear view per contributing strain, and
a synteny view of all of them, one panel per strain, which needs a synteny track
in the session that aligns the strains. An alignment in a
[synteny track](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at)
offers the same jump from its right-click menu, **Open \<strain\> at the
matching region**, so either view opens a strain the same way.

On HPRC's graph the contributors are its 464 haplotypes, and the config the HPRC
page on genomes.jbrowse.org opens declares every one as an assembly under its
PanSN name, so a node there offers the haplotype that contributed it.
[Browsing the HPRC graph](/docs/tutorials/pangenome_hprc#opening-the-haplotype-an-allele-came-from)
opens one this way.

<Figure caption="Top: the graph view's Launch menu over a 50 kb K12 window. Each strain's entry names the locus it contributes, in that strain's coordinates. Bottom: the synteny entry clicked, which opens one panel per strain already framed on that locus, here with curved ribbons, transparent indels and Follow switched on so each row tracks the K12 window above it." src="/img/pangenome/rgfa_launch_out_menu.png" />

The per-strain entries show each strain's sequence at the locus. K12's
`asnW`/`asnU`/`asnV` tRNA genes are integration sites for E. coli pathogenicity
islands, and in that window the graph gives CFT073 tens of kilobases that the
reference lacks. Clicking CFT073's entry opens that sequence on CFT073's
coordinates, where CFT073's gene track names it: `clbA` to `clbS`, the
colibactin island. The coordinates it opens on come from the segments' `SN`/`SO`
tags.

The two halves of the figure below show the same trip in opposite directions. On
the left, the graph opens a linear view of a strain. On the right, a linear view
draws the graph, around segment `s1277` of the
[Route 1](#route-1-a-graph-track-browsable-by-locus) track. The two use
different colorings for different questions: stable rank shows _whose_ sequence
an arm is, and the reference-position ramp shows _where_ each segment sits.

<Figure caption="The round trip between the two views. Left: the graph at K12's tRNA cluster with the CFT073 entry boxed, above the view that entry opens. Right: the segments lane's track menu with Display types → Graph boxed, above the force-directed graph the lane turns into." src="/img/pangenome/rgfa_launch_roundtrip.png" links="Graph → linear=pangenome/rgfa_strain_launch,Linear → graph=pangenome/rgfa_segment_neighbourhood" />

## Which strain takes which path

**Requires the source assemblies.**

The `.segs.bed.gz` and `.links.bed.gz` indexes record what the graph contains.
Which strains have each segment is not in them, because rGFA's `SR` tag is build
order, not sample. minigraph can recompute the walks by aligning each assembly
back to the graph (`minigraph -cxasm --call`). The call writes one line per
bubble per sample, with the path that sample takes and its length.
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs the call for every strain and projects the results into one tabix-indexed
BED, with a row per bubble per strain:

```bash
bash build_minigraph_paths.sh ecoli_minigraph.rgfa ecoli_minigraph_paths \
  K12.pansn.fa Sakai.pansn.fa CFT073.pansn.fa NCTC86.pansn.fa IAI39.pansn.fa
```

The reference goes first, because its path through a bubble is the reference
allele that the other strains are scored against. Load the result with one row
per strain:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_paths",
  "name": "minigraph graph: per-strain path through each bubble",
  "uri": "ecoli_minigraph_paths.bed.gz",
  "assemblyNames": ["K12"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "strain",
        "domain": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
      },
      "lengthField": "delta"
    }
  ]
}
```

- `rows` puts each strain in a separate row, `domain` in the order given
- `lengthField` sets the length channel. Without it, a large insertion and a 1
  bp one draw as the same box. Pointed at the BED's signed `delta` column, it
  draws the insertion and deletion marks the
  [alignments track](/docs/user_guides/alignments_track) uses

A row covers only the bubbles under it. `--call` emits a record per bubble and
nothing between bubbles, so over 200 kb of this graph the bubbles cover about a
tenth of the frame and a row is mostly blank. Read a row as marks at the sites
that vary. The [](/docs/user_guides/maf_track) is the per-base lane.

Each row also describes that bubble across all the strains. The popup shows
those columns. A jexl expression over them, set from **Edit filters** on the
track's default display, narrows the track to the sites you want. The multi-row
display has no filter setting.

| Column    | What it is                                     | Use it for                                                                     |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `alleles` | distinct paths anyone actually takes here      | `jexl:feature.alleles>2` cuts to the multi-allelic sites                       |
| `nonRef`  | how many strains leave the reference path      | `jexl:feature.nonRef==1` finds the singletons, `==4` the sites K12 alone lacks |
| `strand`  | the orientation the strain's contig aligned in | `jexl:feature.strand==-1` selects inverted alleles                             |

Most bubbles here are biallelic. A tail of bubbles has a different allele in all
five strains, and those are the hypervariable loci at the end of the
allele-frequency spectrum. `strand` picks out inversions, which on this graph
are all IAI39's and fall in long contiguous runs. **Clustering → Cluster rows by
similarity** reorders the rows by which alleles each strain has. On five strains
the clustering is a sanity check. On a few hundred haplotypes it is the
analysis.

`gfatools bubble` reports **top-level** bubbles only. On this graph they never
overlap, so one flat lane per strain is complete. The lane loses variation
nested _inside_ a bubble, so a 113 kb allele is one block. The
[variants projection](/docs/tutorials/pangenome_ecoli#pangenome-variants-projection)
includes that nested tier.

## Alleles from the rGFA alone {#when-all-you-have-is-the-graph}

Someone else's rGFA usually arrives without the assemblies it was built from, so
the re-mapping above is not possible. The two indexes still record every allele
in the graph, because each L-line row records both of its endpoints in full. A
link between two backbone segments that leaves a coordinate _gap_ is a deletion.
A link from the backbone into a rank>0 segment enters an allele, and the
allele's length is the total of the segments it walks before rejoining.
[`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh)
does that walk in awk and needs only the two files:

```bash
bash build_rgfa_alleles.sh ecoli_minigraph   # -> ecoli_minigraph.alleles.bed.gz
```

Each row describes an allele against the reference it replaces, which makes the
row an alignment. The BED therefore has a `CIGAR` column (`2062M63348I`), and an
[alignments track](/docs/user_guides/alignments_track) reads it directly:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "ecoli_minigraph_alleles",
  "name": "minigraph graph: allele inventory (from the rGFA alone)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_minigraph.alleles.bed.gz"
  }
}
```

An `AlignmentsTrack` works over a BED because the display draws any feature that
has a CIGAR. The alleles pack into rows, and each draws the same insertion
marker and deletion bar a read does, at its real size. Without the CIGAR, a 63
kb allele draws as a 1 bp feature with the size shown only in its label.

The allele size is measured, but the position inside the anchor span is not. A
bubble does not record where in the span its indel sits, so by convention the
CIGAR puts the indel at the end. Over a 2 kb anchor the offset is invisible, and
over a 100 kb anchor the position is approximate.

The popup shows `altLen`, `nested`, `discoveryRank` and the traversed
`segments`. Two filters are useful. Set both from **Edit filters** on the same
file loaded as a `FeatureTrack`, whose default display has that menu item:

- `jexl:abs(feature.delta)>10000` scales this lane to HPRC's two hundred
  thousand alleles. Filter on `abs`, since `delta` is negative for a deletion.
- `jexl:feature.nested==0` before reading lengths in bulk. `nested` marks a row
  whose walk passed a branch point, so its `delta` is one of several routes
  through a nested bubble.

This route cannot tell you which assemblies have an allele. `discoveryRank` and
`firstSeenIn` name the **first** assembly to contribute a segment, because
minigraph collapses shared sequence. An allele that four strains share is
credited to whichever strain was added first. Rank records build order, so a
high rank does not mean the earlier assemblies lacked the sequence. Use the
per-strain route when you have the assemblies.

## See also

- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [](/docs/user_guides/alignments_track)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_cactus)
- [Configuring plugins](/docs/config_guides/plugins)
- [PANGENOME_GRAPHS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PANGENOME_GRAPHS.md)
  — what rGFA and plain GFA can and cannot say about coordinates and which
  haplotypes have a segment, the one-node-per-bubble level of detail, and the
  decisions here that look like bugs
