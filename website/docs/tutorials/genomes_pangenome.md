---
title: The HPRC pangenome on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (pangenome)
description:
  A click-path through the hosted HPRC page on staging.genomes.jbrowse.org,
  whose locus table opens the release 2 graph, its callset and its haplotypes at
  twenty structurally variable loci, with nothing prepared beforehand
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

The Human Pangenome Reference Consortium's release 2 builds 464 human haplotypes
into one graph, which records where they differ in structure: a deleted gene, an
extra copy, an inverted stretch. The hosted page
[staging.genomes.jbrowse.org/pangenomes/hprc](https://staging.genomes.jbrowse.org/pangenomes/hprc)
lists twenty loci where they do and opens JBrowse on each one, as the graph, as
the callset or as one lane per haplotype. Everything it opens is already built
and served.

:::caution Experimental

The graph view is a beta plugin, so the pangenome pages live on **staging**,
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/),
rather than on genomes.jbrowse.org, until JBrowse 5 ships: the plugin needs a
build newer than the released hosts. Every page link below is a staging link. We
welcome your [feedback](/contact).

:::

## Prerequisites

- nothing to install: this is a click-path through a hosted page and the
  sessions it launches
- to build the graph indexes yourself, or to add the same tracks to your own
  JBrowse, take the [HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc)
  instead; every launch below opens a config it describes

## Where the data comes from

Everything the page opens comes from
[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710).

- the SV-resolution graph our hosted tabix projections were cut from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- how each segment index, link index, bubble file, allele inventory and bubble
  tier was built: https://jbrowse.org/demos/hprc/README.txt
- the 464-haplotype callset, which the variants launch reads:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz
- the graph as a gbz-base database, which the haplotypes launch reads:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- our companion index naming that database's haplotypes:
  https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.haplotype-index.anchored.db

## The locus table

Open the [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc). Under
a row of whole-chromosome links, the **Loci** table gives each locus its gene
cluster, the kind of variation it is known for and its GRCh38 region, and ends
the row in its launches:

