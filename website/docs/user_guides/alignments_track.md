---
id: alignments_track
title: Alignments track
---

import Figure from '../figure'

The alignments track combines a pileup (one box per read) and a coverage
histogram (depth at each position, with mismatches highlighted).

### Pileup

Each read is drawn as a box at its mapped position. Reads are grey by default,
and the track has several "Color by" options — by strand (red = forward, blue
= reverse), pair orientation, insert size, methylation, or BAM tag, among
others.

### Coverage

The coverage row shows depth-of-coverage at each position. Mismatches are
drawn as colored boxes inside the histogram bar: if 50% of the reads have a T
where the reference has an A, the top half of the bar at that position will be
red (for T).

<Figure caption="Screenshot showing the alignments track, which contains both a coverage view at the top and a pileup view at the bottom" src="/img/alignments.png" />

### Show soft clipping

When a read has bases at one end that don't align to the reference, the
aligner can mark them as **soft-clipped** (kept in the read sequence but
flagged as unaligned) or **hard-clipped** (dropped from the read entirely).
JBrowse hides soft-clipped bases by default.

Turn on the "Show soft clipping" option in the track menu to display them.
This is useful around structural variants and regions with difficult
mappability — clusters of soft-clipped bases often mark a breakpoint.

<Figure caption="The soft clipping option is a toggle in the 'Pileup settings' menu." src="/img/alignments_soft_clipped_menu.png" />
<Figure caption="Shows what turning on soft-clipping enables for a simulated long-read dataset. There is a simulated structural variant, a deletion, at this position, so the read has bases that map to the other side of the deletion being revealed by this." src="/img/alignments_soft_clipped.png" />

### Sort by options

The pileup can be re-ordered so that reads crossing **the center line** of the
view are grouped by a specific attribute — base pair, read strand, mapping
quality, or BAM tag. The center line is the reference point for the sort, so
turning it on (next section) makes it much clearer what's happening.

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

If a BAM or CRAM file has MM-tag annotations for DNA/RNA modifications, the
alignments track can color reads by modification. Two modes are available:

- **Modifications** — draws each modification at the positions reported in the
  MM tag
- **Methylation** — draws both unmodified and modified CpGs. Unmodified
  positions are not in the MM tag; this mode infers them from the reference
  CpG context

<Figure caption="The track menu can be used to access the settings to color by modifications or methylation." src="/img/alignments/modifications1.png" />
<Figure caption="Screenshot showing the same track in both modifications mode and methylation mode. This is a hypo-methylated CpG island (there are no methylation marks in a CpG island)" src="/img/alignments/modifications2.png" />
<Figure caption="After the setting has been enabled you can revisit the dialog box to see the current coloring settings." src="/img/alignments/modifications3.png" />

### Color by orientation

JBrowse uses the same color scheme as IGV for coloring by pair orientation.
These pair orientations can be used to reveal complex patterns of structural
variation.

See
[IGV's Interpreting Color by Pair Orientation guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/#pair-orientation)
for further details on interpreting these pair orientations.

<Figure caption="This shows an inverted duplication, the tandem duplication can produce green arrows which have reads pointing in opposite directions e.g. <-- and -->, while blue arrows which can indicate an inversion point in the same direction e.g. --> and -->." src="/img/inverted_duplication.png" />

### Sashimi-style arcs

The alignments track will draw sashimi-track style arcs across spliced
alignments (indicated by N in the CIGAR string). If the reads additionally are
tagged with XS tags, it will try to draw the arcs using the strand indicated by
the alignment.

<Figure caption="Sashimi-style arcs that are automatically drawn from spliced alignments. These arcs will be drawn by default on both short-reads e.g. RNA-seq and long reads e.g. Iso-Seq." src="/img/alignments_track_arcs.png" />

Disable them under the track menu's SNPCoverage options if they're not useful
for your data.

### Insertion and clipping indicators

The alignments track will also draw an upside-down histogram of insertion and
soft/hard clipped read counts at all positions, and mark significant positions
(covering 30% of the reads) with a colored triangle.

<Figure caption="Clipping and insertion indicators are drawn at the top of the alignments track. Purple indicates insertions, the blue indicates soft clipping, and red indicates hard clipping." src="/img/alignment_clipping_indicators.png" />

Also, insertions that are larger than 10bp are marked with a larger purple
rectangle, seen in the screenshot below. Generally, long reads span larger
insertions better, so this feature is more prominent with large reads.

<Figure caption="Large insertion indicator drawn from long reads, along with the 'show soft clipping' setting turned on for a short read track." src="/img/insertion_indicators.png" />

The track menu's SNPCoverage options let you hide the indicators and their
counts independently.

#### How the indicator threshold works

A triangle indicator is drawn when an event (insertion, soft clip, or hard clip)
occurs in more than 30% of reads at that position. The depth used for this
calculation is `max(coverageDepth[pos - 1], coverageDepth[pos])` — the larger of
the two bases flanking the interbase position. This correctly handles cliffs
where reads pile up on one side and then stop, such as when many reads end with
soft clipping at the same boundary. The tooltip percentage uses the same local
depth.

### Arc display

The arc display draws bezier curves between paired or split reads, surfacing
long-range connections that are useful for spotting structural variants and
misassemblies.

Switch to it from the track menu, either as the main display ("Display
types") or as a replacement for just the lower panel ("Replace lower panel
with...").

<Figure caption="Switching to the arc display from the track menu, replacing the lower (pileup) panel so arcs are shown alongside coverage." src="/img/alignments/select_arc_display.png" />

The arcs automatically re-fit when you resize the track height, so dragging
the track taller produces a denser display.

Long-range interactions outside the current view are drawn as vertical lines
(to other chromosomes, for example) or large semicircular arcs (for
off-screen partners). The track menu has toggles to hide these if they're
distracting.

https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-fDL8SrEPoO&password=6rsxL

<Figure caption="The arc display showing a deletion with Illumina paired-end reads and Nanopore ultra-long reads on HG002. Also shows the menu-items for hiding inter-region lines." src="/img/alignments/arc_selector.png" />

### Read cloud display

The read cloud display also connects paired or split reads, but lays them out
on the Y axis by the **log of the distance between mates**. This makes the
distance distribution of pairs visible at a glance, and reveals patterns the
arc display can flatten — for example, insertion pairs (drawn pink) separate
clearly from background.

Like the arc display, dragging the track taller re-packs the features into
the available height.

<Figure caption="The arc display (top) and read cloud (bottom) on the same synthetic SV dataset. The read cloud surfaces insertion pairs (pink) more clearly than the arc display." src="/img/alignments/read_cloud.png" />

### Compact display

The track can be set to a more compact feature height from the track menu's
pileup settings.

<Figure caption="Compact view of alignments" src="/img/alignments/compact.png" />
