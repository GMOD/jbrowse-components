---
title: Synteny on genomes.jbrowse.org
description:
  Open a UCSC liftOver track in a linear genome view and launch a synteny view
  from it
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** genomes.jbrowse.org already carries UCSC's pairwise liftOver
alignments for every genome, so you can turn one on in a linear genome view and
launch a two-panel linear synteny view from any chain block. No download and no
second assembly setup: JBrowse resolves the mate genome on demand.

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a ready-made JBrowse
config for every UCSC genome, and each one already carries UCSC's pairwise
liftOver alignments to the other genomes. Nothing to download, nothing to
convert, and no second install: any pair UCSC has a chain file for can be
compared in a couple of clicks, in a browser.

This tutorial compares hg38 against T2T-CHM13 (hs1) at _TNNT3_, a locus that
GRCh38 and T2T-CHM13 lay out differently.

## Opening a liftOver track

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org), then in the
track selector find **Pairwise alignments** → **liftOver** and turn on **hg38 to
Human (hs1) liftOver**. Type `TNNT3` into the location box to navigate to the
gene; the hosted config ships a name index, so gene symbols work without any
setup.

hs1 does not need to be added. The hg38 config declares only hg38, but when a
track references an assembly JBrowse does not know, it asks its plugins to
resolve the name (the `Core-handleUnrecognizedAssembly` extension point) and the
site's hub plugin supplies the config. Every liftOver track on the site works
this way, so none of them need a second assembly set up by hand.

The liftOver track is a synteny track, but in a plain linear genome view it
draws the way an alignments track does: one feature per chain block, laid out in
rows.

## Launching a synteny view

Right-click any chain block and choose **Launch synteny view for this
position**. The dialog that opens controls how the second panel is framed, and
its defaults suit the block you clicked. **Use CIGAR to map the current visible
region to the target** is the option to note: with it, JBrowse walks the
alignment to find the interval matching what is in view, rather than framing on
the whole block's endpoints. A reverse-strand block adds a second checkbox,
**Horizontally flip inverted targets**, ticked by default so the target panel
still reads left to right. **Submit** opens a two-panel synteny view on that
position, with the liftOver track drawn as ribbons between the panels.

<Figure caption="The three steps, from the hg38-to-mm39 liftOver track around SHH to the view it opens: 302 kb of human chr7 against the 311 kb of mouse chr5 it aligns to, ribbon per chain block. The launched view carries the chain track and nothing else, so each panel starts empty until you add its genes." src="/img/genomes_synteny/launch_sequence.png" />

Set the ribbon coloring to **Strand** from the palette button in the synteny
track header.

A locus that no single chain block covers (a gene that several blocks tile, or
one you have only navigated to) takes a second route: drag-select it on the
scale bar and pick **Launch → Linear synteny view**, whose dialog picks the
synteny dataset to read it from. This starts from the region rather than from a
block, and offers every assembly the session's synteny datasets align to it, so
use it when more than one liftOver track is on. See
[the linear synteny view guide](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

## Ribbon display settings

Two settings change how the ribbons read, both on the synteny view's **View
options** button:

- **Show...** → **Show curved lines** draws each ribbon as a curve instead of a
  straight shear, so a block that lands far from where it started is easier to
  follow across the gap.
- **CIGAR display mode** → **Transparent indels** stops painting the insertions
  and deletions inside each block, leaving them as see-through gaps. With strand
  coloring on, that keeps color meaning only one thing.

<Figure src="/img/genomes_synteny/ribbon_settings.png" links="As it opens=genomes_synteny/ribbons_default,Curved + transparent indels=genomes_synteny/ribbons_curved" caption="The same TNNT3 comparison before and after both settings, with the menu that holds them open on top. Top: straight ribbons with colored indels. Bottom: curved ribbons with transparent indels, where the indels drop out to white and the reverse-strand segment is a single blue sweep crossing the forward-strand pink." />

## The rearrangement

_TNNT3_ is the locus from Fig 5C of the T2T human variation paper. Called
against GRCh38 the region reads as a 24 kb inversion plus a 22 kb deletion that
ablates _LINC01150_ in every individual; against T2T-CHM13 that same 22 kb is
intact, just sitting on the other side of _TNNT3_ in the opposite orientation.
Colored by strand, that segment is the one off-color ribbon in the view.

<Figure caption="hg38 (top) vs T2T-CHM13/hs1 (bottom) at TNNT3, colored by strand with curved ribbons and transparent indels. LINC01150 sits upstream of TNNT3 in hg38 and downstream of it in T2T-CHM13, and the purple ribbon is the segment that moved." src="/img/synteny_hg38_hs1_tnnt3.png" />

## Trying other pairs

The same click-path works for any liftOver track under **Pairwise alignments** →
**liftOver**. The one thing that changes is how much of the chain survives: a
close comparison like hs1 or panTro6 gives long collinear blocks, while a
distant one gives short scattered ones, and the CIGAR option matters more the
more diverged the pair is. The site's
[synteny pair index](https://genomes.jbrowse.org/synteny) lists which pairs
exist.

## See also

- [Synteny visualization](/docs/tutorials/synteny_visualization) for loading
  your own alignments and configuring the views
- [Synteny from ortholog tables](/docs/tutorials/multiway_synteny) and
  [All-vs-all synteny](/docs/tutorials/allvsall_synteny) for stacking more than
  two genomes in one view
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [The T2T human variation paper](https://www.science.org/doi/10.1126/science.abl3533),
  whose Fig 5C is this locus
