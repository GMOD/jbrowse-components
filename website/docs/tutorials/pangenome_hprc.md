---
title: 'Pangenome (HPRC): browsing the graph'
sidebar_label: Pangenome (HPRC 1, browsing)
description:
  Open HPRC release 2's pangenome graph from genomes.jbrowse.org, move it along
  a chromosome from the linear view, follow one allele to the haplotype that
  carries it, and read how many kringle copies eight haplotypes carry in LPA
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A pangenome graph records what a set of genomes share and where they diverge, so
sequence that one person carries and the reference lacks is an object in the
file. The Human Pangenome Reference Consortium's release 2 builds 464 human
haplotypes into one such graph. We open it at the MHC class II locus from the
consortium's page on genomes.jbrowse.org, where it draws under a linear view of
GRCh38 and moves when that view moves. We then follow one allele back to the
haplotype that carries it, and read how many copies of the LPA kringle repeat
eight haplotypes carry. [Part 2](/docs/tutorials/pangenome_hprc_part2) reads who
carries each allele across the release, and
[part 3](/docs/tutorials/pangenome_hprc_part3) draws haplotypes against each
other.

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
- the KIV-2 bubble cut from the base-level graph for GRCh38 and eight
  haplotypes, with their walks:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.kiv2.eight-haplotypes.gfa

## The HPRC page

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc). Under
a row of whole-chromosome links, the **Loci** table gives each locus its gene
cluster, the kind of variation it is known for and its GRCh38 region, and ends
the row in its launches: **graph**, **variants**, **haplotypes** and **gene
hub**. RHD / RHCE, SMN1 / SMN2 and CYP2D6 have no graph launch, because
minigraph merges their near-identical copies onto one path.

<Figure caption="The HPRC page: the whole-chromosome links, then the head of the Loci table, where each row ends in its launches. The RHD / RHCE and SMN1 / SMN2 rows open only the callset and the gene hub. The boxed link is the graph launch the next step takes." src="/img/pangenome/genomes_hprc_loci.png" />

Press **graph** on the HLA / MHC row. JBrowse opens in a new tab on
`chr6:32,510,001-32,600,000`, the MHC class II window, in two panels. The linear
view above holds the RefSeq genes, the graph's bubbles, its allele inventory and
its rGFA segments, one block per graph segment. The panel below draws the same
window as a graph.

<Figure caption="The graph launch at MHC class II: RefSeq genes, bubbles, the allele inventory and the rGFA segments above, and the same window below as an anchored graph, its backbone under the linear view's coordinates, colored by reference position with alleles in charcoal." src="/img/pangenome/genomes_hprc_mhc_graph.png" />

## Reading the cut

The graph opens in the anchored layout, where every x is a GRCh38 coordinate.
Four words describe the drawing:

- the **backbone** is GRCh38's own path through the graph, the chain of segments
  along the top row
- a **bubble** is a place where that chain opens out and closes again, at one
  locus where haplotypes disagree; each bubble in the hosted bubble index draws
  as a halo along its nodes, labelled with what kind of variation it is
- an **allele** is a stretch of sequence some haplotype carries in place of the
  reference, drawn as a node in a lower row, hanging below the point it attaches
  at
- a deletion is an **edge**, a dashed jump along the top row from one backbone
  segment to another, skipping the segments between them

Each lower row is one **rank**, the order in which minigraph added the assembly
that first contributed the sequence. Hover any node: the tooltip gives its
length and its rank, and rank 0 is the backbone. The hover also bands the node's
interval across the lanes above, and hovering a block in the segments lane
lights its node below.

Color ties the two panels together as well. The graph opens colored by
**Reference position**, red at the start of the window to magenta at its end,
and the segments lane above takes the same ramp. An allele sits on another
assembly's sequence and has no GRCh38 position, so it draws in charcoal.

The view draws the RefSeq genes onto the backbone too: exons as dark stretches
along the reference nodes that carry them, with each gene's name pinned under
the backbone. **View menu → Settings** turns off either layer, **Genes on the
backbone** or **Mark bubbles**.

## The graph follows the linear view