- **graph**: the locus as a graph, under a linear view of the same window
- **variants**: the callset as a haplotype matrix beside the RefSeq genes, which
  [part 2](/docs/tutorials/pangenome_hprc_part2#the-variant-callset) reads
- **haplotypes**: one lane per structural configuration the callset finds at the
  locus
- **gene hub**: genomes.jbrowse.org's ortholog explorer for the locus's gene

<Figure caption="The HPRC page: the whole-chromosome links, then the head of the locus table, where each row ends in its launches. The RHD / RHCE and SMN1 / SMN2 rows open only the callset and the gene hub. The boxed link is the graph launch the next section follows." src="/img/pangenome/genomes_hprc_loci.png" />

Each launch opens a window of at most 150 kb at the locus, where the graph draws
segment by segment. RHD / RHCE, SMN1 / SMN2 and CYP2D6 have no graph launch,
because minigraph merges their near-identical copies onto one path.

## A locus as a graph

Press **graph** on the HLA / MHC row. The session is two panels. Above, a linear
view with the RefSeq genes, the bubbles lane, the allele inventory and the rGFA
segments. Below, the graph, colored along the reference from red at the window's
start to magenta at its end, with a segment that has no reference coordinate in
charcoal. Hovering a node highlights its segment in the lane above, and the
reverse.

<Figure caption="The MHC class II window from the graph launch: RefSeq genes, bubbles, the allele inventory and the rGFA segments above, and the same window as a force-directed graph below, on the reference-position ramp, with the genes drawn along the backbone and each bubble haloed and labelled." src="/img/pangenome/genomes_hprc_mhc_graph.png" />

Inside the session, the segments track's menu has **Launch → Graph genome view
(this region)**, and rubberbanding a span offers **Graph genome view (this
selection)**, so a zoomed-in window reopens as a graph without the page. The
graph reaches back the same way. Hovering a node bands its interval across the
lanes above, right-clicking one offers **Highlight in hg38** and **Open in
hg38**, and the view's own **Launch** menu reopens the whole window as a linear
view. The HPRC tutorial walks
[a node back to its coordinates](/docs/tutorials/pangenome_hprc#from-the-allele-back-to-grch38).

## A whole chromosome

The **Whole chromosome** links above the table open the same two panels over a
whole chromosome. Past 150 kb the launch swaps the segment-level lanes for the
bubble tier the HPRC tutorial builds with `build_bubble_tier.sh`, one node per
top-level bubble, and a curve of segments per bubble. At that scale the curve
shows where the graph varies, and the tier lane places each bubble.
[Part 2](/docs/tutorials/pangenome_hprc_part2#a-whole-chromosome-as-a-graph)
walks a whole chromosome at that scale.

## A locus's haplotypes

Press **haplotypes** on the CFH / CFHR row. The session opens the RefSeq genes
over one lane per haplotype. Each lane is that haplotype's walk, read out of the
graph's gbz-base database in the browser and drawn in its own contig
coordinates, and ribbons join each lane to the one above. The page chose the
haplotypes from the callset: haplotypes with identical genotypes at every
structural site in the window share a configuration, and each lane stands for
one configuration, largest group first, up to eight.

<Figure caption="The CFH / CFHR haplotypes launch: hg38's RefSeq genes above eight haplotype lanes, each in its own contig coordinates. The first lane, HG002#1, stands for the largest group: its walk skips the boxed stretch holding CFHR3 and CFHR1, so the ribbon from hg38 past that stretch slants back to meet it. The seven lanes under it run through the whole window." src="/img/pangenome/genomes_hprc_cfhr_haplotypes.png" />

The skipped stretch is the common CFHR3-CFHR1 deletion
[(Hughes et al. 2006)](https://doi.org/10.1038/ng1890).
[Part 3](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph) opens the
same lane track on a panel of four deletion carriers and four non-carriers, each
carrying its own gene models, and **Lanes → Choose lanes...** in the track menu
swaps in any other haplotype the graph names. A row with no haplotypes launch is
a locus whose window holds no top-level structural site in the callset.

## The other two graphs

Each graph on staging has its own page in the same shape: chromosome links, a
locus table and a files table.
[/pangenomes/mouse](https://staging.genomes.jbrowse.org/pangenomes/mouse) is 18
inbred and wild-derived strains on GRCm39, and
[/pangenomes/bovine](https://staging.genomes.jbrowse.org/pangenomes/bovine) is
the taurine, indicine, yak, bison and gaur super-pangenome on ARS-UCD1.2.
[The pangenomes landing page](https://staging.genomes.jbrowse.org/pangenomes/)
links all three. Their loci come from the graph itself, ranked by segment count,
and neither page has a haplotypes launch. The mouse graph was built with
minigraph, which writes no haplotype paths, so it has no callset: its rows open
**bubbles** where the others open **variants**. The
[mouse](/docs/tutorials/pangenome_mouse) and
[cattle](/docs/tutorials/pangenome_cattle) tutorials build those two.

## Adding the same tracks to your own instance

The graph and haplotypes launches open
https://jbrowse.org/pangenome/hprc-grch38/config.json, a plain JBrowse config,
and the variants launch opens genomes.jbrowse.org's own hg38 config with the
callset added as a session track. The
[HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc) walks each track, and
you can write the session-spec URLs the page builds by hand. A graph launch is a
`LinearGenomeView` with an `id`, and a `GraphGenomeView` carrying
`loadedTrackId`, `loadedRegion` and `connectedViewId` naming that id. A
haplotypes launch is a `LinearGenomeView` whose `hprc_v2_1_gbz_lanes` track
carries `laneFilter` and `domain`, both listing the panel's haplotypes.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part2)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/pangenome_mouse)
- [](/docs/tutorials/pangenome_cattle)

## References

- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710), the release
  every launch on the page opens.
- Hughes AE et al.
  [A common CFH haplotype, with deletion of CFHR1 and CFHR3, is associated with lower risk of age-related macular degeneration](https://doi.org/10.1038/ng1890).
  Nature Genetics, 2006.
