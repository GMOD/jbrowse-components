---
id: sv_visualization
title: Structural variant visualization
---

import Figure from '../figure'

JBrowse 2 provides several complementary views for exploring structural variants
(SVs). This guide covers the main tools and how they connect.

## SV signal in the alignments track

The standard alignments track already exposes several signals that indicate
structural variation without requiring any extra steps.

### Soft clipping

When reads extend past a breakpoint, the overhanging bases are soft-clipped.
Enabling soft clipping display makes these bases visible and highlights the
edges of SVs. Access it via Track menu → Pileup settings → Show... → Show soft
clipping.

<Figure caption="Shows what turning on soft-clipping enables for a simulated long-read dataset. There is a simulated structural variant, a deletion, at this position, so the read has bases that map to the other side of the deletion being revealed by this." src="/img/alignments_soft_clipped.png" />

### Insertion and clipping indicators

The alignments track draws an inverted histogram at the top of the pileup
showing insertion and clipping counts. Positions where clipping or insertions
cover more than ~30% of reads are marked with a colored triangle (purple for
insertions, blue for soft clipping, red for hard clipping).

<Figure caption="Clipping and insertion indicators are drawn at the top of the alignments track." src="/img/alignment_clipping_indicators.png" />

Large insertions (>10 bp) are further highlighted with a larger purple
rectangle—this is especially prominent in long-read data.

<Figure caption="Large insertion indicator drawn from long reads, along with the 'show soft clipping' setting turned on for a short read track." src="/img/insertion_indicators.png" />

### Color by pair orientation

Coloring reads by pair orientation reveals characteristic patterns for each SV
type. Enable it via Track menu → Pileup settings → Color by... → Pair
orientation. JBrowse uses the same color scheme as IGV — see the
[IGV paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)
for further background. For standard Illumina (FR-oriented) libraries:

| Orientation | Color | Description |
| --- | --- | --- |
| LR (→ ←, normal proper pair) | light grey | concordant, no SV |
| RL (← →, mates pointing away from each other) | green | abnormal orientation |
| LL (→ →, both mates forward strand) | teal | abnormal orientation |
| RR (← ←, both mates reverse strand) | dark blue | abnormal orientation |

<Figure caption="This shows an inverted duplication with characteristic orientation patterns: RL pairs (green) and LL/RR pairs (teal/dark blue) at the structural variant boundaries." src="/img/inverted_duplication.png" />

### Color by insert size

**In the pileup**, Track menu → Pileup settings → Color by... → Insert size
renders a continuous color gradient based on insert size (warmer for longer
inserts). Reads with mates on a different chromosome are shown in dark grey.

**In the read arc and linked reads displays**, Track menu → Color scheme →
Insert size ± 3σ uses threshold-based coloring:

| Pattern | Color | Typical signal |
| --- | --- | --- |
| Insert larger than expected (>3σ) | red | deletion spans the pair |
| Insert smaller than expected (<3σ) | pink | insertion between the pair |
| Mate on a different chromosome | purple | translocation or inter-chromosomal fusion |

The **Insert size ± 3σ and orientation** option combines both signals and is
often the most informative setting for a general SV scan.

## SV-type signatures

