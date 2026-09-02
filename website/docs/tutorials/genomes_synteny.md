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

## Where the data comes from

genomes.jbrowse.org's own hosted configs for the three genomes this page
compares, each already carrying UCSC's pairwise liftOver chains to the others.

- hg38: https://jbrowse.org/ucsc/hg38/config.json
- Human (hs1, T2T-CHM13): https://jbrowse.org/ucsc/hs1/config.json
- Chimp (panTro6), for [Trying other pairs](#trying-other-pairs):
  https://jbrowse.org/ucsc/panTro6/config.json

## The hosted configs

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a config for every UCSC
genome, each carrying UCSC's pairwise liftOver alignments to the others. This
page compares hg38 against T2T-CHM13 (hs1) at _TNNT3_, a locus the two lay out
differently.

## Opening a liftOver track

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org), find **Pairwise
alignments** → **liftOver** in the track selector and turn on **hg38 to Human
(hs1) liftOver**. Type `TNNT3` into the location box; the hosted config ships a
name index.

The hg38 config declares only hg38. A track referencing an assembly JBrowse does
not know is resolved through the `Core-handleUnrecognizedAssembly` extension
point, where the site's hub plugin supplies the mate genome's config.

In a plain linear genome view the liftOver track draws one feature per chain
block, laid out in rows.

## Launching a synteny view

Right-click any chain block and choose **Launch synteny view for this
position**. The dialog frames the second panel. **Use CIGAR to map the current
visible region to the target** walks the alignment to find the interval matching
what is in view; the chain through _TNNT3_ spans the chromosome, so unticked it
frames both panels on all of chromosome 11. A reverse-strand block adds
**Horizontally flip inverted targets**, ticked by default.

**Open in new view** appends the result below the linear view; **Replace current
view** puts it in that view's place.

<Video src="/media/synteny/liftover_launch.mp4" caption="Launching from a chain block on the hg38 to Human (hs1) liftOver track at TNNT3: the block's right-click menu, the dialog that frames the second panel, and Replace current view putting the two-panel synteny view in the linear view's place. The hg38 panel arrives carrying the gene track that was open above; the hs1 panel arrives empty." />

The panel you launched from keeps the tracks that view had on (**Copy this
view's tracks into its panel** turns that off). The hs1 panel opens empty; the
view header's track selector button lists one selector per panel.

A locus no single chain block covers takes a second route: drag-select it on the
scale bar and pick **Launch → Linear synteny view**, whose dialog offers every
assembly the session's synteny datasets align to it. See
[the linear synteny view guide](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

## Ribbon display settings

Two settings live in the synteny view's settings menu, the sliders button in its
header:

- **Curved lines** draws each ribbon as a curve, easier to follow across a gap
- **CIGAR indels** → **Transparent indels** leaves insertions and deletions
  inside each block as see-through gaps

The palette button in the same header sets what ribbons are colored by.
**Strand** paints each block by its orientation, and is what the figures below
use.

<Figure src="/img/genomes_synteny/ribbon_settings.png" links="As it opens=genomes_synteny/ribbons_default,Curved + transparent indels=genomes_synteny/ribbons_curved" caption="The same TNNT3 comparison before and after both settings, with the menu that holds them open on top. Top: straight ribbons with colored indels. Bottom: curved ribbons with transparent indels." />

## The TNNT3 rearrangement

_TNNT3_ is the locus from Fig 5C of the T2T human variation paper. Against
GRCh38 the region reads as an inversion plus a deletion that ablates _LINC01150_
in every individual; against T2T-CHM13 that segment is intact on the other side
of _TNNT3_ in the opposite orientation. Colored by strand, it is the one
off-color ribbon.

<Figure caption="hg38 (top) vs T2T-CHM13/hs1 (bottom) at TNNT3, colored by strand with curved ribbons and transparent indels. LINC01150 sits upstream of TNNT3 in hg38 and downstream of it in T2T-CHM13, and the purple ribbon is the segment that moved." src="/img/synteny_hg38_hs1_tnnt3.png" />

## Trying other pairs

The same click-path works for any track under **Pairwise alignments** →
**liftOver**, one per chain file UCSC publishes against the genome you are in. A
close pair gives long collinear blocks, a distant one short scattered ones.

The figure below is that route on **hg38 to Chimp (panTro6) liftOver**, across
an intron of _FTO_.

<Figure caption="The four steps on the hg38-to-panTro6 liftOver track across an FTO intron: right-click a chain block, confirm the framing, launch, then add the chimp panel's genes and repeats." src="/img/genomes_synteny/launch_sequence.png" />

Its last frame switches to curves and **Transparent indels**
([above](#ribbon-display-settings)), which turns the one gap into a hole lining
up against the RepeatMasker track. The element under it is an L1HS, the youngest
human LINE-1 subfamily, and the chimp panel has every other repeat in the window
but not that one.

The chimp panel's track selector offers **NCBI RefSeq - RefSeq All** and
**RepeatMasker**, brought in with the panTro6 hub. The rest of that hub loads
from **File → Open connection** as a JBrowse 2 hub at
`https://jbrowse.org/ucsc/panTro6/config.json`.

To start from a gene, the site's
[ortholog search](https://genomes.jbrowse.org/orthologs) lists a symbol's NCBI
orthologs among the hosted genomes, with a synteny view per row where an
alignment exists.

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [The T2T human variation paper](https://www.science.org/doi/10.1126/science.abl3533)
