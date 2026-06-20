---
title: Alignments track
description: Learn how to show BAM and CRAM files
guide_category: Track types
---

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

<Figure caption="Screenshot showing the alignments track, which contains both a coverage view at the top and a pileup view at the bottom" src="/img/volvox_alignments.png" />

### Show soft clipping

When a read has bases at one end that don't align to the reference, the aligner
can mark them as **soft-clipped** (kept in the read sequence but flagged as
unaligned) or **hard-clipped** (dropped from the read entirely). JBrowse hides
soft-clipped bases by default.

Turn on the "Show soft clipping" option in the track menu to display them. This
is useful around structural variants and regions with difficult mappability —
clusters of soft-clipped bases often mark a breakpoint.

<Figure caption="Enabling 'Show soft clipping' from the track menu's 'Show...' submenu (top), and the result on a simulated long-read dataset (bottom): a simulated deletion causes reads to have bases mapping to the other side of the breakpoint." src="/img/alignments_soft_clipped_menu.png" />

### Sort by options

The pileup can be re-ordered so that reads crossing **the center line** of the
view are grouped by their value at that position for a specific attribute — base
pair, read strand, mapping quality, or BAM tag. Showing the center line (next
section) makes the sort reference point visible.

### Showing the center line

Toggle "Show center line" from the linear genome view menu. The center line is a
1bp-wide indicator at the middle of the view that the "Sort by" function uses as
its reference point.

<Figure caption="Toggling 'Show center line' from the LGV view menu (top), and the resulting 1bp-wide center line indicator over the pileup (bottom)." src="/img/alignments_center_line.png" />

### Sorting by base pair

With **Sort by base pair** selected in the track menu, the pileup is re-arranged
so that reads carrying the same base at the center-line position are grouped
together. Combined with the center line indicator, this lets you quickly see
haplotype-correlated SNPs.

<Figure caption="Sort by Base pair groups reads by which nucleotide they carry at the center-line position." src="/img/alignments_sort_by_base.png" />

### Sort, color, and filter by tag

You can sort, color, or filter reads by any BAM tag. A common workflow is
coloring and sorting by the HP (haplotype) tag to see phased reads.

<Figure caption="HG002 ONT reads grouped and colored by the HP (haplotype) tag — the pileup splits into one tinted section per haplotype, so phased reads and their haplotype-correlated SNPs read at a glance." src="/img/alignments/haplotype.png" />

### Filtering reads

The **Filter by** dialog hides reads based on their SAM flags. The common use is
cleaning up a dense pileup: exclude PCR/optical duplicates and secondary
alignments, or keep only properly-paired reads. You can also filter to a
specific read name, or by a tag value — `HP:1` for one haplotype, or `HP:*` for
any read carrying the tag.

<Figure caption="The Filter by dialog. The two flag columns are an include/exclude bitmask: by default unmapped, QC-fail, and duplicate reads are excluded. Tag and read-name filters are below." src="/img/alignments/filter_dialog.png" />

### Grouping reads

**Group by** splits the pileup into stacked sections inside the track, one per
group, sharing a single coverage scale. Grouping by the HP tag turns a phased
BAM into one pileup per haplotype, which is easier to read than coloring alone.
Strand, read group (RG), or any other tag work the same way.

The track menu's **Group by...** opens a dialog where you pick strand or a tag
(e.g. `HP` for haplotype). Each group becomes its own coverage+pileup section
with a divider label, so the haplotypes read separately.

<Figure caption="A 27 bp heterozygous deletion in HG002 ONT reads, with the pileup separated by HP tag into haplotype 1 (pink) and haplotype 2 (blue). The deletion-supporting reads concentrate in a single haplotype." src="/img/smalldel.png" />

### Color by modifications/methylation

If a BAM or CRAM file has MM-tag annotations for DNA/RNA modifications, the
alignments track can color reads by modification. Two modes are available:

- **Modifications** — draws each modification at the positions reported in the
  MM tag
- **Methylation** — draws both unmodified and modified CpGs. Unmodified
  positions are not in the MM tag; this mode infers them from the reference CpG
  context

<Figure caption="COLO829 tumor nanopore reads colored by base modification (5mC/5hmC) across a UCSC CpG island on chr20. Enable this from the track menu's Color by → Base modifications → All modification types." src="/img/alignments/modifications1.png" />
<Figure caption="Screenshot showing the same track in both modifications mode and methylation mode. This is a hypo-methylated CpG island (there are no methylation marks in a CpG island)" src="/img/alignments/modifications2.png" />

### Color by strand

Reads are tinted by the strand they map to:

<!-- COLOR_TABLE alignments-strand START -->

| Color                                                                                                                                                                       | Name           | Value     | Description                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------- | ------------------------------- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#EC8B8B;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#EC8B8B"></span> | Forward strand | `#EC8B8B` | Read maps to the forward strand |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#8F8FD8;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#8F8FD8"></span> | Reverse strand | `#8F8FD8` | Read maps to the reverse strand |

<!-- COLOR_TABLE alignments-strand END -->

### Color by orientation

