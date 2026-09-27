---
title: 'Pangenome (HPRC): browsing the graph'
sidebar_label: Pangenome (HPRC 1, browsing)
description:
  Open HPRC release 2's pangenome graph from genomes.jbrowse.org as a track of
  the linear view, move it along a chromosome, follow one allele to the
  haplotype that carries it, and read how many kringle copies eight haplotypes
  carry in LPA
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A pangenome graph records what a set of genomes share and where they diverge, so
sequence that one person carries and the reference lacks is an object in the
file. The Human Pangenome Reference Consortium's release 2 builds 464 human
haplotypes into one such graph, and we open it from the consortium's page on
genomes.jbrowse.org as a track of a linear view of GRCh38, where it moves with
the view. We:

- at MHC class II, read the graph's backbone, bubbles, alleles and edges
- follow one allele back to the haplotype that carries it
- at LPA, read how many copies of the kringle repeat eight haplotypes carry

[Part 2](/docs/tutorials/pangenome_hprc_part2) reads who carries each allele
across the release, and [part 3](/docs/tutorials/pangenome_hprc_part3) draws
haplotypes against each other.

:::caution Experimental

The graph view is a beta plugin, and the HPRC page lives on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/)
until JBrowse 5 ships. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, which every launch from the HPRC page loads, so
  the route installs nothing
- to open the same graph in your own JBrowse,
  [hosting your own graph](/docs/tutorials/pangenome_prepare_graph) loads the
  plugin and builds the files

## Where the data comes from

The data is [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), which
JBrowse reads through small tabix projections of its graph that we host.

- the SV-resolution graph (`sv.gfa`) the projections are cut from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt
- the config every launch on the HPRC page opens, which declares every release 2
  haplotype as an assembly with its CAT gene annotation:
  https://jbrowse.org/pangenome/hprc-grch38/config.json
- the base-level graph as a gbz-base database, one walk per haplotype, read by
  range request:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- our companion index naming that database's haplotypes:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db

## The HPRC page

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc). Each
row of its **Loci** table ends in launches: **graph**, **variants**,
**haplotypes** and **gene hub**.

<Figure caption="The HPRC page: the whole-chromosome links, then the head of the Loci table, where each row ends in its launches. The RHD / RHCE and SMN1 / SMN2 rows open only the callset and the gene hub. The boxed link is the graph launch the next step takes." src="/img/pangenome/genomes_hprc_loci.png" />

Press **graph** on the HLA / MHC row. JBrowse opens on
`chr6:32,510,001-32,600,000`, the MHC class II window.

<Figure caption="The graph launch at MHC class II: RefSeq genes, bubbles and the allele inventory over the graph track, anchored on the view's coordinates, colored by reference position with alleles in charcoal." src="/img/pangenome/genomes_hprc_mhc_graph.png" />

## Reading the cut

The graph opens anchored, every x a GRCh38 coordinate:

- the **backbone** is GRCh38's path, along the top row
- a **bubble** is a place where haplotypes disagree
- an **allele** is sequence a haplotype carries in place of the reference, a
  node in a lower row
- an **edge** is a deletion, a dashed jump over the segments it skips

Hover a node for its length and **rank**, the lower row it sits in. Nodes are
colored by reference position, red to magenta; an allele has none, so it draws
in charcoal.

## The graph moves with the view

Type the C4 window, `chr6:31,980,000-32,050,000`, into the location box and
press Enter. The graph track cuts the new window, and scrolling or zooming moves
it with the lanes above.

Open the graph track's menu and pick **Layout → Force-directed layout**, which
draws the graph by its shape, in coordinates fitted to the track.

<Figure caption="The C4 locus cut as a force-directed graph, the bottom track under the hg38 genes for the same window, colored by reference position. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips one whole copy of the tandem C4-CYP21-TNX module." src="/img/pangenome/hprc_graph_anatomy.png" />

The arc in the labelled bubble is the edge: a haplotype with one fewer C4 copy
takes it straight past GRCh38's, and the renderer labels the arc with the bp it
removes.

## A chromosome and back

Pick **Layout → Anchored** again and type `chr6` into the location box. Past a
zoom named in the adapter's `coarse` slot, the graph switches to one node per
bubble, so the whole chromosome draws; the lanes above show a zoom-in message at
this width.

