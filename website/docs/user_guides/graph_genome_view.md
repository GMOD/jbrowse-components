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
**projections** instead: the graph flattened onto one reference's coordinates as
synteny, variants, alignment, or depth.

**Prerequisites:** the plugin (below), a graph in rGFA or GFA, and the
contributing assemblies if you want to launch out into them.

<Figure caption="50 kb of K12 launched as a graph. Both panels read the same two tabix indexes and run the same reference-position ramp, red at the start of the window to magenta at its end, so a block above and its node below share a hue. The alternate alleles are the charcoal ones, off the ramp: they have no K12 coordinates, which is why the linear track has nothing to show for them either." src="/img/pangenome/rgfa_subgraph_launch.png" />

:::info Requires the graph genome view plugin

The **Graph genome view** is a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web, because its force-directed layout uses the
GPL-licensed [Bandage](https://github.com/rrwick/Bandage) engine (its
[OGDF](https://ogdf.github.io/) FMMM layout). It is in **beta** and not in the
[plugin store](/docs/user_guides/plugin_store) yet, but it is a native ES module
and loads from any config today (see
[configuring plugins](/docs/config_guides/plugins)):

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

`RgfaTabixAdapter` and `MinigraphBubbleAdapter` ship in the same plugin.

:::

## Quick start

Indexing a graph means converting it once into two tabix-indexed BED files,
`.segs.bed.gz` for the segments and `.links.bed.gz` for the links between them,
which JBrowse can then query by locus. With that pair in hand: **Add track**
with `RgfaTabixAdapter` or `BedTabixAdapter` pointing at it → **Track menu →
Launch view → Graph genome view (this region)**.
[Route 1](#route-1-a-graph-track-browsable-by-locus) builds the pair; skip to
[Three layouts](#three-layouts) if you just need to know what the buttons do.

## Where a segment's coordinates come from

A graph is a set of segments and links, which is all force-directed layout
needs. Drawing it **beside a linear view** also needs each segment's position on
a reference, and that is what the formats differ on.

| Format                                                        | Where positions live                 | Opening a locus                          |
| ------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **rGFA** (minigraph, the minigraph stage of Minigraph-Cactus) | `SN`/`SO`/`SR` tags on every segment | direct, the file states them             |
| **plain GFA** (pggb, odgi, base-level Minigraph-Cactus)       | inside the P/W path lines            | walk a path first, in the app or offline |

Both end up in the same place: a segment track on the reference, and a graph
that lines up under it.

## Route 1: a graph track, browsable by locus

Index the graph once and it becomes an ordinary `FeatureTrack`, with the graph a
menu item away from whatever is on screen. Which script builds the index depends
on the format, and nothing after that does. Both live in the repo's
[`scripts/`](https://github.com/GMOD/jbrowse-components/tree/main/scripts)
directory and need `bgzip` and `tabix`, plus `gfatools` for the rGFA route or
`python3` for the plain-GFA one:

```bash
# rGFA: the tags are already coordinates, so this is a projection
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_rgfa_tabix.sh
bash build_rgfa_tabix.sh ecoli_minigraph.rgfa ecoli_minigraph

# plain GFA: walk the P (or W) lines to derive the same thing
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh
bash build_pggb_tabix.sh pggb/*.smooth.final.gfa ecoli_pggb K12
```

The plain-GFA walk makes two choices worth knowing:

- When a path reaches a segment twice, **the first visit wins**. A node draws as
  one tube at one x, so recording both would claim reference the segment does
  not occupy. The repeat stays visible as depth.
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

Then **Track menu → Launch view → Graph genome view (this region)** cuts a
subgraph from the index. The item is offered only for a track whose adapter can
cut one, and past the size the view will draw it greys out and names its own
limit rather than disappearing.

Right-clicking one segment cuts the graph around that segment instead, padded by
half its length on each side so it opens with context rather than clipped to its
own ends. Dragging across the ruler and picking **Graph genome view (this
selection)** does the same for a window you choose, with no track menu involved.

<Figure caption="Right-click on backbone segment s1277 (glnA to yihN) → Launch view → Graph genome view (this segment). The launched window is the segment plus half its length on each side, colored Rainbow so each of the sixteen segments takes its own hue, with one line per graph link." src="/img/pangenome/rgfa_segment_neighbourhood.png" />

Each line is one graph link, drawn when both of its endpoints are inside the
cut. Every allele here has two links, one leaving the backbone and one
rejoining, so s1814 and s1815 draw two lines while s1813, s1816 and the rank-2
s2272 draw one, their other neighbour falling outside the window. The leftmost
mark carries three because it is two alleles at once, s1813 and s1814, both a
few tens of bp and so too short to draw apart at this zoom.

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

Anchoring on paths is also what answers "which samples go through this node".
The `P` and `W` lines state every traversal, so each node knows its visitors and
**Node details** lists them under `carriedBy`; **Sample rows** then draws real
carriage. A track anchored on rGFA tags instead (route 1) has no traversals to
read: `carriedBy` is empty there and the panel reports `contributingAssembly`,
the one assembly `SN` credits the segment to. That is the file rather than the
view, and it is why the two routes answer different questions about the same
graph.

## Three layouts

The **Layout** dropdown draws the same subgraph three ways, differing in what
the axes mean:

| Layout             | x              | y                       |
| ------------------ | -------------- | ----------------------- |
| Anchored           | reference bp   | one row per stable rank |
| Sample rows        | reference bp   | one row per assembly    |
| **Force-directed** | nothing (FMMM) | nothing                 |

Force-directed is the default, and the one most of these figures use: an
anchored drawing flattens both routes through a locus onto the reference axis,
so an allele reads as a stub hanging under a line rather than as the other side
of a bubble. The anchored modes are one dropdown click away, and the figures
that take them are the ones about the axis itself.

Both reference-anchored modes need a backbone, from rGFA tags or from a
reference path. Only a graph with neither leaves them greyed out, and there
force-directed is the honest picture: the classic Bandage one, where alternate
alleles fall out as bubbles rather than as rows (the
[MHC figure](/docs/tutorials/pangenome_hprc#open-a-locus-as-a-graph) shows it
beside a linear view).

**Rank** is minigraph's `SR` tag and it counts build order: 0 is the first
assembly on the command line, 1 is sequence first added with the second, and so
on. So a high-rank segment is sequence none of the earlier assemblies had, and
only rank 0 has reference coordinates, which is why it is the only rank a linear
view of the reference can show, and why the figure at the top of this page has
fewer blocks above than the graph has nodes below.

Rank is a property of how the graph was built, not of any genome: at a dense
locus one rank holds alleles from many haplotypes, so a rank row means nothing
biological. **Sample rows** rows by the assembly each allele came from instead,
so reading across a row says what that strain does to the reference.

In **Sample rows** the top row is the K12 backbone, carrying each segment's
length, and every row under it is one strain whose charcoal marks are the
segments it takes instead, tied by grey threads to where they attach.

<Figure caption="460 bp of the pggb graph drawn twice, under the genes, MAF and segments lanes for the same window. Left, Sample rows. Right, the same nodes force-directed, where the locus reads as a shape rather than as rows." src="/img/pangenome/pggb_locus_sample_rows.png" links="Sample rows=pangenome/pggb_locus_sample_rows_rows,Force-directed=pangenome/pggb_locus_sample_rows_force" />

What "came from" means depends on the format, and it is the one place the two
formats say genuinely different things. On rGFA it is the strain that _first
contributed_ the sequence, because `SR` is build order and nothing in the file
records who else carries it. On a path GFA every path that visits a segment is
stated outright, so a row is carriage and the node popup lists the rest.

Both anchored layouts draw an allele across **the reference it replaces, never
its own sequence length**: an insertion consumes no reference, so it draws as a
mark where it attaches, with its size in the tooltip.

## Two settings that decide what is drawn

**View menu → Settings → Bubble spread** sets a floor on how long a node is
drawn in the force layout (the anchored layouts place a node from its
coordinates, so it does nothing there). The engine comes from Bandage, whose
graphs are assembled contigs of kb to Mb, so its own floor is tiny: a pangenome
allele of a few bases clamps to a stub, both arms of a bubble land inside one
node thickness of each other, and the window draws as a single thread. **Open
bubbles** and **Wide bubbles** give every allele a drawn length instead, at the
cost that below the floor a node no longer draws proportional to its length.

**View menu → Settings → Graph context** is how far the cut follows links past
the region, defaulting to **1 hop**. It is the in-app counterpart of
`odgi extract -c N`. An allele's interior segments are indexed under their own
haplotype's sequence, so a reference query never reaches them: a detour that
leaves the backbone before the window and rejoins after it arrives as two stubs
rather than as the one event it is. A hop closes those, costing a query per
off-reference segment already reached. **None** shows what the region query
alone reaches.

Both halves below share their genes and segments lane, and colour each node the
same way, so a segment can be found in either. The long green block is the
island; the blue and orange boxes are the two nodes where one CFT073 detour
leaves the backbone and rejoins it. A hop is one step, so the right half stops
with a loose end of its own, and the node and edge counts in the header rise to
match what it reached. It expands only over off-reference segments, so it does
not drag in the backbone either side of the window.

<Figure caption="The paa island cut from the same segments track twice, each under the linear view it was made from. Left, at Graph context None, the two boxed nodes end in mid-air: the sequence between them sits on that strain's own contig, which no K12 coordinate reaches. Right, at 1 hop, the red arrow marks the interior the extra queries found, closing them into a bubble." src="/img/pangenome/graph_context.png" links="None=pangenome/graph_context_none,1 hop=pangenome/graph_context_hop1" />

A **2 hops** setting handles a graph whose alleles have alleles of their own. On
this window 1 hop already closes the cut; HPRC's amylase window keeps growing
at 2. It stops at two because a frontier is not a bubble decomposition and never
converges on an exact slice. For an exact slice, cut one with
`gfatools view -R <region> -r 1` and open it as a [file](#route-2-a-gfa-file).

## Colors that mean the same thing in both panels

A graph panel and a linear panel show the same segments, so the useful question
is which coloring survives the trip between them. The **Color** dropdown opens on
**Auto**, which is Reference position on any graph carrying reference coordinates
and Uniform on one carrying none. Three of its schemes are worth knowing:

- **Reference position** ramps hue over the window the subgraph was cut from,
  red at its start to magenta at its end, with a key in the top right naming the
  interval. A segment with no reference coordinate of its own comes off the ramp
  and draws flat charcoal, so a hue always states a position on the reference. It
  is the one scheme a linear track can reproduce exactly, because it is a
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

## Hovering one panel highlights the other

Hover a node and the reference interval it occupies is highlighted in every
linear view beside it; hover the linear view and the segment under the cursor
lights up in the graph. Nothing to configure, and it is what makes a rank>0
allele locatable at all, since those have no reference coordinates.

The reverse works from any track, not just the graph's own segments. A gene
gives only a coordinate, and that is enough: rGFA segments do not overlap on a
stable sequence, so one backbone segment covers it.

The alignment lane below says the same event from the other side: CFT073 has no
aligned bases across the band, and neither do IAI39 or Sakai, while NCTC86
aligns straight through it.

<Figure caption="Hovering CFT073's allele in the graph (circled) highlights the reference interval it occupies in the linear view above, across every track there. That interval is the 2 kb of K12 between the backbone segments the allele leaves and rejoins, so the node is a non-reference insertion: 65.4 kb of sequence where the reference has 2.1 kb." src="/img/pangenome/rgfa_hover_sync.png" />

The same event drawn as an alignment rather than as a graph is a synteny gap,
which is what the [all-vs-all tutorial](/docs/tutorials/allvsall_synteny) puts
beside its own graph panel.

A hover lasts as long as the pointer does. **Right-click a node → Highlight in
&lt;assembly&gt;** writes the same interval into the linear view's own highlight
list instead, where it stays.

## From a node back to a genome

Every segment carries the sequence it came from and its offset there. With only
the reference loaded that gets you back to the reference; with the contributing
assemblies loaded, the graph's **Launch view** menu gains two ways out:

- **one linear view per contributing strain**, framed on that strain's own
  coordinates for this locus. Right-clicking a single allele does it for that
  segment alone: a CFT073 allele opens CFT073 at the offset its own tags state,
  not a projection onto K12.
- **a synteny view of all of them**, one panel per strain, each already at its
  own locus. Those panel coordinates come from the graph, so nothing is looked
  up in a PAF first; the alignment track only draws the ribbons between panels.

Only loaded assemblies are offered, so the menu never lists a view that cannot
open, and a location goes into the linear view already beside the graph rather
than stacking a pane. A launched view carries the session's annotation for the
assembly it opens on, so a strain arrives with its own genes rather than empty.

<Figure caption="Top: the graph's Launch view menu over a 50 kb K12 window, opened from the view menu boxed in red. Each strain's entry names the locus it contributes on its own coordinates. Bottom: the synteny entry clicked, which opens one panel per strain already framed on that locus, against the graph's own all-vs-all track." src="/img/pangenome/rgfa_launch_out_menu.png" />

Taking the other entry answers a different question. K12's `asnW`/`asnU`/`asnV`
tRNA genes are the sites E. coli pathogenicity islands integrate at, and in that
window the graph gives CFT073 tens of kilobases the reference does not have.
Clicking that strain's entry opens the sequence on CFT073's own coordinates,
where its gene track names it: `clbA` to `clbS`, the colibactin island.

The colors below are **Stable rank**, so the labeled orange arm is the segment
only CFT073 carries and the blue is backbone it shares with K12; between them
they are the window the menu row names. No alignment is consulted, the launched
coordinates come from the segments' own `SN`/`SO` tags.

<Figure caption="Top: the graph at K12's asnW/asnU/asnV tRNA cluster, with the strain list open and the CFT073 entry boxed. Bottom: the view that entry launches, the same sequence on CFT073's own coordinates, holding the clb genotoxin operon." src="/img/pangenome/rgfa_strain_launch.png" />

## Building the rGFA these figures use

**Skip this if your graph is already indexed.**

The figures above use a minigraph graph of five strains, built by the
[pangenome tutorials](/docs/tutorials/pangenome_ecoli). One thing to get right:
minigraph takes its stable names from the input FASTA headers, so feed it
PanSN-named records rather than the per-strain files, whose contig is called
`chr` in all five. Otherwise every segment lands on an ambiguous `chr` that no
later command can query by strain.

A minigraph graph is far less fragmented than a pggb one, recording structural
variation rather than every SNP, so a legible window is hundreds of kb rather
than hundreds of bp.

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

`partitionField` gives each strain its own row. `lengthField` is the length
channel: without it a large insertion and a 1 bp one draw the same box. Pointed
at the BED's signed `delta` column, it draws the insertion and deletion marks
the [alignments track](/docs/user_guides/alignments_track) uses.

A row is only as continuous as the bubble decomposition under it: `--call` emits
a record per bubble and nothing between them, so over 200 kb of this graph the
bubbles cover about a tenth of the frame and a row is mostly blank. Read it as
marks at the sites that vary, not as a per-base lane like the
[](/docs/user_guides/maf_track).

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
never overlap, which is what makes one flat lane per strain complete rather than
lossy. Variation nested _inside_ a bubble is the cost: a 113 kb allele is one
block, not the SNPs and small indels within it. The
[variants projection](/docs/tutorials/pangenome_ecoli#pangenome-variants-projection)
carries that nested tier instead.

## When all you have is the graph

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

`AlignmentsTrack` over a BED is deliberate: the display draws whatever carries a
CIGAR, so the alleles pack into rows and each draws the same insertion marker
and deletion bar a read does, at its real size. Without the CIGAR a 63 kb allele
is a 1 bp feature with the number hidden in its label.

The size is measured; the position inside the anchor span is not. A bubble does
not state where in the span its indel sits, so the CIGAR puts it at the end by
convention: invisible over a 2 kb anchor, placed rather than located over a 100
kb one.

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
build order, not carriage, and a high rank does not mean the earlier assemblies
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
