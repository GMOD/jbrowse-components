---
title: Synteny on genomes.jbrowse.org
description:
  Open a UCSC liftOver track in a linear genome view and launch a synteny view
  from it
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a ready-made JBrowse
config for every UCSC genome, and each one already carries UCSC's pairwise
liftOver alignments to the other genomes. Nothing to download, nothing to
convert, and no second install: any pair UCSC has a chain file for can be
compared in a couple of clicks, in a browser.

This tutorial compares hg38 against T2T-CHM13 (hs1) at _TNNT3_, a locus that
GRCh38 and T2T-CHM13 lay out differently.

## Opening a liftOver track

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org), then in the
track selector find **Pairwise alignments** > **liftOver** and turn on **hg38 to
Human (hs1) liftOver**. Type `TNNT3` into the location box to navigate to the
gene; the hosted config ships a name index, so gene symbols work without any
setup.

You never had to add hs1. The hg38 config declares only hg38, but the moment a
track references an assembly JBrowse does not know, it asks its plugins to
resolve the name (the `Core-handleUnrecognizedAssembly` extension point) and the
site's hub plugin supplies the config. Every liftOver track on the site works
this way, which is why none of them need a second assembly set up by hand.

The liftOver track is a synteny track, but in a plain linear genome view it
draws the way an alignments track does: one feature per chain block, laid out in
rows.

<Figure caption="The hg38 to hs1 liftOver track under NCBI RefSeq genes at TNNT3. Each bar is one chain block, labeled with its score." src="/img/genomes_synteny/lgv_liftover.png" />

## Launching a synteny view

Right-click any chain block and choose **Launch synteny view for this
position**.

<Figure caption="The chain block context menu. The launch item is offered only once the mate assembly (hs1) has resolved." src="/img/genomes_synteny/launch_menu.png" />

The dialog that opens decides how the second panel is framed, and the defaults
are already right for the block you clicked. The one worth understanding is
**Use CIGAR to map the current visible region to the target**: with it, JBrowse
walks the alignment to find the interval that actually matches what you are
looking at, rather than framing on the whole block's endpoints.

<Figure caption="The launch dialog, opened from the inverted block. Horizontally flip target is already checked because the feature is reverse-strand on hs1." src="/img/genomes_synteny/launch_dialog.png" />

**Submit** opens a two-panel synteny view on that position, with the liftOver
track drawn as ribbons between the panels. Set the ribbon coloring to **Strand**
from the palette button in the synteny track header.

This is the payoff: _TNNT3_ is the locus from Fig 5C of the T2T human variation
paper. Called against GRCh38 the region reads as a 24 kb inversion plus a 22 kb
deletion that ablates _LINC01150_ in every individual; against T2T-CHM13 that
same 22 kb is intact, just sitting on the other side of _TNNT3_ in the opposite
orientation. Colored by strand, that segment is the one off-color ribbon in the
view.

<Figure caption="hg38 (top) vs T2T-CHM13/hs1 (bottom) at TNNT3, colored by strand. LINC01150 sits upstream of TNNT3 in hg38 and downstream of it in T2T-CHM13, and the purple ribbon is the segment that moved." src="/img/synteny_hg38_hs1_tnnt3.png" />

## Two settings worth changing

Both live on the synteny view's **View options** button:

- **Show...** > **Show curved lines** draws each ribbon as a curve instead of a
  straight shear, so a block that lands far from where it started is easier to
  follow across the gap.
- **CIGAR display mode** > **Transparent indels** stops painting the
  insertions and deletions inside each block, leaving them as see-through gaps.
  With strand coloring on, that keeps color meaning only one thing.

<Figure src="/img/genomes_synteny/ribbon_settings.png" links="As it opens=genomes_synteny/ribbons_default,Curved + transparent indels=genomes_synteny/ribbons_curved" caption="The same TNNT3 comparison before and after both settings. Top: straight ribbons with colored indels. Bottom: curved ribbons with transparent indels, where the indels drop out to white and the reverse-strand segment is a single blue sweep crossing the forward-strand pink." />

## Trying other pairs

The same click-path works for any liftOver track under **Pairwise alignments** >
**liftOver**. The one thing that changes is how much of the chain survives: a
close comparison like hs1 or panTro6 gives long collinear blocks, while a
distant one gives short scattered ones, and the CIGAR option matters more the
more diverged the pair is. The site's
[synteny pair index](https://genomes.jbrowse.org/synteny) lists which pairs
exist.

## See also

- [Synteny visualization](/docs/tutorials/synteny_visualization) for loading
  your own alignments and configuring the views
- [Linear synteny view](/docs/user_guides/linear_synteny_view)
- [Dotplot view](/docs/user_guides/dotplot_view)
- [The T2T human variation paper](https://www.science.org/doi/10.1126/science.abl3533),
  whose Fig 5C is this locus
