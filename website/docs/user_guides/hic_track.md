---
title: Hi-C track
description: Contact matrix display
guide_category: Track types
---

**TL;DR:** Hi-C measures how often pairs of genomic loci contact each other in
the nucleus. JBrowse draws it as a triangular contact matrix, brighter where
contacts are more frequent, reading `.hic` files (Juicer and compatible
pipelines) in place over HTTP range requests.

## Loading a Hi-C track

In the "Add a track" form, paste the URL to a `.hic` file (or open it from
disk). JBrowse detects the format from the extension and creates a Hi-C track.
To try it without preparing anything:

```
https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic
```

Only the `.hic` format is supported. Cooler files (`.cool`, `.mcool`) need
converting first, e.g. with `hicConvertFormat` from HiCExplorer.

## Reading the contact matrix

<Figure caption="Hi-C contact matrix for hg19 chr8:50.4–61.3Mb, with a gene track above. The bright strip along the top edge is the diagonal (self-interactions), and the triangular sub-blocks below it are TADs, delimited by sharp drops in signal." src="/img/hic_track.png" />

Mousing over the matrix draws a V-shaped guide down to the two positions the bin
under the cursor pairs, with a tooltip giving both loci and the contact score.
The guide tracks over empty bins too, so it reads positions anywhere in the
triangle.

## Adjusting resolution

JBrowse picks a resolution to fit the view width. Zoom in for finer bins, out
for larger-scale structure. For manual control, open the **Resolution** item in
the track menu: the Finer/Coarser buttons step through the binning levels stored
in the file, disabling at the finest and coarsest available, and the menu stays
open so you can step repeatedly. Stepping applies a persistent offset from the
auto-selected level, so resolution still tracks your zoom, just shifted.
**Reset** returns to auto.

<Figure caption="Show → Show legend and Show → Show resolution controls, both off by default. The overlay gives the color scale with its endpoints and a binsize dropdown, which is how a chosen resolution gets pinned into an exported figure." src="/img/hic/overlay_controls.png" />

## Adjusting the color scale

Pick the ramp from the track menu's **Color scheme**: Juicebox (white to red),
Fall (white through yellow and red to black), or Viridis, which is perceptually
uniform and the safer choice for readers with color vision deficiency.

**Show → Show faint contacts (95th percentile)** decides what the ramp spans.
Off, the diagonal owns the scale and everything below it washes out; on (the
default) the scale saturates at the 95th percentile of counts and TAD structure
separates from background.

<Figure caption="4.2 Mb of hg19 chr8 with Show faint contacts off and on, each frame labeled with its setting. Only the saturation point of the color scale differs; the contact data is identical. Off, the diagonal takes the whole ramp and the TADs under it are barely above white; on, each TAD is a block with an edge and the corner dots between them are visible." src="/img/hic/faint_contacts.png" links="Show faint contacts off=hic/percentile_off,Show faint contacts on=hic/percentile_on" />

**Show → Log scale** maps counts to color on a log2 scale, compressing the
diagonal further still.

## Normalization

Raw contact counts carry coverage biases from restriction-site density,
mappability, and GC content. `.hic` files ship precomputed matrix-balancing
vectors, and the track menu's **Normalization** submenu lists only the schemes
the file actually contains — KR (Knight-Ruiz, the recommended default), SCALE (a
faster approximation to KR), VC and VC_SQRT (vanilla coverage), and NONE (raw
observed counts).

Vectors are stored per chromosome and binsize, so a file can list a scheme that
is missing at the binsize on screen. The menu ticks the normalization the loaded
matrix actually carries rather than the one requested, and the unavailable entry
says which scheme was substituted. Stepping to a finer resolution usually
resolves it.

## Comparing two regions

The matrix is fetched for every _pair_ of displayed regions, not just each
region against itself. Open a second region in the same view and the contacts
between the two fill the space between their triangles — the same geometry that
puts a bright off-diagonal block at a translocation's partner loci.

<Figure caption="Two windows on hg19 chr8 open in one linear genome view. Each window has its own triangle; the signal between them is the contacts between the two windows, fetched as a region pair." src="/img/hic/two_regions.png" />

Inter-chromosomal matrices are commonly only stored at coarse binsizes. When the
auto-picked resolution is finer than anything the file holds for that pair, the
cross-block is absent while the intra-chromosomal triangles still draw. Step
**Coarser** until it appears.

The same thing scales to the whole genome. **View → Show all regions in
assembly** puts every chromosome in the view at once, which makes the fetch
every chromosome against every other one and the drawing a block diagonal.

<Figure caption="hg19 chr1 to chrY in one view, log scale. Each chromosome is its own triangle and the notch out of each one is its centromere. The blocks between them are empty because this file stores intra-chromosomal contacts only." src="/img/hic/whole_genome.png" />

Log scale is what makes that figure readable rather than optional decoration. At
whole-genome zoom one pixel is megabases, contact frequency has decayed over
almost every bin on screen, and on the linear ramp the twenty-four triangles
render as a thin smear along the diagonal.

## Fitting the triangle to the track height

The triangle's natural height is half the view width, so on a wide view it is
taller than the track and the lower half is cut off. **Show → Fit to display
height** squashes it vertically to whatever height the track is dragged to,
trading square bins for seeing the whole triangle.

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
- [](/docs/user_guides/sv_visualization)
- [Basic usage: opening tracks](/docs/user_guides/basic_usage#opening-tracks)
- [Gallery: coverage and contact maps](/gallery/#coverage)
