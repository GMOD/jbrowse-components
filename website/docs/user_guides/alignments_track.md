---
title: Alignments track
description: Learn how to show BAM and CRAM files
guide_category: Track types
---

An alignments track shows BAM/CRAM reads two ways at once: a coverage histogram
on top (read depth at each position) and a pileup below (one box per read). Zoom
to base level and most of what you need is already on screen. Almost everything
else is a track-menu option that changes how reads are sorted, colored, grouped,
sized, or filtered.

<Figure caption="An alignments track: coverage on top, pileup below. Mismatches show as colored ticks in the pileup and colored segments in the coverage bars." src="/img/volvox_alignments.png" />

A coverage bar that is part red means that fraction of reads have a mismatch
there. The track menu's **Show → Coverage** and **Show → Pileup** toggles turn
either panel off independently: coverage-only is compact for surveying depth
across many samples, and pileup-only gives the reads the vertical space.

## Sorting reads

**Right-click a base in the pileup** and choose _Sort by base at position_.
Reads group by the nucleotide they have there, so haplotype-correlated SNPs line
up.

<Figure caption="Sort by base groups reads by the nucleotide they have at the sorted position." src="/img/alignments_sort_by_base.png" />

The track menu's **Sort by** groups reads the same way against the _center line_
(a 1bp indicator at the middle of the view), and also sorts by strand, mapping
quality, or any BAM tag. Four more order the whole layout instead:

- **Sort by → Longest reads first** puts the widest reads at the top.
- **Sort by → Spliced reads first** puts the reads with a reference skip (`N`)
  in the CIGAR there.
- **Sort by → Split reads first** puts the reads aligned in pieces there, the
  ones with an `SA` tag.
- **Sort by → SV evidence first** puts the split reads on top, then the reads
  with an insertion or deletion of 50 bp or more, then the pairs the aligner did
  not call concordant: at a breakpoint those are the reads crossing it. A read
  counts only when both ends are placed: a split read whose other pieces all sit
  at mapping quality 0, such as the clipped tail of an Alu, stays put.

## Color by

The track menu's **Color by** offers several schemes.

### Strand

<!-- COLOR_TABLE alignments-strand START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#EC8B8B;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#EC8B8B"></span> | Forward strand | `#EC8B8B` | Read maps to the forward strand |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#8F8FD8;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#8F8FD8"></span> | Reverse strand | `#8F8FD8` | Read maps to the reverse strand |

<!-- COLOR_TABLE alignments-strand END -->

### Read quality and bases

