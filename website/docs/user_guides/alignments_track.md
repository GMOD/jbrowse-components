---
id: alignments_track
title: Alignments track
---

import Figure from '../figure'

Visualizing alignments is an important aspect of genome browsers. This guide
will go over the main features of the "Alignments track." The alignments track
is a combination of a pileup and a coverage visualization.

### Pileup visualization

The pileup is the lower part of the alignments track and shows each of the reads
as boxes positioned on the genome.

By default the reads are colored red if they aligned to the forward strand of
the reference genome, or blue if they aligned to the reverse strand.

### Coverage visualization

The coverage visualization shows the depth-of-coverage of the reads at each
position on the genome, and also draws using colored boxes any occurrence of
mismatches between the read and the reference genome, so if 50% of the reads had
a T instead of the reference A, half the height of the coverage histogram would
contain a 'red' box.

<Figure caption="Screenshot showing the alignments track, which contains both a coverage view at the top and a pileup view at the bottom" src="/img/alignments.png" />

### Show soft clipping

If a read contains bases that do not map the the genome properly, they can
either be removed from the alignment (hard clipping) or can be included, and not
shown by default (soft clipping).

JBrowse 2 also contains an option to "show the soft clipping" that has occurred.
This can be valuable to show the stopToken around a region that contains
structural variation or difficult mappability.

<Figure caption="The soft clipping option is a toggle in the 'Pileup settings' menu." src="/img/alignments_soft_clipped_menu.png" />
<Figure caption="Shows what turning on soft-clipping enables for a simulated long-read dataset. There is a simulated structural variant, a deletion, at this position, so the read has bases that map to the other side of the deletion being revealed by this." src="/img/alignments_soft_clipped.png" />

### Sort by options

The alignments tracks can also be configured to "sort by" a specific attribute
for reads that span **the center line**.

By default the center line is not shown, but by showing it (detailed below) then
you will obtain a better idea of what the "sort by" option is doing.

### Showing the center line

1. Open the hamburger menu in the top left of the linear genome view
2. Select "Show center line"

<Figure caption="The 'show center line' option is a toggle in the LGV menu." src="/img/alignments_center_line_menu.png" />
<Figure caption="The center line is an indicator that shows what base pair underlies the center of the view." src="/img/alignments_center_line.png" />

:::info Note

The center line is used by the 'Sort by' function discussed in this section; the
sort is performed using properties of the feature, or even exact base pair
underlying the center line.

:::

### Sorting by base pair

Sorting by base pair will re-arrange the pileup so that the reads that have a
specific base pair mutation at the position crossing the center line (which is
1bp wide) will be arranged in a sorted manner. To enable Sort by base pair:

1. Open the track menu for the specific track using the vertical '...' in the
   track label
2. Select `Pileup settings`->`Sort by`->`Base pair`

<Figure caption="Illustrating the pileup re-ordering that happens when turning on the 'Sort by'->'Base pair'. The sorting is done by specifically what letter of each read underlies the current center line position (the center line is 1bp wide, so sorted by that exact letter)" src="/img/alignments_sort_by_base.png" />

### Sort, color and filter by tag

With these features, we can create expressive views of alignments tracks. For
example, in the below step-by-step guide, it shows how to color and sort the
reads by the HP tag:

<Figure caption="Step-by-step guide showing how to sort and color by haplotype with the HP tag." src="/img/alignments/haplotype.png" />

### Color by modifications/methylation

If you have data that marks DNA/RNA modifications using the MM tag in BAM/CRAM
format, then the alignments track can use these tags to color modifications. It
uses two modes:

1. All modifications - draws the modifications as they are
1. modifications - draws the modifications as they are
1. Methylation mode - draws both unmodified and modified CpGs (unmodified
   positions are not indicated by the MM tag and this mode considers the
   sequence context)

<Figure caption="The track menu can be used to access the settings to color by modifications or methylation." src="/img/alignments/modifications1.png" />
<Figure caption="Screenshot showing the same track in both modifications mode and methylation mode. This is a hypo-methylated CpG island (there are no methylation marks in a CpG island)" src="/img/alignments/modifications2.png" />
<Figure caption="After the setting has been enabled you can revisit the dialog box to see the current coloring settings." src="/img/alignments/modifications3.png" />