Different SVs produce characteristic combinations of signals. Here is what to
look for in each case. The patterns below apply to JBrowse's IGV-emulated color
schemes; the
[DRAGEN SV IGV tutorial](https://help.dragen.illumina.com/product-guides/dragen-v4.5/dragen-dna-pipeline/sv-calling/sv-igv-tutorial)
is a useful companion reference with detailed screenshots of each type.

### Deletion

- Soft-clipped reads at two nearby positions are indicative of a deletion's
  breakpoint edges
- A coverage drop in the region between breakpoints is indicative of a deletion
- Paired reads flanking the gap colored **red** (larger-than-expected insert) in
  insert size mode are indicative of a deletion spanning the pair
- In the read arc display, unusually long arcs are indicative of a deletion

### Insertion

- Soft-clipped reads at a single site are indicative of an insertion; with "Show
  soft clipping" enabled the inserted bases become visible on each side
- When the insertion is large enough that paired reads flank it, those pairs
  colored **pink** (smaller-than-expected insert on the reference) in insert-size
  mode are indicative of an insertion between them
- For insertions larger than the sequenced fragment size, mates may become
  unmapped; paired-end evidence weakens and long reads are needed to fully span
  the event
- The purple insertion indicator triangle at a position is indicative of an
  insertion when >30% of reads carry one there

### Inversion

- **LL (teal)** and **RR (dark blue)** read pairs at the boundaries are
  indicative of an inversion, where normally LR-oriented reads become
  same-direction
- Interior reads may look normal if you are zoomed into the inverted region
  itself
- Soft-clipped reads at both breakpoints, sometimes with short homology sequences

### Tandem duplication

- **RL (green)** read pairs are indicative of a tandem duplication: reads appear
  to point away from each other when the right end of the duplication has been
  joined to the left end in the subject genome
- Elevated coverage over the duplicated segment is also indicative of a
  duplication
- In the read arc display, arcs pointing backward (upstream) across a junction
  are indicative of a tandem duplication

### Translocation / inter-chromosomal fusion

- In the read arc and linked reads displays with insert size coloring, reads
  with mates on a different chromosome are colored **purple** and are indicative
  of an inter-chromosomal event
- In the pileup with insert size coloring, they appear **dark grey**
- A cluster of such reads at a locus is indicative of one end of a
  translocation; open the breakpoint split view from the feature details to see
  both ends side-by-side
- In the read arc display, inter-chromosomal connections render as vertical
  lines at the edge of the view

## Read arc display

The read arc display renders bezier curves between the two ends of a paired-end
read or split alignment, making long-range connections visually obvious. Enable
it via Track menu → Display types → Read arc display (or Track menu → Replace
lower panel with... → Read arc display to show arcs alongside the
coverage+pileup panels).

<Figure caption="Menu item for selecting the 'Read arc display' using the track menu." src="/img/alignments/select_arc_display.png" />

Off-screen or inter-chromosomal connections are shown as vertical lines at the
edge of the view. Dragging the track height adjusts how the arcs pack into the
available space.

<Figure caption="The read arc display showing a deletion with Illumina paired-end reads and Nanopore ultra-long reads on HG002." src="/img/alignments/arc_selector.png" />

The read arc display also has a Color scheme menu (Track menu → Color scheme)
with options for coloring by insert size, orientation, or both, making it easy
to distinguish normal pairs from discordant ones.

## Linked reads display

The linked reads display connects paired-end reads and supplementary alignments
as linked entities drawn on the same row, and stratifies rows by the log-scaled
distance between the read ends. This makes it straightforward to count how many
reads span a breakpoint and to see their orientation.

Enable it via Track menu → Display types → Linked reads display (or Track menu
→ Replace lower panel with... → Linked reads display to keep the
coverage+pileup panels).

<Figure caption="The read arc display and linked reads display being shown for the same dataset on volvox data with synthetic SVs." src="/img/alignments/read_cloud.png" />

Options in Track menu → Edit filters let you:

- Show or hide **proper pairs** (concordant pairs that do not signal an SV)
- Show or hide **singletons** (reads with no detected pair or supplementary
  alignment)

Track menu → Color scheme provides coloring by insert size, orientation, or
both. Long reads with supplementary alignments are colored salmon and light blue
to show the flip in orientation at the breakpoint. Short paired-end reads use
navy and green to highlight misoriented pairs.

## Breakpoint split view

The breakpoint split view opens two synchronized linear genome panels placed
side-by-side, each showing one side of a breakpoint. Splines connect supporting
reads across both panels, and the SV call itself is drawn as a colored line with
feet indicating directionality. This is the view most useful for translocations,
where the two breakpoints may be on different chromosomes—there is no need to
"zoom out" to see the distance between them.

<Figure caption="The breakpoint split view showing an interchromosomal translocation. Black splines connect supporting reads; the green line with feet is the variant call." src="/img/breakpoint_split_view.png" />

You can search for a location directly in the breakpoint split view header bar
(added in v3.7.0) without needing to navigate the panels manually.

### Launching from the SV inspector

The SV inspector (available from the main menu bar) loads a VCF, BED, BEDPE,
or STAR-fusion file and displays a table of SV calls alongside a whole-genome
circular view. Clicking on a feature in the circular view, or clicking the
triangle dropdown on any table row, opens a breakpoint split view focused on
that variant.

See the [SV inspector guide](sv_inspector_view) for details on loading data.

### Launching from variant feature details

When you click on a BND or TRA variant in a variant track, the feature details
panel that opens on the right contains a button to open the breakpoint split
view. This launches the split view focused on the two ends of that call and
automatically loads any alignment tracks that are already open in the view.

<Figure caption="The feature details panel for a BND/TRA variant has a link to open the breakpoint split view." src="/img/link_to_split_view.png" />

### Launching from alignment feature details

You can launch the breakpoint split view directly from a read without needing a
VCF. Click any read that has a supplementary alignment (typically a long read or
a chimeric short read), and the feature details panel will include an option to
open the breakpoint split view centered on that read and its supplementary
partner.

## Tips for navigating large SV regions

JBrowse renders tracks on demand and will decline to load very large regions to
avoid fetching hundreds of megabytes. If you get an error when zooming out, try:

- **Navigate via VCF track**: add your SV call set as a variant track. Clicking
  a feature jumps directly to the relevant region at an appropriate zoom level,
  or opens the breakpoint split view via feature details.
- **Use the SV inspector**: loading your VCF into the SV inspector gives you a
  whole-genome overview plus one-click navigation to any individual call.
- **Use the breakpoint split view**: for inter-chromosomal or very large SVs,
  open the breakpoint split view directly so each panel shows only its local
  region—no need to zoom out to the full inter-breakpoint distance.
- **Zoom increment**: use the `+` / `-` buttons in the toolbar, or scroll the
  mouse wheel, for finer zoom steps than dragging the zoom slider.

## Summary of display types and settings

| Display / setting | How to enable | Best for |
| --- | --- | --- |
| Pileup (default) | Default lower panel | Individual reads, base-level detail |
| Color by pair orientation | Pileup settings → Color by... | Inversions (teal/dark blue), duplications (green) |
| Color by insert size | Pileup settings → Color by... | Deletions (red), insertions (blue), translocations (black/grey) |
| Soft clipping | Pileup settings → Show... | Clipped bases at breakpoints |
| Read arc display | Track menu → Display types | Overview of long-range connections across many reads |
| Linked reads display | Track menu → Display types | Counting discordant pairs, seeing orientation per read |
| Breakpoint split view | Feature details or SV inspector | Side-by-side inspection of both breakpoint loci |
