---
title: Synteny on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (synteny)
description:
  Open a UCSC liftOver track in a linear genome view and launch a synteny view
  from it
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

genomes.jbrowse.org already carries UCSC's pairwise liftOver alignments for
every genome, so you can turn one on in a linear genome view and launch a
two-panel linear synteny view from any chain block. JBrowse resolves the mate
genome on demand, so the second assembly needs no setup.

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
- hg38's staging config, which adds the multi-way track for
  [Many genomes at once](#many-genomes-at-once):
  https://jbrowse.org/ucsc/hg38/config-staging.json

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

Right-click any chain block and choose **Launch → Linear synteny view with
\<assembly\>**. <!-- menu-path-ok --> The dialog frames the second panel. **Use
CIGAR to map the current visible region to the target** walks the alignment to
find the interval matching what is in view; the chain through _TNNT3_ spans the
chromosome, so unticked it frames both panels on all of chromosome 11. A
reverse-strand block adds **Horizontally flip inverted targets**, ticked by
default.

**Open in new view** appends the result below the linear view; **Replace current
view** puts it in that view's place.

<Video src="/media/synteny/liftover_launch.mp4" caption="Launching from a chain block on the hg38 to Human (hs1) liftOver track at TNNT3: the block's right-click menu, the dialog that frames the second panel, and Replace current view putting the two-panel synteny view in the linear view's place. The hg38 panel opens with the gene track that was open above; the hs1 panel opens empty." />

The panel you launched from keeps the tracks that view had on (**Copy this
view's tracks into its panel** turns that off). The hs1 panel opens empty; the
view header's track selector button lists one selector per panel.

For a locus no single chain block covers, drag-select it on the scale bar and
pick **Launch → Linear synteny view**, whose dialog offers every assembly the
session's synteny datasets align to it. See
[the linear synteny view guide](/docs/user_guides/linear_synteny_view#from-a-locus-you-are-already-looking-at).

## Ribbon display settings

Two settings live in the synteny view's settings menu, the sliders button in its
header:

- **Curved lines** draws each ribbon as a curve, easier to follow across a gap
- **CIGAR indels** → **Transparent indels** leaves insertions and deletions
  inside each block as see-through gaps

The palette button in the same header sets what ribbons are colored by.
**Strand** paints each block by its orientation; the figures below use it.

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

The figure's last step switches to curves and **Transparent indels**
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

## Many genomes at once

A liftOver track pairs hg38 with one other genome. hg38's staging config adds
one track over all of hg38's liftOver chains, **hg38 vs 240 genomes (liftOver,
multi-way)**, which draws hg38 on top and a lane per genome below it, each lane
with that genome's own gene models. The track is on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org) only until
JBrowse 5 ships, since no released JBrowse has the display it opens in.

The way into the multi-way track starts from a gene. Open
[the TNNT3 gene page](https://staging.genomes.jbrowse.org/gene/?gene=TNNT3) and
scroll to **Conserved gene order**, which draws the genes around _TNNT3_ in the
80 species nearest human. **☰ Multi-way synteny lanes** at the top of that
figure opens the track over the same hg38 window, with a lane for each of those
species the track holds.

<Figure src="/img/genomes_synteny/star_link.png" caption="The TNNT3 gene page on staging.genomes.jbrowse.org at its Conserved gene order section, with the Multi-way synteny lanes link boxed." />

26 of the 80 species get a lane, since the track holds only genomes UCSC
publishes a liftOver chain to. Where a row's own assembly has no chain, its lane
is the newest build of that species that does. **[rev]** after a lane's
coordinates marks a genome drawn reversed so that it reads in hg38's
orientation.

<Figure src="/img/genomes_synteny/star_lanes.png" caption="The view the link opens: hg38 at TNNT3 over 26 genomes. In every lane that names them, the genes around TNNT3 read in hg38's order, SYT8 to MRPL23; the platypus lane spreads over ten sequences and names none of them." />

Each lane reads the same chain file as that genome's pairwise liftOver track, so
the one view holds what 26 synteny views would. The ribbons between two lanes
below hg38 pass through hg38, since each chain aligns its genome to hg38 alone.
[Reading the stack](/docs/tutorials/hg38_vertebrates_synteny#reading-the-stack)
covers the lane labels, the ribbons and the lane menus.

## Choosing the lanes: mouse strains at Nnt

A star holds every genome UCSC lifts its reference over to, so which lanes open
is a choice. mm39's star holds the Mouse Genomes Project strains, and mm39 is
C57BL/6J, the strain that lost _Nnt_ exons 7 to 11 (Freeman et al. 2006). We'll
open the strain lanes at that gene:

- open
  [mm39 on staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/ucsc/mm39/)
  and turn on **mm39 vs 76 genomes (liftOver, multi-way)** under **Pairwise
  alignments**
- type `Nnt` into the location box
- in the track menu, **Lanes → Choose lanes...**, type `house mouse` into the
  filter and tick the strains, the C57BL/6J T2T assembly among them

<Figure src="/img/genomes_synteny/mouse_strains_nnt.png" caption="mm39 at Nnt over Mus strain assemblies, the C57BL/6J T2T assembly first. Every other lane opens a gap under the middle of the gene, the sequence the reference strain lacks, and the T2T assembly of that same strain runs straight." />

## One person's two haplotypes at 17q21.31

hg38's star holds both haplotypes of the H9 T2T assembly, so a stack can put one
person's two chromosomes under the reference. At 17q21.31 the H2 haplotype is a
900 kb inversion (Stefansson et al. 2005), and H9 carries one of each. Open
hg38's star at `chr17:45,300,000-46,800,000` and choose the two H9 haplotypes,
the HG002 maternal assembly, the NA24631 maternal assembly and T2T-CHM13 (hs1)
as lanes.

<Figure src="/img/genomes_synteny/human_17q21_haplotypes.png" caption="hg38 from MAPT to NSF over five T2T haplotypes. The H9 hap2 lane crosses the lane above it across the inversion and runs straight either side of it; the other four haplotypes run straight throughout." />

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/user_guides/dotplot_view)
- [The T2T human variation paper](https://www.science.org/doi/10.1126/science.abl3533)

## References

- Freeman HC, Hugill A, Dear NT, Ashcroft FM, Cox RD. Deletion of nicotinamide
  nucleotide transhydrogenase: a new quantitive trait locus accounting for
  glucose intolerance in C57BL/6J mice. Diabetes (2006).
  https://doi.org/10.2337/db06-0358
- Stefansson H, et al. A common inversion under selection in Europeans. Nat
  Genet (2005). https://doi.org/10.1038/ng1508
