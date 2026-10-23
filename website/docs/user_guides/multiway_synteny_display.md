---
title: Multi-way synteny display
description: One lane per genome under a linear genome view
guide_category: Views
---

The multi-way synteny display stacks several genomes under a linear genome view,
one lane per genome, each drawn in that genome's own coordinates. The view's
genome is the anchor on top. Each lane fits itself to wherever the alignment
places the anchor's window, and ribbons join the matching stretches or genes
between lanes.

A synteny track over several genomes draws this way from its track menu:
**Display types → Multi-way synteny display**.

## What a ribbon joins

The track's source decides which two lanes a ribbon connects:

| Source                                                                | A ribbon joins                                     | Worked through in                                                                                                                                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pairwise chains against one genome (`MultiPairwiseSyntenyAdapter`)    | a lane to the anchor, whichever lane sits above it | [](/docs/tutorials/hg38_vertebrates_synteny), [](/docs/tutorials/genomes_synteny)                                                                                                           |
| One PAF holding many pairs (`MultiGenomePAFAdapter`, indexed or not)  | a lane to the lane above it                        | [](/docs/tutorials/t2t_apes_cactus_synteny), [](/docs/tutorials/allvsall_synteny), [](/docs/tutorials/syri_synteny)                                                                         |
| An ortholog table (`MCScanBlocksAdapter`)                             | one ortholog group, down adjacent lanes            | [](/docs/tutorials/multiway_synteny_grape_peach_cacao), [](/docs/tutorials/primate_orthologs_synteny), [](/docs/tutorials/ecoli_orthologs_synteny), [](/docs/tutorials/orthofinder_synteny) |
| Haplotype walks through a pangenome graph (`WalkTabixSyntenyAdapter`) | the nodes two neighbouring haplotypes share        | [](/docs/tutorials/pangenome_hprc_haplotypes)                                                                                                                                               |

So a blue ribbon means "inverted against the anchor" on a chain track and
"inverted against the lane above" on a neighbour-pair track. Stacking the
genomes in tree order makes the second kind read as a walk down the tree.

## Reading a lane header

Each lane has its own scale, printed in its header:

- the left end shows where the lane starts, with `[rev]` where the lane runs
  against the anchor
- the right end shows the span the lane draws, and that span as a multiple of
  the anchor's window, rounded to one of a few fixed steps
- the ticks fall at one interval shared by every lane
- `also at` names a second stretch the window aligns to, a window or more away
  from the one the lane draws

A lane with no readable gene track (GFF3, GTF, BigBed or BED) on its assembly
outlines gene spans from the table where it has them, labeled `no annotation`.
The view's gridlines stop at the anchor, the one lane they fit.

## Ribbons

- **Color by... → Strand**, under **Ribbons** in the track menu, is the default:
  red where the two lanes a ribbon joins run the same way, blue where one is
  reversed. A lane drawn reversed has its ribbons run straight on screen while
  the color still marks them as inverted.
- Hover a ribbon to light the same alignment or ortholog group in every lane it
  reaches.
- Click a ribbon to open its details; click empty canvas to clear the outline.
- A ribbon joins a gene to the next lane that places it when the lane between
  places nothing, so a sparse lane mid-stack cuts no chain. A track whose
  ribbons all join the anchor draws each gutter against the anchor instead.

## Choosing and ordering lanes

The **Lanes** submenu in the track menu holds the stack's controls:

- **Choose lanes...** picks which genomes draw, with a filter box for long
  lists.
- **Order lanes by structure** stacks each lane beside the one whose insertions
  and deletions against the anchor are most alike.
- **Freeze lanes** keeps every lane where it is as you pan and zoom. While
  frozen, drag a lane to slide it.

Drag a lane label to move that lane. In the display config, `rows.sort` pins the
lanes it names to the top, in that order, and the rest follow densest-first, so
the order holds across a pan;
[grouping and ordering](/docs/config_guides/grouping_and_ordering#multiway-synteny)
has the `rows` config.

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
- **Let the lane choose where it draws (pinned to ⟨chromosome⟩)** undoes either
  **Show** item.
- **Let the lane choose its orientation (pinned on ⟨chromosome⟩)** undoes a
  flip.

## The lane header menu

The ⋮ on a lane header, or a right-click on its name, opens the lane menu. The
**Lanes** submenu in the track menu also lists every lane by name, each with the
same items.

- **Open ⟨genome⟩ at the matching region** opens that genome in a separate
  linear genome view, with its gene track.
- **Re-anchor on ⟨genome⟩** turns the track around so that genome is the anchor.

<Figure caption="The lane header menu." src="/img/multiway_synteny/lane_header_menu.png" />

## Opening a stacked synteny view

Two routes open a [linear synteny view](/docs/user_guides/linear_synteny_view)
with a row per genome:

- **Launch → Linear synteny view (visible region)** in the track menu offers a
  row to every genome that aligns to the window.
- **Launch → Linear synteny view** appears once you drag-select a region on the
  scale bar. The dialog lists a row per genome, with arrows to reorder them.

## See also

- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config_guides/grouping_and_ordering)
