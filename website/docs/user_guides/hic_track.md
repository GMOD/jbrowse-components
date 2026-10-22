---
title: Hi-C track
description: Contact matrix display
guide_category: Track types
---

Hi-C measures how often pairs of genomic loci contact each other in the nucleus.
JBrowse draws it as a triangular contact matrix, brighter where contacts are
more frequent, reading `.hic` files (Juicer and compatible pipelines) in place
over HTTP range requests.

## Loading a Hi-C track

In the "Add a track" form, paste the URL to a `.hic` file (or open it from
disk). JBrowse detects the format from the extension and creates a Hi-C track.
To try it without preparing anything:

```text
https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic
```

Only the `.hic` format is supported. Cooler files (`.cool`, `.mcool`) need
converting first, e.g. with `hicConvertFormat` from HiCExplorer.

## Reading the contact matrix

<Figure caption="A Hi-C contact matrix for hg19 chr8:50.4–61.3Mb with a gene track above. The diagonal runs along the top edge." src="/img/hic_track.png" />

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

<Figure caption="Show... → Legend adds the color scale, its title naming the normalization and the binsize on screen." src="/img/hic/overlay_controls.png" />

## Adjusting the color scale

Pick the ramp from the track menu's **Color scheme**:

- **Juicebox** - transparent to red, the default
- **Fall** - white through yellow and red to black
- **Reds** and **Blues** - white to red, and white to blue
- **Viridis**, **Magma**, **Inferno** and **Cividis** - perceptually uniform;
  cividis is the safest choice for readers with color vision deficiency

