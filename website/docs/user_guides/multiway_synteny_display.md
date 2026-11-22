---
title: Multi-way synteny display
description: One lane per genome under a linear genome view
guide_category: Views
---

The multi-way synteny display stacks several genomes under a linear genome view,
one lane per genome, each drawn in that genome's own coordinates. The view's
genome is the anchor on top. The display fits each lane to the stretch the
alignment matches to the anchor's window, and ribbons join the matching
stretches or genes between lanes.

A synteny track over several genomes draws this way from its track menu:
**Display types → Multi-way synteny display**.
[Three or more genomes](/docs/config_guides/synteny_track#three-or-more-genomes)
has a config for each kind of input, from an ortholog table or alignment files
of your own.

## What a ribbon joins

Which two lanes a ribbon connects depends on the track's source:

| Source                                                                 | A ribbon joins                                                                                    | Worked through in                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Pairwise alignments against one genome (`MultiPairwiseSyntenyAdapter`) | a lane to the anchor, whichever lane sits above it                                                | [](/docs/tutorials/hg38_vertebrates_synteny), [](/docs/tutorials/genomes_synteny)                                                              |
| One PAF holding many pairs (`MultiGenomePAFAdapter`, indexed or not)   | a lane to the lane above it, or to the anchor where the file aligns every genome to one reference | [](/docs/tutorials/t2t_apes_cactus_synteny), [](/docs/tutorials/syri_synteny)                                                                  |
| An ortholog table (`MCScanBlocksAdapter`)                              | one ortholog group, down adjacent lanes                                                           | [](/docs/tutorials/multiway_synteny_grape_peach_cacao), [](/docs/tutorials/primate_orthologs_synteny), [](/docs/tutorials/orthofinder_synteny) |
| Haplotype walks through a pangenome graph (`WalkTabixSyntenyAdapter`)  | the nodes two neighbouring haplotypes share                                                       | [](/docs/tutorials/pangenome_hprc_haplotypes)                                                                                                  |

A blue ribbon means "inverted against the anchor" on a track against one genome
and "inverted against the lane above" on a neighbour-pair track. Stacking the
genomes in tree order makes the second kind read as a walk down the tree.

## Reading a lane header

Each lane has its own scale, printed in its header:

- **Left end:** where the lane starts, with `[rev]` where the lane runs against
  the anchor
- **Right end:** the anchor prints its window's span. A lane that holds more
  sequence across the window than the anchor, such as one with insertions, is
  squeezed to fit and prints the span it draws and how many times it is squeezed
  (`114Kbp, squeezed 1.5×`); a lane at the anchor's scale prints nothing
- **Ticks** fall at one interval shared by every lane
- **`also at`** names a second stretch the window aligns to, a window or more
  away from the one the lane draws

A lane with no readable gene track (GFF3, GTF, BigBed or BED) on its assembly
outlines gene spans from the table where it has them, labeled `no annotation`.
The view's gridlines stop at the anchor, the one lane they fit.

## Ribbons

- **Color by → Strand**, under **Ribbons** in the track menu, is the default:
  red where the two lanes a ribbon joins run the same way, blue where one is
  reversed. A lane drawn reversed has straight ribbons that are still blue.
- **Hover** a ribbon to light the same alignment or ortholog group in every lane
  it reaches; the tooltip names the two lanes it joins, each with its stretch
  and length.
- **Click** a ribbon to open its details, and empty canvas to clear the outline.
  An alignment against the anchor ends its details in a **Link to view** card,
  which opens the other genome at the matching region or launches a synteny view
  of the pair.
- **Opacity** in the track menu sets how far overlapping ribbons show through
  each other.
- **Blocks:** an MCScan `.anchors` track draws each block of gene pairs as a
  pale band behind their ribbons, from one end of the block to the other on both
  lanes. A band is colored and filtered by the block's own direction, `block`
  and `blockSpan`, and hovers and clicks as a ribbon does.
- **Skipped lanes:** a ribbon joins a gene to the next lane that places it when
  the lane between places nothing, so a sparse lane mid-stack cuts no chain.

## Choosing and ordering lanes

The **Lanes** submenu in the track menu holds the stack's controls:

- **Choose lanes...** picks which genomes draw, with a filter box for long
  lists.
- **Order lanes by structure** starts from the lane most like the anchor and
  stacks each lane beside the one whose insertions and deletions against the
  anchor are most alike, so a structure several lanes share draws as one block.
  The order stays until you reset it.
- **Freeze lanes** keeps every lane where it is as you pan and zoom. While
  frozen, drag or side-scroll a lane to slide it. The lanes unfreeze once the
  view leaves the window they froze on.

Drag a lane label to move that lane. To fix the order across a pan, the display
config's `rows.sort` pins the lanes it names to the top, in that order, and the
rest follow densest-first, or each beside the lane most alike where the source
joins neighbouring lanes
([grouping and ordering](/docs/config_guides/grouping_and_ordering#multiway-synteny)).

## Where a lane draws

A lane draws one stretch of one chromosome at a time, the stretch holding most
of the window. Where the window aligns somewhere else too, the lane header menu
offers it:

- **Show ⟨chromosome⟩ in this lane** moves the lane onto another chromosome the
  window aligns to.
- **Show ⟨region⟩ in this lane** moves it onto the other stretch its header
  names after `also at`.
- **Flip lane** turns the lane the other way on the same chromosome, for a lane
  whose blocks split about evenly between the two orientations.
- **Unpin ⟨chromosome⟩** undoes either **Show** item, so the lane chooses where
  it draws again.
- **Unpin orientation on ⟨chromosome⟩** undoes a flip.

## The lane header menu

The ⋮ on a lane header, or a right-click on its name, opens the lane menu. The
**Lanes** submenu in the track menu also lists every lane by name, each with the
same items.

- **Open ⟨genome⟩ at the matching region** opens that genome in a separate
  linear genome view, with its gene track.
- **Re-anchor on ⟨genome⟩** turns the track around so that genome is the anchor.
- **Re-align lane**, offered while the lanes are frozen, fits the lane to what
  the anchor shows now and keeps it frozen there.
- **Color...** picks a color for the lane, drawn as a bar beside its name, over
  any color the data source gives it; **Clear lane color** returns to the
  source's. The display config's `rows.colors` sets these by assembly name.

<Figure caption="The lane header menu." src="/img/multiway_synteny/lane_header_menu.png" />

## Opening a stacked synteny view

These open a [linear synteny view](/docs/user_guides/linear_synteny_view) with a
row per genome:

- **Advanced → Launch → Linear synteny view (visible region)...** in the track
  menu offers a row to every genome that aligns to the window.
- **Launch → Linear synteny view...** appears once you drag-select a region on
  the scale bar. The dialog lists a row per genome, with arrows to reorder them.

## See also

- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config_guides/grouping_and_ordering)
