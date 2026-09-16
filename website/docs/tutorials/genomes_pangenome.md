---
title: The HPRC pangenome on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (pangenome)
description:
  A click-path through the hosted pangenome pages on staging.genomes.jbrowse.org
  — draw any window of the HPRC release 2 graph, or a whole chromosome of it,
  with nothing prepared beforehand
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

This tutorial walks one hosted page,
[staging.genomes.jbrowse.org/pangenomes/hprc](https://staging.genomes.jbrowse.org/pangenomes/hprc),
and the sessions it launches. Everything it opens is already built and already
served: you type a region and press a button. Nothing here is a file you fetch,
a config you write or a tool you install.

The HPRC page draws the human pangenome graph on any GRCh38 region you give it,
beside a linear view of the same window, and switches to a bubble tier for a
window too wide to draw segment by segment.

:::caution Experimental

The graph view is a beta plugin, so the pangenome pages live on **staging**,
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/),
rather than on genomes.jbrowse.org, until JBrowse 5 ships — the plugin needs a
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

Every launch on the HPRC page opens one hosted config,
https://jbrowse.org/pangenome/hprc-grch38/config.json, whose tracks read
tabix-indexed projections published beside it; JBrowse reads only the window you
asked for out of them. The page's own **Published files** table names those
projections with their sizes, for anyone who does want a copy.

The upstream HPRC release 2 files the projections were cut from, as provenance
rather than as a download step:

- the SV-resolution graph:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.sv.gfa.gz
- the 464-haplotype callset, which the variant lane reads straight off S3:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.wave.vcf.gz
- how each segment index, link index, bubble file, allele inventory and bubble
  tier was built, recorded beside them:
  https://jbrowse.org/demos/hprc/README.txt

## Two ways in

The [HPRC page](https://staging.genomes.jbrowse.org/pangenomes/hprc) is for when
you have a region: its **Draw the graph** form takes a GRCh38 locstring. The
rest of this tutorial walks that route.

The
[variable loci explorer](https://staging.genomes.jbrowse.org/pangenomes/explorer)
is for when you have a gene: a catalog of GRCh38 loci where structure varies
between haplotypes, each card carrying the same graph launch beside the variant
summaries and genotype matrix for that locus.

## Drawing a window

Scroll to **Draw the graph**. The box holds `chr6:32,510,001-32,600,000`, the
MHC class II window, and the presets beneath it are catalog loci that minigraph
draws well, followed by one per chromosome. Loci it collapses onto a single path
(SMN1/2, RHD/RHCE, CYP2D6) are left out, because the graph there is a bare
thread.

<Figure caption="The HPRC page's Draw the graph form: a region box preloaded with the MHC class II window, the note on what the launch will cut, an Open in PangyPlot link for the same coordinates, and the catalog loci and chromosomes as presets." src="/img/pangenome/genomes_hprc_launcher.png" />

Type any region and press **Draw as a graph**. The note under the box shows what
the launch will cut.

The session is two panels. Above, a linear view with the RefSeq genes, the
bubbles lane, the allele inventory and the rGFA segments. Below, the graph,
colored along the reference from red at the window's start to magenta at its
end, with a segment that has no reference coordinate in charcoal. Hovering a
node highlights its segment in the lane above, and the reverse.

<Figure caption="The MHC class II window drawn from the page: RefSeq genes, bubbles, rGFA segments and the allele inventory above, and the same window as a force-directed graph below, on the reference-position ramp." src="/img/pangenome/genomes_hprc_mhc_graph.png" />

Inside the session, the segments track's menu has **Launch → Graph genome view
(this region)**, and rubberbanding a span offers **Graph genome view (this
selection)**, so a zoomed-in window reopens as a graph without the page. The
graph reaches back the same way. Hovering a node bands its interval across the
lanes above, right-clicking one offers **Highlight in hg38** and **Open in
hg38**, and the view's own **Launch** menu reopens the whole window as a linear
view. The HPRC tutorial walks
[a node back to its coordinates](/docs/tutorials/pangenome_hprc#from-the-allele-back-to-grch38).

## Wider than 150 kb

Past 150 kb the launch swaps the segment-level lanes for the bubble tier the
HPRC tutorial builds with `build_bubble_tier.sh`, one node per top-level bubble,
and a curve of segments per bubble. A chromosome preset is the widest case of
the same rule. At that scale the curve shows where the graph varies, and the
tier lane places each bubble.

## Beyond 5 Mb at segment resolution

The graph view lays a window out in the browser, which caps it. For the same
region at every scale, the form's **Open in PangyPlot** link opens
[PangyPlot](https://pangyplot.research.sickkids.ca/), which precomputes an odgi
layout and level-of-detail tiers server-side and navigates by the same
`chrom:start-end`. PangyPlot serves the release 1.1 graph, so a locus can differ
in detail from the release 2 launch. Both are on GRCh38, so the coordinates line
up.

## The other two graphs

Each graph on staging has its own page, and all three are the same page shape:
the same region form, the same projections table, the same caveats list.
[/pangenomes/mouse](https://staging.genomes.jbrowse.org/pangenomes/mouse) is 18
inbred and wild-derived strains on GRCm39, and
[/pangenomes/bovine](https://staging.genomes.jbrowse.org/pangenomes/bovine) is
the taurine, indicine, yak, bison and gaur super-pangenome on ARS-UCD1.2.
[The pangenomes landing page](https://staging.genomes.jbrowse.org/pangenomes/)
is the choice between the three. What differs is what each graph can say: the
mouse graph was built with minigraph, which writes no haplotype paths, so it has
no callset and cannot say which strain carries an allele. The
[mouse](/docs/tutorials/pangenome_mouse) and
[cattle](/docs/tutorials/pangenome_cattle) tutorials are how those two were
built.

## Adding the same tracks to your own instance

Every launch opens https://jbrowse.org/pangenome/hprc-grch38/config.json, a
plain JBrowse config. The
[HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc) walks each of its
tracks, and the session-spec URLs the page builds can be written by hand: a
`LinearGenomeView` with an `id`, and a `GraphGenomeView` carrying
`loadedTrackId`, `loadedRegion` and `connectedViewId` naming that id.
