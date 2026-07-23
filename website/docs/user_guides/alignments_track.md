---
title: Alignments track
description: Learn how to show BAM and CRAM files
guide_category: Track types
---

An alignments track shows BAM/CRAM reads two ways at once: a coverage histogram
on top (read depth at each position) and a pileup below (one box per read). Open
a track, zoom to base level, and most of what you need is already on screen. The
sections below cover the track-menu options you'll reach for most often.

<Figure caption="An alignments track: coverage histogram on top, pileup below. Reads are grey; mismatches to the reference show as colored ticks in the pileup and as colored segments inside the coverage bars." src="/img/volvox_alignments.png" />

In the coverage row, a bar that is part red means that fraction of reads carry a
mismatch (e.g. a `T` where the reference has an `A`) at that position. In the
pileup, the same mismatches appear as colored ticks on the otherwise-grey reads.

The track menu's **Show coverage** and **Show pileup** toggles turn either panel
off independently. Dropping the pileup leaves a compact coverage-only track
(handy for surveying depth across many samples), while dropping the coverage row
reclaims that vertical space for the reads.

## Sorting reads

The quickest way to sort is to **right-click a mismatch (or any base) in the
pileup** and choose _Sort by base at position_. Reads are then grouped by which
nucleotide they carry there, so haplotype-correlated SNPs line up at a glance.

<Figure caption="Sort by base groups reads by the nucleotide they carry at the sorted position." src="/img/alignments_sort_by_base.png" />

The track menu's **Sort by...** does the same thing against the _center line_ (a
1bp indicator at the middle of the view), and can also sort by read strand,
mapping quality, or any BAM tag.

## Color by

The track menu's **Color by...** offers several schemes.

### Strand

<!-- COLOR_TABLE alignments-strand START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#EC8B8B;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#EC8B8B"></span> | Forward strand | `#EC8B8B` | Read maps to the forward strand |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#8F8FD8;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#8F8FD8"></span> | Reverse strand | `#8F8FD8` | Read maps to the reverse strand |

<!-- COLOR_TABLE alignments-strand END -->

### Read quality and bases

Three schemes surface per-read or per-base signal directly on the pileup:

- Mapping quality shades each read by its MAPQ, so poorly-mapped reads (often in
  repeats or segmental duplications) fade out and confidently-placed reads stay
  solid.
- Per-base quality colors every base by its Phred score on a red→yellow→green
  ramp (low-quality bases run red, high-quality bases green), which is the
  quickest way to tell a real variant from a run of low-confidence base calls.
- Per-base lettering draws every aligned base in its nucleotide color, not just
  the mismatches, turning the whole pileup into a colored base grid at base-pair
  resolution.

### Modifications and methylation

If a BAM/CRAM carries MM/ML modification calls (common in nanopore and PacBio
data), **Color by → Modifications** paints them. It offers two modes:

- **One color per modification type** draws a mark _only_ where the MM tag
  reports a modified base, each type in its own color, so an unmethylated region
  looks empty. Use the **Threshold** slider to raise the probability cutoff, or
  **Modification types** to restrict to a single type such as 5mC (both sit
  directly beneath the two mode radios).
- **One color per type, plus low-probability & unmodified in blue** (IGV calls
  this "2-color") does everything the by-type view does and additionally paints
  the not-modified side blue: modified sites keep their per-type color, while
  low-probability and unmodified sites turn blue. For methylation (cytosine)
  data it fills every CpG in context, including the ones the basecaller left
  implicit (drawn blue). Those blue positions aren't in the MM tag; JBrowse
  infers them from the reference CpG context. That's why a hypomethylated island
  fills with solid blue here but looks nearly empty in the by-type mode. The
  cytosine context (CpG/CHG/CHH) is a **Cytosine context** submenu in the same
  list.

See the [methylation tutorial](/docs/tutorials/methylation) for an end-to-end
modified-base workflow.

<Figure caption="COLO829 tumor nanopore reads over a hypomethylated CpG island on chr20, colored by type (top) and 2-color (bottom): by-type leaves the island near-empty, 2-color fills it solid blue." src="/img/alignments/modifications2.png" />

