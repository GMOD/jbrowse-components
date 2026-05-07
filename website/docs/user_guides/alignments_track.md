---
id: alignments_track
title: Alignments track
description: BAM/CRAM pileup and coverage displays
guide_category: Track types
---

import Figure from '../figure'

The alignments track combines a pileup and a coverage visualization.

### Pileup visualization

The pileup (lower panel) shows reads as boxes positioned on the genome.

By default, forward-strand reads are red; reverse-strand reads are blue.

### Coverage visualization

The coverage track shows depth-of-coverage at each position and highlights
mismatches with colored boxes proportional to their frequency — if 50% of reads
have a T where the reference has A, half the histogram height is colored.

<Figure caption="The alignments track with coverage (top panel, depth histogram with mismatches colored proportionally) and pileup (bottom panel, individual reads as colored boxes — red for forward strand, blue for reverse strand)." src="/img/alignments.png" />

### Show soft clipping

Aligners clip terminal bases that cannot be incorporated into an alignment: hard
clipping discards them from the BAM record; soft clipping retains them in the
BAM sequence (marked 'S' in the CIGAR) but excludes them from the alignment.
JBrowse does not render soft-clipped bases by default, but enabling "Show soft
clipping" (Pileup settings menu) can reveal signal around structural variants
and difficult mappability regions.

<Figure caption="The soft clipping option is a toggle in the 'Pileup settings' menu." src="/img/alignments_soft_clipped_menu.png" />
<Figure caption="Soft-clipped reads at a breakpoint edge (~position 2,700, right side). With Show soft clipping enabled, the overhanging bases appear as colored nucleotides on each read; the dense cluster of colored bases at a common endpoint reveals where reads cannot align through a structural variant boundary." src="/img/alignments_soft_clipped.png" />

### Sort by options

The alignments track can be configured to sort reads by a specific attribute at
**the center line**.

### Showing the center line

1. Open the hamburger menu in the top left of the linear genome view
2. Select "Show center line"

<Figure caption="The 'show center line' option is a toggle in the LGV menu." src="/img/alignments_center_line_menu.png" />
<Figure caption="The center line is an indicator that shows what base pair underlies the center of the view." src="/img/alignments_center_line.png" />

:::info Note

The sort is performed using properties of the read, or the exact base pair
underlying the center line.

:::

### Sorting by base pair

Sorts the pileup by the base each read has at the center line position. To
enable:

1. Open the track menu using the vertical '...' in the track label
2. Select `Pileup settings` → `Sort by` → `Base pair`

<Figure caption="Illustrating the pileup re-ordering that happens when turning on the 'Sort by'->'Base pair'. The sorting is done by specifically what letter of each read underlies the current center line position (the center line is 1bp wide, so sorted by that exact letter)" src="/img/alignments_sort_by_base.png" />

### Sort, color and filter by tag

The guide below shows how to color and sort reads by the HP tag:

<Figure caption="Four-step walkthrough for coloring and sorting reads by haplotype. (1) Open Track menu → Pileup settings → Color by → Tag. (2) Enter HP as the tag name. (3) Reads are now colored by HP value, one color per haplotype. (4) Open Sort by → Tag → HP to stack each haplotype's reads into contiguous rows." src="/img/alignments/haplotype.png" />

### Color by modifications/methylation

The alignments track can color DNA/RNA modifications using the MM tag in
BAM/CRAM files. It uses two modes:

1. All modifications - draws the modifications as they are
1. Methylation mode - draws both unmodified and modified CpGs (unmodified
   positions are not indicated by the MM tag and this mode considers the
   sequence context)

<Figure caption="The track menu can be used to access the settings to color by modifications or methylation." src="/img/alignments/modifications1.png" />
<Figure caption="Screenshot showing the same track in both modifications mode and methylation mode. This is a hypo-methylated CpG island (there are no methylation marks in a CpG island)" src="/img/alignments/modifications2.png" />
<Figure caption="After the setting has been enabled you can revisit the dialog box to see the current coloring settings." src="/img/alignments/modifications3.png" />

