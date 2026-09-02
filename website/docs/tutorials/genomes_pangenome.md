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

**TL;DR:** genomes.jbrowse.org's HPRC page draws the human pangenome graph on
any GRCh38 region you type, beside a linear view of the same window, and a row
of chromosome buttons draws each whole chromosome off a bubble tier. Nothing is
built by hand; the [HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc) is
where the files come from.

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

The [HPRC page](https://genomes.jbrowse.org/pangenomes/hprc) is for when you
have a region: its **Draw the graph** form takes a GRCh38 locstring, and its
chromosome row opens a whole chromosome at bubble resolution. The rest of this
page walks that route.

The [variable loci explorer](https://genomes.jbrowse.org/pangenomes/explorer) is
for when you have a gene: a catalog of GRCh38 loci where structure varies
between haplotypes, each card carrying the same graph launch beside the variant
summaries and genotype matrix for that locus.

<Figure caption="The HPRC page's Draw the graph section: a region box preloaded with the MHC class II window, the catalog loci as presets, an Open in PangyPlot link for the same coordinates, and one button per chromosome." src="/img/pangenome/genomes_hprc_launcher.png" />

## Drawing a window

Open the [HPRC page](https://genomes.jbrowse.org/pangenomes/hprc) and scroll to
**Draw the graph**. The box holds `chr6:32,510,001-32,600,000`, the MHC class II
window, and the presets beneath it are catalog loci that minigraph draws well.
Loci it collapses onto a single path (SMN1/2, RHD/RHCE, CYP2D6) are left out,
because the graph there is a bare thread.

Type any region and press **Draw as a graph**. The note under the box says what
the launch will cut. Past 150 kb it warns, because the layout scales to fit and
a megabase-wide window draws as one thread; past 5 Mb, the view's own limit, it
refuses.

The session is two panels. Above, a linear view with the RefSeq genes, the
bubbles lane, the rGFA segments colored by rank (reference blue, everything else
orange) and the allele inventory. Below, the graph, colored along the reference
from red at the window's start to magenta at its end, with a segment that has no
reference coordinate in charcoal. Hovering a node highlights its segment in the
lane above, and the reverse.

<Figure caption="The MHC class II window drawn from the page: RefSeq genes, bubbles, rank-colored segments and the allele inventory above, and the same window as a force-directed graph below, on the reference-position ramp." src="/img/pangenome/genomes_hprc_mhc_graph.png" />

Inside the session, the segments track's menu carries **Launch → Graph genome
view (this region)**, and rubberbanding a span offers **Graph genome view (this
selection)**, so a zoomed-in window reopens as a graph without the page. The
graph reaches back the same way: hovering a node bands its interval across the
lanes above, right-clicking one offers **Highlight in hg38** and **Open in
hg38**, and the view's own **Launch** menu reopens the whole window as a linear
view. The HPRC tutorial lists
[every crossing](/docs/tutorials/pangenome_hprc#every-way-across) and what each
cannot do.

## Drawing a whole chromosome

The chromosome row draws the tier the HPRC tutorial builds with
`build_bubble_tier.sh`: one node per top-level bubble, so a whole chromosome is
a few hundred nodes. The linear view above it swaps the segment-level lanes for
the tier's own lane and a curve of segments per bubble.

<Figure caption="chr21 whole, off the bubble tier: RefSeq genes, the variability curve and the tier lane above, and the tier as a graph below in the anchored layout, so the reference backbone runs under the same axis with each bubble's alternative hanging beneath it. 130 nodes for 46.7 Mb." src="/img/pangenome/genomes_hprc_chr21_tier.png" />

The chromosome launch opens in the **Anchored** layout, where every x is a
reference coordinate, so the chain stays under the linear view it came from
instead of bending into an arc. The **Layout** dropdown switches to
force-directed.

The launch raises the view's `maxRegionBp` to the chromosome's length, since the
5 Mb default is a proxy for node count that a tier breaks. `maxGraphNodes`, the
real ceiling, is unchanged.

## Beyond 5 Mb at segment resolution

The graph view lays a window out in the browser, which caps it. For the same
region at every scale, the form's **Open in PangyPlot** link opens
[PangyPlot](https://pangyplot.research.sickkids.ca/), which precomputes an odgi
layout and level-of-detail tiers server-side and navigates by the same
`chrom:start-end`. It serves the release 1.1 graph, so a locus can differ in
detail from the release 2 launch; both are on GRCh38, so the coordinates line
up.

## Adding the same tracks to your own instance

Every launch opens https://jbrowse.org/pangenome/hprc-grch38/config.json, a
plain JBrowse config. The
[HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc) walks each of its
tracks, and the session-spec URLs the page builds can be written by hand: a
`LinearGenomeView` with an `id`, and a `GraphGenomeView` carrying
`loadedTrackId`, `loadedRegion` and `connectedViewId` naming that id.
