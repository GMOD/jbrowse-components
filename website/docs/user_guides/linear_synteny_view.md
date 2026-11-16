---
title: Linear synteny view
description: Side-by-side alignment of two genomes
guide_category: Views
---

The linear synteny view stacks two genomes, one above the other, and draws their
alignments as ribbons connecting matching regions. Each panel behaves like a
linear genome view, so you can scroll, zoom, and add tracks to either side
independently while the ribbons follow.

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
genome, then 45 more matches. The ribbon tooltips report it and the CIGAR indel
modes paint it, so an alignment file with no CIGARs can only be drawn as solid
blocks. For which file formats have one and which adapter reads each, see
[the alignment format glossary](/docs/config_guides/synteny_track#alignment-format-glossary).

## Opening a linear synteny view

**Add → Linear synteny view** opens the import form. If your config already has
a synteny track, it opens in **Quick start**: pick the track and it fills in a
row per assembly that track names, then click **Launch**. **Swap** reverses the
row order.

**Manual** is the same form with the rows exposed: select each row's assembly
yourself, click the arrow between two rows to give that pair its dataset, and
add a .paf, .out (MashMap), .delta (MUMmer), .chain, .anchors, or
.anchors.simple (MCScan) file there if the session has none. Use **Manual** for
a stack whose rows come from more than one track, and to adjust the rows Quick
start filled in.

Quick start and Manual both stack more than two genomes. The worked examples are
from an [all-vs-all PAF](/docs/tutorials/allvsall_synteny), an
[MCScan ortholog table](/docs/tutorials/multiway_synteny_grape_peach_cacao), and
a [pangenome graph's linear projections](/docs/tutorials/pangenome_ecoli).

<Figure caption="The import form the synteny and dotplot views share, in Manual mode." src="/img/dotplot_add.png" />

<Figure caption="The linear synteny view for the grape vs peach genomes." src="/img/linear_synteny.png" />

### From a locus you are already looking at

With a synteny track open in a linear genome view, JBrowse can frame the panels
from the track's ribbons. The import form above is for a dataset that is
configured but closed.

- **Drag-select a region** on the scale bar and pick **Launch → Linear synteny
  view**. JBrowse opens a panel for every assembly aligning to the region in the
  dialog's **synteny dataset** (a select when the view has more than one open).
  The dialog lists the panels top to bottom with the locus and size each opens
  on, and up/down arrows to reorder them: ribbons join neighbouring panels only.
  This is the route for an [all-vs-all](/docs/tutorials/allvsall_synteny)
  dataset, where a locus aligns to several assemblies.
- **The whole view:** with nothing to select, the view's hamburger menu has the
  same **Linear synteny view (visible region)...** under **Launch**.
- **Right-click an alignment** in a synteny track and pick **Launch → Linear
  synteny view with \<assembly\>** <!-- menu-path-ok --> to open the pair that
  alignment describes. Worked through in [](/docs/tutorials/genomes_synteny).
  - **Use CIGAR to map the current visible region to the target** frames the
    panels on the interval matching your window; without it they frame on the
    whole block. The dialog prints where each panel will open.
  - On an alignment with no CIGAR the option reads **Clip the panels to the
    current visible region** and interpolates across the block.
  - **Linear synteny view, all assemblies here**, on a track declaring three or
    more assemblies, opens the multi-panel dialog at the clicked block.
  - **Open \<assembly\> at the matching region** opens the mate assembly alone,
    with the session's gene track for it, at the stretch your window maps to.
  - The feature's details panel has the same three as links.
- **A row of a synteny view:** drag-select on its scale bar and pick **Launch →
  Linear synteny view...**; the dialog anchors on that row's genome. **Replace
  current view** then re-anchors the stack on that row.
- **A row of a [](/docs/user_guides/maf_track):** drag-select across the rows
  and pick **Linear synteny view, \<ref\> vs**, then the sample. The ribbons are
  cut from the alignment's columns, so no synteny file is needed.

Every Launch dialog offers a **window size** (padding added to every panel) and
**horizontally flip inverted targets**. Unflipped, an inverted panel's
coordinates run right to left.

## Navigating each panel

Each genome panel is a full linear genome view and, by default, is controlled
independently:

- scroll, zoom, and pan either panel independently; ribbons redraw to follow
- type a region or gene name into a panel's search box to jump it there
- add tracks (genes, alignments, coverage) to either side from its track
  selector, useful for reading what a syntenic block actually contains

### Making the panels move together

**Follow** in the hamburger menu keeps the other panels on whatever aligns to
one anchor panel, re-resolved through the alignment as you move, so the ribbons
stay near-vertical however far you pan. It suits two haplotypes or two
assemblies of the same genome.

- **Anchor row:** a section Follow adds to the same menu, naming the panel that
  drives. Any panel you click, pan, zoom or type in becomes the anchor. In a
  stack of three or more the others are placed outward from it a level at a
  time.
- **Dragging the ribbons** between two panels pans them together; while
  following, it moves the anchor and the others follow. A panel past a band with
  no synteny track pans with the drag.
- **Header toggle:** the arrows button turns following on and off and shows
  whether it is running. It switches to a warning form where nothing aligns to
  the anchor's window (a haplotype-specific insertion, a centromere, the end of
  the alignments), and the other panels hold their position.

Turn following off to move one panel alone.

<Video src="/media/synteny/hg002_follow_panels.mp4" caption="Following on the two haplotypes of T2T-HG002: the header's toggle, and a window typed into the anchor panel alone." />

## Interacting with the ribbons

- **Hover** a ribbon for the alignment's coordinates on both genomes and, when
  zoomed in, the CIGAR operation under the cursor
- **Click** a ribbon to highlight it across both panels
- **Right-click** a ribbon for **Center view on this feature**, which moves both
  panels to that alignment, the same as the link in its feature panel
- **Move top panel to the matching region** and **Move bottom panel to the
  matching region**, on the same menu, leave one panel alone and send the other
  to the sequence the first panel's window aligns to, through the alignment's
  CIGAR. On a synteny track opened inside a panel the item reads **Move other
  panel to the matching region**, and the panel you clicked in stays
- **No CIGAR, no matching region:** those items are missing on a PAF written
  without `minimap2 -c`, a MashMap or MCScan file, and the coarse tier of a
  tiered PIF; zooming in far enough to load the fine tier brings them back
- **Follow** (above) keeps a panel on the matching region as you move, and works
  on CIGAR-less alignments by interpolating across the block

## Coloring the ribbons

The palette button in the view header sets what the ribbon color means. A mode
with a key to read, a ramp or a color per track, floats its legend over the top
ribbon band; close it with the legend's button and it stays closed for that
mode.

- **Default:** the ribbon color plus CIGAR operation coloring, so insertions,
  deletions, and skips inside an alignment are drawn in separate colors
- **Strand:** forward and inverted alignments get different colors, so a ribbon
  that twists reads as an inversion
- **Distinct color per track:** a separate palette color for each overlaid
  synteny track. Offered once a view has more than one track
- **Query / Target:** color by the refName on this side or on the other side,
  for telling contigs apart when one maps across several
- **Reference:** color every level of a stacked view by the shared reference's
  chromosome names, so a region keeps one color down the stack
- **Color by value:** a submenu of the numbers an alignment can have, each
  painted on a color ramp or in bins. The row names whichever is in use.
  - **Identity:** per-alignment sequence identity on a red-grey-blue ramp, red
    divergent and blue identical, as the MAF track's identity heatmap paints it.
    It needs the `=`/`X` CIGAR that `minimap2 --eqx` writes
  - **Mapping quality:** per-alignment PAF MAPQ in the alignments track's four
    bins (0, 1-9, 10-29 and 30+), dark to light
  - **dN/dS:** the ratio of non-synonymous to synonymous substitution rate, on a
    diverging blue-yellow-red ramp whose pale middle is 1, clamped at 2. Blue is
    purifying selection, red positive selection. It needs an
    [ortholog table](/docs/tutorials/homoeolog_synteny) with `dn` and `ds` per
    link
  - **Syntenic depth:** grey for a one-to-one ortholog, orange where several
    genes share one, darker from three on, so a tandem array stands out. It
    needs an MCScan `.anchors` or `.blocks` file and counts over the whole file,
    so a gene whose extra ortholog is off screen still takes color
  - **Any column the table declares:** each of an ortholog table's
    `attributeColumns` becomes an entry. A numeric column paints a viridis ramp;
    a text column (an ancestral linkage group or an orthogroup) paints one color
    per label, or the color in the table's `color` column, with a legend row per
    label

A mode whose number a track does not have leaves every ribbon the default color.

A text column's label keeps the color it took when first drawn. A session can
fix the labels' order and colors with the view's `encoding.color.scale.domain`:
the labels it lists take the palette in order and lead the legend.

**Track colors**, offered once a view has more than one track, lists each track
with the swatch it draws in under Distinct color per track. Pick a color there
to pin it, or reset a track to its automatic palette slot.

The settings button beside it has **Identity fade**, which fades low-identity
ribbons whatever the color mode.

## Display settings

The sliders button in the header opens a menu of every setting for how the
ribbons look. The checkboxes come first, then the rows that open a submenu of
options or a slider. The hamburger menu next to it sets which genomes the view
stacks, where they point and what leaves it.

- **Identity fade** is described above
- **Curved lines** draws ribbons as bezier curves, which read better at
  whole-genome scale where straight crossings stack into noise
- **Location markers** continues the top panel's scalebar grid down through the
  ribbons, so each tick shows where a round coordinate lands below
- **Off-screen mates** marks the alignments this view cannot draw
  ([below](#off-screen-mates))
- **CIGAR indels** sets how insertions and deletions inside an alignment are
  shown:
  - **Colored indels** paints them
  - **Transparent indels** leaves them as see-through gaps in the ribbon
  - **Off - don't draw CIGAR indels** draws each alignment as one solid block.
    Its warning icon flags that overlapping blocks run together, and a gap
    inside a block is painted as though it matched across
- **Level of detail** picks which stored tier is fetched
- **Opacity** is how much dense overlapping alignments show through each other
- **Min length** hides alignments shorter than it, clearing short spurious
  chains at whole-genome zoom

CIGAR indels and Level of detail are offered only where the data has indels to
draw and more than one stored tier. Ribbons thinner than a pixel fade in a dense
view.

<Figure caption="Human against chimp across an RB1 intron, from a liftOver chain with RepeatMasker on both. Colored indels paints a missing L1HS as a wedge." src="/img/synteny_human_chimp_cigar_modes.png" />

The same human/chimp chain resolves an insertion an order of magnitude smaller
than that L1HS, still a gap in the alignment with the element named at the
indel:

<Figure caption="A human-specific AluYb8 in PICALM, drawn as an indel in the ribbon." src="/img/synteny_te_picalm_alu.png" />

## View options

In the view's hamburger menu, the first rows zoom every row at once and **Rows**
holds what varies with the stack:

- **Square view - same bp per pixel** puts every row on the average of the rows'
  current scales, keeping each row's center
- **Show whole genome - each row fit to width** zooms every row out to its whole
  genome (its chromosomes, where the assembly's sequence report names them),
  each scaled to fill its pane
- **Show whole genome - same bp per pixel** zooms every row out onto one scale,
  so a smaller genome draws shorter. Both show-whole-genome rows stay in force
  once marked: zooming back out from a locus returns to the same scale
- **Follow** moves the other rows to whatever aligns to the anchor row, and
  picks which row is the anchor
- **Rows**:
  - **Add assembly row** stacks a third or further assembly
  - **Remove row** takes any row of a stack of three or more, with the bands
    beside it; if a synteny track connects the neighbours of a middle row, the
    view opens it between them
  - **Reverse row order** flips the stack top to bottom, each band keeping its
    tracks
  - **Re-order chromosomes** opens the re-order dialog. On three rows or more it
    asks which row to keep as it is, and sorts every other row against its
    neighbour nearer it
  - one entry per genome opens that row's own view menu, the only route to it
    for a collapsed row
- **Show** for the header's own search boxes
- **Export image...**

## Off-screen mates

A ribbon needs both ends on screen. An alignment whose mate is on a contig the
facing panel is not showing, or has scrolled away from, draws nothing, so a
locus syntenic to a chromosome out of view looks like a locus syntenic to
nothing. **Off-screen mates** in the settings menu, on by default, marks those
alignments:

- **Where:** a mark sits on the edge of the band beside the panel that still has
  the alignment, at its position there. A mark along the top edge means the
  upper panel has the alignment and the lower panel cannot pair it; along the
  bottom edge, the reverse
- **Hover** names the contig the mark points at, how much sequence goes there in
  how many alignments, and the locus a click goes to. A wide enough run of marks
  is labelled with the contig's name
- **Click** moves the _other_ panel to the mate: it scrolls there if the panel
  already draws that stretch, or else adds the contig as a region and zooms to
  the mate with some context around it. Right-click offers the same and copies
  the contig's name
- **Undo** in the notification the click raises puts back the row's regions,
  zoom and scroll. A click on a following row that is not the anchor makes it
  the anchor, and Undo restores the old one

Scrolling the facing panel onto the mate turns the mark into the ribbon.

<Figure caption="Peach chr1 over grape chr1 from MCScan blocks. Grey marks along the band's top edge are alignments whose grape end is on a chromosome not shown." src="/img/synteny_offscreen_mates.png" />

## See also

- [](/docs/user_guides/dotplot_view)
- [](/docs/user_guides/multiway_synteny_display)
- [Synteny visualization tutorial](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny) - hosted liftOver chains, nothing to set
  up
- [Synteny/dotplot configuration](/docs/config_guides/synteny_track)
- [](/docs/user_guides/maf_track)
