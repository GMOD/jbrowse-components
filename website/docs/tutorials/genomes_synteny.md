---
title: Synteny on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (synteny)
description:
  Open a UCSC liftOver track in a linear genome view and launch a synteny view
  from it
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
data: hosted
---

**TL;DR:** genomes.jbrowse.org already carries UCSC's pairwise liftOver
alignments for every genome, so you can turn one on in a linear genome view and
launch a two-panel linear synteny view from any chain block. JBrowse resolves
the mate genome on demand, so the second assembly needs no setup.

## Prerequisites

- nothing to install: this is a click-path through a hosted site, and no data,
  config or second assembly is prepared by hand

## The hosted configs

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a ready-made JBrowse
config for every UCSC genome, and each one already carries UCSC's pairwise
liftOver alignments to the other genomes, so any pair UCSC has a chain file for
can be compared in a couple of clicks.

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
the whole block's endpoints. On a close pair that is the whole difference: the
chain running through _TNNT3_ spans the chromosome, so with the box unticked
both panels open on the whole of chromosome 11. A reverse-strand block adds
another checkbox, **Horizontally flip inverted targets**, ticked by default so
the target panel still reads left to right.

The dialog then offers two ways out, both building the same view. **Open in new
view** appends it below the linear view you launched from; **Replace current
view** puts it in that view's place, which is usually what you want here, since
the synteny view opens on the locus the linear view is already showing.

<Video src="/media/synteny/liftover_launch.mp4" caption="Launching from a chain block on the hg38 to Human (hs1) liftOver track at TNNT3: the block's right-click menu, the dialog that frames the second panel, and Replace current view putting the two-panel synteny view in the linear view's place. The hg38 panel arrives carrying the gene track that was open above; the hs1 panel arrives empty." />

The panel for the assembly you launched from opens with the tracks that view had
on, and **Copy this view's tracks into its panel** in the dialog turns that off.
The hs1 panel opens empty, and its tracks come from its own track selector,
whose button in the view header lists one per panel.

A locus that no single chain block covers (a gene that several blocks tile, or
one you have only navigated to) takes a second route: drag-select it on the
scale bar and pick **Launch → Linear synteny view**, whose dialog picks the
synteny dataset to read it from. This starts from the region rather than from a
block, and offers every assembly the session's synteny datasets align to it, so
use it when more than one liftOver track is on. See
[the linear synteny view guide](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

## Ribbon display settings

Three settings change how the ribbons read. Two are in the synteny view's
settings menu, the sliders button in its header:

- **Curved lines**, ticked, draws each ribbon as a curve instead of a straight
  shear, so a block that lands far from where it started is easier to follow
  across the gap.
- **CIGAR indels** → **Transparent indels** stops painting the insertions and
  deletions inside each block, leaving them as see-through gaps. With strand
  coloring on, that keeps color meaning only one thing.

The third is the palette button further along the same header, whose menu sets
what every ribbon is colored by. **Strand** paints each block by the orientation
it landed in, and is the setting the TNNT3 figures below use.

<Figure src="/img/genomes_synteny/ribbon_settings.png" links="As it opens=genomes_synteny/ribbons_default,Curved + transparent indels=genomes_synteny/ribbons_curved" caption="The same TNNT3 comparison before and after both settings, with the menu that holds them open on top. Top: straight ribbons with colored indels. Bottom: curved ribbons with transparent indels." />

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
more diverged the pair is. That **liftOver** category is itself the index of
which pairs exist, since there is one track in it per chain file UCSC publishes
against the genome you are in.

The figure below is that route on **hg38 to Chimp (panTro6) liftOver**, across
an intron of _FTO_, and its clicks are the ones in the clip above.

<Figure caption="The four steps on the hg38-to-panTro6 liftOver track across an FTO intron: right-click a chain block, confirm the framing, launch, then add the chimp panel's genes and repeats." src="/img/genomes_synteny/launch_sequence.png" />

Its last frame switches the ribbon to curves and to **Transparent indels**, both
covered [above](#ribbon-display-settings), which turns the one gap in it into a
hole that lines up against the RepeatMasker track over it. The element under it
is an L1HS, the youngest human LINE-1 subfamily, and the chimp panel keeps every
other repeat in the window but not that one.

The chimp panel's own track selector offers **NCBI RefSeq - RefSeq All** and
**RepeatMasker**, because naming panTro6 also brought in the panTro6 hub's gene,
repeat and gap tracks. The rest of that hub is not loaded with them; open it
from **File → Open connection** as a JBrowse 2 hub at
`https://jbrowse.org/ucsc/panTro6/config.json` when you want its conservation or
expression tracks too.

To come at it from a gene rather than from a pair of assemblies, the site's
[ortholog search](https://genomes.jbrowse.org/orthologs) takes a gene symbol and
lists its NCBI orthologs among the hosted genomes, with a synteny view per row
wherever the two assemblies have an alignment.

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [The T2T human variation paper](https://www.science.org/doi/10.1126/science.abl3533)
