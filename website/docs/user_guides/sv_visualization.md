---
id: sv_visualization
title: Structural variant visualization
---

import Figure from '../figure'

JBrowse 2 provides several complementary views for exploring structural variants
(SVs). This guide covers the SV-focused interpretation of these tools; see the
[alignments track guide](alignments_track) for general alignments features.

## SV signals in the alignments track

The standard alignments track exposes several signals relevant to SVs without
requiring any extra steps:

- **Soft clipping** — reads that extend past a breakpoint have their overhanging
  bases soft-clipped; enabling Show soft clipping (Track menu → Pileup settings
  → Show...) makes these bases visible at breakpoint edges
- **Insertion/clipping indicators** — a purple triangle marks positions where
  >30% of reads carry an insertion; blue/red triangles mark clipping; larger
  purple rectangles appear for insertions >10 bp
- **Color by pair orientation** — abnormally oriented pairs produce characteristic
  colors described in the table below
- **Color by insert size** — pairs with unexpectedly large or small inserts are
  highlighted

For descriptions of these features in general use, see the
[alignments track guide](alignments_track).

### Pair orientation color scheme

JBrowse uses the same color scheme as IGV. See the
[IGV paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)
for further background. Enable via Track menu → Pileup settings → Color by... →
Pair orientation. For standard Illumina (FR-oriented) libraries:

| Orientation | Color | Description |
| --- | --- | --- |
| LR (→ ←, normal proper pair) | light grey | concordant |
| RL (← →, mates pointing away from each other) | green | abnormal orientation |
| LL (→ →, both mates forward strand) | teal | abnormal orientation |
| RR (← ←, both mates reverse strand) | dark blue | abnormal orientation |

<Figure caption="An inverted duplication with characteristic orientation patterns: RL pairs (green) and LL/RR pairs (teal/dark blue) at the structural variant boundaries." src="/img/inverted_duplication.png" />

### Insert size color scheme

**In the pileup** (Track menu → Pileup settings → Color by... → Insert size),
reads are colored by a continuous HSL gradient based on insert size; reads with
mates on a different chromosome are dark grey.

**In the read arc and linked reads displays** (Track menu → Color scheme), the
Insert size ± 3σ option uses threshold-based coloring:

| Pattern | Color | Notes |
| --- | --- | --- |
| Insert larger than expected (&gt;3σ) | red | indicative of a deletion spanning the pair |
| Insert smaller than expected (&lt;3σ) | pink | indicative of an insertion between the pair |
| Mate on a different chromosome | purple | indicative of an inter-chromosomal event |

**Insert size ± 3σ and orientation** combines both signals and is often the most
informative setting for a general SV scan.

## SV-type signatures

