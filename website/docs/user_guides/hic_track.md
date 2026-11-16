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
under the cursor pairs, with a tooltip giving both loci, the distance between
them on one chromosome, and the contact score. The guide follows the cursor over
empty bins too.

## Adjusting resolution

JBrowse picks a resolution to fit the view width: zoom in for finer bins, out
for larger-scale structure. The **Resolution** item in the track menu overrides
it:

- **Finer** and **Coarser** step through the binning levels stored in the file
- **The offset persists:** a step shifts the auto-selected level, so resolution
  still tracks your zoom
- **Reset** returns to auto

<Figure caption="Show → Show legend adds the color scale, its title naming the normalization and the binsize on screen." src="/img/hic/overlay_controls.png" />

## Adjusting the color scale

Pick the ramp from the track menu's **Color scheme**:

- **Juicebox** - transparent to red, the default
- **Fall** - white through yellow and red to black
- **Reds** and **Blues** - white to red, and white to blue
- **Viridis**, **Magma**, **Inferno** and **Cividis** - perceptually uniform;
  cividis is the safest choice for readers with color vision deficiency

Viridis, magma, inferno and cividis run light to dark here, so a sparse
long-range bin draws close to the background of an empty one rather than as a
dark speck;
[`encoding.color.scale.reverse`](/docs/config/hiccolor/#slot-scalereverse)
written `false` turns them back. A config names the ramp as
[`encoding.color.scale.scheme`](/docs/config/hiccolor/#slot-scalescheme).

**Color scheme → Emphasize faint contacts (95th percentile)** sets what the ramp
spans. <!-- menu-path-ok --> Off, the scale follows the diagonal and everything
below it washes out; on (the default) the scale saturates at the 95th percentile
of counts and TAD structure separates from background.

<Figure caption="Emphasize faint contacts off and on, each frame labeled with its setting." src="/img/hic/faint_contacts.png" links="Emphasize faint contacts off=hic/percentile_off,Emphasize faint contacts on=hic/percentile_on" />

**Color scheme → Log scale** maps counts to color through log(1 + count),
compressing the diagonal further still.

The scale's top follows the loaded counts, so it moves as you zoom and differs
between tracks. To compare two tracks, or one region at two zooms, on one scale,
pin the top as
[`encoding.color.scale.domainMax`](/docs/config/hiccolor/#slot-scaledomainmax)
in [**Advanced → Edit plot...**](/docs/user_guides/edit_plot), or in each
track's config:

```json
"displayDefaults": { "encoding": { "color": { "scale": { "domainMax": 500 } } } }
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

A file can list a scheme that is missing at the binsize on screen. The menu then
ticks the normalization the loaded matrix has, and the requested entry names the
scheme substituted for it. Stepping to a finer resolution usually resolves it.

## Comparing two regions

Open a second region in the same view and the contacts between the two fill the
space between their triangles, which is where a translocation's partner loci
draw a bright off-diagonal block. The
[Hi-C structural variants tutorial](/docs/tutorials/hic_structural_variants)
shows that block for chr9 against chr22 in K562.

- **A missing cross-block:** files often store inter-chromosomal contacts only
  at coarse binsizes, so the block can be absent while the triangles draw. Step
  **Coarser** until it appears
- **Whole genome:** **View → Zoom → Show whole genome** draws every chromosome
  as a triangle along the bottom edge and each pair as the block between their
  triangles
- **Blank off-diagonal:** a file storing only intra-chromosomal contacts leaves
  every block between the triangles empty, so check the file before reading a
  blank block
- **Log scale:** a sparse file needs a log
  [`encoding.color.scale.type`](/docs/config/hiccolor/#slot-scaletype) to show
  its long-range bins, and a dense one comes back solid under it
- **Track height:** the drawing is as tall as the widest pair is wide, half the
  view at whole-genome zoom, so a short track shows only the faint top slice

<Figure caption="GM12878 Hi-C at its coarsest binsize, hg38 chr1 to chrY in one view." src="/img/hic/whole_genome.png" />

## Comparing two conditions

**Compare with** in a Hi-C track's menu lists the other Hi-C tracks on its
assembly; picking one opens a new track of this map over that one, the view
Juicebox calls Observed/Control. Use it for two cell types, or a treatment and
its control.

- **Color:** red where this map gained contacts, blue where it lost them
- **Depth:** both maps are scaled to one library depth first, and a contact
  either map lacks still draws
- **Hover** prints the ratio and both counts
- **Same build only:** JBrowse refuses a control whose chromosome lengths differ
  from the map's
- **Shared levels:** only the binsizes and normalizations both files hold are
  offered; where the two fall back to different normalizations for a region
  pair, both draw from raw counts

<Figure src="/img/hic/observed_control.png" caption="K562 over GM12878 at the BCR and ABL1 loci. The block between the two regions is the translocation K562 carries." links="Open this view=hic/observed_control" />

## Fitting the triangle to the track height

The triangle's natural height is half the view width, so on a wide view it is
taller than the track and the lower half is cut off. **Layout → Fit to track
height** squashes it vertically to whatever height the track is dragged to.

## Overlaying loops and interactions as arcs

Loop and interaction calls (HiCCUPS loops, ABC/EPIraction enhancer–gene links)
ship as [BEDPE](/docs/config_guides/file_types/) files with two endpoints per
line. A [mark display](/docs/config_guides/mark_display#links) draws each call
as a link from one end to its mate, stacked above the matrix they came from.

Add the BEDPE file from **Add a track** and pick **Marks** from the track menu's
display types; the arcs draw with nothing configured. Then add the `.hic` matrix
as a separate track and reorder so the links sit above it. A link's
`strokeWidth` sets its stroke width, and `encoding.strokeWidth` bound to a field
scales it by the score.

## Compartments and subcompartments

At tens of megabases the matrix separates into two interleaved sets of regions
that preferentially contact regions of the same set: the A compartment, which is
gene-rich and active, and the B compartment, which is not. Against the decay of
contact with distance, that signal is a faint texture in the counts.

**Values → Observed/expected** divides each count by the file's expected count
at its distance, the view Juicebox calls O/E. A block between two regions of one
compartment draws red and a block between opposite compartments blue. The ratio
runs from a quarter to fourfold around 1 on every track, so two tracks set to it
share one scale; hovering a bin prints the ratio, the count and the expected
count. Where the file has no expected values at the binsize on screen, the track
draws the counts and the key says **Contacts**.

<Figure src="/img/hic/observed_expected.png" caption="Observed/expected over hg19 chr8, red where two regions contact more than their distance predicts." links="Open this view=hic/observed_expected" />

JBrowse draws no correlation matrix of those ratios; for the compartment call
itself, ENCODE publishes two files per Hi-C experiment, both derived from the
matrix:

- **Compartment eigenvector:** a BigWig whose sign is the compartment and whose
  magnitude is how strongly a bin belongs. It loads as an ordinary
  [quantitative track](/docs/user_guides/quantitative_track), a two-color plot
  around zero
- **Subcompartments:** a BED splitting A and B further, colored from its
  `itemRgb` column with no configuration

<Figure src="/img/hic/compartment_switch.png" caption="GM12878 and K562 eigenvector tracks over one window. At the EBF1 band they take opposite signs." links="Open this view=hic/compartment_switch" />

Comparing compartments between samples needs the tracks set up as in that
figure, or the difference can be spurious:

- **One scale:** autoscaled tracks are not comparable, so set both tracks' min
  and max score by hand, from the track menu or in config
- **One sign:** an eigenvector is equally valid negated, so check which sign is
  A against the gene track (A is the gene-rich side) over a whole chromosome,
  not one window. In both files above, positive is the gene-rich side
- **Subcompartment labels:** a caller's cluster numbers are arbitrary, not the
  published A1/A2/B1/B2/B3 naming, so two files compare only when one pipeline
  assigned them. A class number that changes while the eigenvector holds is a
  relabelling

## See also

- [Hi-C track configuration](/docs/config_guides/hic_track)
- [LinearHicDisplay config schema](/docs/config/linearhicdisplay)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_visualization)
- [Basic usage: opening tracks](/docs/user_guides/basic_usage#opening-tracks)
