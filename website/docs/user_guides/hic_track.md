---
title: Hi-C track
description: Contact matrix display
guide_category: Track types
---

Hi-C measures how often pairs of genomic loci contact each other in the nucleus.
JBrowse draws it as a triangular contact matrix under the ruler, with brighter
color for more contacts. It reads `.hic` files (Juicer and compatible pipelines)
through the hic-straw module.

## Loading a Hi-C track

In the "Add a track" form, paste the URL to a `.hic` file (or open it from
disk). JBrowse detects the format and creates a Hi-C track that renders below
the ruler.

## Reading the contact matrix

<Figure caption="Hi-C contact matrix for hg19 chr8:50.4–61.3Mb, with a gene track above. The bright strip along the top edge is the diagonal (self-interactions), the triangular sub-blocks are TADs, and their off-diagonal corners are loops." src="/img/hic_track.png" />

Three cues carry most Hi-C reads:

- Diagonal - the bright top edge, always the strongest signal
- Triangular blocks - TADs, delimited by sharp drops in signal
- Off-diagonal spots - point-to-point loops between specific loci

## Adjusting resolution and color scale

JBrowse picks a resolution to fit the view width. Zoom in for finer bins, out
for larger-scale structure. For manual control, open the **Resolution** item in
the track menu: the Finer/Coarser buttons step through the binning levels stored
in the file, disabling themselves at the finest and coarsest levels available,
and the menu stays open so you can step repeatedly. Stepping applies a
persistent offset from the auto-selected level, so resolution still tracks your
zoom, just shifted; **Reset** returns to auto.

Pick the color ramp from the track menu: `juicebox`, `fall`, or `viridis`. See
the [Hi-C track config guide](/docs/config_guides/hic_track/) for the color,
log-scale, and normalization options.

## Overlaying loops and interactions as arcs

Loop and interaction calls (HiCCUPS loops, ABC/EPIraction enhancer–gene links)
ship as [BEDPE](/docs/config_guides/file_types/) files with two endpoints per
line. JBrowse renders them in a paired-arc display, one arc per call, so you can
stack the called loops directly above the matrix they came from.

Load a BEDPE file like any other track (paste its URL into "Add a track"), then
add the `.hic` matrix as a separate track and reorder so the arcs sit above it.
Arc thickness is adjustable from the track menu: open **Arc width** and drag the
slider (this writes the `lineWidth` slot on the
[paired-arc display](/docs/config/linearpairedarcdisplay), which you can also
set in config).

## See also

- [Hi-C track configuration](/docs/config_guides/hic_track)
- [LinearHicDisplay config schema](/docs/config/linearhicdisplay)
- [Basic usage: opening tracks](/docs/user_guides/basic_usage#opening-tracks)
