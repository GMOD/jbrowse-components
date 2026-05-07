---
id: hic_track
title: Hi-C track
description: Contact matrix display
guide_category: Track types
---


Hi-C captures genome-wide chromatin interaction frequencies by sequencing pairs
of genomic regions that are physically co-located in the nucleus. JBrowse
renders these as a triangular contact matrix where color intensity indicates
contact frequency — brighter means more interactions.

JBrowse reads `.hic` files produced by Juicer, Juicebox, and compatible
pipelines, using the hic-straw module.

## Loading a Hi-C track

In the Add track dialog, paste the URL to a `.hic` file (or open it from disk).
JBrowse auto-detects the format and creates a Hi-C track. The track renders a
triangular contact matrix below the chromosome ruler.

## Reading the contact matrix

<Figure caption="Hi-C contact matrix for a region of hg19 (~chr19:50–60 Mb). The diagonal (brightest red strip) represents self-interactions. Triangular blocks of elevated signal along the diagonal are topologically associating domains (TADs) — genomic regions whose loci contact each other more than they contact flanking regions. Off-diagonal bright spots are chromatin loops connecting specific pairs of loci." src="/img/hic_track.png" />

Key features to interpret:

- **Diagonal** — always the brightest band; self-interactions within a region
- **TAD boundaries** — sharp drops in signal that delimit the triangular blocks;
  the corners of these blocks are where loop anchors often occur
- **Loops** — punctate off-diagonal bright spots at specific locus pairs,
  typically CTCF-anchored
- **Compartments** — at low resolution, alternating plaid-like patterns (A/B
  compartments) reflecting active vs repressed chromatin

## Adjusting resolution and color scale

JBrowse automatically selects a resolution that fits the current view width.
Zoom in to increase resolution; zoom out to see larger-scale organization.

The color scale is configurable via the track's configuration — see
[the Hi-C track config guide](/docs/config_guides/hic_track/) for available
options.

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-xS8Eg67AFS&password=jPzH5)
— Hi-C contact matrix with gene annotations