A bin with no contacts is left unpainted, so the page shows through it, and a
ramp that is dark at its low end would scatter dark specks across the sparse
long-range half of the matrix. Viridis, magma, inferno and cividis therefore run
light to dark unless [`color.reverse`](/docs/config/hiccolor/#slot-reverse)
reverses them, whether picked from the menu or named in a config. These are the
ramps every color scale in JBrowse names, so a config spells one as
[`color.scheme`](/docs/config/hiccolor/#slot-scheme).

**Color scheme → Emphasize faint contacts (95th percentile)** decides what the
ramp spans. <!-- menu-path-ok --> Off, the diagonal owns the scale and
everything below it washes out; on (the default) the scale saturates at the 95th
percentile of counts and TAD structure separates from background.

<Figure caption="Emphasize faint contacts off and on, each frame labeled with its setting." src="/img/hic/faint_contacts.png" links="Emphasize faint contacts off=hic/percentile_off,Emphasize faint contacts on=hic/percentile_on" />

**Color scheme → Log scale** maps counts to color through log(1 + count),
compressing the diagonal further still.

The scale's top follows the loaded counts, so it moves as you zoom and differs
between tracks. To compare two tracks, or one region at two zooms, on one scale,
pin the top as [`color.domainMax`](/docs/config/hiccolor/#slot-domainmax) in
[**Advanced → Edit plot...**](/docs/user_guides/edit_plot), or in each track's
config:

```json
"displayDefaults": { "color": { "domainMax": 500 } }
```

## Normalization

Raw contact counts have coverage biases from restriction-site density,
mappability, and GC content. `.hic` files ship precomputed matrix-balancing
vectors, and the track menu's **Normalization** submenu lists only the schemes
the file actually contains:

- **KR** - Knight-Ruiz, the recommended default
- **SCALE** - a faster approximation to KR
- **VC** and **VC_SQRT** - vanilla coverage
- **NONE** - raw observed counts

Vectors are stored per chromosome and binsize, so a file can list a scheme that
is missing at the binsize on screen. The menu ticks the normalization the loaded
matrix actually has rather than the one requested, and the unavailable entry
names the scheme that was substituted. Stepping to a finer resolution usually
resolves it.

## Comparing two regions

The matrix is fetched for every _pair_ of displayed regions. Open a second
region in the same view and the contacts between the two fill the space between
their triangles — the same geometry that puts a bright off-diagonal block at a
translocation's partner loci. The
[Hi-C structural variants tutorial](/docs/tutorials/hic_structural_variants)
shows that block on a real one, chr9 against chr22 in K562.

Inter-chromosomal matrices are commonly only stored at coarse binsizes. When the
auto-picked resolution is finer than anything the file holds for that pair, the
cross-block is absent while the intra-chromosomal triangles still draw. Step
**Coarser** until it appears.

The pairwise geometry of two regions scales to the whole genome. **View → Zoom →
Show all regions in assembly** puts every chromosome in the view at once, which
makes the fetch every chromosome against every other one and the drawing a block
diagonal: each chromosome is a triangle along the bottom edge, each pair of
chromosomes is the block between their two triangles, and the whole pyramid is
the genome against itself.

<Figure caption="GM12878 Hi-C at its coarsest binsize, hg38 chr1 to chrY in one view." src="/img/hic/whole_genome.png" />

How much figure this is depends on the file. A file storing only
intra-chromosomal contacts leaves every block between the triangles empty, so
check a candidate before reading anything into a blank off-diagonal. It also
decides the sensible ramp: a sparse file needs a log
[`color.scale`](/docs/config/hiccolor/#slot-scale) to lift its decayed
long-range bins off the floor, and a dense one comes back solid under the same
setting, since every bin then reaches the top of the scale.

The track has to be tall here. A pair's contacts are drawn in the wedge between
its two regions, so the drawing is as tall as the widest pair on screen is wide,
and at whole-genome zoom that is chr1 against chrY: half the view. A
hundred-pixel track shows the top slice of that pyramid, which is its faintest
corner.

## Comparing two conditions

Two maps of one assembly, two cell types or a treatment and its control, compare
as one track. **Compare with...** in a Hi-C track's menu lists the other Hi-C
tracks on its assembly; picking one opens a new track of this map over that one,
the view Juicebox calls Observed/Control. Both maps are scaled to one library
depth first, so two libraries sequenced to different depths compare, and a
contact either map lacks still draws: red where this map gained contacts, blue
where it lost them. Hovering a bin prints the ratio and both counts.

<Figure src="/img/hic/observed_control.png" caption="K562 over GM12878 at the BCR and ABL1 loci. The block between the two regions is the translocation K562 carries." links="Open this view=hic/observed_control" />

JBrowse refuses a control whose chromosomes differ in length from the map's,
since two builds share chromosome names and differ in coordinates. Only the
binsizes and normalizations both files hold are offered, and where the two fall
back to different normalizations for a region pair, both read raw counts.

## Fitting the triangle to the track height

The triangle's natural height is half the view width, so on a wide view it is
taller than the track and the lower half is cut off. **Layout → Fit to display
height** squashes it vertically to whatever height the track is dragged to,
trading square bins for seeing the whole triangle.

## Overlaying loops and interactions as arcs

Loop and interaction calls (HiCCUPS loops, ABC/EPIraction enhancer–gene links)
ship as [BEDPE](/docs/config_guides/file_types/) files with two endpoints per
line. A [mark display](/docs/config_guides/mark_display#links) draws each call
as a link from one end to its mate, so you can stack the called loops directly
above the matrix they came from.

Add the BEDPE file from **Add a track** and pick **Marks** from the track menu's
display types: the display sees each call name its other end and draws the arcs
with nothing configured. Then add the `.hic` matrix as a separate track and
reorder so the links sit above it. A link's `size` sets its stroke width, and
`encoding.size` scales it by the score.

## Compartments and subcompartments

At tens of megabases the matrix separates into two interleaved sets of regions
that preferentially contact regions of the same set: the A compartment, which is
gene-rich and active, and the B compartment, which is not. Against the steep
decay of contact with distance, that signal stays a faint texture in the counts.

**Values → Observed/expected** divides each count by the file's expected count
at its distance, the view Juicebox calls O/E. The decay drops out, so a block
between two regions of one compartment draws red and a block between opposite
compartments blue. The ratio runs from a quarter to fourfold around 1 on every
track, so two tracks set to it share one scale; hovering a bin prints the ratio,
the count and the expected count. Where the file has no expected values at the
binsize on screen, JBrowse draws the counts instead and the key says
**Contacts**.

<Figure src="/img/hic/observed_expected.png" caption="Observed/expected over hg19 chr8, red where two regions contact more than their distance predicts." links="Open this view=hic/observed_expected" />

Published compartment figures usually correlate those ratios as well, which
JBrowse does not draw. The compartment call itself is the closer match, and the
processing pipeline has already made it. ENCODE publishes two such files per
Hi-C experiment, both derived from the matrix in the same track:

- The **compartment eigenvector**, a BigWig. Its sign is the compartment
  assignment and its magnitude is how strongly a bin belongs, so it loads as an
  ordinary [quantitative track](/docs/user_guides/quantitative_track) and draws
  as a two-color plot around zero.
- **Subcompartments**, a BED. Clustering the interaction profiles splits A and B
  further, and the file has a color per class in its `itemRgb` column, so the
  track paints itself with no color configuration.

<Figure src="/img/hic/compartment_switch.png" caption="GM12878 and K562 eigenvector tracks over one window. At the EBF1 band they take opposite signs." links="Open this view=hic/compartment_switch" />

Two things about that figure are worth copying whenever you compare compartments
between samples, since getting either wrong invents a difference.

**Pin both eigenvector tracks to the same scale.** Left to autoscale, each track
scales to the min and max of its data, so the two stop being comparable. Set the
min and max score by hand, from the track menu or in config.

**An eigenvector identifies A only up to a sign.** The decomposition that
produces it is equally valid negated, so which sign means "active" is a property
of the file, and comparing two files means their orientations have to agree as
well. Both are checkable against the gene track: A is the gene-rich compartment
by definition, so the sign that coincides with the dense stretches of the gene
track is A. Do that check over a whole chromosome rather than in one frame,
since a few megabases can be gene-poor in both samples and settle nothing. In
both files above, positive is the gene-rich side.

The subcompartment classes need the same caution in a different place. The
cluster numbers a caller emits are arbitrary labels rather than the published
A1/A2/B1/B2/B3 naming, so a class number means nothing alone and two files only
compare because the same pipeline assigned the same colors. A class number can
move between two files without the eigenvector moving at all, which is a
relabelling rather than a switch.

## See also

- [Hi-C track configuration](/docs/config_guides/hic_track)
- [LinearHicDisplay config schema](/docs/config/linearhicdisplay)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_visualization)
- [Basic usage: opening tracks](/docs/user_guides/basic_usage#opening-tracks)
