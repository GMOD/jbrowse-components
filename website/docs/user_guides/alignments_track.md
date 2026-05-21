---
id: alignments_track
title: Alignments track
---

import Figure from '../figure'

The alignments track combines a pileup (one box per read) and a coverage
histogram (depth at each position, with mismatches highlighted).

### Pileup

Each read is drawn as a box at its mapped position. Reads are grey by default,
and the track has several "Color by" options — by strand (red = forward, blue =
reverse), pair orientation, insert size, methylation, or BAM tag, among others.

### Coverage

The coverage row shows depth-of-coverage at each position. Mismatches are drawn
as colored boxes inside the histogram bar: if 50% of the reads have a T where
the reference has an A, the top half of the bar at that position will be red
(for T).

<Figure caption="Screenshot showing the alignments track, which contains both a coverage view at the top and a pileup view at the bottom" src="/img/alignments.png" />

### Show soft clipping

When a read has bases at one end that don't align to the reference, the aligner
can mark them as **soft-clipped** (kept in the read sequence but flagged as
unaligned) or **hard-clipped** (dropped from the read entirely). JBrowse hides
soft-clipped bases by default.

Turn on the "Show soft clipping" option in the track menu to display them. This
is useful around structural variants and regions with difficult mappability —
clusters of soft-clipped bases often mark a breakpoint.

<Figure caption="The soft clipping option is a toggle in the 'Pileup settings' menu." src="/img/alignments_soft_clipped_menu.png" />
<Figure caption="Shows what turning on soft-clipping enables for a simulated long-read dataset. There is a simulated structural variant, a deletion, at this position, so the read has bases that map to the other side of the deletion being revealed by this." src="/img/alignments_soft_clipped.png" />

### Sort by options

The pileup can be re-ordered so that reads crossing **the center line** of the
view are grouped by a specific attribute — base pair, read strand, mapping
quality, or BAM tag. The center line is the reference point for the sort, so
turning it on (next section) makes it much clearer what's happening.

### Showing the center line

Toggle "Show center line" from the linear genome view menu. The center line is a
1bp-wide indicator at the middle of the view that the "Sort by" function uses as
its reference point.

<Figure caption="The 'show center line' option is a toggle in the LGV menu." src="/img/alignments_center_line_menu.png" />
<Figure caption="The center line is an indicator that shows what base pair underlies the center of the view." src="/img/alignments_center_line.png" />

### Sorting by base pair

With "Sort by → Base pair" selected in the track menu, the pileup is re-arranged
so that reads carrying the same base at the center-line position are grouped
together. Combined with the center line indicator, this lets you quickly see
haplotype-correlated SNPs.

<Figure caption="Sort by Base pair groups reads by which nucleotide they carry at the center-line position." src="/img/alignments_sort_by_base.png" />

### Sort, color, and filter by tag

You can sort, color, or filter reads by any BAM tag. A common workflow is
coloring and sorting by the HP (haplotype) tag to see phased reads.

<Figure caption="Step-by-step guide showing how to sort and color by haplotype with the HP tag." src="/img/alignments/haplotype.png" />

### Color by modifications/methylation

If a BAM or CRAM file has MM-tag annotations for DNA/RNA modifications, the
alignments track can color reads by modification. Two modes are available:

- **Modifications** — draws each modification at the positions reported in the
  MM tag
- **Methylation** — draws both unmodified and modified CpGs. Unmodified
  positions are not in the MM tag; this mode infers them from the reference CpG
  context

<Figure caption="The track menu can be used to access the settings to color by modifications or methylation." src="/img/alignments/modifications1.png" />
<Figure caption="Screenshot showing the same track in both modifications mode and methylation mode. This is a hypo-methylated CpG island (there are no methylation marks in a CpG island)" src="/img/alignments/modifications2.png" />
<Figure caption="After the setting has been enabled you can revisit the dialog box to see the current coloring settings." src="/img/alignments/modifications3.png" />

### Color by orientation

The pair-orientation color scheme matches IGV's, and surfaces complex structural
variants. See IGV's
[paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/#pair-orientation)
for a reference of which orientation patterns map to which colors.

<Figure caption="An inverted duplication. Green arrows are reads pointing in opposite directions (--&gt; &lt;--), characteristic of tandem duplication; blue arrows point in the same direction (--&gt; --&gt;), characteristic of inversion." src="/img/inverted_duplication.png" />

### Sashimi-style arcs

Sashimi-style arcs are drawn automatically over spliced alignments (reads with
`N` in the CIGAR). When reads carry the XS tag, the arc strand follows that tag.

<Figure caption="Sashimi-style arcs over spliced alignments. Drawn by default for both short-read (RNA-seq) and long-read (Iso-Seq) data." src="/img/alignments_track_arcs.png" />

The SNPCoverage options in the track menu can turn them off.

### Insertion and clipping indicators

The coverage row shows an upside-down histogram of insertions and soft/hard
clips at each position, with a colored triangle when an event exceeds 30% of the
reads at that base.

<Figure caption="Indicators above the coverage track: purple = insertion, blue = soft clip, red = hard clip." src="/img/alignment_clipping_indicators.png" />

Insertions larger than 10bp also get a larger purple rectangle. This is most
prominent with long reads, which span larger insertions.

<Figure caption="Large-insertion indicator from long reads; 'show soft clipping' is also enabled on a short-read track for comparison." src="/img/insertion_indicators.png" />

The indicators and counts can be toggled independently from the SNPCoverage
options in the track menu.

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

Switch to it from the track menu, either as the main display ("Display types")
or as a replacement for just the lower panel ("Replace lower panel with...").

<Figure caption="Switching to the arc display from the track menu, replacing the lower (pileup) panel so arcs are shown alongside coverage." src="/img/alignments/select_arc_display.png" />

The arcs automatically re-fit when you resize the track height, so dragging the
track taller produces a denser display.

Long-range interactions outside the current view are drawn as vertical lines (to
other chromosomes, for example) or large semicircular arcs (for off-screen
partners). The track menu has toggles to hide these if they're distracting.

https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-fDL8SrEPoO&password=6rsxL

<Figure caption="The arc display showing a deletion with Illumina paired-end reads and Nanopore ultra-long reads on HG002. Also shows the menu-items for hiding inter-region lines." src="/img/alignments/arc_selector.png" />

### Read cloud display

The read cloud display also connects paired or split reads, but lays them out on
the Y axis by the **log of the distance between mates**. This makes the distance
distribution of pairs visible at a glance, and reveals patterns the arc display
can flatten — for example, insertion pairs (drawn pink) separate clearly from
background.

Like the arc display, dragging the track taller re-packs the features into the
available height.

<Figure caption="The arc display (top) and read cloud (bottom) on the same synthetic SV dataset. The read cloud surfaces insertion pairs (pink) more clearly than the arc display." src="/img/alignments/read_cloud.png" />

### Compact display

The track can be set to a more compact feature height from the track menu's
pileup settings.

<Figure caption="Compact view of alignments" src="/img/alignments/compact.png" />