Type the C4 window, `chr6:31,980,000-32,050,000`, into the linear view's
location box and press Enter. The linear view moves half a megabase towards the
centromere and the graph cuts the new window under it. Scrolling or zooming the
linear view moves the graph with it, and the graph cuts again once the view
leaves the window it last cut.

Now pick **Force-directed layout** from the graph's **Layout** dropdown. The
force layout draws the graph by its shape, with no GRCh38 axis to line up with
the view above, so the graph stops following and the toolbar says why. **Pin**
in the same toolbar holds any layout where it is, and **Follow** hands it back.

<Figure caption="The C4 locus cut as a force-directed graph, under the hg38 genes and the rGFA segments for the same window, both colored by reference position. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips one whole copy of the tandem C4-CYP21-TNX module." src="/img/pangenome/hprc_graph_anatomy.png" />

C4 holds few enough nodes to name its parts. The arc in the labelled bubble is
an edge: a haplotype carrying one fewer copy of the C4 module takes it straight
past a copy GRCh38 has, and the renderer writes the bp the arc removes across
the arc itself.

## A chromosome and back

Pick **Anchored** from the **Layout** dropdown again, and the graph follows once
more. Type `chr6` into the location box. The segments track names a zoom,
`aboveBpPerPx` in its `coarse` slot, past which the graph switches from its
segments to its bubble tier: one node per bubble, with the invariant reference
between bubbles as backbone, so the whole chromosome draws. The toolbar reads
**Following the linear view, coarse tier**, and the lanes above ask you to zoom
in at this width.

Type the MHC class II window, `chr6:32,510,001-32,600,000`, to come back. Past
the same zoom the graph crosses back to the segments, and the class II cut
returns. [Hosting your own graph](/docs/tutorials/pangenome_prepare_graph)
builds the tier and writes the `coarse` slot.

<Video src="/media/pangenome/hprc_browse.mp4" caption="HPRC release 2 from the HPRC page: the HLA / MHC graph launch, the graph following the linear view to C4, out to the bubble tier across chromosome 6 and back to MHC class II, and one allele highlighted in hg38 and opened on the haplotype that contributed it." />

## From an allele to its haplotype

Back at MHC class II, find the allele under _HLA-DRB5_: a charcoal node in a
lower row near the left of the window, 1.8 kb long by its tooltip, hanging
across 12 kb of backbone. Right-click it for two actions whose result outlasts
the hover:

- **Highlight in hg38** marks its reference interval in the linear view and
  leaves it there.
- **Open in hg38** scrolls the linear view to it.

Take **Highlight in hg38**. A band appears in the linear view across the 12 kb
the allele attaches over, and it covers most of _HLA-DRB5_.

<Figure caption="The MHC class II cut drawn both ways under the same tracks, colored by reference position with alleles in charcoal. Left, force-directed, with the allele's right-click menu open on Highlight in hg38 and its band in the linear view. Right, anchored: each x a GRCh38 coordinate, the reference row on top, each lower row one rank, and the ringed dashed arc a deletion." src="/img/pangenome/hprc_mhc_anchored.png" links="Force-directed=pangenome/hprc_mhc_layout_force,Anchored=pangenome/hprc_mhc_layout_anchored" />

Now left-click the same node. The details panel opens on the right, and
`contributingAssembly` names the first assembly to contribute the segment, with
`contributingHaplotype` giving the `sample#haplotype` part of its rGFA name:
`NA20809#2`. The rGFA name, `NA20809#2#CM094351.1`, places the allele on that
haplotype's chromosome 6 as exactly as a backbone segment sits on GRCh38.

The config the HPRC page opens declares each release 2 haplotype as an assembly,
this one as `NA20809.2` with `NA20809#2` among its aliases, so the node's menu
also offers **Open in NA20809.2**. Take it. A linear view of that haplotype's
chromosome 6 opens under the graph, framed on the allele, with the haplotype's
CAT gene annotation. Zoom that view out a few steps for the genes around it.

<Figure caption="The same launch in two frames. First, the MHC class II cut with the NA20809.2 allele ringed and its right-click menu open on Open in NA20809.2. Second, the view that entry opens: NA20809 haplotype 2's chromosome 6 with its CAT genes, which put HLA-DRB9 and HLA-DRB6 either side of the allele and no HLA-DRB5 at all." src="/img/pangenome/hprc_haplotype_launch.png" />