- **Mapping quality** colors each read by its MAPQ bin, the same four bins a
  MAPQ facet stacks: dark blue at 0, through 1-9 and 10-29, to yellow at 30 and
  above, so reads in repeats come out dark. A MAPQ of 255, which means the
  aligner reported none, is grey and passes the **Mapping quality** filter. The
  [SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf) defines
  MAPQ as `-10 log10 Pr{mapping position is wrong}`, so a MAPQ 0 read is drawn
  where it aligned with the aligner putting no better than even odds on it being
  the right copy, which happens when the best score is tied across positions
  ([Li, Ruan and Durbin 2008](https://doi.org/10.1101/gr.078212.108)). A
  **secondary** alignment (FLAG `0x100`) is a competing placement recorded as a
  separate record; the default
  [`filter`](/docs/config/baselinearalignmentsdisplay/#slot-filter) drops
  duplicate, QC-failed and unmapped reads, and keeps those. The
  [mappability QC tutorial](/docs/tutorials/mappability_qc) works a locus where
  MAPQ 0 covers a whole gene.
- **Base quality** colors every base by Phred score on the same cividis ramp,
  dark blue at 0 to yellow at 40 and above, the quickest way to tell a variant
  from a run of low-confidence calls. A CRAM read stored without quality scores
  draws its bases in the plain read color.
- **Base letters** draws every aligned base in its nucleotide color, not just
  the mismatches.

### A read tag

**Color by → Tag...** asks for a tag name and how to color it: **A color per
value** for a tag like `HP` (haplotype) or `RG` (read group), or **A gradient
over numbers** for a numeric tag like `NM` (edit distance).

### Modifications and methylation

For a BAM/CRAM with MM/ML modification calls (nanopore, PacBio), **Color by →
Modifications** paints them in two modes:

- **Modifications** marks only where the MM tag reports a modified base, so an
  unmethylated region looks empty. In **Filter by → More filters...**, the
  Modifications section raises the probability cutoff and restricts to one type
  such as 5mC
- **Color by → Show unmodified in blue** (IGV's "2-color") also paints the
  not-modified side blue. For cytosine data it fills every CpG in context,
  including ones the basecaller left implicit, inferred from the reference.
  **Color by → Cytosine context** picks CpG, CHG or CHH

See the [methylation tutorial](/docs/tutorials/methylation) for an end-to-end
modified-base workflow.

<Figure caption="Nanopore reads over a CpG island colored by type (top) and 2-color (bottom)." src="/img/alignments/modifications2.png" />

Any type in the MM tag paints, so fiber-seq's N6-methyladenine (`A+a`) draws
like any other modification, and since the assay adds 6mA to accessible DNA the
call density doubles as a chromatin-accessibility readout.

<Figure caption="Fiber-seq reads at the GAPDH promoter in modifications mode, purple marking 6mA calls. Treated sample above, no-enzyme control below." src="/img/methylation/chromatin_accessibility_6ma.png" />

### Bisulfite and EM-seq

Bisulfite (WGBS) and EM-seq reads have no MM/ML tags; methylation is in the C→T
conversion itself. **Color by → Bisulfite / EM-seq** reads it off the aligned
bases against the reference, so a plain BAM from a bisulfite-aware aligner
colors without a methylation caller. Methylated cytosines paint red, **Color by
→ Show unmodified in blue** paints the converted sites too, and **Color by →
Cytosine context** picks which cytosines it scores: CpG, CHG, CHH or all of
them, since plant genomes methylate in all three. The
[bisulfite tutorial](/docs/tutorials/bisulfite) runs it on _Arabidopsis_ data.

### Pair orientation and insert size

For paired-end data, **Color by → Insert size and orientation** highlights
discordant pairs, the main way to scan short reads for structural variants:
unexpectedly large inserts turn red, small ones pink, and abnormal orientations
get separate colors, whichever cue is strongest. The
[SV visualization guide](/docs/user_guides/sv_visualization#pair-orientation)
has the color tables, the expected-insert threshold, and what each pattern means
at a breakpoint.

### By tag

Any BAM tag can color, sort, or filter. The common case is the `HP` haplotype
tag for phased reads, where grouping by `HP` (below) usually reads more clearly
than coloring alone. See the
[phased trio tutorial](/docs/tutorials/analyze_trio).

## Grouping reads

The track menu's **Group by** splits the pileup into one coverage+pileup section
per value of a dimension. It is a radio list, one dimension at a time:
**Strand**, **First-of-pair strand**, **Pair orientation**, **Split read (SA
tag)** (separating reads crossing a breakpoint from those spanning it intact),
**Mapping quality**, and **Tag...**, which opens a dialog for the tag name (`HP`
for haplotype, `RG` for read group, or any other). Groups share one coverage
scale and reads missing the tag collect in a trailing "none" section. Grouping
caps at 40 sections; past that the tail merges into one "N merged values"
section, and the tag dialog refuses a tag that would reach the cap, telling you
how many distinct values it found in view first. Drag a section's chip onto
another section to move it there; **Show → Reset section
order**<!-- menu-path-ok --> returns them to the sorted order.

The `facet` setting pre-groups a track, spelled as on the feature tracks: a
dimension (`"strand"`, `"pairOrientation"`, ...), a tag as `"tags.HP"`, or any
other read field. The object form adds `sort`, the section order: the values
listed stack first, in that order, and the rest follow sorted. A chip drag
writes the same object:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "hg002_ont_phased",
  "name": "HG002 ONT, phased",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": { "uri": "https://example.com/HG002.phased.bam" },
    "index": {
      "location": { "uri": "https://example.com/HG002.phased.bam.bai" }
    }
  },
  "displayDefaults": {
    "facet": { "field": "tags.HP", "sort": ["2", "1"] }
  }
}
```

<Figure caption="Group by → Tag... over GIAB HG002 nanopore reads opens a dialog for the tag name, which reports the values it finds in view." src="/img/alignments/haplotype_groupby.png" />

Each section has a label chip that controls the section's height:

- The chevron collapses that section to just its coverage band, and expands it
  again.
- **Show all reads** appears when the section's reads were clipped to fit the
  shared height budget; it gives that one section the track's full row cap, and
  turns into **Fit to view** to hand it back.
- Right-click a chip to hide that section. Its reads leave the shared coverage
  scale, the legend and the arcs with it, which is how to read the rest of the
  stack without the section that dominates it. **Show → Show N hidden groups**
  puts them back.<!-- menu-path-ok -->
- Dragging the boundary below a section resizes that section alone.

**Show → Collapse groups to one row** draws every section as a single row with
overlap depth as darker shading, the compact reading for a track with many
groups; expanding one section from its chip opts that one back out to a true
stack.

The chevron, resize, hide, and collapse choices above apply only within the
view. They are not saved to a session or a shared link, and changing the
grouping dimension clears them, since a section name means nothing under a
different dimension.

<Figure caption="GIAB HG002 nanopore reads grouped and colored by the HP tag, one tinted section per haplotype." src="/img/alignments/haplotype.png" />

Grouping by `HP` is also how to check that a heterozygous variant's supporting
reads sit on one haplotype; see
[phasing heterozygous SVs](/docs/user_guides/sv_visualization#phasing-heterozygous-svs).

Each section's coverage band is built from only the reads grouped into that
section. Group by **Strand** and turn off **Show → Pileup** for a forward and a
reverse histogram on a shared scale, each colored by the mismatches in that
strand's reads. On a strand-specific paired-end library group by **First-of-pair
strand** instead, since there the transcript strand is which mate the read is;
the [RNA-seq tutorial](/docs/tutorials/rnaseq#strand-specific-rna-seq) shows
that. Long-read cDNA is the clearest case, since the reads are oriented to the
transcript.

<Figure caption="HSV-1 cDNA reads over two neighbouring genes, grouped and colored by strand." src="/img/alignments/strand_split_depth.png" />

Grouping by strand also works as a check on the reads. A position colored in one
band and not the other comes from one strand alone, the signature of a
basecalling error; a position that disagrees in both bands is a real variant.

<Figure caption="GIAB HG002 nanopore reads grouped by strand, each band's coverage from that strand's reads alone. The left box disagrees in the reverse band only, the right box in both." src="/img/alignments/strand_split_coverage.png" />

**Track menu → Read connections → SV channels (pairs by orientation)** groups by
pair orientation, drops the pileup and turns the arcs on together, so each
orientation class becomes a separate coverage band with a separate set of arcs.
See [SV channels](/docs/user_guides/sv_visualization#sv-channels).

## Read height and track sizing

The track menu's **Read height** submenu sets how tall each read is drawn. The
presets are Normal, Compact and Super-compact, plus **Custom...** for an exact
pixel height.

<Figure caption="The same reads at a compact feature height." src="/img/alignments/compact.png" />

A pileup taller than the track scrolls. Two settings change that:

- **Read height → Fit to track height** derives the read height from the track
  height so the whole pileup fits, shrinking as coverage deepens. Picking a
  preset drops back to it
- **Advanced → Track height → Autogrow** grows the track to hold the reads, up
  to [growMaxHeight](/docs/config/linearalignmentsdisplay#slot-growmaxheight),
  past which it scrolls again. Real sequencing depth passes that ceiling
  quickly, so raise the slot to keep growing

<Figure src="/img/alignments/height_mode_fit.png" caption="The Read height submenu with Fit to track height selected." />

Fit mode adapts to how much room a pileup has: drag the track taller or shorter
and the reads re-fit. Reads draw no taller than the Normal preset and no smaller
than 1px, so a deep enough pileup still overflows. With grouping, each group's
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
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#800080;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#800080"></span> | Insertion | `#800080` | Reads with an insertion relative to the reference |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#00f;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#00f"></span> | Soft clip | `#00f` | Reads are soft-clipped (clipped bases retained in the read) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#f00;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#f00"></span> | Hard clip | `#f00` | Reads are hard-clipped (clipped bases removed from the read) |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#555555;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#555555"></span> | Overlapping segments of one molecule | `#555555` | Both reads of a pair, or both arms of a split read, align here — so the junction between them is this span rather than a point |

<!-- COLOR_TABLE alignments-indicators END -->

<Figure caption="Clip indicators above the coverage track: blue marks soft clips, red marks hard clips." src="/img/alignment_clipping_indicators.png" />

Insertions larger than 10bp also draw a purple rectangle in the pileup.

<Figure caption="A large insertion across GIAB HG002 nanopore, PacBio and Illumina reads, drawn as purple insertion marks." src="/img/insertion.png" />

## Soft clipping

Bases at a read's end that don't align are **soft-clipped** (kept in the read)
or **hard-clipped** (dropped). Soft-clipped bases are hidden by default; **Show
→ Soft clipping** in the track menu reveals them. Clusters of them often mark a
structural-variant breakpoint.

A read with no `SEQ` field (secondary reads among them) has no clipped bases to
draw, so its clip indicator appears black.

<Figure caption="Enabling Soft clipping (top), and reads ending at a deletion breakpoint showing their unaligned bases (bottom)." src="/img/alignments_soft_clipped_menu.png" />

## Filtering reads

The track menu's **Filter by** hides reads by SAM flag (drop duplicates and
secondaries, or keep only properly-paired reads), by read name, or by tag value
(`HP:1` for one haplotype, `HP:*` for any read with the tag). The splicing
radios keep only spliced reads (a reference skip, `N`, in the CIGAR) or only
unspliced ones, and **Mapping quality** hides reads under a minimum MAPQ, as
`samtools view -q` does. The coverage histogram follows the filter.

<Figure caption="The Filter options dialog with HP typed as the tag. A value of * keeps every read with the tag." src="/img/alignments/filter_dialog.png" />

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

**Show → Sashimi arcs** turns them on and off, and **Show → Sashimi read
counts** prints each junction's supporting-read count on its arc. While the arcs
draw:

- **Filter by → Non-canonical junctions → Hide non-canonical junctions** drops
  junctions whose motif is none of the three canonical pairs. On deep RNA-seq
  the thin arcs are mostly these, so it is the filter to reach for first. **Only
  non-canonical junctions** keeps just those, for checking an aligner's output
- The Sashimi arcs section of **Filter by → More filters...** shows, hides or
  keeps only the **Split-read junctions** that split alignments (SA tag) imply
  beside the N-gap splices, and **Min reads at a junction** drops the junctions
  with fewer reads
- **Advanced → Sashimi placement** splits the arcs above/below the coverage row

See the [RNA-seq tutorial](/docs/tutorials/rnaseq). When one junction peak
dominates the coverage histogram, **Advanced → Coverage axis... → Scale → Log**
keeps the shallower junctions visible.

<Figure caption="Sashimi arcs over B2M RNA-seq with read-support labels on and coverage on a log scale." src="/img/alignments_track_arcs.png" />

## Read connections

The track menu's **Read connections** submenu connects paired or split reads,
the long-range relationships behind structural variants.

### Read arcs

**Read connections → Read arcs** draws a bezier curve between the ends of each
pair, so long-range and discordant pairs stand out from the short local arcs. A
partner the view has not loaded draws as a large semicircle reaching toward it.
A mate on another chromosome draws as an arc when that chromosome is on screen
and as a vertical line at the breakpoint when it is not. Both can be toggled
off, and dragging the track taller re-fits the arcs.

An arc whose ends are in different displayed regions spans them, so a second
region either side of a breakpoint shows the connection as one curve.
Interchromosomal arcs draw in one color, since insert size and orientation mean
nothing across chromosomes.

The arcs and the read cloud paint insert size and orientation, in the colors
**Color by → Insert size and orientation** gives the reads.

Reads describing the same connection draw as **one arc, thickened by how many
there are**, on a log scale, so the arcs rank the evidence. A single-read
connection draws at
[`readConnections.encoding.strokeWidth`](/docs/config/readconnectionsencoding/#slot-strokewidth).
Arcs coalesce only on exactly equal endpoints.

Hovering an arc reports its location, the distance between the ends, the
supporting read count and its color bucket. In read-cloud mode it also gives the
insert size.

<Figure caption="Choosing Read arcs from the Read connections submenu." src="/img/alignments/select_arc_display.png" />

### Read cloud

**Read connections → Read cloud** lays pairs out on the Y axis by the **log
distance between mates**, so the insert-size distribution is visible directly
and short-insert (insertion-supporting) pairs lift away from the background.

<Figure caption="Read cloud on a synthetic SV dataset, reads stratified by log distance between mates." src="/img/alignments/read_cloud.png" />

## Going to a read's mate

Right-click a read and open the **View mate** submenu, present when the mate is
mapped:

- **Split current view to show mate** replaces the displayed regions with the
  read's locus and its mate's side by side, each padded by a read length, and
  turns on **Link mates and supplementary alignments** so the pair is drawn
  joined. A snackbar offers **Undo**, which restores both
- **Open breakpoint split view** puts the two loci in
  [separate stacked panels](/docs/user_guides/sv_visualization#breakpoint-split-view),
  which draws the connecting splines

For a split read, the **View split alignments** submenu offers the same two:
**Split current view to show split alignments** lays out one region per segment
of its `SA` tag, in read order, and **Open breakpoint split view** stacks a
panel per locus the read visits, each centred on its junction.

## One read against the reference

A long read crossing a structural variant aligns in pieces: a primary alignment
plus one supplementary per additional locus, the whole set recorded in each
record's `SA` tag, drawn as separate rows in the pileup.

Right-click any of them and choose **Launch → Linear read vs ref** to put them
back together. The read becomes a separate assembly along one row, every
reference locus it touches lies along the other, and each alignment segment is a
ribbon between them in the order the read visits them. An insertion shows as a
gap in the diagonal. Dragging over the read row extracts that sequence.

<Figure caption="Linear read vs ref for a PacBio read: the pileup above and the read drawn against the reference below. Each gap in the diagonal is inserted sequence." src="/img/read_vs_ref_insertion.png" />

`Dotplot of read vs ref` plots the same alignment as a dotplot, clearer when a
read visits one locus repeatedly.

## See also

- [](/docs/user_guides/consensus_sequence)
- [](/docs/tutorials/giab_hg002_reads)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [SV inspector](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/variant_track)
- [Alignments track configuration](/docs/config_guides/alignments_track)
- [LinearAlignmentsDisplay config schema](/docs/config/linearalignmentsdisplay)
- [MODIFICATION_TAGS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MODIFICATION_TAGS.md)
  — how this repo reads MM/ML base-modification tags, checked line by line
  against htslib, and the one place it deliberately differs
- [DEEP_COVERAGE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/DEEP_COVERAGE.md)
  — what these defaults do at 300x, where the insert-size cut flags a tight
  library's own tail, and why a support floor has to count over a window
