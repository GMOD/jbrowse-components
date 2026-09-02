---
title: Alignments track
description: Learn how to show BAM and CRAM files
guide_category: Track types
---

**TL;DR:** An alignments track shows BAM/CRAM reads two ways at once: a coverage
histogram on top (read depth at each position) and a pileup below (one box per
read). Zoom to base level and most of what you need is already on screen. Almost
everything else is a track-menu option that changes how reads are sorted,
colored, grouped, sized, or filtered.

<Figure caption="An alignments track: coverage histogram on top, pileup below. Reads are grey; mismatches to the reference show as colored ticks in the pileup and as colored segments inside the coverage bars." src="/img/volvox_alignments.png" />

A coverage bar that is part red means that fraction of reads carry a mismatch
there. The track menu's **Show coverage** and **Show pileup** toggles turn
either panel off independently: coverage-only is compact for surveying depth
across many samples, and pileup-only gives the reads the vertical space.

## Sorting reads

**Right-click a base in the pileup** and choose _Sort by base at position_.
Reads group by the nucleotide they carry there, so haplotype-correlated SNPs
line up.

<Figure caption="Sort by base groups reads by the nucleotide they carry at the sorted position." src="/img/alignments_sort_by_base.png" />

The track menu's **Sort by...** does the same against the _center line_ (a 1bp
indicator at the middle of the view), and also sorts by strand, mapping quality,
or any BAM tag. **Sort by... → Longest reads first** and **Sort by... → Spliced
reads first** order the whole layout instead, putting the widest reads, or the
reads with a reference skip (`N`) in the CIGAR, at the top.

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

