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

Two entries in the same menu order the whole layout rather than one column.
**Sort by... → Longest reads first** gives the widest alignments the lowest
rows, and **Sort by... → Spliced reads first** does the same for every read
whose CIGAR carries a reference skip (`N`), so on RNA-seq the junction-spanning
reads sit together at the top of the pileup instead of interleaving with the
unspliced majority.

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
  solid. The [SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf)
  defines MAPQ as `-10 log10 Pr{mapping position is wrong}`, so a MAPQ 0 read is
  aligned, and drawn where it aligned, with the aligner putting no better than
  even odds on that being the right copy. Aligners assign it when the best
  alignment score is tied across positions
  ([Li, Ruan and Durbin 2008](https://doi.org/10.1101/gr.078212.108), which
  introduced the estimator). That is separate from a **secondary** alignment
  (FLAG `0x100`), which is one of the competing placements recorded as its own
  record; JBrowse's default `flagExclude` of 1540 (duplicate, QC-fail, unmapped)
  does not filter those out. The
  [mappability QC tutorial](/docs/tutorials/mappability_qc) works through a
  locus where MAPQ 0 covers a whole gene.
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
  this "2-color") additionally paints the not-modified side blue: modified sites
  keep their per-type color, while low-probability and unmodified sites turn
  blue. For methylation (cytosine) data it fills every CpG in context, including
  the ones the basecaller left implicit, which JBrowse infers from the reference
  CpG context. The cytosine context (CpG/CHG/CHH) is a **Cytosine context**
  submenu in the same list.

See the [methylation tutorial](/docs/tutorials/methylation) for an end-to-end
modified-base workflow.

<Figure caption="COLO829 tumor nanopore reads over a hypomethylated CpG island on chr20, colored by type (top) and 2-color (bottom): by-type leaves the island near-empty, 2-color fills it solid blue." src="/img/alignments/modifications2.png" />

Any type in the MM tag paints, so fiber-seq's N6-methyladenine (`A+a`) draws
like any other modification, and because the assay adds 6mA to accessible DNA
the density of those calls doubles as a chromatin-accessibility readout. Use
**Modification types** to restrict the track to one code when the basecaller
emitted several.

<Figure caption="ONT HG002 fiber-seq at the GAPDH promoter in modifications mode, where purple marks are 6mA calls left on accessible DNA. The treated sample (top) piles them over the promoter; the no-enzyme control (bottom) carries only scattered background." src="/img/methylation/chromatin_accessibility_6ma.png" />

### Bisulfite and EM-seq

Bisulfite (WGBS) and EM-seq reads carry no MM/ML tags: methylation is encoded in
the C→T conversion itself. **Color by → Bisulfite / EM-seq** reads it straight
off the aligned bases against the reference, so a plain BAM from bwameth (or any
bisulfite-aware aligner) colors without a methylation caller. Methylated
cytosines paint red; **Show unmethylated (blue)** paints the converted sites
too. Pick the cytosine context (CG, CHG, or CHH) from the same submenu, which
matters for plant genomes that methylate in all three. The
[bisulfite tutorial](/docs/tutorials/bisulfite) runs the pipeline end to end on
_Arabidopsis_ data.

### Pair orientation and insert size