The pair-orientation color scheme matches IGV's, and surfaces complex structural
variants. See IGV's
[paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/#pair-orientation)
for background. Assuming standard `fr` (Illumina) pairs:

<!-- COLOR_TABLE alignments-pair-orientation START -->

| Color                                                                                                                                                                       | Name                                       | Value     | Description                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------- | ---------------------------------------------------------------------------------- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#d3d3d3;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#d3d3d3"></span> | LR (→ ←, normal proper pair)               | `#d3d3d3` | Concordant                                                                         |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#0099bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#0099bb"></span> | RL (← →, mates point away from each other) | `#0099bb` | Abnormal orientation                                                               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#4d9a4d;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#4d9a4d"></span> | LL (→ →, both mates forward strand)        | `#4d9a4d` | Abnormal orientation                                                               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#5555bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#5555bb"></span> | RR (← ←, both mates reverse strand)        | `#5555bb` | Abnormal orientation                                                               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#6e4b3a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#6e4b3a"></span> | Inter-chromosomal                          | `#6e4b3a` | Mate maps to a different chromosome; colored distinctly rather than by orientation |

<!-- COLOR_TABLE alignments-pair-orientation END -->

For a worked example of pair-orientation coloring on a real structural variant,
see the [SV visualization guide](/docs/user_guides/sv_visualization).

### Color by insert size

For paired-end data, **Color by → Insert size** tints reads by the distance
between mates. Pairs mapping farther apart than expected flag a possible
deletion; pairs much closer suggest an insertion. The gradient variant shades
the distance continuously instead of in bins. Together with pair-orientation
coloring and the read-connection arcs, this is the main way to scan short-read
data for structural variants — the
[SV visualization guide](/docs/user_guides/sv_visualization) walks through
worked examples.

### Sashimi-style arcs

Sashimi-style arcs are drawn automatically over spliced alignments (reads with
`N` in the CIGAR). When reads carry the XS tag, the arc strand follows that tag.

<Figure caption="Sashimi-style arcs over spliced alignments. Drawn by default for both short-read (RNA-seq) and long-read (Iso-Seq) data." src="/img/alignments_track_arcs.png" />

Turn them off from the track menu.

### Insertion and clipping indicators

The coverage row shows an upside-down histogram of insertions and soft/hard
clips at each position, with a colored triangle when an event exceeds a
depth-dependent fraction of the reads at that base. The threshold scales with
depth (roughly 30% at high coverage rising toward 80% at low coverage) to
suppress spurious indicators.

<!-- COLOR_TABLE alignments-indicators START -->

| Color                                                                                                                                                                       | Name      | Value     | Description                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- | ------------------------------------------------------------ |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#800080;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#800080"></span> | Insertion | `#800080` | Reads carry an insertion relative to the reference           |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#00f;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#00f"></span>       | Soft clip | `#00f`    | Reads are soft-clipped (clipped bases retained in the read)  |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#f00;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#f00"></span>       | Hard clip | `#f00`    | Reads are hard-clipped (clipped bases removed from the read) |

<!-- COLOR_TABLE alignments-indicators END -->

<Figure caption="Indicators above the coverage track, colored as in the table above." src="/img/alignment_clipping_indicators.png" />

Insertions larger than 10bp also get a larger purple rectangle. This is most
prominent with long reads, which span larger insertions.

<Figure caption="A large insertion shown across nanopore, PacBio, and Illumina reads: long reads span the insertion and show it as a dense column of purple insertion rectangles." src="/img/insertion.png" />

The indicators and counts can be toggled independently from the track menu.

### Paired arcs

The paired arcs mode draws bezier curves between paired or split reads,
surfacing long-range connections that are useful for spotting structural
variants and misassemblies.

Enable paired arcs from the track menu's **Read connections** submenu.

<Figure caption="Paired arcs drawn over HG002 Illumina reads across a structural variant; bezier curves connect mates, with long-range and discordant pairs standing out from the short local arcs." src="/img/alignments/arc_display.png" />

<Figure caption="Enabling paired arcs from the Read connections submenu, showing arcs alongside the coverage panel." src="/img/alignments/select_arc_display.png" />

The arcs automatically re-fit when you resize the track height, so dragging the
track taller produces a denser display.

Long-range interactions outside the current view are drawn as vertical lines (to
other chromosomes, for example) or large semicircular arcs (for off-screen
partners). The track menu has toggles to hide these if they're distracting.

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-fDL8SrEPoO&password=6rsxL)

<Figure caption="Discordant paired-end arcs over an HG002 structural variant (Illumina 2x250 reads with the GIAB SV call above), with the track menu open at Show... → Advanced where the off-screen and inter-chromosomal arc toggles live." src="/img/alignments/arc_selector.png" />

### Linked reads

The linked reads mode also connects paired or split reads, but lays them out on
the Y axis by the **log of the distance between mates**. This makes the distance
distribution of pairs visible at a glance, and reveals patterns paired arcs can
flatten — for example, insertion pairs (drawn pink) separate clearly from
background.

Enable linked reads from the track menu's **Read connections** submenu. Like
paired arcs, dragging the track taller re-packs the features into the available
height.

<Figure caption="Linked reads on a synthetic SV dataset. Reads are stratified on the Y axis by the log distance between mates, surfacing insertion pairs (drawn pink) clearly against the background." src="/img/alignments/read_cloud.png" />

### Compact display

The track can be set to a more compact feature height from the track menu's
pileup settings.

<Figure caption="Compact view of alignments" src="/img/alignments/compact.png" />
