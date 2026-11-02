---
title: Synteny on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (synteny)
description:
  Open a UCSC liftOver track in a linear genome view and launch a synteny view
  from it
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

Comparing two genomes starts from an alignment between them, and for mammals
that takes hours to compute. UCSC has already aligned each genome it hosts to
many others as liftOver chains, and genomes.jbrowse.org serves those chains as
tracks beside each genome. We compare human with the T2T human reference at
_TNNT3_, with chimp at an _FTO_ intron, with mouse strains at _Nnt_, and one
person's two haplotypes at the 17q21.31 inversion. We:

- turn on a liftOver track and launch a linear synteny view from one of its
  chain blocks
- set the synteny view's ribbons to curves with transparent indels, and color
  them by strand
- launch hg38 against chimp and add the chimp panel's tracks
- turn on a multi-way liftOver track and choose which genomes become its lanes
- reorder the lanes to put one person's two haplotypes side by side

## Opening a liftOver track

We'll start on hg38, where the track selector lists one liftOver track per
genome UCSC aligned hg38 to:

- open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org)
- in the track selector, under **Pairwise alignments** → **liftOver**, turn on
  **hg38 to Human (hs1) liftOver**
- type `TNNT3` into the location box, which searches the hosted name index

The liftOver track draws one feature per chain block. The hg38 config declares
one assembly, and the site loads the other genome's config when a track names
it.

## Launching a synteny view

Right-click any chain block and choose **Launch → Linear synteny view with
\<assembly\>**. <!-- menu-path-ok --> The dialog frames the second panel:

- **Use CIGAR to map the current visible region to the target** finds, from the
  alignment, the interval in the other genome that matches what is in view. The
  chain through _TNNT3_ spans the chromosome, so with the box unticked both
  panels frame all of chromosome 11.
- **Horizontally flip inverted targets** (ticked by default) appears for a
  reverse-strand block.
- **Open in new view** appends the result below the linear view, and **Replace
  current view** puts it in that view's place.
- **Copy this view's tracks into its panel** sets whether the panel you launched
  from keeps the tracks that view had on.

<Video src="/media/synteny/liftover_launch.mp4" caption="Launching from a chain block on the hg38 to hs1 liftOver track at TNNT3: the right-click menu, the framing dialog, and Replace current view." />

