---
title: Browsing synteny on genomes.jbrowse.org
description:
  Open a UCSC liftOver track in a linear genome view and launch a synteny view
  from it
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a ready-made JBrowse
config for every UCSC genome, and each one already carries UCSC's pairwise
liftOver alignments to the other genomes. Nothing needs to be downloaded or
converted: any pair UCSC has a chain file for can be compared in a couple of
clicks.

This tutorial uses hg38 versus T2T-CHM13 (hs1) at _TNNT3_, the locus from Fig 5C
of the T2T human variation paper. Called against GRCh38, the region looks like a
24 kb inversion plus a 22 kb deletion that ablates _LINC01150_ in every
individual. Against T2T-CHM13 it is simpler: that same 22 kb is intact, just
placed on the other side of _TNNT3_ and in the opposite orientation.

## What you need

- A browser. There is nothing to install and no data to prepare.

## Opening a liftOver track

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org), then in the
track selector find **Pairwise alignments** > **liftOver** and turn on **hg38 to
Human (hs1) liftOver**. Type `TNNT3` into the location box to navigate to the
gene.

The liftOver track is a synteny track, but in a plain linear genome view it
draws the way an alignments track does: one feature per chain block, laid out in
rows.

<Figure caption="The hg38 to hs1 liftOver track under NCBI RefSeq genes at TNNT3. Each bar is one chain block; the purple one is aligned to the opposite strand in hs1, and the gray/pink ones around it are collinear." src="/img/genomes_synteny/lgv_liftover.png" />

The second genome is not something you have to add. hg38's config declares only
hg38, but the moment a track references `hs1`, JBrowse asks its plugins to
resolve that name and the site's hub plugin loads the assembly for you.

## Launching a synteny view

Right-click any chain block and choose **Launch synteny view for this
position**.

<Figure caption="The chain block context menu. The launch item is offered only once the mate assembly (hs1) has resolved." src="/img/genomes_synteny/launch_menu.png" />

The dialog that opens decides how the second panel is framed:

- **Use CIGAR to map the current visible region to the target** walks the
  alignment to find the exact matching interval, instead of using the block's
  endpoints.
- **Horizontally flip target** is pre-checked when the block you clicked is
  inverted, so the lower panel runs in the same direction as the upper one.
  Without it, the bottom coordinates count down from left to right.
- **Add window size in bp** pads both sides, so the block has some context
  around it rather than filling the view edge to edge.

<Figure caption="The launch dialog, opened from the inverted block. Horizontally flip target is already checked because the feature is reverse-strand on hs1." src="/img/genomes_synteny/launch_dialog.png" />

**Submit** opens a two-panel synteny view on that position, with the liftOver
track drawn as ribbons between the panels. Set the ribbon coloring to **Strand**
from the palette button in the synteny track header, and the rearrangement is
the only off-color block in the view.

<Figure caption="hg38 (top) vs T2T-CHM13/hs1 (bottom) at TNNT3, colored by strand. LINC01150 sits upstream of TNNT3 in hg38 and downstream of it in T2T-CHM13, and the purple ribbon is the segment that moved." src="/img/synteny_hg38_hs1_tnnt3.png" />

## Trying other pairs

The same click-path works for any liftOver track under **Pairwise alignments** >
**liftOver**, which for hg38 covers everything from chimp and mouse to
zebrafish. The one thing that changes is how much of the chain survives: a close
comparison like hs1 or panTro6 gives long collinear blocks, while a distant one
gives short scattered ones, and the launch dialog's CIGAR option matters more
the more diverged the pair is.

## See also

- [Synteny visualization](/docs/tutorials/synteny_visualization) for loading
  your own alignments and configuring the views
- [Linear synteny view](/docs/user_guides/linear_synteny_view)
- [Dotplot view](/docs/user_guides/dotplot_view)