Type the MHC class II window, `chr6:32,510,001-32,600,000`, to come back and
cross back to segments.
[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
tier and writes the `coarse` slot.

<Video src="/media/pangenome/hprc_browse.mp4" caption="HPRC release 2 from the HPRC page: the HLA / MHC graph launch, the graph track moving with the view to C4, out to the bubble tier across chromosome 6 and back to MHC class II, and one allele highlighted in hg38 and opened on the haplotype that contributed it." />

## From an allele to its haplotype

Back at MHC class II, find the allele under _HLA-DRB5_: a charcoal node in a
lower row, 1.8 kb long, hanging across 12 kb of backbone. Right-click it and
take **Highlight in hg38**. A band appears in the linear view across the 12 kb
the allele attaches over, covering most of _HLA-DRB5_.

<Figure caption="The MHC class II cut drawn both ways under the same tracks, colored by reference position with alleles in charcoal. Left, force-directed, with the allele's right-click menu open on Highlight in hg38 and its band in the linear view. Right, anchored: each x a GRCh38 coordinate, the reference row on top, each lower row one rank, and the ringed dashed arc a deletion." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Now left-click the same node. Its details give `contributingHaplotype`,
`NA20809#2`, and the node's menu offers **Open in NA20809.2**. Take it. A second
linear view opens below the first, on that haplotype's chromosome 6, framed on
the allele with its CAT gene annotation. Zoom out a few steps for the genes
around it.

<Figure caption="The same launch in two frames. First, the MHC class II cut with the NA20809.2 allele ringed and its right-click menu open on Open in NA20809.2. Second, the view that entry opens: NA20809 haplotype 2's chromosome 6 with its CAT genes, which put HLA-DRB9 and HLA-DRB6 either side of the allele and no HLA-DRB5 at all." src="/img/pangenome/hprc_haplotype_launch.png" />

## The LPA kringle repeat

_LPA_ carries a tandem array of kringle IV type 2 (KIV-2) copies, tied to
lipoprotein(a) levels, a heart-disease risk factor (Schmidt et al. 2016). Type
the LPA window, `chr6:160,525,000-160,655,000`, and pick **Layout →
Force-directed layout** from the graph track's menu.

<Figure caption="The LPA window with the RefSeq genes, UniProt's kringle domains and the HPRC bubbles above the force-directed graph track. The kringle array is the knot of loops in the middle, haloed and labelled as a repeat array, and LPA is pinned under the backbone with its exons along it." src="/img/pangenome/hprc_lpa_kiv2.png" />

Every loop in the knot is a different number of copies. Click the array's purple
label to lay the bubble's segments out alone, with a button back to the window.
This rGFA cut records only segments and links, so which haplotype takes which
loop stays unanswered here.

## One haplotype's copies

A **walk** is one haplotype's route through the graph, and the release publishes
one per haplotype as a gbz-base database. Type the array's own window,
`chr6:160,616,002-160,646,753`, put the rGFA graph track back to a segments lane
with **Display types → Feature display**, and turn the gbz-base track on from
the track selector. **Display types → Graph** in its track menu then cuts that
same track as a graph of the walks. Enter the eight lanes the track drew in the
**Haplotypes** field of **Settings**,
`HG00097.1, HG00099.1, HG00128.1, HG00133.1, HG01109.1, HG01123.1, HG01960.1, HG02055.1`,
and pick **Layout → Force-directed layout**.

A node draws thicker the more walks carry it (Bandage's depth as width), so the
shared backbone is the thick line and one haplotype's own copies are the thin
loops. Untick **Mark bubbles** so the per-route chips stop stacking, then pick
`HG00133` under **Walk**: its route keeps its ink while everything else fades,
and a readout gives its length against the reference walk.

<Figure caption="The eight-haplotype KIV-2 cut under the same window's genes, bubbles and rGFA segments, with HG00133 picked under Walk. The labelled loop is copies HG00133 walks and GRCh38 does not, its links drawn dark, and the readout states the walk's excess over GRCh38." src="/img/pangenome/graph_kiv2_walks.png" />

Pick **Layout → Walk rows** and **Color → Uniform**: each walk becomes a bar,
longest first, blue where GRCh38 carries the same sequence and purple where it
does not, so the copies a haplotype adds read as its purple stretch.

<Figure caption="The eight-haplotype KIV-2 cut in walk rows, one bar per haplotype under GRCh38's, longest first, under LPA with the KIV-2 bubble boxed in the bubbles lane. The purple stretch of each bar is kringle copies GRCh38 does not carry, and each readout gives the walk's length and its excess over GRCh38." src="/img/pangenome/graph_kiv2_walk_rows.png" />

## Check it against the bubble index

Click the KIV-2 bubble boxed in the last figure. Its details give
`shortestAlleleLength` and `longestAlleleLength`, the shortest and longest
routes the rGFA holds there. Every bar in walk rows falls between them, and
GRCh38's, with no purple, is the shortest of the nine.

## See also

- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_hprc_part5)
- [](/docs/tutorials/pangenome_prepare_graph)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_cattle)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release this
  page opens: the Minigraph-Cactus graph and the assemblies it was built from.
- Li H.
  [The rGFA format](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) and
  [gfatools](https://github.com/lh3/gfatools), which define the `SN`/`SO`/`SR`
  tags this page opens the graph by.
- Schmidt K, Noureen A, Kronenberg F, Utermann G. Structure, function, and
  genetics of lipoprotein(a). J Lipid Res. 2016;57(8):1339-1359.
  https://doi.org/10.1194/jlr.R067314
- Wick RR, Schultz MB, Zobel J, Holt KE. Bandage: interactive visualization of
  de novo genome assemblies. Bioinformatics. 2015;31(20):3350-3352.
  https://doi.org/10.1093/bioinformatics/btv383