For paired-end data, **Color by → Pair orientation** and **Color by → Insert
size** highlight discordant pairs, the main way to scan short reads for
structural variants. Reads with an unexpectedly large insert turn red, smaller
turn pink, and abnormal pair orientations get their own colors. A combined
**Insert size and orientation** mode paints whichever cue is strongest. The
[SV visualization guide](/docs/user_guides/sv_visualization#pair-orientation-color-scheme)
has the full color tables, the threshold the "expected" insert range is built
from, how the combined mode breaks ties, and what each pattern means at a real
breakpoint.

### By tag

You can color, sort, or filter by any BAM tag. The common case is the `HP`
(haplotype) tag to see phased reads; grouping by `HP` (below) usually reads more
clearly than coloring alone. The
[phased trio tutorial](/docs/tutorials/analyze_trio) walks through working with
`HP`-tagged reads alongside a phased VCF.

## Grouping reads

The track menu's **Group by...** splits the pileup into one coverage+pileup
section per value of a chosen dimension: strand, split read (whether the read
carries an `SA` tag, which separates the reads crossing a breakpoint from the
ones spanning it intact), read group (RG), or any tag such as `HP`. Each group
gets a divider label and the groups share one coverage scale, so they read
independently, and reads missing the chosen tag collect in a trailing "none"
section. Grouping costs no extra fetching, and each divider has a control to
collapse its section down to just its coverage.

<Figure caption="Group by... opens a dialog where you pick the dimension (here the HP haplotype tag) and can color by the same tag." src="/img/alignments/haplotype_groupby.png" />

<Figure caption="HG002 ONT reads grouped and colored by the HP tag. The pileup splits into one tinted section per haplotype, so phased reads and their haplotype-correlated SNPs read at a glance." src="/img/alignments/haplotype.png" />

Grouping by `HP` is also how you check that a heterozygous variant's supporting
reads sit on one haplotype; see
[phasing heterozygous SVs](/docs/user_guides/sv_visualization#phasing-heterozygous-svs).

Each section's coverage band is built from only that section's reads, which is
how you get strand-split coverage. Group by **Strand** and turn off **Show... →
Show pileup**, and the band becomes a forward histogram and a reverse histogram
on a shared scale, each carrying its own mismatch coloring. On a strand-specific
paired-end library group by **First-of-pair strand** instead, since there the
transcript strand is which mate the read is; the
[RNA-seq tutorial](/docs/tutorials/rnaseq#strand-specific-rna-seq) shows that on
a pair of genes transcribed in opposite directions.

On data where read strand carries meaning, the two bands are the whole result.
Long-read cDNA is the clearest case: the reads are oriented to the transcript,
so a gene's coverage lands in one band and its neighbour's in the other.

<Figure caption="HSV-1 mRNA (MinION cDNA) over two neighbouring genes of the viral genome, grouped by strand and colored by it. UL21 and UL22 are transcribed in opposite directions, so each band carries the coverage over its own gene and the switch falls between them." src="/img/alignments/strand_split_depth.png" />

The same split read the other way is a check on the reads. Each band's mismatch
coloring is computed from only its own strand's reads, so a position colored in
one band and not the other is carried by one strand alone, the signature of a
systematic basecalling error rather than a variant.

<Figure caption="HG002 nanopore reads grouped by strand, each band colored from only its own strand's reads. At the left boxed column only the reverse reads disagree with the reference, a basecalling error; at the right one both strands do, a real variant." src="/img/alignments/strand_split_coverage.png" />

One arrangement of those two moves has a row of its own, under the overlay it
builds on. **Track menu → Read connections → SV channels (pairs by
orientation)** groups by pair orientation, drops the pileup and turns the arcs
on together, so each orientation class arrives as its own coverage band with its
own arcs; [SV channels](/docs/user_guides/sv_visualization#sv-channels) is what
the bands say.

## Read height and track sizing

The track menu's **Read height** submenu holds two independent choices: how tall
each read is drawn, and how the track absorbs more reads than fit.

The size presets at the top are Normal, Compact, and Super-compact, plus
**Custom...** for an exact pixel height. Each preset's trailing pin makes that
height the default for every alignments track; see
[defaults for all tracks](/docs/user_guides/display_defaults) for how pinning
works.

<Figure caption="The same reads at a compact feature height." src="/img/alignments/compact.png" />

Under the **Track sizing** subheading in the same submenu are three modes. Each
label names both halves of what it does: what happens to the read height, then
what happens to the track height.

- Fixed read height + fixed track height - reads keep their configured height,
  the track keeps the height you gave it, and the pileup scrolls when it
  overflows.
- Fixed read height + autogrow track height - reads keep their height and the
  track grows to hold them instead of scrolling, up to the
  [growMaxHeight](/docs/config/linearalignmentsdisplay#slot-growmaxheight)
  ceiling, past which it scrolls again. At real sequencing depth a pileup passes
  that ceiling quickly, so raise the slot if you want the track to keep growing.
- Fit read height to track height - the read height is derived from the track
  height so the whole pileup fits on screen at once, shrinking as coverage
  deepens and growing back as it thins. Because the size is computed, no size
  preset reads as selected while fitting; picking one drops back to fixed.

<Figure src="/img/alignments/height_mode_fit.png" caption="The Track sizing options inside the Read height submenu, with Fit read height to track height selected. Because the size is computed while fitting, none of the presets above it read as selected." />

Fit mode is the one to reach for when you care about the shape of a pileup: drag
the track taller or shorter and the reads re-fit to whatever height you gave it.
It draws reads no taller than the Normal preset, so a shallow pileup in a tall
track doesn't balloon, and no smaller than 1px per read, so an extremely deep
pileup overflows the display. Grouping interacts with it directly: each group's
coverage row is reserved first and only the expanded groups' rows share what's
left, so collapsing a group gives the rest more height.

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
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#555555;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#555555"></span> | Overlapping segments of one molecule | `#555555` | Both reads of a pair, or both arms of a split read, align here — so the junction between them is this span rather than a point |

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
(`HP:1` for one haplotype, `HP:*` for any read carrying the tag), and the
dialog's splicing radios keep only spliced reads (a reference skip, `N`, in the
CIGAR) or only unspliced ones. The coverage histogram follows the filter, so
"Only spliced reads" leaves a histogram of the junction-spanning evidence alone.

<Figure caption="The Filter by dialog. The two flag columns are an include/exclude bitmask; by default unmapped, QC-fail, and duplicate reads are excluded." src="/img/alignments/filter_dialog.png" />

To filter by what a read in front of you actually carries, right-click it and
use the **Filter** submenu: _Filter for this read_, _Filter for this haplotype
(HP:n)_, and _Filter for this read group (RG:x)_ each read their value off that
read, so there is nothing to type. They combine rather than replace each other,
and **Clear read/tag filters** appears once any is active.

## Sashimi arcs

Sashimi-style arcs are drawn automatically over spliced alignments (reads with
`N` in the CIGAR), so RNA-seq and Iso-Seq splice junctions appear with no setup.
The arc strand follows whichever strand tag the aligner wrote: `XS` or `TS` give
the transcript strand directly, while minimap2's `ts` gives the orientation
relative to the read and is combined with the read's own strand. A read carrying
none of the three (default STAR output without `--outSAMstrandField`, for one)
casts no vote, so tagged and untagged reads mix freely on the same arc.

JBrowse also reads the two bases at each end of every intron off the reference
sequence and classifies the junction's splice motif: GT-AG, GC-AG or AT-AC on
either strand, or non-canonical. The motif shows in the arc's tooltip and detail
panel, and a junction none of whose reads carry a strand tag takes the strand
its motif implies, so untagged STAR output still colors by strand. This needs
the assembly to have a sequence adapter; without one the motif stays unknown.

The track menu's **Sashimi arcs** submenu controls them:

- **Show labels** prints each junction's supporting-read count on its arc
- **Hide non-canonical junctions** drops the junctions whose motif is none of
  the three canonical pairs. On deep RNA-seq the thin arcs are mostly these
  alignment artefacts, and a read-count floor cannot separate them from a real
  junction at low depth, so this is the filter to reach for first
- **Arc placement** splits the arcs above/below the coverage row
- **Min read support** drops the junctions carried by fewer reads than the
  slider's value

Turn the arcs off from the same submenu. See the
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
and discordant pairs stand out from the short local arcs. A partner the view has
not loaded draws as a large semicircular arc reaching toward it. A mate on
another chromosome draws as an arc too, when that chromosome is one of the
regions on screen, and as a vertical line at the breakpoint when it is not — the
line says the connection reaches somewhere this view is not showing. Both can be
toggled off. Dragging the track taller re-fits the arcs into the available
height.

An arc whose two ends are in different displayed regions spans them, so opening
a second region either side of a breakpoint shows the connection as one curve.
Interchromosomal arcs are drawn in one colour, since insert size and pair
orientation mean nothing across chromosomes.

Reads describing the same connection draw as **one arc, thickened by how many of
them there are**, the way a sashimi arc is sized by its junction's read count,
so the arcs rank the evidence. Thickness is on a log scale, and a connection
supported by a single read draws at the width
[`readConnectionsLineWidth`](/docs/config/linearalignmentsdisplay/#slot-readconnectionslinewidth)
sets. Arcs coalesce only on exactly equal endpoints, so junctions a few bases
apart stay separate curves.

Hovering an arc reports the junction behind it: its location, the distance
between the two ends, how many reads support it, and which colour bucket it fell
in. In read-cloud mode the tooltip also gives the pair's insert size, which is
what that mode plots on the Y axis.

<Figure caption="Enabling 'Show read arcs' from the Read connections submenu; the arcs draw alongside the coverage panel." src="/img/alignments/select_arc_display.png" />

### Read cloud

_Show read cloud_ lays pairs out on the Y axis by the **log distance between
mates**, making the insert-size distribution visible at a glance. Patterns that
arcs flatten separate clearly, for example short-insert (insertion-supporting)
pairs drawn pink lift away from the background.

<Figure caption="Read cloud on a synthetic SV dataset. Reads are stratified by log distance between mates, surfacing insertion pairs (pink) against the background." src="/img/alignments/read_cloud.png" />

## Going to a read's mate

When a pair is discordant, the question is usually what is at the other end.
Right-click a read and open the **View mate** submenu:

- **Split current view to show mate** replaces the view's displayed regions with
  two: the read's locus and its mate's, side by side in the one view, each
  padded by a read length. An inter-chromosomal mate is simply a second region
  on another chromosome. A snackbar offers **Undo** to put the original view
  back, so this is cheap to try and reverse.
- **Open breakpoint split view** puts the two loci in
  [their own stacked panels](/docs/user_guides/sv_visualization#breakpoint-split-view)
  instead, which draws the connecting splines.

The submenu appears only for a read whose mate is mapped.

## One read against the reference

A long read that crosses a structural variant aligns in pieces: the aligner
splits it into a primary alignment plus one supplementary alignment per
additional locus, records the whole set in each record's `SA` tag, and the
pileup draws them as separate rows, often far apart or on different chromosomes.

Right-click any of them and choose **Launch view → Linear read vs ref** to put
them back together, which the `SA` tag makes possible from one record. The read
becomes its own assembly along one lane, every reference locus it touches is
laid out along the other, and each alignment segment is drawn as a ribbon
between them, in the order the read visits them rather than in reference order.

An insertion shows as a gap in the diagonal, since those bases are in the read
and not in the reference. Dragging over a region in the read lane extracts that
sequence.

<Figure caption="'Linear read vs ref' for a SKBR3 PacBio read spanning several insertions. The ordinary pileup on top, and below it the read drawn against the reference, where each gap in the diagonal is inserted sequence absent from the reference." src="/img/read_vs_ref_insertion.png" />

The companion item `Dotplot of read vs ref` plots the same alignment as a
dotplot, which reads more clearly when a read visits one locus repeatedly.

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