### Color by orientation

JBrowse uses the same color scheme as IGV for coloring by pair orientation.
These pair orientations can be used to reveal complex patterns of structural
variation. For a full breakdown of what each color indicates and how to
interpret each SV type, see the
[structural variant visualization guide](/docs/user_guides/sv_visualization).

<Figure caption="This shows an inverted duplication. The tandem duplication produces green arrows (RL orientation, reads pointing away from each other, e.g. <-- and -->), while the inversion boundaries produce teal (LL) and dark blue (RR) arrows pointing in the same direction." src="/img/inverted_duplication.png" />

### Sashimi-style arcs

Spliced alignments (N in the CIGAR string) are drawn with sashimi-style arcs. If
reads carry an XS tag, arcs reflect the strand of the alignment.

<Figure caption="Sashimi-style arcs that are automatically drawn from spliced alignments. These arcs will be drawn by default on both short-reads e.g. RNA-seq and long reads e.g. Iso-Seq." src="/img/alignments_track_arcs.png" />

:::info Note

Disable via the track menu (vertical "..." next to track label) → SNPCoverage settings → uncheck "Draw arcs".

:::

### Insertion and clipping indicators

An inverted histogram of insertion and clipping counts is drawn above the
pileup; positions where >30% of reads carry an event are marked with a colored
triangle.

<Figure caption="Clipping and insertion indicators are drawn at the top of the alignments track. Purple indicates insertions, the blue indicates soft clipping, and red indicates hard clipping." src="/img/alignment_clipping_indicators.png" />

Insertions >10bp are marked with a larger purple rectangle. This signal is more
prominent in long-read data, which can span larger insertions.

<Figure caption="Large insertion indicator drawn from long reads, along with the 'show soft clipping' setting turned on for a short read track." src="/img/insertion_indicators.png" />

:::info Note

Disable via the track menu (vertical "..." next to track label) → SNPCoverage settings → uncheck "Draw insertion/clipping indicators" and "Draw
insertion/clipping counts".

:::

### Using the "Read arc display"

The read arc display renders bezier curves between paired-end or split-read
ends, making long-range connections visible for detecting SVs and misassemblies.

Enable via Track menu → Display types → Read arc display (or "Replace lower
panel with..." to show arcs alongside coverage).

<Figure caption="Track menu → Display types (or Replace lower panel with...) shows three lower-panel options: Pileup display (default), Read arc display, and Linked reads display. Selecting Read arc display replaces the pileup with bezier arc curves while keeping the coverage panel." src="/img/alignments/select_arc_display.png" />

Dragging the track height repacks the arcs to fit, allowing dense displays with
multiple tracks. Inter-chromosomal connections appear as vertical lines;
off-screen interactions as larger arcs. Both can be disabled via the track menu.

[Live demo — HG002 deletion with Nanopore and Illumina reads in arc display](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-fDL8SrEPoO&password=6rsxL)

<Figure caption="Read arc display for a deletion in HG002. Illumina short arcs (top) and Nanopore long sweeping arcs (bottom) both span the deleted region — the arcs are longer than neighboring pairs, indicating the deletion. Color scheme is Insert size ± 3σ: red arcs have inserts larger than expected." src="/img/alignments/arc_selector.png" />

### Using the "Linked reads display"

The linked reads display connects paired-end reads and split alignments as rows
stratified by log-scaled distance between ends. Dragging the track height
repacks reads into the available space.

<Figure caption="The 'Arc display' and 'Linked reads display' being shown for the same dataset, showing some synthetic SVs on our sample volvox data. The linked reads display uniquely shows insertion (pink pairs) better than the arc display." src="/img/alignments/read_cloud.png" />

### Compacting the view of alignments tracks

Enable compact display via Track menu → Pileup settings → Set feature height →
Compact.

<Figure caption="Track menu → Pileup settings → Set feature height, showing the Normal and Compact options. Compact reduces read height so more reads fit vertically, useful for high-coverage regions or when you only need to see orientation patterns rather than base-level detail." src="/img/alignments/compact.png" />
