---
title: 'Pangenome (HPRC): browsing the graph'
sidebar_label: Pangenome (HPRC, browsing the graph)
description:
  Open HPRC release 2's pangenome graph from genomes.jbrowse.org as a track of
  the linear view, follow one allele to the haplotype that carries it, and read
  a whole chromosome at one node per bubble
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A pangenome graph records what a set of genomes share and where they diverge, so
sequence that one person carries and the reference lacks is an object in the
file. The Human Pangenome Reference Consortium's release 2 builds 464 human
haplotypes into one such graph. We open it from the consortium's page on
genomes.jbrowse.org as a track of a linear view of GRCh38, and:

- read a whole chromosome, one node per bubble
- at C4, read the graph's backbone, bubbles and alleles
- at MHC class II, follow one allele back to the haplotype that carries it

Three more pages start from the same HPRC page:
[allele carriers](/docs/tutorials/pangenome_hprc_carriers),
[haplotypes against each other](/docs/tutorials/pangenome_hprc_haplotypes) and
[repeat lengths](/docs/tutorials/pangenome_hprc_repeats).

:::caution Experimental

The graph view is a beta plugin, and the HPRC page is on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/)
until JBrowse 5 ships. We welcome your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, which every launch from the HPRC page loads;
  [hosting your own graph](/docs/tutorials/pangenome_prepare_graph) loads it
  into your own JBrowse

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), read through tabix
projections of its graph that we host.

- the SV-resolution graph (`sv.gfa`) the projections are cut from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the projections, with the exact build recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt
- the config every launch on the HPRC page opens, which declares every release 2
  haplotype as an assembly with its CAT gene annotation:
  https://jbrowse.org/pangenome/hprc-grch38/config.json

## The HPRC page

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc). Each
row of its **Loci** table ends in launches: **graph**, **variants**,
**haplotypes** and **gene hub**.

<Figure caption="The HPRC page: the whole-chromosome links, then the head of the Loci table, where each row ends in its launches. The RHD / RHCE and SMN1 / SMN2 rows have no graph launch. The boxed link is the HLA / MHC graph launch." src="/img/pangenome/genomes_hprc_loci.png" />

## A whole chromosome {#a-chromosome-and-back}

Press **chr1** among the **Whole chromosome** links above the Loci table. Past a
zoom named in the graph adapter's `coarse` slot, JBrowse draws one node per
bubble, so the whole chromosome fits. A curve of segments per bubble shows how
much the haplotypes disagree at each locus.

<Figure caption="GRCh38 chr1 with the cytogenetic bands, three chr1 loci the HPRC pages open, and two lanes from one file. The blue curve is segments per bubble; the tier lane draws the same bubbles, one gold block per bubble. The blank column is 1q12, where nothing aligns." src="/img/pangenome/hprc_whole_chromosome.png" />

[Hosting your own graph](/docs/tutorials/pangenome_prepare_graph) builds the
tier and writes the `coarse` slot.

## The C4 locus as a graph

Back on the HPRC page, press **graph** on the HLA / MHC row. Type `C4A` in the
location box, pick the chr6 hit, and zoom out twice to take in _C4B_. Open the
graph track's menu and pick **Layout → Force-directed layout**, which draws the
graph by its shape.

<Figure caption="The C4 locus as a force-directed graph under the hg38 genes for the same window, colored by reference position. The labels name a backbone segment, an allele, and a bubble whose two routes are the reference path and the dashed arc that skips one whole copy of the tandem C4-CYP21-TNX module." src="/img/pangenome/hprc_graph_anatomy.png" />

The graph has four kinds of object:

- the **backbone** is GRCh38's path, colored red to magenta by reference
  position
- a **bubble** is a place where haplotypes disagree
- an **allele** is sequence a haplotype carries in place of the reference, drawn
  in charcoal because it has no reference position
- an **edge** that skips sequence is a deletion, drawn as a dashed arc

The dashed arc in the labelled bubble is the route of a haplotype with one fewer
C4 copy than GRCh38.

## From an allele to its haplotype

Type `chr6:32,500,000-32,560,000`, the MHC class II window. The charcoal node
beside _HLA-DRB5_ is an allele much shorter than the stretch of backbone it
hangs across. Right-click it and take **Highlight in hg38**: a band marks the
span of GRCh38 it replaces, which covers most of _HLA-DRB5_.

<Figure caption="MHC class II with the graph track in the force-directed layout, colored by reference position. The ringed charcoal node is the allele beside HLA-DRB5, with its right-click menu open on Highlight in hg38." src="/img/pangenome/hprc_mhc_layout_force.png" />

## Check it on the haplotype

Left-click the allele. Its details give `contributingHaplotype`, `NA20809#2`,
the first assembly the graph saw the allele in. Right-click it again and take
**Open in NA20809.2**. A second linear view opens below the first, on that
haplotype's chromosome 6, framed on the allele with its CAT gene annotation.
Zoom out a few steps.

<Figure caption="The same launch in two frames. First, the MHC class II cut in the force-directed layout, with the NA20809.2 allele ringed and its right-click menu open on Open in NA20809.2. Second, the view that entry opens: NA20809 haplotype 2's chromosome 6 with its CAT genes." src="/img/pangenome/hprc_haplotype_launch.png" />

The haplotype's CAT annotation has _HLA-DRB9_ and _HLA-DRB6_ either side of the
allele and no _HLA-DRB5_, the gene its band covered on hg38.

## See also

- [](/docs/tutorials/pangenome_hprc_carriers)
- [](/docs/tutorials/pangenome_hprc_haplotypes)
- [](/docs/tutorials/pangenome_hprc_repeats)
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