### Pair orientation and insert size

For paired-end data, **Color by → Pair orientation** and **Color by → Insert
size** highlight discordant pairs, the main way to scan short reads for
structural variants. Reads with an unexpectedly large insert turn red, smaller
turn pink, and abnormal pair orientations get their own colors. The combined
**Insert size and orientation** mode prioritizes the strongest cue: a short
insert always paints pink (an insertion is here), otherwise abnormal orientation
wins, otherwise a large insert paints red (deletion). Insert-size thresholds are
robust to the long tail of large inserts (`median ± 3·1.4826·MAD`) so the
short-insert signal isn't washed out. See the
[SV visualization guide](/docs/user_guides/sv_visualization) for the full color
tables.

<Figure caption="Reads colored by pair orientation at an inverted duplication. Most pairs are concordant LR (grey); the discordant ones cluster at the breakpoints: teal RL pairs (mates pointing away) flag the tandem duplication, while green LL and dark blue RR same-direction pairs flag the inversion." src="/img/inverted_duplication.png" />

The [SV visualization guide](/docs/user_guides/sv_visualization) has the full
color tables and worked examples on real structural variants.

### By tag

You can color, sort, or filter by any BAM tag. The common case is the `HP`
(haplotype) tag to see phased reads; grouping by `HP` (below) usually reads even
more clearly than coloring alone. The
[phased trio tutorial](/docs/tutorials/analyze_trio) walks through working with
`HP`-tagged reads alongside a phased VCF.

## Grouping reads

The track menu's **Group by...** splits the pileup into one coverage+pileup
section per value of a chosen dimension: strand, read group (RG), or any tag
such as `HP`. Each group gets a divider label and the groups share one coverage
scale, so they read independently. Grouping a phased BAM by `HP` turns it into
one pileup per haplotype.

<Figure caption="Group by... opens a dialog where you pick the dimension (here the HP haplotype tag) and can color by the same tag." src="/img/alignments/haplotype_groupby.png" />

<Figure caption="HG002 ONT reads grouped and colored by the HP tag. The pileup splits into one tinted section per haplotype, so phased reads and their haplotype-correlated SNPs read at a glance." src="/img/alignments/haplotype.png" />

<Figure caption="A 27 bp heterozygous deletion in HG002 ONT reads, grouped by HP into haplotype 1 (pink) and haplotype 2 (blue). The deletion-supporting reads concentrate in a single haplotype." src="/img/smalldel.png" />

## Compact display

For a denser pileup, lower the feature height from the track menu's pileup
settings.

<Figure caption="The same reads at a compact feature height." src="/img/alignments/compact.png" />

The **Read height** submenu offers Normal, Compact, and Super-compact presets
(plus a custom value) for how tall each read is drawn. Each preset's trailing ⋯
control opens a dialog to make that height the session-wide default for
alignments tracks, applied to future tracks and, optionally, to the ones already
open.

Read height is separate from the sibling **Track sizing** submenu, which
controls what the track does when there are more reads than fit: _scroll_ (fixed
height), _expand_ (grow the track to show every read), or _squeeze_ (shrink
reads to fill the current height).

<Figure caption="Making Compact the default feature height. Top: the ⋯ control on the Compact preset (circled). Bottom: it opens this dialog; ticking both boxes sets Compact as the default for new alignments tracks and applies it to the two tracks already open." src="/img/feature_height_default.png" />

## Insertion and clipping indicators

The coverage row shows an upside-down histogram of insertions and clips, with a
colored triangle wherever an event exceeds a depth-dependent fraction of the
reads at that base (roughly 30% at high coverage, rising toward 80% at low
coverage, to suppress noise).

<!-- COLOR_TABLE alignments-indicators START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#800080;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#800080"></span> | Insertion | `#800080` | Reads carry an insertion relative to the reference |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#00f;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#00f"></span> | Soft clip | `#00f` | Reads are soft-clipped (clipped bases retained in the read) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#f00;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#f00"></span> | Hard clip | `#f00` | Reads are hard-clipped (clipped bases removed from the read) |