On GRCh38 the allele attaches across the 12 kb of backbone the band marks, which
covers most of _HLA-DRB5_. On NA20809 haplotype 2 the same 1.8 kb sits between
_HLA-DRB9_ and _HLA-DRB6_, and that haplotype's annotation has no _HLA-DRB5_
model at all.

## The LPA kringle repeat

_LPA_ carries a tandem array of kringle IV type 2 (KIV-2) copies, and how many
copies a haplotype carries is inversely related to its level of lipoprotein(a),
a heritable risk factor for heart disease (Schmidt et al. 2016). Pick
**Anchored** in the graph's **Layout** dropdown so it follows again, type the
LPA window, `chr6:160,525,000-160,655,000`, into the location box, and then pick
**Force-directed layout**. The array draws as a knot of loops, and the halo
around it labels it a repeat array.

<Figure caption="The LPA window with the RefSeq genes, UniProt's kringle domains, the HPRC bubbles and the rGFA segments above the force-directed graph. The kringle array is the knot of loops in the middle, haloed and labelled as a repeat array, and LPA is pinned under the backbone with its exons along it." src="/img/pangenome/hprc_lpa_kiv2.png" />

Every loop in the knot is a different number of copies. Click the array's label,
the purple one on the knot: the view cuts the bubble's segments out and lays
them out on their own, with a button back to the window. A bubble inside the
array gets a label of its own to click in turn. The rGFA records which segments
exist and how they link, and no haplotype walks through it, so nothing in this
cut says who takes which loop.

## One haplotype's copies

A **walk** is one haplotype's route through the graph, and the base-level graph
keeps one per haplotype. We host the KIV-2 bubble cut from it for GRCh38 and
eight haplotypes, walks included. Take **Add → Graph genome view** from the
app's top menu, give its form the file's URL, and pick **Force-directed layout**
again:

```text
https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.kiv2.eight-haplotypes.gfa
```

A node draws thicker the more of the nine walks carry it, Bandage's depth drawn
as width, so the backbone every haplotype shares is the thick line and the
copies one haplotype alone carries are the thin loops. Each route over a
kilobase carries a chip naming the haplotypes that take it, and with nine walks
through one array the chips stack over the loops, so turn **View menu → Settings
→ Mark bubbles** off. The **Walk** dropdown in the toolbar names each haplotype
in the file. Pick `HG00133`: its route keeps its ink while every other node and
link fades, and a readout beside the legend gives the walk's length through the
window against the reference walk.

<Figure caption="The eight-haplotype KIV-2 cut under the same window's genes, bubbles and rGFA segments, with HG00133 picked in the Walk dropdown. The labelled loop is copies HG00133 walks and GRCh38 does not, its links drawn dark, and the readout states the walk's excess over GRCh38." src="/img/pangenome/graph_kiv2_walks.png" />

Pick **Walk rows** in the **Layout** dropdown to read every haplotype at once,
and **Uniform** from the **Color** dropdown so GRCh38's own bar draws in the
same blue. Each walk becomes a bar on its own bp axis, longest first, blue where
GRCh38 carries the same sequence and purple where it does not, so the copies a
haplotype adds read as the length of its purple stretch.

<Figure caption="The eight-haplotype KIV-2 cut in walk rows, one bar per haplotype under GRCh38's, longest first, under LPA with the KIV-2 bubble boxed in the bubbles lane. The purple stretch of each bar is kringle copies GRCh38 does not carry, and each readout gives the walk's length and its excess over GRCh38." src="/img/pangenome/graph_kiv2_walk_rows.png" />

## Check it against the bubble index

The bubbles lane over the array is one row of the hosted bubble index. Click the
KIV-2 bubble in that lane, the block boxed in the last figure. Its details list
the row's segment count, its path count and its `shortestAlleleLength` and
`longestAlleleLength`, the shortest and longest routes the rGFA holds between
the bubble's two ends. Every bar in walk rows is longer than the first and
shorter than the second, and GRCh38's own bar, which carries no purple, is the
shortest of the nine.

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