- **Mapping quality** shades each read by its MAPQ, so reads in repeats fade
  out. The [SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf)
  defines MAPQ as `-10 log10 Pr{mapping position is wrong}`, so a MAPQ 0 read is
  drawn where it aligned with the aligner putting no better than even odds on it
  being the right copy, which happens when the best score is tied across
  positions ([Li, Ruan and Durbin 2008](https://doi.org/10.1101/gr.078212.108)).
  A **secondary** alignment (FLAG `0x100`) is a competing placement recorded as
  its own record; the default `flagExclude` of 1540 (duplicate, QC-fail,
  unmapped) does not drop those. The
  [mappability QC tutorial](/docs/tutorials/mappability_qc) works a locus where
  MAPQ 0 covers a whole gene.
- **Per-base quality** colors every base by Phred score on a red→yellow→green
  ramp, the quickest way to tell a variant from a run of low-confidence calls.
- **Per-base lettering** draws every aligned base in its nucleotide color, not
  just the mismatches.

### Modifications and methylation

For a BAM/CRAM with MM/ML modification calls (nanopore, PacBio), **Color by →
Modifications** paints them in two modes:

- **One color per modification type** marks only where the MM tag reports a
  modified base, so an unmethylated region looks empty. **Threshold** raises the
  probability cutoff and **Modification types** restricts to one type such as
  5mC
- **One color per type, plus low-probability & unmodified in blue** (IGV's
  "2-color") also paints the not-modified side blue. For cytosine data it fills
  every CpG in context, including ones the basecaller left implicit, inferred
  from the reference. **Cytosine context** picks CpG/CHG/CHH

See the [methylation tutorial](/docs/tutorials/methylation) for an end-to-end
modified-base workflow.

<Figure caption="COLO829 tumor nanopore reads over a hypomethylated CpG island on chr20, colored by type (top) and 2-color (bottom): by-type leaves the island near-empty, 2-color fills it solid blue." src="/img/alignments/modifications2.png" />

Any type in the MM tag paints, so fiber-seq's N6-methyladenine (`A+a`) draws
like any other modification, and since the assay adds 6mA to accessible DNA the
call density doubles as a chromatin-accessibility readout.

<Figure caption="ONT HG002 fiber-seq at the GAPDH promoter in modifications mode, where purple marks are 6mA calls left on accessible DNA. The treated sample (top) piles them over the promoter; the no-enzyme control (bottom) carries only scattered background." src="/img/methylation/chromatin_accessibility_6ma.png" />

### Bisulfite and EM-seq

Bisulfite (WGBS) and EM-seq reads carry no MM/ML tags; methylation is in the C→T
conversion itself. **Color by → Bisulfite / EM-seq** reads it off the aligned
bases against the reference, so a plain BAM from a bisulfite-aware aligner
colors without a methylation caller. Methylated cytosines paint red, **Show
unmethylated (blue)** paints the converted sites too, and the same submenu picks
the CG, CHG or CHH context, which plant genomes methylate in all three. The
[bisulfite tutorial](/docs/tutorials/bisulfite) runs it on _Arabidopsis_ data.

### Pair orientation and insert size

For paired-end data, **Color by → Pair orientation** and **Color by → Insert
size** highlight discordant pairs, the main way to scan short reads for
structural variants: unexpectedly large inserts turn red, small ones pink, and
abnormal orientations get their own colors. **Insert size and orientation**
paints whichever cue is strongest. The
[SV visualization guide](/docs/user_guides/sv_visualization#pair-orientation-color-scheme)
has the color tables, the expected-insert threshold, and what each pattern means
at a breakpoint.

### By tag

Any BAM tag can color, sort, or filter. The common case is the `HP` haplotype
tag for phased reads, where grouping by `HP` (below) usually reads more clearly
than coloring alone. See the
[phased trio tutorial](/docs/tutorials/analyze_trio).

## Grouping reads

The track menu's **Group by...** splits the pileup into one coverage+pileup
section per value of a dimension: strand, split read (an `SA` tag, separating
reads crossing a breakpoint from those spanning it intact), read group (RG), or
any tag such as `HP`. Groups share one coverage scale, reads missing the tag
collect in a trailing "none" section, and each divider can collapse its section
to just its coverage.

<Figure caption="Group by... opens a dialog where you pick the dimension (here the HP haplotype tag) and can color by the same tag." src="/img/alignments/haplotype_groupby.png" />

<Figure caption="HG002 ONT reads grouped and colored by the HP tag. The pileup splits into one tinted section per haplotype, so phased reads and their haplotype-correlated SNPs read at a glance." src="/img/alignments/haplotype.png" />

Grouping by `HP` is also how to check that a heterozygous variant's supporting
reads sit on one haplotype; see
[phasing heterozygous SVs](/docs/user_guides/sv_visualization#phasing-heterozygous-svs).

Each section's coverage band is built from only its own reads. Group by
**Strand** and turn off **Show... → Show pileup** for a forward and a reverse
histogram on a shared scale, each with its own mismatch coloring. On a
strand-specific paired-end library group by **First-of-pair strand** instead,
since there the transcript strand is which mate the read is; the
[RNA-seq tutorial](/docs/tutorials/rnaseq#strand-specific-rna-seq) shows that.
Long-read cDNA is the clearest case, since the reads are oriented to the
transcript.

<Figure caption="HSV-1 mRNA (MinION cDNA) over two neighbouring genes of the viral genome, grouped by strand and colored by it. UL21 and UL22 are transcribed in opposite directions, so each band carries the coverage over its own gene and the switch falls between them." src="/img/alignments/strand_split_depth.png" />

The same split is a check on the reads: a position colored in one band and not
the other is carried by one strand alone, the signature of a basecalling error
rather than a variant.

<Figure caption="HG002 nanopore reads grouped by strand, each band colored from only its own strand's reads. At the left boxed column only the reverse reads disagree with the reference, a basecalling error; at the right one both strands do, a real variant." src="/img/alignments/strand_split_coverage.png" />

**Track menu → Read connections → SV channels (pairs by orientation)** groups by
pair orientation, drops the pileup and turns the arcs on together, so each
orientation class is its own coverage band with its own arcs. See
[SV channels](/docs/user_guides/sv_visualization#sv-channels).

## Read height and track sizing

The track menu's **Read height** submenu sets how tall each read is drawn and
how the track absorbs more reads than fit. The presets are Normal, Compact and
Super-compact, plus **Custom...** for an exact pixel height. Each preset's pin
makes it the default for every alignments track; see
[defaults for all tracks](/docs/user_guides/display_defaults).

<Figure caption="The same reads at a compact feature height." src="/img/alignments/compact.png" />

**Track sizing** in the same submenu has three modes, each label naming what
happens to the read height, then to the track height:

- Fixed read height + fixed track height - the pileup scrolls when it overflows
- Fixed read height + autogrow track height - the track grows to hold the reads,
  up to
  [growMaxHeight](/docs/config/linearalignmentsdisplay#slot-growmaxheight), past
  which it scrolls again. Real sequencing depth passes that ceiling quickly, so
  raise the slot to keep growing
- Fit read height to track height - the read height is derived from the track
  height so the whole pileup fits, shrinking as coverage deepens. No preset
  reads as selected while fitting; picking one drops back to fixed

<Figure src="/img/alignments/height_mode_fit.png" caption="The Track sizing options inside the Read height submenu, with Fit read height to track height selected. Because the size is computed while fitting, none of the presets above it read as selected." />

Fit mode is for the shape of a pileup: drag the track taller or shorter and the
reads re-fit. Reads draw no taller than the Normal preset and no smaller than
1px, so an extremely deep pileup still overflows. With grouping, each group's
coverage row is reserved first and the expanded groups share what is left, so
collapsing a group gives the rest more height.

## Insertion and clipping indicators

The coverage row shows an upside-down histogram of insertions and clips, with a
colored triangle wherever an event exceeds a depth-dependent fraction of the
reads at that base.

<!-- COLOR_TABLE alignments-indicators START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#800080;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#800080"></span> | Insertion | `#800080` | Reads carry an insertion relative to the reference |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#00f;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#00f"></span> | Soft clip | `#00f` | Reads are soft-clipped (clipped bases retained in the read) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#f00;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#f00"></span> | Hard clip | `#f00` | Reads are hard-clipped (clipped bases removed from the read) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#555555;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#555555"></span> | Overlapping segments of one molecule | `#555555` | Both reads of a pair, or both arms of a split read, align here — so the junction between them is this span rather than a point |

<!-- COLOR_TABLE alignments-indicators END -->

<Figure caption="Clip indicators above the coverage track: blue marks soft clips, red marks hard clips." src="/img/alignment_clipping_indicators.png" />

Insertions larger than 10bp also draw a purple rectangle in the pileup.

<Figure caption="A large insertion across nanopore, PacBio, and Illumina reads: long reads span it as a dense column of purple insertion rectangles." src="/img/insertion.png" />

## Soft clipping

Bases at a read's end that don't align are **soft-clipped** (kept in the read)
or **hard-clipped** (dropped). Soft-clipped bases are hidden by default; **Show
soft clipping** in the track menu reveals them. Clusters of them often mark a
structural-variant breakpoint.

A read with no `SEQ` field (secondary reads among them) has no clipped bases to
draw, so its clip indicator appears black.

<Figure caption="Enabling 'Show soft clipping' (top) and the result (bottom): reads terminating at a deletion breakpoint expose their unaligned bases." src="/img/alignments_soft_clipped_menu.png" />

## Filtering reads

The track menu's **Filter by...** hides reads by SAM flag (drop duplicates and
secondaries, or keep only properly-paired reads), by read name, or by tag value
(`HP:1` for one haplotype, `HP:*` for any read carrying the tag). The splicing
radios keep only spliced reads (a reference skip, `N`, in the CIGAR) or only
unspliced ones. The coverage histogram follows the filter.

<Figure caption="The Filter by dialog. The two flag columns are an include/exclude bitmask; by default unmapped, QC-fail, and duplicate reads are excluded." src="/img/alignments/filter_dialog.png" />

Right-click a read for the **Filter** submenu: _Filter for this read_, _Filter
for this haplotype (HP:n)_ and _Filter for this read group (RG:x)_ read their
value off that read. They combine, and **Clear read/tag filters** appears once
any is active.

## Sashimi arcs

Sashimi-style arcs draw automatically over spliced alignments (`N` in the
CIGAR), so RNA-seq and Iso-Seq junctions appear with no setup. The arc strand
follows the aligner's strand tag: `XS` or `TS` give the transcript strand,
minimap2's `ts` is relative to the read and combined with the read's strand, and
a read with none (default STAR output without `--outSAMstrandField`) casts no
vote.

JBrowse also reads the two bases at each end of every intron off the reference
and classifies the splice motif: GT-AG, GC-AG or AT-AC on either strand, or
non-canonical. The motif shows in the arc's tooltip, and a junction with no
strand-tagged reads takes the strand its motif implies, so untagged STAR output
still colors by strand. This needs a sequence adapter on the assembly.

The track menu's **Sashimi arcs** submenu controls them:

- **Show labels** prints each junction's supporting-read count on its arc
- **Hide non-canonical junctions** drops junctions whose motif is none of the
  three canonical pairs. On deep RNA-seq the thin arcs are mostly these, so it
  is the filter to reach for first
- **Arc placement** splits the arcs above/below the coverage row
- **Min read support** drops the junctions carried by fewer reads than the
  slider's value

Turn the arcs off from the same submenu. See the
[RNA-seq tutorial](/docs/tutorials/rnaseq). When one junction peak dominates the
coverage histogram, **Coverage → Scale type → Log scale** keeps the shallower
junctions visible.

<Figure caption="Sashimi arcs over B2M RNA-seq alignments with per-junction read-support labels enabled and the coverage histogram on a log scale, so the deep junction peak doesn't flatten the rest." src="/img/alignments_track_arcs.png" />

## Read connections

The track menu's **Read connections** submenu connects paired or split reads,
the long-range relationships behind structural variants.

### Read arcs

_Show read arcs_ draws a bezier curve between the ends of each pair, so
long-range and discordant pairs stand out from the short local arcs. A partner
the view has not loaded draws as a large semicircle reaching toward it. A mate
on another chromosome draws as an arc when that chromosome is on screen and as a
vertical line at the breakpoint when it is not. Both can be toggled off, and
dragging the track taller re-fits the arcs.

An arc whose ends are in different displayed regions spans them, so a second
region either side of a breakpoint shows the connection as one curve.
Interchromosomal arcs draw in one colour, since insert size and orientation mean
nothing across chromosomes.

Reads describing the same connection draw as **one arc, thickened by how many
there are**, on a log scale, so the arcs rank the evidence. A single-read
connection draws at
[`readConnectionsLineWidth`](/docs/config/linearalignmentsdisplay/#slot-readconnectionslinewidth).
Arcs coalesce only on exactly equal endpoints.

Hovering an arc reports its location, the distance between the ends, the
supporting read count and its colour bucket. In read-cloud mode it also gives
the insert size.

<Figure caption="Enabling 'Show read arcs' from the Read connections submenu; the arcs draw alongside the coverage panel." src="/img/alignments/select_arc_display.png" />

### Read cloud

_Show read cloud_ lays pairs out on the Y axis by the **log distance between
mates**, so the insert-size distribution is visible directly and short-insert
(insertion-supporting) pairs lift away from the background.

<Figure caption="Read cloud on a synthetic SV dataset. Reads are stratified by log distance between mates, surfacing insertion pairs (pink) against the background." src="/img/alignments/read_cloud.png" />

## Going to a read's mate

Right-click a read and open the **View mate** submenu, present when the mate is
mapped:

- **Split current view to show mate** replaces the displayed regions with the
  read's locus and its mate's side by side, each padded by a read length. A
  snackbar offers **Undo**
- **Open breakpoint split view** puts the two loci in
  [their own stacked panels](/docs/user_guides/sv_visualization#breakpoint-split-view),
  which draws the connecting splines

For a split read, **Split current view to show split alignments** does the same
with one region per segment of its `SA` tag, in read order, and turns on **View
as pairs / link supplementary alignments**; **Undo** restores both.

## One read against the reference

A long read crossing a structural variant aligns in pieces: a primary alignment
plus one supplementary per additional locus, the whole set recorded in each
record's `SA` tag, drawn as separate rows in the pileup.

Right-click any of them and choose **Launch → Linear read vs ref** to put them
back together. The read becomes its own assembly along one lane, every reference
locus it touches lies along the other, and each alignment segment is a ribbon
between them in the order the read visits them. An insertion shows as a gap in
the diagonal. Dragging over the read lane extracts that sequence.

<Figure caption="'Linear read vs ref' for a SKBR3 PacBio read spanning several insertions. The ordinary pileup on top, and below it the read drawn against the reference, where each gap in the diagonal is inserted sequence absent from the reference." src="/img/read_vs_ref_insertion.png" />

`Dotplot of read vs ref` plots the same alignment as a dotplot, clearer when a
read visits one locus repeatedly.

## See also

- [](/docs/user_guides/consensus_sequence)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [SV inspector](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/variant_track)
- [Alignments track configuration](/docs/config_guides/alignments_track)
- [LinearAlignmentsDisplay config schema](/docs/config/linearalignmentsdisplay)
- [Gallery: alignments and long reads](/gallery/#alignments)
- [MODIFICATION_TAGS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MODIFICATION_TAGS.md)
  — how this repo reads MM/ML base-modification tags, checked line by line
  against htslib, and the one place it deliberately differs
- [DEEP_COVERAGE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/DEEP_COVERAGE.md)
  — what these defaults do at 300x, where the insert-size cut flags a tight
  library's own tail, and why a support floor has to count over a window
