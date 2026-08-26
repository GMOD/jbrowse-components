---
title: Graph genome view
guide_category: Views
description:
  Draw a pangenome graph as a graph, from an rGFA or a plain GFA, at any locus,
  beside a linear view of the same window
---

**TL;DR:** The graph genome view draws a pangenome graph **as a graph**, beside
a linear view of the same window, and moves between the two. The reference's own
path through the graph is its **backbone**; every segment off that path is an
alternate allele another assembly carries. Most other pangenome tracks are
**projections**: the graph flattened onto one reference's coordinates as
synteny, variants, alignment, or depth.

**Prerequisites:** the plugin (below), a graph in rGFA or GFA, and the
contributing assemblies if you want to launch out into them.

<Figure caption="50 kb of K12 launched as a graph. Both panels read the same two tabix indexes and run the same reference-position ramp, so a block above and its node below share a hue. The charcoal nodes are the alternate alleles, which have no K12 coordinates and so nothing in the linear track either." src="/img/pangenome/rgfa_subgraph_launch.png" />

:::info Requires the graph genome view plugin

The **Graph genome view** is a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web, because its force-directed layout uses the
GPL-licensed [Bandage](https://github.com/rrwick/Bandage) engine (its
[OGDF](https://ogdf.github.io/) FMMM layout). It is in **beta** and not in the
[plugin store](/docs/user_guides/plugin_store) yet; it is a native ES module and
loads from any config (see [configuring plugins](/docs/config_guides/plugins)):

<!-- GRAPH_PLUGIN_CONFIG START -->

```json
{
  "plugins": [
    {
      "name": "GraphGenomeView",
      "esmUrl": "https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js"
    }
  ]
}
```

<!-- GRAPH_PLUGIN_CONFIG END -->

`RgfaTabixAdapter` and `MinigraphBubbleAdapter` ship in the same plugin.

:::

## Quick start

Indexing a graph means converting it once into two tabix-indexed BED files,
`.segs.bed.gz` for the segments and `.links.bed.gz` for the links between them,
which JBrowse can then query by locus. With that pair in hand: **Add track**
with `RgfaTabixAdapter` pointing at the shared prefix → **Track menu → Launch
view → Graph genome view (this region)**.
[Route 1](#route-1-a-graph-track-browsable-by-locus) builds the pair; skip to
[Three layouts](#three-layouts) if you just need to know what the buttons do.

`RgfaTabixAdapter` is the only adapter that cuts a subgraph: the same pair
behind a `BedTabixAdapter` draws as a feature track whose menu offers no graph.
To skip indexing entirely, [Route 2](#route-2-a-gfa-file) opens a GFA as a file.

## Where a segment's coordinates come from

A graph is a set of segments and links, which is all force-directed layout
needs. Drawing it **beside a linear view** also needs each segment's position on
a reference, and that is what the formats differ on.

| Format                                                        | Where positions live                 | Opening a locus                          |
| ------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **rGFA** (minigraph, the minigraph stage of Minigraph-Cactus) | `SN`/`SO`/`SR` tags on every segment | direct, the file states them             |
| **plain GFA** (pggb, odgi, base-level Minigraph-Cactus)       | inside the P/W path lines            | walk a path first, in the app or offline |
| **assembly graph** (SPAdes, Flye, Velvet)                     | nowhere, there is no reference       | not possible                             |

The first two end up in the same place: a segment track on the reference, and a
graph that lines up under it. Everything here except the force layout reads
those coordinates, so an assembly graph gets none of it: no locus cut, neither
anchored layout, no hover sync, no launch menus.
[Bandage](https://github.com/rrwick/Bandage), whose engine draws the force
layout here, was built for those graphs. Use Bandage for one.

## Route 1: a graph track, browsable by locus

Index the graph once and it becomes an ordinary `FeatureTrack`, with the graph a
menu item away from whatever is on screen. Which script builds the index depends
on the format; everything after it is the same. Both live in the repo's
[`scripts/`](https://github.com/GMOD/jbrowse-components/tree/main/scripts)
directory and need `bgzip` and `tabix`, plus
[`gfatools`](https://github.com/lh3/gfatools) for the rGFA route or `python3`
for the plain-GFA one:

```bash
# rGFA: the tags are already coordinates, so this is a projection
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_tabix.sh
bash build_rgfa_tabix.sh ecoli_minigraph.rgfa ecoli_minigraph

# plain GFA: walk the P (or W) lines to derive the same thing
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh
gfa=$(ls pggb/*.smooth.final.gfa)
bash build_pggb_tabix.sh "$gfa" ecoli_pggb K12
```

The rGFA in these figures is a minigraph graph of five strains, built by the
[pangenome tutorials](/docs/tutorials/pangenome_ecoli). Building your own has
one thing to get right: minigraph takes its stable names from the input FASTA
headers, so feed it PanSN-named records rather than the per-strain files, whose
contig is called `chr` in all five. Otherwise every segment lands on an
ambiguous `chr` that no later command can query by strain.

The plain-GFA walk makes four choices worth knowing:

- The third argument names an **assembly**, not a path, so every contig that
  assembly contributes is reference and walks first at rank 0. A genome with
  more than one contig states its reference as one path per contig, and
  anchoring on a single one of them leaves the rest to whichever donor path
  reaches their segments first. A bare sample (`GRCh38`) is enough where the
  reference is haploid; on a diploid one, write the haplotype (`HG002#1`), or
  the script picks one and says on stderr which.
- The walk also records **who carries each segment**, as `SM:Z:` in the index,
  which is the one thing rGFA cannot state. That is what fills `carriedBy` in
  the node popup on this route.
- When a path reaches a segment twice, **the first visit wins**: a node draws as
  one tube at one x. The repeat stays visible as depth.
- A segment the reference never visits is placed on **its own carrier's
  coordinates**. That is the same asymmetry rGFA has, and why a reference query
  reaches such a segment through the links file.

Both write `<prefix>.segs.bed.gz` and `<prefix>.links.bed.gz` with their tabix
indexes, and both load through one adapter:

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph"
  }
}
```

The `uri` is the shared prefix: the adapter resolves `.segs.bed.gz`,
`.links.bed.gz` and both `.tbi` files from it. These stable names are PanSN
(`K12#1#chr`) and their sample prefix is already the assembly name, so no
`assemblyNameToPanSN` mapping is needed. The
[HPRC tutorial](/docs/tutorials/pangenome_hprc#load-the-graph) needs one,
because that graph calls the reference `GRCh38` while the assembly is `hg38`.

Then **Track menu → Launch → Graph genome view (this region)** cuts a subgraph
from the index. The item is offered only for a track whose adapter can cut one,
and past the size the view will draw it greys out and names its own limit.

How wide a window that is depends on the graph. A minigraph graph records
structural variation and collapses everything smaller, so a legible window is
hundreds of kb; a pggb graph puts a node at every SNP, and a legible window is
hundreds of bp.

Right-clicking one segment cuts the graph around that segment, padded by half
its length on each side so it opens with context. Dragging across the ruler and
picking **Graph genome view (this selection)** does the same for a window you
choose, with no track menu involved.

Each line in the launched graph is one graph link, drawn when both of its
endpoints are inside the cut, so an allele near the window's edge draws only the
link that stays inside it.

## Route 2: a GFA file

With no index, **Add → Graph genome view** takes a GFA by file or URL and draws
the whole thing. That suits a window someone cut for you, and a graph too large
to index:

```bash
odgi extract -i graph.og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O | odgi view -i - -g > window.gfa
# vg equivalent, for a Minigraph-Cactus graph
vg chunk -x graph.xg -p K12#1#chr:1004500-1004900 -c 20 > window.vg
```

A plain GFA states no reference, so pick which path to anchor on under **View
menu → Settings → Reference path**. `odgi extract` writes the window into the
path name (`K12#1#chr:1004500-1004961`), which is where the offsets come from; a
whole-genome path simply starts at zero.

Anchoring on paths is also what answers which samples go through a node. The `P`
and `W` lines state every traversal, so **Node details** lists them under
`carriedBy`. A true rGFA has no traversals to read: `carriedBy` is empty there
and the panel reports `contributingAssembly`, the one assembly `SN` credits the
segment to.

Route 1 gets the same answer without the file, as long as the index came from a
plain GFA: `build_pggb_tabix.sh` does the traversal walk offline and writes each
segment's carriers into the index as `SM:Z:`. So the split is by format: only a
minigraph rGFA is without it.

**Sample rows** draws a row per contributing assembly: a node is drawn once, on
the row of the first path that reaches it, and the other carriers stay in
`carriedBy`. Reading across a row says what one assembly does to the reference,
and a segment several haplotypes share appears on one of their rows only.

## On JBrowse Desktop

[JBrowse Desktop](/docs/quickstart_desktop) runs Route 2 with no server, config
or index. Install the plugin once from the start screen menu, at **Global
plugins... → Add custom plugin**. Expand **Advanced options** and put the
`esmUrl` from the top of this page in **ESM build URL**, leaving the two fields
above it empty: they are the UMD pair, and filling either one wins. Then **Add →
Graph genome view** offers **Choose file**.

Desktop only starts a session by opening a genome, so you have to pick one
before there is an **Add** menu at all. It can be any genome: a GFA opened this
way is laid out from its own P/W lines.

## Three layouts

The **Layout** dropdown draws the same subgraph three ways, differing in what
the axes mean:

| Layout                    | x              | y                       |
| ------------------------- | -------------- | ----------------------- |
| Anchored                  | reference bp   | one row per stable rank |
| Sample rows               | reference bp   | one row per assembly    |
| **Force-directed layout** | nothing (FMMM) | nothing                 |

Force-directed is the default: an anchored drawing flattens both routes through
a locus onto the reference axis, so an allele reads as a stub hanging under a
line.

Both reference-anchored modes need a backbone, from rGFA tags or from a
reference path, and a graph with neither leaves them greyed out. There
force-directed is the only picture available: the classic Bandage one, where
alternate alleles fall out as bubbles (the
[MHC figure](/docs/tutorials/pangenome_hprc#open-a-locus-as-a-graph) shows it
beside a linear view).

**Rank** is minigraph's `SR` tag and it counts build order: 0 is the first
assembly on the command line, 1 is sequence first added with the second, and so
on. A high-rank segment is sequence none of the earlier assemblies had, and only
rank 0 has reference coordinates, which is why it is the only rank a linear view
of the reference can show.

Rank is a property of how the graph was built: at a dense locus one rank holds
alleles from many haplotypes, so a rank row means nothing biological. **Sample
rows** rows by the assembly each allele came from, so reading across a row says
what that strain does to the reference, with the backbone on top and each
strain's charcoal marks under it, tied by grey threads to where they attach.

<Figure caption="460 bp of the pggb graph drawn twice, under the genes, MAF and segments lanes for the same window. Left, Sample rows. Right, the same nodes force-directed, where the locus reads as a shape rather than as rows." src="/img/pangenome/pggb_locus_sample_rows.png" links="Sample rows=pangenome/pggb_locus_sample_rows_rows,Force-directed=pangenome/pggb_locus_sample_rows_force" />

What "came from" means depends on the format. On rGFA it is the strain that
_first contributed_ the sequence, because `SR` is build order and nothing in the
file records who else carries it. On a path GFA every path that visits a segment
is stated outright, so a row is carriage and the node popup lists the rest.

Both anchored layouts draw an allele across **the reference it replaces**: an
insertion consumes no reference, so it draws as a mark where it attaches, with
its size in the tooltip.

## Bubble spread and graph context {#two-settings-that-decide-what-is-drawn}

**View menu → Settings → Bubble spread** decides how a node's bp becomes its
drawn length in the force layout (the anchored layouts place a node from its
coordinates, so it does nothing there). The engine comes from Bandage, whose
graphs are assembled contigs of kb to Mb, so it maps length linearly with a tiny
floor and a pangenome allele of a few bases clamps to a stub.

Two instruments fix that, and they are alternatives:

- **Open bubbles** and **Wide bubbles** raise the floor, so every allele gets a
  drawn length while everything above the floor stays proportional. Take one of
  these when a long node has to stay long, which is the case when a path ribbon
  has to run along it. The floor is per node, so it lifts a graph's
  non-branching chain nodes too and the drawing inflates with node count.
- **Compress lengths** pulls both ends towards the graph's own mean instead, so
  a cut spanning kilobases and single bases fits one pane at any node count.
  This is Bandage's own power law, moved onto the axis a pangenome needs it on.
  It costs the top end: a node that should read as long no longer does.

**Proportional** is the untouched Bandage map, and what to keep when a figure is
about relative length.

**View menu → Settings → Graph context** is how far the cut follows links past
the region, defaulting to **1 hop**. It is the in-app counterpart of
`odgi extract -c N`. An allele's interior segments are indexed under their own
haplotype's sequence, so a reference query never reaches them: a detour that
leaves the backbone before the window and rejoins after it arrives as two stubs.
A hop closes those, costing a query per off-reference segment already reached.
**None** shows what the region query alone reaches.

Both halves below share their genes and segments lane and colour each node the
same way, so a segment can be found in either. A hop is one step, so the right
half stops with a loose end of its own. It expands only over off-reference
segments, so it does not drag in the backbone either side of the window.

<Figure caption="The paa island cut from the same segments track twice, each under the linear view it was made from. Left, at Graph context None, the two boxed nodes end in mid-air. Right, at 1 hop, the red arrow marks the interior the extra queries found, closing them into a bubble." src="/img/pangenome/graph_context.png" links="None=pangenome/graph_context_none,1 hop=pangenome/graph_context_hop1" />

A **2 hops** setting handles a graph whose alleles have alleles of their own. On
this window 1 hop already closes the cut; HPRC's amylase window keeps growing
at 2. It stops at two, since hops grow a neighbourhood and an exact slice comes
from a bubble decomposition: cut one with `gfatools view -R <region> -r 1` and
open it as a [file](#route-2-a-gfa-file).

## Color schemes and matching a linear track {#colors-that-mean-the-same-thing-in-both-panels}

The **Color** dropdown opens on **Auto**, which is Reference position on any
graph carrying reference coordinates and Uniform on one carrying none. Three of
its schemes are worth knowing:

- **Reference position** ramps hue over the window the subgraph was cut from,
  red at its start to magenta at its end, with a key in the top right naming the
  interval. A segment with no reference coordinate of its own comes off the ramp
  and draws flat charcoal, so a hue always states a position on the reference.
  It is the one scheme a linear track can reproduce exactly, because it is a
  function of two numbers and a midpoint.
- **Stable rank** is the rank ladder above: rank 0 blue, then a ramp for the
  rest.
- **Depth** is how many paths walk each segment, which is core-versus-accessory
  at the segment level.

To paint a segments track in the same colors as the graph, put the matching
expression on the track. Reference position, over the 50 kb window from
4,050,000 that the figures above are cut from:

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph"
  },
  "displayDefaults": {
    "color": "jexl:feature.rank>0 ? 'rgb(60,65,72)' : `hsl(${min(300, max(0, ((feature.start+feature.end)/2 - 4050000) / 50000 * 300))},70%,50%)`"
  }
}
```

The `rank` branch is the graph's own off-ramp charcoal, and fires only on a lane
opened on a contributing assembly, where rank>0 segments have coordinates of
their own.

Stable rank needs no window, so it is the one that can live in a hosted config.
Same track, different `color`:

```
jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'
```

## Hover sync between the panels {#hovering-one-panel-highlights-the-other}

Hover a node and the reference interval it occupies is highlighted in every
linear view beside it; hover the linear view and the segment under the cursor
lights up in the graph. Nothing to configure, and it is what makes a rank>0
allele locatable at all, since those have no reference coordinates.

The reverse works from any track. A gene gives a coordinate, which is enough:
rGFA segments do not overlap on a stable sequence, so one backbone segment
covers it.

The alignment lane below says the same event from the other side: CFT073 has no
aligned bases across the band, and neither do IAI39 or Sakai, while NCTC86
aligns straight through it.

The lane is a projection onto K12's coordinates, so it has a column for every
base K12 has and none for a base it does not; 65 kb that exists only in CFT073
has nowhere in it to be drawn. The graph holds both, which is what the node in
the lower panel is.

<Figure caption="Hovering CFT073's allele in the graph highlights the reference interval it occupies in the linear view above, across every track there. The ringed node is 65.4 kb carried only by CFT073, and it attaches to K12 across a 2.1 kb band — the interval between the segments the allele leaves and rejoins." src="/img/pangenome/rgfa_hover_sync.png" />

The same event drawn as an alignment is separate evidence: the graph's claim
comes out of its own segment and link indexes, and the alignment below out of a
whole-genome alignment the graph had no part in.

<Figure caption="The same insertion as an alignment, K12 above and CFT073 below, each panel at its own scale. The flanking chains align ribbon to ribbon at both frame edges, and everything CFT073 carries between them lands on nothing." src="/img/pangenome/rgfa_insertion_synteny.png" />

The [all-vs-all tutorial](/docs/tutorials/allvsall_synteny) puts the same kind
of panel beside its own graph.

A hover lasts as long as the pointer does. **Right-click a node → Highlight in
&lt;assembly&gt;** <!-- menu-path-ok --> writes the same interval into the
linear view's own highlight list instead, where it stays. The item names the
assembly it will mark, so it reads **Highlight in hg38** on an HPRC session.

## From a node back to a genome

Every segment carries the sequence it came from and its offset there. With only
the reference loaded that gets you back to the reference; with the contributing
assemblies loaded, the graph's **Launch** menu gains two ways out:

- **one linear view per contributing strain**, framed on that strain's own
  coordinates for this locus. Right-clicking a single allele does it for that
  segment alone: a CFT073 allele opens CFT073 at the offset its own tags state.
- **a synteny view of all of them**, one panel per strain, each already at its
  own locus. Those panel coordinates come from the graph, and the alignment
  track draws the ribbons between panels.

Only loaded assemblies are offered, and a location goes into the linear view
already beside the graph. A launched view carries the session's annotation for
the assembly it opens on, so a strain arrives with its own genes. An alignment
in a
[synteny track](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at)
offers the same jump from its right-click menu, **Open \<strain\> at the
matching region**, so a strain reads the same way out of either view.

<Figure caption="Top: the graph's Launch menu over a 50 kb K12 window. Each strain's entry names the locus it contributes on its own coordinates. Bottom: the synteny entry clicked, which opens one panel per strain already framed on that locus." src="/img/pangenome/rgfa_launch_out_menu.png" />

Taking the other entry answers a different question. K12's `asnW`/`asnU`/`asnV`
tRNA genes are the sites E. coli pathogenicity islands integrate at, and in that
window the graph gives CFT073 tens of kilobases the reference does not have.
Clicking that strain's entry opens the sequence on CFT073's own coordinates,
where its gene track names it: `clbA` to `clbS`, the colibactin island. The
launched coordinates come from the segments' own `SN`/`SO` tags.

The two halves of the figure are the same journey in opposite directions: left,
a graph launching a linear view; right, a linear view launching a graph, the
right-click on segment `s1277` from
[Route 1](#route-1-a-graph-track-browsable-by-locus) above. Their colorings
differ because the questions do: stable rank says _whose_ sequence an arm is,
while the reference-position ramp says _where_ each segment sits.

<Figure caption="The round trip between the two views. Left: the graph at K12's tRNA cluster with the CFT073 entry boxed, above the view that entry launches. Right: a right-click on segment s1277 in a linear view, above the subgraph it cuts." src="/img/pangenome/rgfa_launch_roundtrip.png" links="Graph → linear=pangenome/rgfa_strain_launch,Linear → graph=pangenome/rgfa_segment_neighbourhood" />

## Which strain takes which path

**Requires the source assemblies.**

The two indexes say what the graph contains, not who carries what: rGFA's `SR`
tag is build order, not sample. minigraph can recompute the walks by aligning
each assembly back to the graph (`minigraph -cxasm --call`), emitting one line
per bubble per sample with the path that sample takes and its length.
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs that for every strain and projects the results into one tabix-indexed BED,
a row per bubble per strain:

```bash
bash build_minigraph_paths.sh ecoli_minigraph.rgfa ecoli_minigraph_paths \
  K12.pansn.fa Sakai.pansn.fa CFT073.pansn.fa NCTC86.pansn.fa IAI39.pansn.fa
```

The reference goes first, because its path through a bubble _is_ the reference
allele the others are scored against. Load the result with one row per strain:

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_paths",
  "name": "minigraph graph: per-strain path through each bubble",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_minigraph_paths.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "strain",
      "lengthField": "delta",
      "rowOrder": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
    }
  ]
}
```

- `partitionField` gives each strain its own row
- `lengthField` is the length channel: without it a large insertion and a 1 bp
  one draw the same box. Pointed at the BED's signed `delta` column, it draws
  the insertion and deletion marks the
  [alignments track](/docs/user_guides/alignments_track) uses

A row is only as continuous as the bubble decomposition under it: `--call` emits
a record per bubble and nothing between them, so over 200 kb of this graph the
bubbles cover about a tenth of the frame and a row is mostly blank. Read it as
marks at the sites that vary; the [](/docs/user_guides/maf_track) is the
per-base lane.

Each row also carries what that bubble looks like across all the strains. Those
columns are in the popup, and a jexl expression over them narrows the track to
the sites worth a look, from **Edit filters** on the track's default display
(the multi-row display has no filter of its own):

| Column    | What it is                                     | Use it for                                                                     |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `alleles` | distinct paths anyone actually takes here      | `jexl:feature.alleles>2` cuts to the multi-allelic sites                       |
| `nonRef`  | how many strains leave the reference path      | `jexl:feature.nonRef==1` finds the singletons, `==4` the sites K12 alone lacks |
| `strand`  | the orientation the strain's contig aligned in | `jexl:feature.strand==-1` selects inverted alleles                             |

Most bubbles here are biallelic, with a tail where all five strains carry
something different: an allele-frequency spectrum whose end is the hypervariable
loci. `strand` picks out inversions, all of them IAI39's on this graph, in long
contiguous runs. **Clustering → Cluster rows by similarity** reorders the rows
by which alleles each strain carries; on five strains that is a sanity check, on
a few hundred haplotypes it is the analysis.

`gfatools bubble` reports **top-level** bubbles only, and on this graph they
never overlap, so one flat lane per strain is complete. Variation nested
_inside_ a bubble is the cost: a 113 kb allele is one block. The
[variants projection](/docs/tutorials/pangenome_ecoli#pangenome-variants-projection)
carries that nested tier.

## Alleles from the rGFA alone {#when-all-you-have-is-the-graph}

Someone else's rGFA usually arrives without the assemblies it was built from,
which rules out the re-mapping above. The two indexes still state every allele
the graph holds, because each L-line row carries both of its endpoints in full:
a link between two backbone segments that leaves a coordinate _gap_ is a
deletion, and a link from the backbone into a rank>0 segment enters an allele
whose length is the segments it walks before rejoining.
[`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh)
does that walk in awk and needs nothing but the two files:

```bash
bash build_rgfa_alleles.sh ecoli_minigraph   # -> ecoli_minigraph.alleles.bed.gz
```

Each row is an allele stated against the reference it replaces, which is an
alignment, so the BED carries a `CIGAR` column (`2062M63348I`) and an
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

`AlignmentsTrack` over a BED works because the display draws whatever carries a
CIGAR, so the alleles pack into rows and each draws the same insertion marker
and deletion bar a read does, at its real size. Without the CIGAR a 63 kb allele
is a 1 bp feature with the number hidden in its label.

The size is measured; the position inside the anchor span is not. A bubble does
not state where in the span its indel sits, so the CIGAR puts it at the end by
convention: invisible over a 2 kb anchor, approximate over a 100 kb one.

`altLen`, `nested`, `discoveryRank` and the traversed `segments` are in the
popup. Two filters matter, both from **Edit filters** on the same file loaded as
a `FeatureTrack`, whose default display has one:

- `jexl:abs(feature.delta)>10000` scales this lane to HPRC's two hundred
  thousand alleles. Filter on `abs`, since `delta` is negative for a deletion.
- `jexl:feature.nested==0` before reading lengths in bulk. `nested` marks a row
  whose walk passed a branch point, so its `delta` is one route through a nested
  bubble rather than the only one.

The real limit is whose allele it is. `discoveryRank` and `firstSeenIn` name the
**first** assembly to contribute a segment, because minigraph collapses: an
allele four strains share is credited to whichever was added first. That is
build order, not carriage: a high rank does not mean the earlier assemblies
lacked the sequence. Use the per-strain route when you have the assemblies.

## See also

- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [](/docs/user_guides/alignments_track)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_cactus)
- [Configuring plugins](/docs/config_guides/plugins)
- [Gallery: pangenomes](/gallery/#pangenome)
- [PANGENOME_GRAPHS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PANGENOME_GRAPHS.md)
  — what rGFA and plain GFA can and cannot say about coordinates and carriage,
  the one-node-per-bubble level of detail, and the decisions here that look like
  bugs
