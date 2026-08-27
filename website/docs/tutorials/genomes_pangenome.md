---
title: The HPRC pangenome on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (pangenome)
description:
  Draw any window of the HPRC release 2 graph, or a whole chromosome of it, from
  a hosted page with nothing prepared beforehand
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
data: hosted
---

**TL;DR:** genomes.jbrowse.org's HPRC page launches the Minigraph-Cactus graph
as a graph, on any GRCh38 region you type, beside a linear view of the same
window. A row of chromosome buttons draws each whole chromosome off a bubble
tier. Nothing is built by hand; the
[HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc) is where the files
come from.

:::caution Experimental

The graph view is a beta plugin, and the page is on
[staging.genomes.jbrowse.org](https://staging.genomes.jbrowse.org/pangenomes/hprc)
until JBrowse 5 ships, because the plugin needs a build newer than the released
hosts. We welcome your [feedback](/contact).

:::

## Prerequisites

- nothing to install: this is a click-path through a hosted page and the
  sessions it launches
- to build the graph indexes yourself, or to add the same tracks to your own
  JBrowse, take the [HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc)
  instead; every launch below opens a config it describes

## Where the data comes from

The page launches one hosted config,
https://jbrowse.org/pangenome/hprc-grch38/config.json, whose tracks are tabix
projections of the release 2 `sv.gfa` and the release's own variant callset:

- the SV-resolution graph the projections are cut from:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.sv.gfa.gz
- the segment and link indexes, the bubble file, the allele inventory and the
  bubble tier, all under https://jbrowse.org/demos/hprc/ with a README stating
  how each was built
- the 464-haplotype callset, read straight off S3:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz

<Figure caption="The HPRC page on genomes.jbrowse.org. Draw the MHC as a graph opens the graph on the class II window; the Explorer button goes to the locus catalog; Browse the pangenome on GRCh38 opens the reference-projected callset instead." src="/img/pangenome/genomes_hprc_page.png" />

## Two ways in

The [HPRC page](https://genomes.jbrowse.org/pangenomes/hprc) is the one to take
when a region is what you have. Its **Draw the graph** form takes a GRCh38
locstring and opens the graph cut to that window, and its chromosome row opens a
whole chromosome at bubble resolution. The rest of this page walks that route.

The [variable loci explorer](https://genomes.jbrowse.org/pangenomes/explorer) is
the one to take when a gene is what you have. It is a catalog of GRCh38 loci
where structure varies between haplotypes, and each locus card carries the same
graph launch, sized to the window the graph draws well, beside the variant
summaries and the genotype matrix for that locus.

<Figure caption="The HPRC page's Draw the graph section: a region box preloaded with the MHC class II window, the catalog loci as presets, an Open in PangyPlot link for the same coordinates, and one button per chromosome." src="/img/pangenome/genomes_hprc_launcher.png" />

## Drawing a window

Open the [HPRC page](https://genomes.jbrowse.org/pangenomes/hprc) and scroll to
**Draw the graph**. The box arrives holding `chr6:32,510,001-32,600,000`, the
MHC class II window, and the presets beneath it are the catalog's loci that
minigraph draws well; the ones it collapses onto a single path (SMN1/2,
RHD/RHCE, CYP2D6) are left out on purpose, because the graph there is a bare
thread and reads as an empty result.

Type any region, with or without commas, and press **Draw as a graph**. The note
under the box says what the launch will cut. Past 150 kb it warns instead: the
layout scales the graph to fit, so a megabase-wide window draws as one
unreadable thread rather than as loops. The cut is refused outright past 5 Mb,
which is the view's own limit.

The session that opens is two panels. Above, a linear view of the window with
the RefSeq genes, the bubbles lane, the rGFA segments colored by rank (reference
blue, everything else orange) and the allele inventory, which draws each
insertion at its real magnitude. Below, the graph, colored along the reference
from red at the window's start to magenta at its end, with a segment that has no
reference coordinate in charcoal. Hovering a node highlights its segment in the
lane above, and hovering the lane highlights the node.

<Figure caption="The MHC class II window drawn from the page: RefSeq genes, bubbles, rank-colored segments and the allele inventory above, and the same window as a force-directed graph below, on the reference-position ramp." src="/img/pangenome/genomes_hprc_mhc_graph.png" />

The form is only the first cut. Inside the session, the segments track's menu
carries **Launch → Graph genome view (this region)**, and rubberbanding a span
offers **Graph genome view (this selection)**, so a zoomed-in window reopens as
a graph without going back to the page.

## Drawing a whole chromosome

The chromosome row draws the tier the HPRC tutorial builds with
`build_bubble_tier.sh`: one node per top-level bubble, so chr1's 249 Mb is a few
hundred nodes and lays out in milliseconds. The linear view above it swaps the
segment-level lanes for the tier's own lane and a curve of segments per bubble,
which is where the graph varies and by how much.

<Figure caption="chr21 whole, off the bubble tier: RefSeq genes, the variability curve and the tier lane above, and the tier as a graph below in the anchored layout, so the reference backbone runs under the same axis with each bubble's alternative hanging beneath it. 130 nodes for 46.7 Mb." src="/img/pangenome/genomes_hprc_chr21_tier.png" />

The chromosome launch opens in the **Anchored** layout, where every x is a
reference coordinate, rather than the force-directed default: a few hundred
nodes in a chain bend into an arc under a force layout, and anchored keeps them
under the linear view they came from. The **Layout** dropdown switches between
the two.

The one setting the launch changes is the view's `maxRegionBp`, raised to the
chromosome's length: the 5 Mb default is a proxy for node count that a tier
breaks. The real ceiling, `maxGraphNodes`, is unchanged.

## Beyond 5 Mb at segment resolution

The graph view cuts a window and lays it out in the browser, which is what makes
it self-hosting and what caps it. For the same region at every scale in between,
the form's **Open in PangyPlot** link opens
[PangyPlot](https://pangyplot.research.sickkids.ca/), which precomputes an odgi
layout and level-of-detail tiers server-side and navigates by the same
`chrom:start-end`. Its instance serves the release 1.1 graph, so a locus can
differ in detail from the release 2 launch beside it; the coordinates line up
because both are on GRCh38.

## Adding the same tracks to your own instance

Every launch above opens https://jbrowse.org/pangenome/hprc-grch38/config.json,
which is a plain JBrowse config you can read. The
[HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc) walks each of its
tracks, from the plugin declaration through the rGFA indexes to the tier, and
the same session-spec URLs the page builds can be written by hand: a
`LinearGenomeView` with an `id`, and a `GraphGenomeView` carrying
`loadedTrackId`, `loadedRegion` and `connectedViewId` naming that id.
