---
title: SV visualization
description: Interpreting SV signals across display types
guide_category: Views
---

This guide covers how to interpret structural variant (SV) signals across
JBrowse's views. A typical workflow starts in the
[SV inspector](/docs/user_guides/sv_inspector_view) (a combined variant table
and whole-genome circular overview) to triage candidates, then drills into the
alignments at each breakpoint to examine read-level evidence.

SV calls load as [variant tracks](/docs/user_guides/variant_track) (VCF), reads
as [alignments tracks](/docs/user_guides/alignments_track) (BAM/CRAM). The
[alignments track guide](/docs/user_guides/alignments_track) covers the general
features; this page focuses on what to look for when interpreting SVs.

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

The standard alignments track gives you several SV-relevant signals without any
extra steps:

- Soft clipping - reads that extend past a breakpoint have their overhanging
  bases soft-clipped; enabling Show soft clipping from the track menu makes
  these bases visible at breakpoint edges

<Figure caption="Soft-clipped reads at a breakpoint edge (right side, ~position 2,700). The dense cluster of colored bases marks where many reads terminate at a common breakpoint." src="/img/alignments_soft_clipped.png" />

- Insertion/clipping indicators - a purple triangle marks positions where a
  depth-dependent fraction of reads (roughly 30% at high coverage) carry an
  insertion; blue/red triangles mark clipping; larger purple rectangles appear
  for insertions >10 bp

<Figure caption="Clipping and insertion indicators visible as colored vertical marks above the coverage track. The tall vertical colored lines (blue = soft clip, red = hard clip, purple = insertion) flag positions where many reads carry an SV signal, even without zooming into the pileup." src="/img/alignment_clipping_indicators.png" />

- Color by pair orientation - abnormally oriented pairs produce characteristic
  colors described in the table below
- Color by insert size - pairs with unexpectedly large or small inserts are
  highlighted

For descriptions of these features in general use, see the
[alignments track guide](/docs/user_guides/alignments_track).

### Pair orientation color scheme

JBrowse uses the same color scheme as IGV. See the
[IGV paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)
for background. Set the color scheme to Pair orientation from the track menu.
Orientation coloring assumes standard `fr` (Illumina) read pairs; SOLiD-style
pair orientations are not supported. The table below assumes `fr`:

<!-- COLOR_TABLE alignments-pair-orientation START -->

| Color                                                                                                                                                                       | Name                                       | Value     | Description                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#d3d3d3;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#d3d3d3"></span> | LR (→ ←, normal proper pair)               | `#d3d3d3` | Concordant                                                                                                          |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#0099bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#0099bb"></span> | RL (← →, mates point away from each other) | `#0099bb` | Abnormal orientation                                                                                                |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#4d9a4d;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#4d9a4d"></span> | LL (→ →, both mates forward strand)        | `#4d9a4d` | Abnormal orientation                                                                                                |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#5555bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#5555bb"></span> | RR (← ←, both mates reverse strand)        | `#5555bb` | Abnormal orientation                                                                                                |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#6e4b3a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#6e4b3a"></span> | Inter-chromosomal                          | `#6e4b3a` | Mate maps to a different chromosome; colored distinctly rather than by orientation                                  |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#9b30b0;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#9b30b0"></span> | Split-read inversion                       | `#9b30b0` | A paired read's supplementary segment maps opposite-strand to its primary — the split crosses an inversion junction |

<!-- COLOR_TABLE alignments-pair-orientation END -->

<Figure caption="An inverted duplication (CPX type INVdup, HGSV_2721) shown twice: a compact overview (top frame) and the same locus at normal feature height (bottom frame). Teal RL reads (mates pointing away) flag the tandem duplication; green LL and dark blue RR same-direction reads flag the inversion. These orientation-colored reads are a minority of an otherwise concordant grey pileup, so they cluster at the breakpoints." src="/img/inverted_duplication.png" />

#### Short reads vs. long reads

Short paired-end reads can only _infer_ an inversion: because neither mate spans
the breakpoint, the evidence is indirect, a cluster of same-orientation (LL/RR)
or split pairs arcing across the two junctions in an otherwise concordant (grey)
pileup. Long reads span the whole event, so a single read crosses both
breakpoints and splits into forward and reverse-strand alignments. With View as
pairs / link supplementary alignments on, those segments chain onto one row: the
inverted middle paints the reverse-strand color between forward-strand flanks,
and the split junctions are joined by a magenta inversion arc. The figure below
shows this ~1.2 kb inversion in one 1000 Genomes sample (HG00151) with Oxford
Nanopore long reads, the 1KGP ensemble SV call marking the locus above.

<Figure caption="The same inversion (HGSV_10047, chr1:197,787,660-197,788,855) in HG00151 Oxford Nanopore long reads, supplementary alignments linked. Each read's reverse-strand middle (blue) paints between its forward-strand flanks (red), and the magenta split-read arc joins the two breakpoints — both directly read out the inversion. The 1KGP ensemble VCF call marks the locus above." src="/img/inversion_long_read.png" />