### Color by orientation

JBrowse uses the same color scheme as IGV for coloring by pair orientation.
These pair orientations can be used to reveal complex patterns of structural
variation.

See
[IGV's Interpreting Color by Pair Orientation guide](https://software.broadinstitute.org/software/igv/interpreting_pair_orientations)
for further details on interpreting these pair orientations.

<Figure caption="This shows an inverted duplication, the tandem duplication can produce green arrows which have reads pointing in opposite directions e.g. <-- and -->, while blue arrows which can indicate an inversion point in the same direction e.g. --> and -->." src="/img/inverted_duplication.png" />

### Sashimi-style arcs

The alignments track will draw sashimi-track style arcs across spliced
alignments (indicated by N in the CIGAR string). If the reads additionally are
tagged with XS tags, it will try to draw the arcs using the strand indicated by
the alignment.

<Figure caption="Sashimi-style arcs that are automatically drawn from spliced alignments. These arcs will be drawn by default on both short-reads e.g. RNA-seq and long reads e.g. Iso-Seq." src="/img/alignments_track_arcs.png" />

:::info Note

You can disable these by clicking on the track menu (vertical "..." next to
track label, then hovering over SNPCoverage options, and unchecking "Draw
arcs").

:::

### Insertion and clipping indicators

The alignments track will also draw an upside-down histogram of insertion and
soft/hard clipped read counts at all positions, and mark significant positions
(covering 30% of the reads) with a colored triangle.

<Figure caption="Clipping and insertion indicators are drawn at the top of the alignments track. Purple indicates insertions, the blue indicates soft clipping, and red indicates hard clipping." src="/img/alignment_clipping_indicators.png" />

Also, insertions that are larger than 10bp are marked with a larger purple
rectangle, seen in the screenshot below. Generally, long reads span larger
insertions better, so this feature is more prominent with large reads.

<Figure caption="Large insertion indicator drawn from long reads, along with the 'show soft clipping' setting turned on for a short read track." src="/img/insertion_indicators.png" />

:::info Note

You can disable these by clicking on the track menu (vertical "..." next to
track label, then hovering over SNPCoverage options, and unchecking "Draw
insertion/clipping indicators" and "Draw insertion/clipping counts").

:::

### Using the "Arc display"

In JBrowse 2.3.0, we introduced the ability to render "Arcs" to show long range
connections between reads. This information is very valuable for revealing
structural variation, misassemblies, etc.

To enable, use the track menu to launch "Display types"->"Arc display" or
"Replace lower panel with..."->"Arc display"

<Figure caption="Menu item for selecting the 'Arc display' using the track menu. In this case we are just replacing the 'lower panel' allowing the arcs to be displayed alongside the coverage" src="/img/alignments/select_arc_display.png" />

The "Arc display" bezier curves will automatically try to fit into the window
when you click and drag the track height, so you can create a dense display of
arcs using multiple data tracks

Long range interactions are indicated using vertical lines (connecting to other
chromosomes for example) or larger semi-circular arcs for off-screen
interactions). You can turn off rendering these events using the track menu if
they are not relevant to your interest.

<!-- http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=share-fDL8SrEPoO&password=6rsxL -->

<Figure caption="The arc display showing a deletion with Illumina paired-end reads and Nanopore ultra-long reads on HG002. Also shows the menu-items for hiding inter-region lines." src="/img/alignments/arc_selector.png" />

### Using the "Read cloud display"

Similar to the "Arc display" we also offer what we call the "Read cloud"
display. It is similar in some ways to the "Arc display" but renders paired-end
or split read features as connected and stratified by the distance between their
connections logarithmically on the "y-position" of the track. Similar to the
"Arc display", clicking and dragging the track height of the "Read cloud
display" will re-pack features into that area.

<Figure caption="The 'Arc display' and 'Read cloud' being shown for the same dataset, showing some synthetic SVs on our sample volvox data. The read cloud display uniquely shows insertion (pink pairs) better than the arc display." src="/img/alignments/read_cloud.png" />

### Compacting the view of alignments tracks

Users can create a more compact display of alignments using Track menu->Pileup
settings->Set feature height->Compact

<Figure caption="Compact view of alignments" src="/img/alignments/compact.png" />
