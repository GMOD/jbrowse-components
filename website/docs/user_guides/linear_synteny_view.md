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
CIGAR display modes paint, so an alignment file carrying no CIGARs can only be
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

The import form starts from two assemblies. The other way round is to start from
a locus in a linear genome view that has a synteny dataset covering its
assembly, and let JBrowse frame the panels for you. The dataset does not have to
be an open track:

- **Drag-select a region** on the scale bar and pick **Launch → Linear synteny
  view**. The dialog's first field is the **synteny dataset** to read the region
  back out of, listing every one in the session that covers this assembly, the
  view's own tracks first; changing it refetches the panels below. JBrowse finds
  every assembly aligning to the region in that dataset and opens a panel for
  each. The dialog lists them top to bottom with up/down arrows, the assembly
  you selected in among them: ribbons are drawn between neighbouring panels
  only, so that order decides which comparisons the view can show. This is the
  form to use for an [all-vs-all](/docs/tutorials/allvsall_synteny) dataset,
  where a locus reaches several assemblies at once.
- **Right-click a single alignment** in a synteny track drawn in a linear genome
  view and pick **Launch synteny view for this position**, which opens the one
  pair that alignment describes. Its **Use CIGAR to map the current visible
  region to the target** option walks the alignment to find the interval that
  actually matches what you are looking at, rather than framing on the whole
  block's endpoints. An alignment carrying no CIGAR — a PAF written without
  minimap2's `-c`, MashMap, MCScan, the coarse tier of a PIF — offers the same
  option as **Clip the panels to the current visible region**, estimating the
  target interval by interpolating across the block, which is the straight line
  its ribbon is already drawn as. Worked through in
  [](/docs/tutorials/genomes_synteny).
- The same **Linear synteny view (visible region)** entry sits in the view's
  hamburger menu under **Launch view**, for when the region you want is the
  whole view and there is nothing to select.

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

**Row sync** in the hamburger menu couples the panels, in one of two ways:

- **Link scroll and zoom** replays a pan or zoom in one panel onto the others,
  so they move together by pixels. Useful once the panels are already lined up
  on the region you want to walk along, and on comparisons close enough that
  they stay lined up
- **Follow the matching region** instead keeps the other panels on whatever
  aligns to one anchor panel, re-resolved through the synteny data as you move.
  Where the pixel lock drifts apart as indels accumulate between the two
  genomes, this re-derives the correspondence, so the ribbons stay near-vertical
  however far you pan

Following is the mode to reach for when comparing two haplotypes or two
assemblies of the same genome, where the coordinates diverge but the sequence
does not. Turning it on adds an **Anchor row** section to the same menu, naming
which panel drives; the others are placed from it, outward one level at a time
in a stack of three or more.

The header's arrows button toggles following on and off without opening the
menu, and shows whether it is running. It changes to a warning form where
nothing aligns to the anchor's window at all — a haplotype-specific insertion, a
centromere, a panel off the end of the alignments — which is the case where the
other panels hold their position rather than move.

A followed panel can still be panned by hand; it returns to the matching region
once it settles. Turn following off to keep it where you put it.

## Interacting with the ribbons

- Hover a ribbon to see a tooltip with the alignment's coordinates on both
  genomes and, when zoomed in, the CIGAR operation under the cursor
- Click a ribbon to highlight it across both panels
- Right-click a ribbon for a context menu with **Center on feature**, which
  recenters both panels on that alignment
- The same menu offers **Move top panel to the matching region** and **Move
  bottom panel to the matching region**. Where **Center on feature** moves both
  panels to the alignment's midpoint, these leave one panel alone and send the
  other to the sequence that panel's visible window aligns to, resolved through
  the alignment's CIGAR. That is what to reach for on a chain-scale alignment,
  whose midpoint can be tens of megabases from what is on screen; there are two
  items because a ribbon sits between two panels
- The same item is on the right-click menu of a synteny track opened as a track
  _inside_ a panel, as **Move other panel to the matching region** — there the
  panel you clicked in is the one that stays
- Those items appear only where the alignment carries a CIGAR to walk. A PAF
  written without `minimap2 -c`, a MashMap or MCScan file, and the coarse tier
  of a tiered PIF all describe a block without describing the correspondence
  inside it, so there is no matching region to resolve; zooming in far enough to
  load the fine tier brings the items back
- To keep a panel on the matching region as you move rather than sending it
  there once, use **Follow the matching region** above. It works on CIGAR-less
  alignments too, interpolating across the block where the click-driven items
  decline to guess

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
  an [ortholog table](/docs/tutorials/multiway_synteny_grape_peach_cacao)
  carrying `dn` and `ds` per link