### Insert size color scheme

In the pileup, set the color scheme to Insert size from the track menu. Reads
are colored red (insert larger than expected), pink (smaller than expected), or
light grey (normal). A separate Insert size (gradient) option shades reads
continuously by the magnitude of the deviation. Reads with a mate on a different
chromosome are handled separately (see the table below).

With paired arcs or linked reads enabled (via Read connections in the track
menu), the Insert size option uses threshold-based coloring:

<!-- COLOR_TABLE alignments-insert-size START -->

| Color                                                                                                                                                                       | Name                           | Value     | Description                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------- | -------------------------------------- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#6e4b3a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#6e4b3a"></span> | Mate on a different chromosome | `#6e4b3a` | Suggests an inter-chromosomal event    |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff0000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff0000"></span> | Insert larger than expected    | `#ff0000` | Suggests a deletion spanning the pair  |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ffc0cb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ffc0cb"></span> | Insert smaller than expected   | `#ffc0cb` | Suggests an insertion between the pair |

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
alignments track; combine several signals (clipping, orientation, coverage,
arcs) before calling an SV rather than relying on any one. The
[DRAGEN SV IGV tutorial](https://help.dragen.illumina.com/product-guides/dragen-v4.5/dragen-dna-pipeline/sv-calling/sv-igv-tutorial)
is a useful companion reference.

### Deletion

- Soft-clipped reads at two nearby positions mark the breakpoint edges
- A coverage drop between those positions is a classic deletion signal;
  heterozygous deletions typically show only a ~50% reduction rather than a
  complete drop
- Paired reads flanking the gap colored red (larger insert than expected)
  suggest a deletion spanning the pair
- With paired arcs enabled, unusually long arcs point to a deletion

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
  [SV signals in the alignments track](#sv-signals-in-the-alignments-track) for
  the depth-dependent threshold)

<Figure caption="An insertion (nssv15767046 INS, labeled in the variant track at top) visible as a dense column of purple insertion rectangles at ~position 55,705,920 in nanopore (top track), PacBio (middle track), and Illumina (bottom track) reads. Long reads show tall purple bars spanning the inserted bases; Illumina reads show only soft-clip artifacts at the same site because the insert exceeds the fragment size." src="/img/insertion.png" />

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
- With paired arcs enabled, arcs pointing backward (upstream) across a junction
  point to a tandem duplication

The teal RL signature also appears in the inverted-duplication figure in the
[pair orientation section](#pair-orientation-color-scheme) above.

### Translocation / inter-chromosomal fusion

- With paired arcs or linked reads enabled, reads with mates on a different
  chromosome are colored purple; in the pileup they appear dark grey
- A cluster of such reads at a locus marks one end of a translocation; open the
  [breakpoint split view](#breakpoint-split-view) from the feature details to
  see both ends at once

## Paired arcs

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

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-fDL8SrEPoO&password=6rsxL)

- HG002 deletion with Nanopore and Illumina reads in arc mode

A read can look concordant (light-grey LR fill) yet still carry a dark-blue
connector. That happens when the read itself crosses the inversion breakpoint:
it splits into a primary and a strand-flipped supplementary alignment, and the
arc joining them is colored for the inversion, the same dark blue as an RR pair.
This is a second, independent line of evidence for the inversion, from a single
split read rather than a pair. Hover any connector to read its classification
(for example, _Split-read inversion_ versus _RR, both mates reverse strand_).

## Linked reads

[Read cloud](/docs/user_guides/alignments_track#read-cloud) stratifies reads by
the log-scaled distance between mates, making it easy to count how many reads
span a breakpoint and read their orientation at a glance. Chains with
supplementary alignments are connected by an orange line.

<Figure caption="Linked reads on an SV dataset: reads are drawn as horizontal lines stratified on the Y axis by the log distance between mates. The bar on the bottom row marks an abnormally large insert, flagging the structural-variant event." src="/img/alignments/read_cloud.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-ofjI26CNas&password=ohqlR)

- inversion example in linked reads mode

The Edit filters option in the track menu lets you show or hide proper pairs and
singletons. The color scheme provides insert size, orientation, or combined
coloring.

## Inspecting individual reads

Right-clicking any read opens a context menu with two single-read inspection
options:

- Linear read vs ref - opens a synteny-style split view showing how that read
  aligns to the reference, with the read sequence on one panel and the reference
  on the other
- Dotplot of read vs ref - opens a dotplot of the read against the reference,
  which can reveal complex rearrangements as diagonal segments

Both are most useful on long reads where a single read spans a breakpoint.

<Figure caption="'Linear read vs ref' for a SKBR3 PacBio read spanning several insertions relative to the reference. The top panel is a standard pileup; the bottom panel is a synteny-style split view showing the read (top lane) aligned to the reference (bottom lane). Each gap in the diagonal alignment blocks in the lower panel marks inserted sequence not present in the reference. Click-and-drag over any region in the lower panel to extract its sequence." src="/img/read_vs_ref_insertion.png" />

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
  "Open in breakpoint split view" link in its Breakends section.

<Figure caption="Feature details panel for a TRA variant. The Breakends section has a 'Launch split view' list where each row pairs the two breakend endpoints (e.g. '14:84871468 // 17:74803924') with an 'Open in breakpoint split view' link; clicking it opens both breakpoint loci simultaneously in the breakpoint split view, with any open alignment tracks pre-loaded." src="/img/link_to_split_view.png" />

The view also supports multi-hop events where a single read has multiple
supplementary alignments, connecting more than two breakpoints simultaneously.

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fbreakpoint%2Fconfig.json&session=share-xeUuLRakik&password=vh0ca)

- multi-hop split read connection in breakpoint split view

## Phasing heterozygous SVs

For heterozygous SVs, confirming that supporting reads come from a single
haplotype is strong evidence for the call. If your BAM/CRAM has been haplotagged
(e.g., with WhatsHap or HiPhase), reads carry an `HP` tag identifying the
haplotype; the [phased trio tutorial](/docs/tutorials/analyze_trio) covers
working with phased haplotypes end-to-end.

Sort and color by the `HP` tag from the track menu. Reads from each haplotype
cluster together, making it easy to see whether an SV is present on one or both
haplotypes.

<Figure caption="Reads colored and sorted by haplotype. Coloring by the HP tag gives one color per haplotype, and sorting by the HP tag stacks each haplotype's reads into contiguous rows, making it easy to see which haplotype carries the variant." src="/img/alignments/haplotype.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE)

- heterozygous small deletion in GIAB colored and sorted by HP tag

Grouping by the `HP` tag from the track menu will split the track into separate
sub-tracks per haplotype for an even clearer visual separation. Note that group
by spawns new track instances dynamically, so sort and color is generally faster
for initial exploration.

See the [alignments track guide](/docs/user_guides/alignments_track) for more on
sorting, coloring, and filtering by tag.

## Working with large SVs

Loading a very large genomic region can trigger an error when the window would
require fetching more data than JBrowse allows in a single request. For large or
inter-chromosomal SVs, a better approach is:

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

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64)

- COLO829 tumor vs normal whole-genome coverage

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

| Display / setting         | How to enable                   | Best for                                           |
| ------------------------- | ------------------------------- | -------------------------------------------------- |
| Pileup (default)          | Default lower panel             | Base-level detail, individual reads                |
| Color by pair orientation | Color scheme in track menu      | Abnormal orientation patterns (RL/LL/RR)           |
| Color by insert size      | Color scheme in track menu      | Insert size anomalies (pileup)                     |
| Paired arcs               | Read connections in track menu  | Overview of long-range connections                 |
| Linked reads              | Read connections in track menu  | Counting discordant pairs, orientation per read    |
| Linear read vs ref        | Right-click on any read         | Complex alignment of a single long read            |
| Breakpoint split view     | Feature details or SV inspector | Side-by-side inspection of both breakpoint loci    |
| Sort/color by HP tag      | Sort/color by tag in track menu | Confirming heterozygous SVs on one haplotype       |
| Dotplot view              | Launch from the Add menu        | Chromosome-scale rearrangements (de novo assembly) |
| Linear synteny view       | Add menu or dotplot selection   | Base-level alignment between two genomes           |

## Limitations

- Read-level displays require zooming in: the pileup, paired arcs, and linked
  reads modes only render when the view is zoomed in enough to load individual
  reads; very large SVs can't be spanned in a single pileup view
- Paired-end evidence is fragment-size limited: for insertions larger than the
  sequenced fragment, paired-end evidence disappears; long reads are required to
  fully resolve the inserted sequence
- Repetitive regions: SVs in segmental duplications or repeats produce noisy,
  ambiguous signals; soft-clipped reads and orientation anomalies are common
  artifacts in these regions
- Short-read orientation coloring assumes `fr` (Illumina) read pairs;
  SOLiD-style orientations are not supported

## See also

- [Alignments track](/docs/user_guides/alignments_track) - sorting, coloring,
  grouping, and filtering reads in general use
- [SV inspector](/docs/user_guides/sv_inspector_view) - whole-genome SV triage
- [Circular genome view](/docs/user_guides/circular_view) - plot a single SV
  track as chords and launch the breakpoint split view from one
- [Variant track](/docs/user_guides/variant_track) - VCF display and the
  per-sample genotype table
- [Alignments track configuration](/docs/config_guides/alignments_track) -
  config-file options for color and filter defaults
- [Gallery: structural variant examples](/gallery/#sv) - live breakpoint split
  views, read-vs-reference insertions, and inversions to open and explore