<!-- COLOR_TABLE alignments-indicators END -->

<Figure caption="Clip indicators above the coverage track: blue marks soft clips, red marks hard clips." src="/img/alignment_clipping_indicators.png" />

Insertions larger than 10bp also draw a purple rectangle in the pileup, most
visible with long reads, which span larger insertions.

<Figure caption="A large insertion across nanopore, PacBio, and Illumina reads: long reads span it as a dense column of purple insertion rectangles." src="/img/insertion.png" />

## Soft clipping

When a read has bases at one end that don't align, the aligner can mark them
**soft-clipped** (kept in the read sequence) or **hard-clipped** (dropped).
JBrowse hides soft-clipped bases by default; turn on **Show soft clipping** from
the track menu to reveal them. Clusters of soft-clipped bases often mark a
structural-variant breakpoint.

<Figure caption="Enabling 'Show soft clipping' (top) and the result (bottom): reads terminating at a deletion breakpoint expose their unaligned bases." src="/img/alignments_soft_clipped_menu.png" />

## Filtering reads

The track menu's **Filter by...** hides reads by SAM flag, for example excluding
duplicates and secondary alignments to clean up a dense pileup, or keeping only
properly-paired reads. You can also filter to a specific read name or tag value
(`HP:1` for one haplotype, `HP:*` for any read carrying the tag).

<Figure caption="The Filter by dialog. The two flag columns are an include/exclude bitmask; by default unmapped, QC-fail, and duplicate reads are excluded." src="/img/alignments/filter_dialog.png" />

## Sashimi arcs

Sashimi-style arcs are drawn automatically over spliced alignments (reads with
`N` in the CIGAR), so RNA-seq and Iso-Seq splice junctions appear with no setup.
When reads carry the XS tag, the arc strand follows it. The track menu's
**Sashimi arcs** submenu controls them: _Show labels_ prints each junction's
supporting-read count on its arc, _Arc placement_ splits the arcs above/below
the coverage row, and _Filter by score_ drops low-support junctions. Turn the
arcs off from the same submenu. See the
[RNA-seq tutorial](/docs/tutorials/rnaseq) for a worked splice-junction example.

When one exon-junction peak dominates the coverage histogram behind the arcs,
switch the coverage to a log scale via the track menu's **Coverage → Scale type
→ Log scale**, so the shallower junctions stay visible.

<Figure caption="Sashimi arcs over B2M RNA-seq alignments with per-junction read-support labels enabled and the coverage histogram on a log scale, so the deep junction peak doesn't flatten the rest." src="/img/alignments_track_arcs.png" />

## Read connections

The track menu's **Read connections** submenu connects paired or split reads,
which surfaces the long-range relationships behind structural variants.

### Read arcs

_Show read arcs_ draws a bezier curve between the ends of each pair. Long-range
and discordant pairs stand out from the short local arcs. Off-screen partners
draw as large semicircular arcs and inter-chromosomal mates as vertical lines;
both can be toggled off. Dragging the track taller re-fits the arcs into the
available height.

<Figure caption="Enabling 'Show read arcs' from the Read connections submenu; the arcs draw alongside the coverage panel." src="/img/alignments/select_arc_display.png" />

### Read cloud

_Show read cloud_ lays pairs out on the Y axis by the **log distance between
mates**, making the insert-size distribution visible at a glance. Patterns that
arcs flatten separate clearly, for example short-insert (insertion-supporting)
pairs drawn pink lift away from the background.

<Figure caption="Read cloud on a synthetic SV dataset. Reads are stratified by log distance between mates, surfacing insertion pairs (pink) against the background." src="/img/alignments/read_cloud.png" />

## See also

- [Consensus sequence](/docs/user_guides/consensus_sequence)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [SV inspector](/docs/user_guides/sv_inspector_view)
- [Variant track](/docs/user_guides/variant_track)
- [Alignments track configuration](/docs/config_guides/alignments_track)
- [LinearAlignmentsDisplay config schema](/docs/config/linearalignmentsdisplay)
- [Gallery: alignments and long reads](/gallery/#alignments)
