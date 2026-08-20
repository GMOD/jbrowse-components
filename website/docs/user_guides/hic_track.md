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

<Figure caption="4.2 Mb of hg19 chr8 with Show faint contacts off and on, each frame labeled with its setting. Only the saturation point of the color scale differs; the contact data is identical." src="/img/hic/faint_contacts.png" links="Show faint contacts off=hic/percentile_off,Show faint contacts on=hic/percentile_on" />

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
puts a bright off-diagonal block at a translocation's partner loci. The
[Hi-C structural variants tutorial](/docs/tutorials/hic_structural_variants)
shows that block on a real one, chr9 against chr22 in K562.

Inter-chromosomal matrices are commonly only stored at coarse binsizes. When the
auto-picked resolution is finer than anything the file holds for that pair, the
cross-block is absent while the intra-chromosomal triangles still draw. Step
**Coarser** until it appears.

The same thing scales to the whole genome. **View → Navigation → Show all
regions in assembly** puts every chromosome in the view at once, which makes the
fetch every chromosome against every other one and the drawing a block diagonal:
each chromosome is a triangle along the bottom edge, each pair of chromosomes is
the block between their two triangles, and the whole pyramid is the genome
against itself.

<Figure caption="GM12878 in situ Hi-C at its coarsest 2.5 Mb binsize, hg38 chr1 to chrY in one view. The white bands crossing it are centromeres and the acrocentric short arms, where there is nothing to contact." src="/img/hic/whole_genome.png" />

How much figure this is depends on the file. A file storing only
intra-chromosomal contacts leaves every block between the triangles empty, so
check a candidate before reading anything into a blank off-diagonal. It also
decides the sensible ramp: a sparse file needs
[`useLogScale`](/docs/config/linearhicdisplay/#slot-uselogscale) to lift its
decayed long-range bins off the floor, and a dense one comes back solid under
the same setting, since every bin then reaches the top of the scale.

The track has to be tall here. A pair's contacts are drawn in the wedge between
its two regions, so the drawing is as tall as the widest pair on screen is wide,
and at whole-genome zoom that is chr1 against chrY: half the view. A
hundred-pixel track shows the top slice of that pyramid, which is its faintest
corner.

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

## Compartments and subcompartments

At tens of megabases the matrix separates into two interleaved sets of regions
that preferentially contact their own kind: the A compartment, which is
gene-rich and active, and the B compartment, which is not. In a published figure
this reads as a checkerboard, but that picture is drawn from an
_observed/expected_ matrix, where each bin has been divided by the average
contact at its separation and then correlated. JBrowse draws raw or
matrix-balanced counts, and against the steep decay of contact with distance the
compartment signal stays a faint texture rather than a checkerboard. Balanced
counts on a linear ramp show the most of it; `Log scale` on a deeply sequenced
file returns solid red.

What is worth loading instead is the compartment call itself, which the
processing pipeline has already made. ENCODE publishes two such files per Hi-C
experiment, both derived from the matrix in the same track:

- The **compartment eigenvector**, a BigWig. Its sign is the compartment
  assignment and its magnitude is how strongly a bin belongs, so it loads as an
  ordinary [quantitative track](/docs/user_guides/quantitative_track) and draws
  as a two-color plot around zero.
- **Subcompartments**, a BED. Clustering the interaction profiles splits A and B
  further, and the file carries a color per class in its `itemRgb` column, so
  the track paints itself with no color configuration.

<Figure src="/img/hic/compartment_switch.png" caption="GM12878 and K562 eigenvector tracks over the same window: the TCF4 band falls in opposite compartments in the two lines while the frame edges agree. No contact matrix here, since the eigenvector is that computation over one, published." links="Open this view=hic/compartment_switch" />

Two things about that figure are worth copying whenever you compare compartments
between samples, because getting either wrong produces a difference that is not
there.

**Pin both eigenvector tracks to the same scale.** Left to autoscale, each track
fills its own lane from its own extremes and the two stop being comparable. Set
the min and max score by hand, from the track menu or in config.

**An eigenvector identifies A only up to a sign.** The decomposition that
produces it is equally valid negated, so which sign means "active" is a property
of the file, not a convention you can assume — and comparing two files means
their orientations have to agree as well. Both are checkable against the gene
track: A is the gene-rich compartment by definition, so the sign that coincides
with the dense stretches of the gene track is A. Do that check over a whole
chromosome rather than in one frame, since a few megabases can be gene-poor in
both samples and settle nothing. In both files above, positive is the gene-rich
side.

The subcompartment classes need the same caution in a different place. The
cluster numbers a caller emits are arbitrary labels rather than the published
A1/A2/B1/B2/B3 naming, so a class number means nothing on its own and two files
only compare because the same pipeline assigned the same colors. That is also
why the figure requires _both_ signals to change before calling a region
switched: a class number can move without the eigenvector moving at all, which
is a relabelling and not a change in compartment.

## See also

- [Hi-C track configuration](/docs/config_guides/hic_track)
- [LinearHicDisplay config schema](/docs/config/linearhicdisplay)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_visualization)
- [Basic usage: opening tracks](/docs/user_guides/basic_usage#opening-tracks)
- [Gallery: coverage and contact maps](/gallery/#coverage)