A mode whose number a track does not carry leaves every ribbon the default color
rather than painting them all at zero.

**Customize per track** at the bottom of that menu overrides the choice above
for one track at a time: each track can take its own mode, and its automatic
palette color can be pinned to one you pick. Choosing any mode above clears
those overrides.

The settings button beside it has **Identity fade**, which modulates ribbon
opacity by identity independently of the color mode, so low-identity blocks fade
out without spending the color channel.

## View options

The view's hamburger menu controls how the ribbons are drawn:

- Show curved lines - draw ribbons as bezier curves instead of straight
  connectors
- CIGAR display mode - how per-base insertions and deletions inside each
  alignment are shown: **Colored indels** paints them, **Transparent indels**
  leaves them as see-through gaps in the ribbon, and **Off - don't draw CIGAR
  indels** draws each alignment as one solid block. That last one is marked with
  a warning: overlapping blocks run together with nothing to tell them apart,
  and a gap inside a block is painted as though it matched across
- Show location markers - continue the top panel's scalebar grid down through
  the ribbons, so each tick shows where a round coordinate up there lands below
- Show all regions - zoom every row out to its whole assembly, two ways. **Each
  row fit to width** gives each row its own scale so it fills its own pane;
  **Same bp per pixel** puts all rows on one scale, so a smaller genome draws
  proportionally shorter instead of being stretched to the same on-screen length
  as a larger one
- Square view - average bp per pixel - put every row on the average of the rows'
  current scales, keeping each row's center
- Add assembly row - compare three or more assemblies stacked vertically

<Figure caption="Human (hg38) vs chimp (panTro6) across an RB1 intron, from a UCSC liftOver chain with RepeatMasker on both genomes. A full-length L1HS present in human is absent at the orthologous chimp intron, which the 'Colored indels' mode paints as a wedge in the ribbon." src="/img/synteny_human_chimp_cigar_modes.png" />

## Alignments the view cannot draw

A ribbon needs both of its ends on screen. An alignment whose mate lands on a
contig the facing panel is not displaying has only one end, so the view draws
nothing for it — and a locus syntenic to a chromosome you did not stack then
looks exactly like a locus syntenic to nothing.

The hamburger menu says how many those are, naming the contigs they go to, and
the same item turns on a strip of marks along the query axis. Each mark sits
where the alignment is on the panel it does have, stopping short of the ribbons
so it cannot be read as an alignment to whatever is directly below. A run of
marks to one contig carries that contig's name; where several contigs cover the
same stretch, their names stack.

A run too narrow to hold its own name goes unlabelled, which at whole-chromosome
zoom is most of them. Hover any mark and it names the contig it points at, and
how many alignments on this band go there.

Clicking a mark navigates the facing panel to that contig, which is what turns
those marks into ribbons — so the hover is also how to see what a click will do
before making it.

<Figure caption="Peach chromosome 1 over grape chromosome 1, from MCScan blocks. Above, the ribbons alone. Below, the same view marking the alignments it has no second endpoint for — most of this peach chromosome is syntenic to grape chromosomes other than the one stacked under it." src="/img/synteny_offscreen_mates.png" />

<Figure caption="A window of peach chromosome 1 where the grape chromosome stacked under it has no alignments at all. Above, the band is empty apart from the marks and the grape chromosome they name. Below, that chromosome is the one on the bottom panel, and the same alignments are ribbons." src="/img/synteny_offscreen_mates_click.png" />

### Alignments anchored on the lower panel

Everything above is about alignments the view already has. A synteny track is
queried from the **upper** panel of each pair, so an alignment anchored on a
contig the lower panel is showing — whose other end is somewhere the upper panel
is not — is never asked for at all. The same two genomes therefore report
differently depending on which one you stacked on top.

**Search both rows for alignments** adds that second query, and what it finds
splits two ways. An alignment whose other end is on a contig the upper panel is
displaying — just outside the window it is showing — becomes a ribbon, leaving
the top of the band towards wherever it goes; the view has always drawn those in
the other direction, and this is what makes the two directions agree. One whose
other end is on a contig the upper panel is not displaying at all has no second
endpoint, so it is marked along the lower panel's axis instead, mirroring the
strip described above, and clicking one of those marks navigates the **upper**
panel. The count in the menu item above it covers both directions once this is
on.

It is off by default: it is a second query per panel pair, and on a whole-genome
alignment file that is real work rather than bookkeeping.

### How small an insertion still reads

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