The patterns below describe what each SV type characteristically looks like in
the alignments track. They are indicative, not definitive. The
[DRAGEN SV IGV tutorial](https://help.dragen.illumina.com/product-guides/dragen-v4.5/dragen-dna-pipeline/sv-calling/sv-igv-tutorial)
is a useful companion reference.

### Deletion

- Soft-clipped reads at two nearby positions are indicative of breakpoint edges
- A coverage drop between those positions is indicative of a deletion
- Paired reads flanking the gap colored **red** (larger insert) are indicative of
  a deletion spanning the pair
- In the read arc display, unusually long arcs are indicative of a deletion

### Insertion

- Soft-clipped reads at a single site are indicative of an insertion; with Show
  soft clipping enabled, the inserted bases become visible on each side
- When the insertion is large enough that pairs flank it, those pairs colored
  **pink** (smaller insert on reference) are indicative of an insertion between
  them
- For insertions larger than the sequenced fragment size, mates may become
  unmapped; long reads are needed to fully span the event
- A purple insertion indicator triangle at a position is indicative of an
  insertion when >30% of reads carry one

### Inversion

- **LL (teal)** and **RR (dark blue)** read pairs at a boundary are indicative
  of an inversion, where normally LR-oriented reads become same-direction
- Interior reads may look concordant if you are zoomed into the inverted region
  itself
- Soft-clipped reads at both breakpoints, sometimes with short homology sequences

### Tandem duplication

- **RL (green)** read pairs are indicative of a tandem duplication: reads appear
  to point away from each other when the duplicated segment has been joined back
  to its origin
- Elevated coverage over the duplicated region is also indicative of a
  duplication
- In the read arc display, arcs pointing backward (upstream) across a junction
  are indicative of a tandem duplication

### Translocation / inter-chromosomal fusion

- In the read arc and linked reads displays, reads with mates on a different
  chromosome are colored **purple** and are indicative of an inter-chromosomal
  event; in the pileup they appear **dark grey**
- A cluster of such reads at a locus is indicative of one end of a
  translocation; open the breakpoint split view from the feature details to see
  both ends simultaneously

## Read arc display

The read arc display renders bezier curves between the two ends of a paired-end
read or split alignment, making long-range connections visually obvious. Enable
via Track menu → Display types → Read arc display (or Replace lower panel
with... to show arcs alongside the coverage and pileup panels).

<Figure caption="Menu item for selecting the 'Read arc display'." src="/img/alignments/select_arc_display.png" />

Inter-chromosomal connections are shown as vertical lines at the view edge.
Track menu → Color scheme provides insert size, orientation, or combined
coloring.

<Figure caption="The read arc display showing a deletion with Illumina paired-end reads and Nanopore ultra-long reads on HG002." src="/img/alignments/arc_selector.png" />

## Linked reads display

The linked reads display draws paired-end reads and supplementary alignments on
the same row, connected by a line, and stratifies rows by the log-scaled
distance between read ends. This makes it easy to count how many reads span a
breakpoint and to see their orientation. Chains with supplementary alignments
are connected by an orange line.

Enable via Track menu → Display types → Linked reads display (or Replace lower
panel with... to keep the coverage and pileup panels).

<Figure caption="The read arc display and linked reads display shown together for the same dataset." src="/img/alignments/read_cloud.png" />

Track menu → Edit filters lets you show or hide **proper pairs** and
**singletons**. Track menu → Color scheme provides insert size, orientation, or
combined coloring.

## Inspecting individual reads

Right-clicking any read opens a context menu with **Linear read vs ref**, which
opens a synteny-style split view showing how that single read aligns to the
reference. This is useful for inspecting complex or multi-breakpoint SVs on a
single long read.

## Breakpoint split view

The breakpoint split view opens two synchronized panels side-by-side, each
showing one breakpoint locus. Splines connect supporting reads across both
panels, and the variant call is drawn as a colored line with feet indicating
directionality.

<Figure caption="Breakpoint split view for an interchromosomal translocation. Black splines connect supporting reads; the green line with feet is the variant call." src="/img/breakpoint_split_view.png" />

The header bar (added in v3.7.0) accepts location searches directly in either
panel.

### Launching the breakpoint split view

- **From the SV inspector** — click a feature in the circular overview or the
  triangle dropdown on any table row. See the [SV inspector guide](sv_inspector_view).
- **From variant feature details** — click a BND or TRA variant in a variant
  track; the feature details panel contains a button to open the split view,
  automatically loading any open alignment tracks.
- **From alignment feature details** — click any read with a supplementary
  alignment; the feature details panel includes an option to open the split view
  centered on that read and its supplementary partner.

<Figure caption="The feature details panel for a BND/TRA variant has a link to open the breakpoint split view." src="/img/link_to_split_view.png" />

## Large SV strategy

Loading a very large genomic region will trigger an error because JBrowse
declines to fetch hundreds of megabytes at once. For large or inter-chromosomal
SVs, a more effective approach is:

- Use a **bigWig coverage track** instead of a full alignments track when
  surveying the region — it loads at any scale and makes coverage changes
  (deletions, duplications) immediately visible
- Load the **SV call set as a variant track** for a compact overview of all
  calls; clicking a feature navigates directly to it
- Open the **breakpoint split view** to inspect the breakpoint loci themselves —
  each panel shows only a local window around one end of the SV, so the
  inter-breakpoint distance is irrelevant
- Use the **SV inspector** for whole-genome triage before drilling into
  individual calls

## Limitations

- **Read-level displays require zooming in**: the pileup, arc, and linked reads
  displays only render when the view is zoomed in enough to load individual
  reads; very large SVs cannot be spanned in a single pileup view
- **Paired-end evidence is fragment-size limited**: for insertions larger than
  the sequenced fragment, paired-end evidence disappears; long reads are required
  to fully resolve the inserted sequence
- **Repetitive regions**: SVs in segmental duplications or repeats produce noisy,
  ambiguous signals; soft-clipped reads and orientation anomalies are common
  artefacts in these regions
- **Short-read orientation coloring** assumes an FR library; other library
  preparations (RF, FF) require changing the orientation type setting

## Summary

| Display / setting | How to enable | Best for |
| --- | --- | --- |
| Pileup (default) | Default lower panel | Base-level detail, individual reads |
| Color by pair orientation | Pileup settings → Color by... | Abnormal orientation patterns (RL/LL/RR) |
| Color by insert size | Pileup settings → Color by... | Insert size anomalies (pileup, continuous gradient) |
| Read arc display | Track menu → Display types | Overview of long-range connections |
| Linked reads display | Track menu → Display types | Counting discordant pairs, orientation per read |
| Linear read vs ref | Right-click on any read | Complex alignment of a single long read |
| Breakpoint split view | Feature details or SV inspector | Side-by-side inspection of both breakpoint loci |