For a locus no single chain block covers, drag-select it on the scale bar and
pick **Launch → Linear synteny view**, whose dialog offers every assembly the
session's synteny datasets align to it. See
[the linear synteny view guide](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

## Ribbon display settings

The synteny view's settings menu, the sliders button in its header, holds two
ribbon settings:

- **Curved lines** draws each ribbon as a curve, easier to follow across a gap
- **CIGAR indels** → **Transparent indels** leaves insertions and deletions
  inside each block as see-through gaps

<Figure src="/img/genomes_synteny/ribbon_settings.png" links="As it opens=genomes_synteny/ribbons_default,Curved + transparent indels=genomes_synteny/ribbons_curved" caption="The TNNT3 comparison before and after the two ribbon settings, with their menu open on top." />

## The TNNT3 rearrangement by strand

_TNNT3_ is the locus of Fig 5C in Aganezov et al. (2022). Against GRCh38 the
region reads as an inversion plus a deletion that removes the long noncoding RNA
_LINC01150_ in every individual. The palette button in the view header sets the
view's `encoding.color`, a color scale that maps a field to colors. Pick
**Strand** there, and the segment that moved is the one ribbon in the second
color.

<Figure caption="hg38 (top) against hs1 (bottom) at TNNT3, colored by strand, with LINC01150 shaded in each." src="/img/synteny_hg38_hs1_tnnt3.png" />

## Launching hg38 against chimp at an FTO intron

The same launch works from any track under **Pairwise alignments** →
**liftOver**. We'll repeat it against chimp and add tracks to the chimp panel:

- turn on **hg38 to Chimp (panTro6) liftOver**
- type `chr16:54,036,000-54,054,000`, an intron of _FTO_, into the location box
- right-click a chain block and launch a synteny view
- in the chimp panel's track selector, turn on **NCBI RefSeq - RefSeq All** and
  **RepeatMasker**, which come with the panTro6 hub
- set curves and **Transparent indels** as [above](#ribbon-display-settings)

<Figure caption="Launching from the hg38-to-panTro6 liftOver track: right-click a chain block, confirm the framing, launch, then add the chimp panel's tracks." src="/img/genomes_synteny/launch_sequence.png" />

With transparent indels, the one gap in the ribbon is a hole that lines up with
a RepeatMasker element on hg38. The chimp panel lacks that element and has every
other repeat in the window. The rest of the panTro6 hub loads from **File → Open
connection...** as a JBrowse 2 hub at
`https://jbrowse.org/ucsc/panTro6/config.json`.

A chain or PAF of your own launches the same way once it is added as a synteny
track: [HG002 haplotypes](/docs/tutorials/hg002_haplotypes) loads a chain, and
[Synteny (pairwise minimap2)](/docs/tutorials/synteny_visualization) aligns two
genomes and loads the PAF.

To start from a gene, the site's
[ortholog search](https://genomes.jbrowse.org/orthologs) lists a symbol's NCBI
orthologs among the hosted genomes, with a synteny view per row where an
alignment exists.

## Stacking many genomes under hg38 in one multi-way track {#many-genomes-at-once}

A liftOver track pairs hg38 with one other genome. To compare many genomes at
once, hg38's staging config also has **hg38 vs 242 genomes (liftOver,
multi-way)**, one track over all of hg38's liftOver chains, which draws hg38 on
top and a lane per genome below. It is on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org) until JBrowse
5 ships. Open hg38 there, type `TNNT3` into the location box and turn the track
on.

The
[TNNT3 conserved gene order page](https://staging.genomes.jbrowse.org/conserved-gene-order/?gene=TNNT3&ref=9606)
opens the same window across its genomes with **Open TNNT3 in JBrowse across 12
genomes**.

<Figure src="/img/genomes_synteny/star_link.png" caption="The TNNT3 conserved gene order page, with its JBrowse link boxed." />

The track has a lane for each genome UCSC publishes a liftOver chain to, too
many to read at once. In its track menu:

- pick **Lanes → Choose lanes...** and tick chimp, orangutan, rhesus, gray mouse
  lemur, Chinese tree shrew, naked mole-rat, elephant and platypus, a span from
  the apes to the monotremes
- leave the ribbons on their default color, **Color by → Strand** under
  **Ribbons**: red where the two lanes a ribbon joins run the same way, blue
  where one is inverted against the other

<Figure src="/img/genomes_synteny/star_lanes.png" caption="hg38 at TNNT3 over genomes from chimp to platypus, ribbons colored by strand." />

[The multi-way synteny display guide](/docs/user_guides/multiway_synteny_display)
covers the lane labels, `[rev]`, the ribbons and the lane menus.
[Synteny (liftOver lanes, vertebrates)](/docs/tutorials/hg38_vertebrates_synteny)
builds the same kind of track from chains you choose.

## Choosing which mouse strains become lanes at Nnt

The same lane choice compares strains within one species. mm39 is C57BL/6J, the
strain that lost _Nnt_ exons 7 to 11 (Freeman et al. 2006), and its multi-way
liftOver track holds the Mouse Genomes Project strains. We'll open the strain
lanes at that gene:

- open
  [mm39 on staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/ucsc/mm39/)
  and turn on **mm39 vs 76 genomes (liftOver, multi-way)** under **Pairwise
  alignments**
- type `Nnt` into the location box
- in the track menu, pick **Lanes → Choose lanes...**, type `house mouse` into
  the filter and tick the strains, the C57BL/6J T2T assembly among them

<Figure src="/img/genomes_synteny/mouse_strains_nnt.png" caption="mm39 at Nnt over the Mus assemblies the track holds, the C57BL/6J T2T assembly first." />

## Comparing one person's two haplotypes at the 17q21.31 inversion

Dragging a lane's label moves it up or down the stack. hg38's multi-way track
holds both haplotypes of the H9 T2T assembly, so a stack can put one person's
two chromosomes under the reference. At 17q21.31 the H2 haplotype is a 900 kb
inversion (Stefansson et al. 2005), and H9 has one of each. On hg38 at
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org), turn on
**hg38 vs 242 genomes (liftOver, multi-way)**, type
`chr17:45,300,000-46,800,000` into the location box, then in the track menu:

- pick **Lanes → Choose lanes...** and tick the two H9 haplotypes, the HG002
  maternal assembly, the NA24631 maternal assembly and T2T-CHM13 (hs1)
- drag the H9 hap2 lane's label to the top of the stack, beside hg38
- turn off **Show → Gene labels**, since the RefSeq track above names the genes

<Figure src="/img/genomes_synteny/human_17q21_haplotypes.png" caption="hg38 from MAPT to NSF over five T2T haplotypes, ribbons colored by strand. The H9 hap2 lane's ribbons turn blue, and its header names the inversion." />

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/agent_synteny)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)

## Citations

- Aganezov et al. (2022).
  [A complete reference genome improves analysis of human genetic variation](https://doi.org/10.1126/science.abl3533)
- Freeman et al. (2006).
  [Deletion of nicotinamide nucleotide transhydrogenase: a new quantitive trait locus accounting for glucose intolerance in C57BL/6J mice](https://doi.org/10.2337/db06-0358)
- Stefansson et al. (2005).
  [A common inversion under selection in Europeans](https://doi.org/10.1038/ng1508)
