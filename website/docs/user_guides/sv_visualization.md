---
title: SV visualization
description: Interpreting SV signals across display types
guide_category: Analysis
---

**TL;DR:** Triage structural variant (SV) candidates in the
[SV inspector](/docs/user_guides/sv_inspector_view) (a combined variant table
and whole-genome circular overview), then drill into the alignments at each
breakpoint for read-level evidence. SV calls load as
[variant tracks](/docs/user_guides/variant_track) (VCF), reads as
[alignments tracks](/docs/user_guides/alignments_track) (BAM/CRAM); this page
focuses on interpreting SVs, while the
[alignments track guide](/docs/user_guides/alignments_track) covers general
features.

For the read-level signals behind these displays (how split (supplementary)
alignments, the `SA` tag, pair orientation, `TLEN`, and clipping encode SV
evidence in the SAM format), see
[Structural variants and the SAM format](https://cmdcolin.github.io/posts/2022-02-06-sv-sam/).

For end-to-end walkthroughs, see
[Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab) (HG008
tumor/normal PacBio HiFi + C-GIAB SV/CNV calls) and
[Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples)
(population-scale genotypes, trio inheritance, a large inversion).

## SV signals in the alignments track

Four things a standard alignments track already shows carry most of the SV
evidence. The [alignments track guide](/docs/user_guides/alignments_track)
covers what each control does; here they matter for what their patterns mean.

- [Soft clipping](/docs/user_guides/alignments_track#soft-clipping) - reads that
  extend past a breakpoint have their overhanging bases soft-clipped, so a
  cluster of them marks a breakpoint edge
- [Insertion and clipping indicators](/docs/user_guides/alignments_track#insertion-and-clipping-indicators) -
  purple, blue, and red triangles above the coverage row flag insertions and
  clips without zooming into the pileup
- Color by pair orientation - abnormally oriented pairs produce the
  characteristic colors in the table below
- Color by insert size - pairs with unexpectedly large or small inserts are
  highlighted

<Figure caption="Soft-clipped reads at a breakpoint edge (right side, ~position 2,700). The dense cluster of colored bases marks where many reads terminate at a common breakpoint." src="/img/alignments_soft_clipped.png" />

### Pair orientation color scheme

JBrowse uses the same color scheme as IGV. See the
[IGV paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)
for background. Set the color scheme to Pair orientation from the track menu.
Orientation coloring assumes standard `fr` (Illumina) read pairs; SOLiD-style
pair orientations are not supported. The table below assumes `fr`:

<!-- COLOR_TABLE alignments-pair-orientation START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#d3d3d3;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#d3d3d3"></span> | LR (→ ←, normal proper pair) | `#d3d3d3` | Concordant |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#0099bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#0099bb"></span> | RL (← →, mates point away from each other) | `#0099bb` | Abnormal orientation |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#4d9a4d;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#4d9a4d"></span> | LL (→ →, both mates forward strand) | `#4d9a4d` | Abnormal orientation |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#5555bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#5555bb"></span> | RR (← ←, both mates reverse strand) | `#5555bb` | Abnormal orientation |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#6e4b3a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#6e4b3a"></span> | Inter-chromosomal | `#6e4b3a` | Mate maps to a different chromosome; colored distinctly rather than by orientation |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#9b30b0;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#9b30b0"></span> | Split read (inverted) | `#9b30b0` | A paired read's supplementary segment maps opposite-strand to its primary, so the junction is inverted — an inversion or an inverted duplication |

<!-- COLOR_TABLE alignments-pair-orientation END -->

Green LL, navy RR and magenta split reads flag the inverted segment, and the
duplicated copy reads out as elevated coverage and arcs. Those
orientation-colored reads are a minority of an otherwise concordant grey pileup,
so they cluster at the breakpoints.

<Figure caption="An inverted duplication (CPX type INVdup, HGSV_2721) in HG02768 paired-end reads, with the 1KGP ensemble call above and the variant's INFO fields open alongside." src="/img/inverted_duplication.png" />

### Short reads vs long reads

Short paired-end reads can only _infer_ an inversion: because neither mate spans
the breakpoint, the evidence is indirect, a cluster of same-orientation (LL/RR)
or split pairs arcing across the two junctions in an otherwise concordant (grey)
pileup. Long reads span the whole event, so a single read crosses both
breakpoints and splits into forward and reverse-strand alignments. With View as
pairs / link supplementary alignments on, those segments chain onto one row: the
inverted middle paints the reverse-strand color between the forward-strand
segments on either side, and the split junctions are joined by a magenta
inversion arc. The figure below shows this ~1.2 kb inversion in one 1000 Genomes
sample (HG00151) with Oxford Nanopore long reads, the 1KGP ensemble SV call
marking the locus above.

**Group by... → Split read (SA tag)** in the track menu puts the reads carrying
a supplementary alignment in their own section. In that section each read breaks
into three pieces: the middle one aligns in reverse (blue) and the two either
side do not (red), and the magenta arc joins the two breakpoints. The section
below it spans the locus in one piece.

The two sections together are the genotype. A read covers one haplotype, so a
locus where some reads invert and the rest run through unbroken is one inverted
copy and one that is not — a heterozygous inversion, read off the pileup rather
than taken from the caller's `GT`.

<Figure caption="The reads grouped by Group by... → Split read (SA tag): HGSV_10047 (chr1:197,787,660-197,788,855) in HG00151 Oxford Nanopore long reads, with the 1KGP ensemble VCF call above. Split reads are the upper section, each breaking into three pieces with the middle one aligned in reverse (blue); the reads below cross the same span in one piece — a heterozygous inversion." src="/img/inversion_long_read.png" />

### Insert size color scheme

In the pileup, set the color scheme to Insert size from the track menu. Reads
are colored red (insert larger than expected), pink (smaller than expected), or
light grey (normal). A separate Insert size (gradient) option shades reads
continuously by the magnitude of the deviation. Reads with a mate on a different
chromosome are handled separately (see the table below).

With read arcs or the read cloud enabled (via Read connections in the track
menu), the Insert size option uses threshold-based coloring:

<!-- COLOR_TABLE alignments-insert-size START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#6e4b3a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#6e4b3a"></span> | Mate on a different chromosome | `#6e4b3a` | Suggests an inter-chromosomal event |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff0000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff0000"></span> | Insert larger than expected | `#ff0000` | Suggests a deletion spanning the pair |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff3a8c;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff3a8c"></span> | Insert smaller than expected | `#ff3a8c` | Suggests an insertion between the pair |

<!-- COLOR_TABLE alignments-insert-size END -->

The "expected" range is a robust band around the typical insert size,
`median ± 3·1.4826·MAD`, rather than `mean ± 3σ`. The long right tail of large
inserts (deletions, SVs) inflates the standard deviation, pushing a `mean − 3σ`
lower bound below zero so short inserts are never flagged; the median and MAD
ignore that tail, keeping the short-insert (pink) threshold meaningful.

Insert size and orientation combines both signals and is often the most
informative setting for a general SV scan. The two signals are prioritized so
that the strongest cue wins:

- Short insert always paints pink, even if the pair orientation is abnormal. At
  a short insert the useful signal is simply "an insertion is here", so
  distinguishing orientation adds little and pink takes priority.
- Otherwise an abnormal pair orientation wins (teal RL → tandem duplication;
  green LL / dark blue RR → inversion).
- A large insert with normal orientation paints red, the classic deletion
  signature.

## SV-type signatures

The patterns below describe what each SV type typically looks like in the
alignments track. Combine several signals (clipping, orientation, coverage,
arcs) before calling an SV rather than relying on any one. IGV's
[paired-end alignment guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)
is a useful companion reference.

### Deletion

- Soft-clipped reads at two nearby positions mark the breakpoint edges
- A coverage drop between those positions is a classic deletion signal;
  heterozygous deletions typically show only a ~50% reduction rather than a
  complete drop
- Paired reads flanking the gap colored red (larger insert than expected)
  suggest a deletion spanning the pair
- With read arcs enabled, unusually long arcs point to a deletion

<Figure caption="A 27 bp heterozygous deletion (orange variant bar labeled '27bp DEL' in the top track) in HG002 ONT reads. The SNP coverage panel above the pileup shows the local depth; the pileup is grouped by HP tag into stacked sections, separating haplotype 1 (pink) and haplotype 2 (blue). Supporting reads carrying the deletion are concentrated in one haplotype group." src="/img/smalldel.png" />

### Insertion

- Soft-clipped reads at a single site suggest an insertion; with Show soft
  clipping enabled, the inserted bases become visible on each side
- When the insertion is large enough that pairs flank it, those pairs colored
  pink (smaller insert on reference) suggest an insertion between them
- For insertions larger than the sequenced fragment size, mates may become
  unmapped; long reads are needed to fully span the event
- A purple insertion indicator triangle suggests an insertion when enough reads
  carry one at that position (see
  [insertion and clipping indicators](/docs/user_guides/alignments_track#insertion-and-clipping-indicators)
  for the depth-dependent threshold and for the same event across nanopore,
  PacBio, and Illumina reads)

### Inversion

- LL (green) and RR (dark blue) read pairs at a boundary suggest an inversion:
  normally LR-oriented reads become same-direction across the junction
- If you're zoomed into the inverted region itself, interior reads may look
  concordant
- Soft-clipped reads appear at both breakpoints, sometimes with short homology
  sequences visible in the clipped bases

The green LL / dark blue RR signature appears in the inverted-duplication figure
in the [pair orientation section](#pair-orientation-color-scheme) above.

### Tandem duplication

- RL (teal) read pairs suggest a tandem duplication: reads appear to point away
  from each other when the duplicated segment is joined back to its origin
- Elevated coverage over the duplicated region is another supporting signal
- With read arcs enabled, arcs pointing backward (upstream) across a junction
  point to a tandem duplication

The teal RL signature also appears in the inverted-duplication figure in the
[pair orientation section](#pair-orientation-color-scheme) above.

### Translocation / inter-chromosomal fusion

- Under the pair orientation and insert size schemes, reads with mates on a
  different chromosome take the brown inter-chromosomal color in the pileup and
  on their arcs alike, rather than being classified by orientation
- A cluster of such reads at a locus marks one end of a translocation; open the
  [breakpoint split view](#breakpoint-split-view) from the feature details to
  see both ends at once

## Read arcs

[Read arcs](/docs/user_guides/alignments_track#read-arcs) draw bezier curves
between the ends of paired or split reads. For SVs, unusually long arcs relative
to their neighbors point to a deletion spanning the pair, and inter-chromosomal
connections (drawn as vertical lines at the view edge) flag translocations. Set
the color scheme to insert size, orientation, or combined coloring from the
track menu.

<Figure caption="Read arcs over a deletion in the 1000 Genomes Kinh-Vietnamese trio (child, mother, father; Illumina reads), with the 1KGP ensemble SV call on top. The red arcs are pairs spanning the deleted region (drawn red for a larger-than-expected insert size), lining up with the called breakpoints across all three samples." src="/img/multi-sv-trio.png" />

With View as pairs on, each mate pair collapses onto a single row joined by its
own bezier curve, colored here by pair orientation. The abnormal
same-orientation pairs of an inverted duplication then read as a coherent bundle
of curves rather than scattered singleton pileup rows.

A read can look concordant (light-grey LR fill) yet still carry a colored
connector: the read itself crosses the breakpoint, splitting into a primary and
a strand-flipped supplementary alignment, and the arc joining them takes the
split-read inversion color rather than the RR-pair blue. That is independent
evidence for the inversion, from one read rather than a pair. Hover any
connector for its classification.

## Read cloud

[Read cloud](/docs/user_guides/alignments_track#read-cloud) stratifies reads by
the log-scaled distance between mates, making it easy to count how many reads
span a breakpoint and read their orientation at a glance. Chains with
supplementary alignments are connected by an orange line.

The Edit filters option in the track menu lets you show or hide proper pairs and
singletons. The color scheme provides insert size, orientation, or combined
coloring.

## Inspecting individual reads

Right-click any read for **Linear read vs ref** and **Dotplot of read vs ref**,
which lay one read out against every locus it touches. Both are most useful on a
long read spanning a breakpoint, where the order the read visits those loci in
is the structure of the rearrangement. See
[one read against the reference](/docs/user_guides/alignments_track#one-read-against-the-reference).

## Reconstructing a derivative allele

A split read is an ordered, oriented list of reference intervals, which is what
a derivative allele is. The alignments track menu's **Launch view → Reconstruct
derivative allele...** groups the reads in the window by the route their split
alignments describe and lists each route with the number of reads that
independently take it. **Draw as** picks which view it opens in: a **linear
synteny view** puts the allele along the bottom and the loci it visits along the
top, a **breakpoint split view** stacks those loci in the order the reads cross
them. Either goes into the launching view's place or into a new view below it.

It reads SA tags, so the far side of a junction does not have to be on screen.
It needs reads long enough to carry more than one junction, which in practice
means long reads: a route whose segments are each about one read long is an
aligner splitting a short read across the genome rather than an allele, and the
strip and segment sizes beside each row are what separate the two.

A read count ranks the routes; it does not vouch for them. Reads mismapped into
a repeat produce a confident-looking route, so the output is a proposal to check
against the reads rather than a call. [](/docs/tutorials/cancer_sv) works
through both shapes it produces, a two-segment fold-back and a four-segment
allele across three chromosomes.

## Breakpoint split view

The breakpoint split view opens two synchronized panels side-by-side, each
centered on one breakpoint locus. Splines connect supporting reads across both
panels, and the variant call is drawn as a colored line with feet indicating
directionality.

<Figure caption="Breakpoint split view for an interchromosomal translocation. The two panels are each centered on one breakpoint locus. Black splines connect supporting reads that span the junction (each spline represents a single read seen in both panels). The green line with arrowheads ('feet') is the variant call drawn across both panels to indicate directionality." src="/img/breakpoint_split_view.png" />

The header bar accepts location searches directly in either panel.

### Launching the breakpoint split view

- From the SV inspector - click a feature in the circular overview or the
  triangle dropdown on any table row. See the
  [SV inspector guide](/docs/user_guides/sv_inspector_view).
- From variant feature details - click a BND or TRA variant in a variant track;
  the feature details panel has a button to open the split view, automatically
  loading any open alignment tracks.
- From alignment feature details - click any read with a supplementary
  alignment; the feature details panel includes an option to open the split view
  centered on that read and its supplementary partner.
- From the circular genome view - click a chord's feature details and use the
  "Open breakpoints in split view" link in its Breakends section.

<Figure caption="Feature details panel for a TRA variant. The Breakends section lists each endpoint (e.g. '17:74,803,924') with its own 'Open in linear view' link, and below them a single 'Open breakpoints in split view' link; clicking that opens both breakpoint loci simultaneously in the breakpoint split view, with any open alignment tracks pre-loaded." src="/img/link_to_split_view.png" />

The view also supports multi-hop events where a single read has multiple
supplementary alignments, connecting more than two breakpoints simultaneously.

### Following a chain of breakends

A BND record names one partner, so the record a launch starts from is two loci
however many the rearrangement has. Launching from a variant track's own
right-click menu offers **Follow further breakends at each end**, which reaches
the rest from the callset: at each end of the chain it looks for another
junction leaving from within a kilobase of the same place, and takes it when
there is exactly one, adding a panel per hop up to four.

It is reading two junctions that leave one locus as one molecule, which is not
something the caller asserts, so it declines the cases where that would be a
guess. Two open continuations at a locus stop the walk, since the records cannot
say which molecule carries which. A continuation that leads back to a locus
already on screen stops it too, because a closed cycle is a shape the panels
already show in full. Where the reads are the evidence rather than the record
layout, the tool is
[Reconstruct derivative allele](/docs/tutorials/cancer_sv#reconstructing-the-derivative-allele-in-the-browser),
which ranks whole routes by how many molecules independently take each.

The option appears only for a launch that can read the callset, and only for the
stacked shape. Two launches can: a variant track's right-click menu, and a click
on a chord in the SV inspector or a circular view, where the chord was drawn
from that same file.

## Phasing heterozygous SVs

For heterozygous SVs, confirming that supporting reads come from a single
haplotype is strong evidence for the call. If your BAM/CRAM has been haplotagged
(e.g., with WhatsHap or HiPhase), reads carry an `HP` tag identifying the
haplotype; the [phased trio tutorial](/docs/tutorials/analyze_trio) covers
working with phased haplotypes end-to-end.

Sort, color, or [group](/docs/user_guides/alignments_track#grouping-reads) by
the `HP` tag from the track menu. Sorting and coloring cluster each haplotype's
reads together; grouping goes further and gives each haplotype its own pileup
section, which makes a one-sided SV unmistakable. Reads with no `HP` tag collect
in their own section, so unphased support is visible rather than hidden.

## Working with large SVs

Loading a very large region can trigger an error when the window would require
fetching more data than JBrowse allows in a single request. For large or
inter-chromosomal SVs:

- Use a BigWig coverage track (or a
  [multi-quantitative track](/docs/user_guides/multiquantitative_track) for
  tumor vs normal comparison) instead of a full alignments track when surveying
  the region. It loads at any scale and makes copy-number changes immediately
  visible
- Load the SV call set as a variant track for a compact overview of all calls;
  clicking a feature navigates directly to it
- Open the breakpoint split view to inspect the breakpoint loci themselves. Each
  panel shows only a local window around one end of the SV, so the
  inter-breakpoint distance doesn't matter
- Use the SV inspector for whole-genome triage before drilling into individual
  calls

<Figure caption="COLO829 melanoma tumor (red) and matched normal (blue) whole-genome coverage as a multi-quantitative BigWig track. Copy-number changes are visible at chromosome scale without loading any reads." src="/img/cnv.png" />

## Whole-genome assembly comparison

When a de novo assembly of the sample is available (for example, a phased tumor
assembly from PacBio HiFi or ONT data), aligning it back to the reference with a
tool like [minimap2](https://github.com/lh3/minimap2) and loading the resulting
PAF as a [synteny track](/docs/tutorials/synteny_visualization) gives a
chromosome-scale view of rearrangements that read-level displays cannot. Complex
events like chromosomal fusions appear as off-diagonal blocks in the
[dotplot view](/docs/user_guides/dotplot_view), and clicking and dragging over a
region in the dotplot can launch a base-level
[linear synteny view](/docs/user_guides/linear_synteny_view) with the same
alignment.

This is particularly effective on cancer samples, where the derived genome often
differs structurally from the reference in ways that are hard to read off the
alignment track. The [C-GIAB tutorial](/docs/tutorials/sv_visualization_cgiab)
walks through this workflow end-to-end with the HG008 phased tumor assembly.

## Summary

| Display / setting             | How to enable                   | Best for                                           |
| ----------------------------- | ------------------------------- | -------------------------------------------------- |
| Pileup (default)              | Default lower panel             | Base-level detail, individual reads                |
| Color by pair orientation     | Color scheme in track menu      | Abnormal orientation patterns (RL/LL/RR)           |
| Color by insert size          | Color scheme in track menu      | Insert size anomalies (pileup)                     |
| Read arcs                     | Read connections in track menu  | Overview of long-range connections                 |
| Read cloud                    | Read connections in track menu  | Counting discordant pairs, orientation per read    |
| Linear read vs ref            | Right-click on any read         | Complex alignment of a single long read            |
| Reconstruct derivative allele | Launch view in the track menu   | The route several long reads agree on              |
| Breakpoint split view         | Feature details or SV inspector | Side-by-side inspection of both breakpoint loci    |
| Sort/color by HP tag          | Sort/color by tag in track menu | Confirming heterozygous SVs on one haplotype       |
| Dotplot view                  | Launch from the Add menu        | Chromosome-scale rearrangements (de novo assembly) |
| Linear synteny view           | Add menu or dotplot selection   | Base-level alignment between two genomes           |

## Limitations

- Read-level displays require zooming in: the pileup, read arcs, and read cloud
  modes only render when the view is zoomed in enough to load individual reads;
  very large SVs can't be spanned in a single pileup view
- Paired-end evidence is fragment-size limited: for insertions larger than the
  sequenced fragment, paired-end evidence disappears; long reads are required to
  fully resolve the inserted sequence
- Repetitive regions: SVs in segmental duplications or repeats produce noisy,
  ambiguous signals; soft-clipped reads and orientation anomalies are common
  artifacts in these regions
- Short-read orientation coloring assumes `fr` (Illumina) read pairs;
  SOLiD-style orientations are not supported

## See also

- [](/docs/user_guides/alignments_track)
- [SV inspector](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/circular_view)
- [](/docs/user_guides/variant_track)
- [Alignments track configuration](/docs/config_guides/alignments_track)
- [Gallery: structural variant examples](/gallery/#sv)
