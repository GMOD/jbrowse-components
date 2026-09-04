---
title: Linear synteny view
description: Side-by-side alignment of two genomes
guide_category: Views
---

**TL;DR:** The linear synteny view stacks two genomes, one above the other, and
draws their alignments as ribbons connecting matching regions. Each panel
behaves like a linear genome view, so you can scroll, zoom, and add tracks to
either side independently while the ribbons follow.

Forward-strand alignments are drawn in one color and inverted alignments in
another, so a ribbon that twists or crosses marks an inversion or rearrangement.

## Query, target, and CIGAR

Every alignment format names the two genomes the same way, as the **query** and
the **target**. The query is the top row here and the horizontal axis of a
[dotplot](/docs/user_guides/dotplot_view); the target is the bottom row and the
vertical axis. Which genome plays which role comes from the track, and **Swap**
in the import form reverses it.

How the two line up base by base is recorded per alignment as a **CIGAR**, a
compact code where e.g. `120M3I45M` is 120 matching bases, 3 extra bases in one
genome, then 45 more matches. It is what the ribbon tooltips report and what the
CIGAR indel modes paint, so an alignment file carrying no CIGARs can only be
drawn as solid blocks. For which file formats carry one and which adapter reads
each, see
[the alignment format glossary](/docs/config_guides/synteny_track#alignment-format-glossary).

## Opening a linear synteny view

**Add → Linear synteny view** opens the import form. If your config already has
a synteny track, it opens in **Quick start**: pick the track and it fills in a
row per assembly that track names, however many that is, then click **Launch**.
**Swap** reverses the row order, since a synteny track is queryable in either
direction and its listed order does not claim which genome belongs on top.

**Manual** is the same form with the rows exposed: select each row's assembly
yourself, click the arrow between two rows to give that pair its dataset, and
add a .paf, .out (MashMap), .delta (MUMmer), .chain, .anchors, or
.anchors.simple (MCScan) file there if the session has none. It is the way in
for a stack whose rows no single track names, and the way to adjust the ones
Quick start filled in.

Either mode stacks more than two genomes. The worked examples are from an
[all-vs-all PAF](/docs/tutorials/allvsall_synteny), an
[MCScan ortholog table](/docs/tutorials/multiway_synteny_grape_peach_cacao), and
a [pangenome graph's linear projections](/docs/tutorials/pangenome_ecoli).

<Figure caption="The import form synteny and dotplot views share, reached from the Add menu. Its Manual mode, shown here, is where you select two assemblies and can supply an additional file." src="/img/dotplot_add.png" />

<Figure caption="The linear synteny view for the grape vs peach genomes." src="/img/linear_synteny.png" />

### From a locus you are already looking at

The other way in starts from a locus in a linear genome view with a synteny
track open on it, and lets JBrowse frame the panels. The track has to be open:
its ribbons are what say the locus aligns anywhere at all, and a dataset that is
configured but closed is what the import form above is for.

- **Drag-select a region** on the scale bar and pick **Launch → Linear synteny
  view**. The dialog names the **synteny dataset** the region is read back out
  of — a select when the view has more than one open, a line otherwise — and
  changing it refetches the panels below. JBrowse finds every assembly aligning
  to the region in that dataset and opens a panel for each. The dialog lists
  them top to bottom with the locus and size each panel will open on and up/down
  arrows, the assembly you selected in among them: ribbons are drawn between
  neighbouring panels only, so that order decides which comparisons the view can
  show. This is the form to use for an
  [all-vs-all](/docs/tutorials/allvsall_synteny) dataset, where a locus reaches
  several assemblies at once.
- **Right-click a single alignment** in a synteny track drawn in a linear genome
  view and pick **Linear synteny view with ...** (naming the mate assembly),
  which opens the one pair that alignment describes. Its **Use CIGAR to map the
  current visible region to the target** option walks the alignment to find the
  interval that matches what you are looking at; without it the panels frame on
  the whole block's endpoints, and the dialog prints where each panel will open
  either way. An alignment carrying no CIGAR — a PAF written without minimap2's
  `-c`, MashMap, MCScan, the coarse tier of a PIF — offers the same option as
  **Clip the panels to the current visible region**, estimating the target
  interval by interpolating across the block, which is the straight line its
  ribbon is already drawn as. Worked through in
  [](/docs/tutorials/genomes_synteny). On a track declaring three or more
  assemblies the same menu also offers **Linear synteny view, all assemblies
  here**, the multi-panel dialog above cut from this track at the block you
  clicked in. **Open \<assembly\> at the matching region** is the jump rather
  than the comparison: it opens the mate assembly on its own, with the session's
  gene track for it, at the stretch the alignment maps your window to, for any
  mate the session has loaded. The same three are links in the feature's details
  panel, clipped to the panel's visible window.
- The same **Linear synteny view (visible region)** entry sits in the view's
  hamburger menu under **Launch**, for when the region you want is the whole
  view and there is nothing to select.
- **A row of a synteny view launches too.** Drag-select on any row's scale bar
  and the same **Launch → Linear synteny view** reads the bands' datasets, so
  the dialog opens anchored on that row's genome with a panel for every assembly
  aligning to it there. **Replace current view** then swaps the stack for one
  anchored on that row, which is how a stack is re-anchored on any of its
  genomes.
- **A row of a [](/docs/user_guides/maf_track)** opens as a synteny view too:
  drag-select across the rows and pick **Launch synteny view, \<ref\> vs...**,
  then the sample. The ribbons are cut from the alignment's own columns, so no
  synteny file is involved.

Both dialogs offer a **window size** (padding added to every panel) and a
**horizontally flip inverted targets** checkbox. Without flipping, an inverted
panel's coordinates run right to left.

## Navigating each panel

Each genome panel is a full linear genome view and, by default, is controlled
independently:

- scroll, zoom, and pan either panel on its own; ribbons redraw to follow
- type a region or gene name into a panel's search box to jump it there
- add tracks (genes, alignments, coverage) to either side from its track
  selector, useful for reading what a syntenic block actually contains

### Making the panels move together

**Link views** in the hamburger menu couples the panels. **Independent** is the
default; the other two couple them differently:

- **Locked together** replays a pan or zoom in one panel onto the others, so
  they move together by pixels. That pixel correspondence drifts apart as indels
  accumulate between the two genomes. Useful once the panels are already lined
  up on the region you want to walk along, and on comparisons close enough that
  they stay lined up
- **Follow** keeps the other panels on whatever aligns to one anchor panel,
  re-resolved through the synteny data as you move. It re-derives the
  correspondence from the alignment, so the ribbons stay near-vertical however
  far you pan

Following is the mode to reach for when comparing two haplotypes or two
assemblies of the same genome, where the coordinates diverge but the sequence
does not. Turning it on adds an **Anchor row** section to the same menu, naming
which panel drives; the others are placed from it, outward one level at a time
in a stack of three or more.

The header's arrows button toggles following on and off without opening the
menu, and shows whether it is running. It changes to a warning form where
nothing aligns to the anchor's window at all — a haplotype-specific insertion, a
centromere, a panel off the end of the alignments — where the other panels hold
their position.

<Figure caption="The follow button in both of its forms, on the two haplotypes of T2T-HG002 with the chain blocks drawn on each panel's own coordinates. Left, the row below is placed from the row above. Right, the anchor row sits in a gap between two chains, so it has nothing to place the other row from and the other row keeps the window it had." src="/img/synteny_follow_unaligned.png" />

A followed panel can still be panned by hand; it returns to the matching region
once it settles. Turn following off to keep it where you put it.

<Video src="/media/synteny/hg002_follow_panels.mp4" caption="Following on the two haplotypes of T2T-HG002, which carry the same coordinates and different sequence: the panels as they open, the header's toggle, and a second window typed into the anchor panel's search box alone." />

## Interacting with the ribbons

- Hover a ribbon to see a tooltip with the alignment's coordinates on both
  genomes and, when zoomed in, the CIGAR operation under the cursor
- Click a ribbon to highlight it across both panels
- Right-click a ribbon for a context menu with **Center on feature**, which
  recenters both panels on that alignment's midpoint
- The same menu offers **Move top panel to the matching region** and **Move
  bottom panel to the matching region**. These leave one panel alone and send
  the other to the sequence that panel's visible window aligns to, resolved
  through the alignment's CIGAR, which is what to reach for on a chain-scale
  alignment whose midpoint can be tens of megabases from what is on screen.
  There are two items because a ribbon sits between two panels
- The same item is on the right-click menu of a synteny track opened as a track
  _inside_ a panel, as **Move other panel to the matching region** — there the
  panel you clicked in is the one that stays
- Those items appear only where the alignment carries a CIGAR to walk. A PAF
  written without `minimap2 -c`, a MashMap or MCScan file, and the coarse tier
  of a tiered PIF all describe a block without describing the correspondence
  inside it, so there is no matching region to resolve; zooming in far enough to
  load the fine tier brings the items back
- To keep a panel on the matching region as you move rather than sending it
  there once, use **Follow** above. It works on CIGAR-less alignments too,
  interpolating across the block

## Coloring the ribbons

The palette button in the view header sets what the ribbon color means, and
carries a **Show color legend** toggle:

- Default - the ribbon color plus CIGAR operation coloring, so insertions,
  deletions, and skips inside an alignment are drawn in their own colors
- Strand - forward and inverted alignments get different colors, so a ribbon
  that twists reads as an inversion
- Distinct color per track - give every overlaid synteny track its own color
  from a palette, so several alignment files drawn into the same view can be
  told apart. Only offered once a view has more than one track
- Query / Target - color by the refName on this side or on the other side, for
  telling contigs apart when one maps across several
- Reference - color every level of a stacked view by the shared reference's
  chromosome names, so a region keeps one color as it is traced down the stack
- Identity - per-alignment sequence identity on a viridis ramp. It needs the
  `=`/`X` CIGAR that `minimap2 --eqx` writes
- Mean query identity - length-weighted identity across all alignments of a
  query/target pair, which smooths a contig split into many hits
- Mapping quality - per-alignment PAF MAPQ on a cividis ramp
- dN/dS - the ratio of non-synonymous to synonymous substitution rate, on a
  diverging blue-yellow-red ramp whose pale middle is 1. Blue below it is
  purifying selection, red above it positive selection, clamped at 2. It needs
  an [ortholog table](/docs/tutorials/homoeolog_synteny) carrying `dn` and `ds`
  per link

A mode whose number a track does not carry leaves every ribbon the default
color.

**Customize per track** at the bottom of that menu overrides the choice above
for one track at a time: each track can take its own mode, and its automatic
palette color can be pinned to one you pick. Choosing any mode above clears
those overrides.

The settings button beside it has **Identity fade**, which modulates ribbon
opacity by identity independently of the color mode, so low-identity blocks fade
out without spending the color channel.

## Display settings

The sliders button in the header opens a menu of every setting that decides what
the ribbons look like, in three groups — how one alignment is drawn, how much of
it is loaded, and which alignments are drawn at all. Every row is the same
shape: a boolean is a checkbox, and a choice or a continuous value opens a
submenu holding its options or its slider. Within a group the checkboxes come
first, then the choices, then the values. The hamburger menu next to it answers
what the view _is_ — which genomes it stacks, where they point, what leaves it.

**Ribbons** — how one alignment is drawn.

- **Identity fade** is described above
- **Thin fade** fades ribbons thinner than a pixel by their on-screen width, so
  an unfiltered whole-genome view does not read as a hard full-opacity hairball.
  Its default, **Auto**, turns the fade on only where the view is dense enough
  to tangle, leaving a genuinely sparse comparison — distant species, every
  alignment sub-pixel — unfaded; **On** and **Off** pin it
- **Curved lines** draws ribbons as bezier curves instead of straight
  connectors, which reads far better at whole-genome scale where straight
  crossings stack into noise
- **Location markers** continues the top panel's scalebar grid down through the
  ribbons, so each tick shows where a round coordinate up there lands below
- **Opacity** is how much dense overlapping alignments show through each other

**Detail** — how much of each alignment is loaded and painted.

- **CIGAR indels** is how per-base insertions and deletions inside one are
  shown:
  - **Colored indels** paints them
  - **Transparent indels** leaves them as see-through gaps in the ribbon
  - **Off - don't draw CIGAR indels** draws each alignment as one solid block.
    It carries a warning icon: overlapping blocks run together with nothing to
    tell them apart, and a gap inside a block is painted as though it matched
    across
- **Level of detail** picks which stored tier is fetched

Both rows are gated on the data: a CIGAR-less PAF has no indels to draw, and an
adapter with one stored tier has nothing to switch between. A file that is both
takes the whole section with it.

**Scope** — which alignments make it into the picture at all.

- **Off-screen mates** decides how hard to look for the ones this view cannot
  draw (below)
- **Min length** hides ones shorter than it, which is what clears the hairball
  of short spurious chains at whole-genome zoom
- **Overdraw** is how many pixels beyond the visible area are still drawn, which
  is what keeps a ribbon reaching a long way off screen visible while you scroll

## View options

The view's hamburger menu keeps seven rows however many genomes are stacked. The
three that zoom every row at once are at the top; what varies with the stack is
inside **Rows**:

- **Square view - average bp per pixel** puts every row on the average of the
  rows' current scales, keeping each row's center
- **Show all regions - each row fit to width** zooms every row out to its whole
  assembly, giving each its own scale so it fills its own pane
- **Show all regions - same bp per pixel** zooms every row out too, but puts
  them all on one scale, so a smaller genome draws proportionally shorter than a
  larger one. The two show-all-regions rows are settings rather than one-off
  buttons: whichever is marked stays in force, so after zooming into a locus,
  zooming back out returns to the same shared scale
- **Link views** decides whether panning one row pans the others, and by what —
  pixels, or the alignment. Following also picks which row is the anchor
- **Rows** - **Add assembly row** to compare three or more assemblies stacked
  vertically, **Remove bottom row**, **Re-order chromosomes**, and one entry per
  genome opening that row's own view menu (which is otherwise reachable only
  from that row's header, and a collapsed row has none)
- **Export SVG**, and **Show...** for the header's own search boxes

<Figure caption="Human (hg38) vs chimp (panTro6) across an RB1 intron, from a UCSC liftOver chain with RepeatMasker on both genomes. A full-length L1HS present in human is absent at the orthologous chimp intron, which the 'Colored indels' mode paints as a wedge in the ribbon." src="/img/synteny_human_chimp_cigar_modes.png" />

## Off-screen mates

A ribbon needs both of its ends on screen. An alignment with only one end there
draws nothing, so a locus syntenic to a chromosome the view cannot pair looks
exactly like a locus syntenic to nothing. Two arrangements produce that, and the
marks cover both. Either the mate is on a contig the facing panel is not
displaying at all, or it is on one that panel has scrolled away from. The second
is what a stack of whole genomes is made of. Every contig is displayed there, so
nothing is missing from the panel, and the ribbons still disappear as soon as
the two rows are not over each other.

Where the mate sits on the facing panel is a live question, so the marks answer
it live. Scroll that panel onto the mate and the mark becomes the ribbon it
stood in for. **Overdraw** is the edge it is measured against.

**Off-screen mates** in the settings menu is where **Mark them on the upper
panel** turns the marks on, and it is on by default. Each mark sits where the
alignment is on the panel it does have, stopping short of the ribbons so it
cannot be read as an alignment to whatever is directly below. A run of marks to
one contig carries that contig's name; where several contigs cover the same
stretch, their names stack.

**Which panel a mark lands on is decided by which one still has the alignment.**
An alignment is undrawable as soon as _either_ of its ends leaves its own panel,
so the two edges of a band say opposite things. A mark along the top edge means
the upper panel still has that alignment and the lower panel cannot pair it —
its other end is on a contig the lower panel is not displaying, or on one it has
scrolled away from. A mark along the bottom edge is the same sentence with the
panels swapped: the lower panel still has it, and the upper panel is the one
that cannot pair it. Clicking a mark always moves the _other_ panel, the one
that would have to show that contig for the two to be a ribbon.

**A panel gets a strip only if the file was queried from it.** The upper panel
always is, which is what makes marking it free: every alignment anchored in the
window it is showing came back, including the ones there is no way to draw, so
the top edge accounts for all of them. The lower panel is queried only at the
step described below, and until it is, the alignments anchored down there are
held only where they happened to fall inside the upper panel's fetch. A strip
drawn from those would stop where the fetch stops rather than where the data
does, shift as the upper panel pans, and give each mark a count that is some
fraction of the alignments going to that contig. So the bottom edge stays empty
until there is a query behind it.

A run too narrow to hold its own name goes unlabelled, which at whole-chromosome
zoom is most of them. Hover any mark and it names the contig it points at, and
how many alignments on this band go there.

Clicking a mark shows that mate on the facing panel. A contig the panel is
already displaying is scrolled to, so the rest of what it was showing stays.
That matters most in a stack of whole genomes, where replacing the panel's
regions would throw away every other chromosome. A contig it is not displaying
has to replace them, and there the click navigates to the mate's own locus
rather than to the whole contig, close enough to show the alignments the mark
stands for. The window is widened around that locus, to at least 20kb and a
little past its ends, so a single small anchor arrives with context around it to
place the alignment against. The click turns those marks into ribbons, and the
hover says what it will do beforehand.

Either way the click raises a notification carrying an **Undo** that puts back
the row's regions, its zoom and its scroll position. The replacing kind discards
a region list that may have been built over several navigations, and even a
scroll is worth being able to take back. If the rows are following each other
and the one clicked was not the anchor, the click also makes it the anchor,
since the follow would otherwise pull the row straight back off the contig it
was just sent to, and the notification says so. That undo restores the previous
anchor too.

<Figure caption="Peach chromosome 1 over grape chromosome 1, from MCScan blocks. Above, the ribbons alone. Below, the same view marking the alignments it has no second endpoint for — most of this peach chromosome is syntenic to grape chromosomes other than the one stacked under it." src="/img/synteny_offscreen_mates.png" />

<Figure caption="A window of peach chromosome 1 where the grape chromosome stacked under it has no alignments at all. Above, the band is empty apart from the marks and the grape chromosome they name. Below, that chromosome is the one on the bottom panel, and the same alignments are ribbons." src="/img/synteny_offscreen_mates_click.png" />

### Alignments anchored on the lower panel

A synteny track is queried from the **upper** panel of each pair, so an
alignment anchored on a contig the lower panel is showing — whose other end is
somewhere the upper panel is not — is never asked for at all. The same two
genomes therefore report differently depending on which one you stacked on top.

**Query the lower panel too, and mark it as well** — the last step of that same
submenu — adds that second query, and with it the strip along the bottom edge.

What comes back splits two ways. An alignment whose other end is on a contig the
upper panel is not displaying at all has no second endpoint, so it becomes a
mark; clicking one of those navigates the **upper** panel. An alignment whose
other end is on a contig the upper panel _is_ displaying, outside the window it
is showing, is a ribbon in principle — but a ribbon with one end that far off
the edge is not drawn, which is the same rule that governs any alignment
reaching a long way off screen, so it becomes a mark too. Raising **Overdraw**
past the panel's pan buffer is what turns those marks into the ribbons they
stand for.

It is off by default: it is a second query per panel pair, which on a
whole-genome alignment file is real work.

### Smaller insertions

The same human/chimp synteny plus RepeatMasker resolves a lineage-specific
insertion an order of magnitude smaller than the L1HS above, and it is still a
gap in the alignment with the element named at the indel:

<Figure caption="A human-specific AluYb8 (~0.3 kb) in PICALM, inserted downstream of a conserved AluY present in both species. A small insertion still reads clearly as an indel." src="/img/synteny_te_picalm_alu.png" />

## See also

- [](/docs/user_guides/dotplot_view)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny) - hosted liftOver chains, nothing to set
  up
- [Synteny/dotplot configuration](/docs/config_guides/synteny_track)
- [](/docs/user_guides/maf_track)
- [Gallery: synteny examples](/gallery/#synteny)
