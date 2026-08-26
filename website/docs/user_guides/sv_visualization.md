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
[alignments tracks](/docs/user_guides/alignments_track) (BAM/CRAM). The
[alignments track guide](/docs/user_guides/alignments_track) covers their
general features.

For the read-level signals behind these displays (how split (supplementary)
alignments, the `SA` tag, pair orientation, `TLEN`, and clipping encode SV
evidence in the SAM format), see
[Structural variants and the SAM format](https://cmdcolin.github.io/posts/2022-02-06-sv-sam/).

For end-to-end walkthroughs, see
[Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab) (HG008
tumor/normal PacBio HiFi + C-GIAB SV/CNV calls) and
[Structural variants (1000 Genomes)](/docs/tutorials/sv_multisamples) (a
whole-gene deletion across the cohort, then a call its coverage is silent
about).

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
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#af4d19;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#af4d19"></span> | Inter-chromosomal | `#af4d19` | Mate maps to a different chromosome; colored distinctly rather than by orientation |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#000000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#000000"></span> | Mate unmapped | `#000000` | The other end of the pair aligned nowhere, so orientation and insert size say nothing |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#9b30b0;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#9b30b0"></span> | Split paired-end read (inverted) | `#9b30b0` | A paired read's supplementary segment maps opposite-strand to its primary, so the junction is inverted — an inversion or an inverted duplication |

<!-- COLOR_TABLE alignments-pair-orientation END -->

An inversion turns a stretch of sequence around, and every read that was inside
it turns around too. A pair with one end inside and one end outside therefore
has one end reversed and one not, so both point the same way — forward-forward
where the pair crosses the left junction, reverse-reverse where it crosses the
right one.

Each of those pairs also has one end carried to the far side of the segment, so
the two span most of it and overlap each other. A green LL pair and a navy RR
pair drawn across the same stretch is the pattern to look for.

<Figure caption="Only a pair straddling a junction has an end that moved without its mate; one wholly inside the inverted segment, or wholly outside it, is unremarkable. The bottom row flips the segment back, and the tie lines follow each read to where it lands: the two inside the segment trade places and turn around." src="/img/inversion_pair_orientation.png" />

The two halves of an INVdup call read out of two different things. Green LL,
navy RR and magenta split reads are the inversion — the third is one read split
into alignments that point in opposite directions, which is the same event seen
within a single molecule. They are a minority of an otherwise concordant grey
pileup, so they cluster at the breakpoints. The duplication carries no
orientation signature at all: where the second copy went is the segment the call
names in `INFO.CPX_INTERVALS`, and no read in the pileup states it.

<Figure caption="An inverted duplication (CPX type INVdup, HGSV_2721) in HG02768 paired-end reads, with the 1KGP ensemble call above and the variant's INFO fields open alongside." src="/img/inverted_duplication.png" />

### Inversions in long reads

Short paired-end reads _infer_ an inversion: neither mate spans the breakpoint,
so the evidence is a cluster of same-orientation (LL/RR) or split pairs arcing
across the two junctions in an otherwise concordant (grey) pileup. Long reads
span the whole event, so a single read crosses both breakpoints and splits into
forward and reverse-strand alignments. With View as pairs / link supplementary
alignments on, those segments chain onto one row: the inverted middle paints the
reverse-strand color between the forward-strand segments on either side, and the
split alignments are joined by a magenta inversion arc.

**Group by... → Split read (SA tag)** in the track menu puts the reads carrying
a supplementary alignment in their own section. In that section each read breaks
into three pieces: the middle one aligns in reverse (blue) and the two either
side align forward (red), and the magenta arc joins the two breakpoints. The
section below it spans the locus in one piece.

The two sections together are the genotype. A read covers one haplotype, so a
locus where some reads invert and the rest run through unbroken is one inverted
copy and one uninverted — a heterozygous inversion read off the pileup rather
than from the caller's `GT`.

<Figure caption="Reads grouped by Group by... → Split read (SA tag) over HGSV_10047 in HG00151 nanopore reads, with the 1KGP ensemble VCF call above. The split reads in the upper section break into three pieces with the middle one reversed; the reads below cross the same span in one piece." src="/img/inversion_long_read.png" />

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
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#af4d19;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#af4d19"></span> | Mate on a different chromosome | `#af4d19` | Suggests an inter-chromosomal event |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff0000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff0000"></span> | Insert larger than expected | `#ff0000` | Suggests a deletion spanning the pair |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#f582c0;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#f582c0"></span> | Insert smaller than expected | `#f582c0` | Suggests an insertion between the pair |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#000000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#000000"></span> | Mate unmapped | `#000000` | The other end of the pair aligned nowhere, so insert size says nothing |

<!-- COLOR_TABLE alignments-insert-size END -->

The "expected" range is a robust band around the typical insert size,
`median ± 3·1.4826·MAD` rather than `mean ± 3σ`: the long right tail of large
inserts (deletions, SVs) inflates the standard deviation, pushing a `mean − 3σ`
lower bound below zero so short inserts are never flagged.

Insert size and orientation combines both signals and is often the most
informative setting for a general SV scan. The two signals are prioritized so
that the strongest cue wins:

- Short insert always paints pink, even if the pair orientation is abnormal: at
  a short insert the signal is that an insertion is here.
- Otherwise an abnormal pair orientation wins (teal RL → tandem duplication;
  green LL / dark blue RR → inversion).
- A large insert with normal orientation paints red, the classic deletion
  signature.

### SV channels

Every scheme above paints one pileup, so an event's evidence arrives mixed into
the rows around it: a minority of abnormally oriented pairs among concordant
grey, their arcs crossing everything else's. **Track menu → Read connections →
SV channels (pairs by orientation)** takes the same reads apart. Each
orientation class becomes its own band with its own coverage curve and its own
arcs, the concordant pairs drop out of the arcs, and the pileup goes away.

The bands are the rows of the orientation table above, and the
[signatures below](#sv-type-signatures) are the key to reading them. An
inversion lights the two same-strand bands on the same pair of breakpoints. A
tandem duplication lights the outward-pointing band. A band that stays empty
under a call is a call with no read-pair evidence behind it, which is as much of
a finding as a band that fills.

<Figure caption="The INVdup call above, arranged as one band per pair orientation in HG02768. The two same-strand bands hold arc bundles standing on the same breakpoints, the normal band carries the ordinary coverage, and the outward-pointing band stays near empty." src="/img/sv_channels.png" />

Clicking the row again restores an ordinary pileup. The color scheme is
untouched in both directions, so a track colored by modifications or insert size
still is on the way back out.

## SV-type signatures

The patterns below describe what each SV type typically looks like in the
alignments track. Combine several signals (clipping, orientation, coverage,
arcs) before calling an SV. IGV's
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

<Figure caption="A 27 bp heterozygous deletion in HG002 ONT reads, with the SNP coverage panel above the pileup. The pileup is grouped by HP tag into stacked sections, and the reads carrying the deletion are concentrated in one haplotype group." src="/img/smalldel.png" />

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
  different chromosome take the rust inter-chromosomal color in the pileup and
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

<Figure caption="Read arcs over a deletion in the 1000 Genomes Kinh-Vietnamese trio, with the 1KGP ensemble SV call on top. The red arcs are pairs with a larger-than-expected insert size, lining up with the called breakpoints across all three samples." src="/img/multi-sv-trio.png" />

With View as pairs on, each mate pair collapses onto a single row joined by its
own bezier curve, colored here by pair orientation. The abnormal
same-orientation pairs of an inverted duplication then read as a coherent bundle
of curves.

A read can look concordant (light-grey LR fill) yet still carry a colored
connector: the read itself crosses the breakpoint, splitting into a primary and
a strand-flipped supplementary alignment, and the arc joining them takes the
split-read inversion color rather than the RR-pair blue. That is evidence from
one read rather than a pair. Hover any connector for its classification.

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
independently take it. **Draw as** picks which view it opens in:

- **linear synteny view** puts the allele along the bottom and the loci it
  visits along the top
- **breakpoint split view** stacks those loci in the order the reads cross them

Either goes into the launching view's place or into a new view below it.

### What the reconstruction needs

Reconstruction reads split alignments and counts them, so what it recovers
follows from what the aligner wrote and how many molecules crossed the event.
The figures below come from scoring it at every junction two published somatic
callsets report — COLO829 on ONT and C-GIAB's HG008-T on PacBio HiFi, 215
junctions between them
([SV_MULTIHOP.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SV_MULTIHOP.md)
carries the run and the rest of its numbers).

- **Long reads, from an aligner that emits SA tags** — minimap2 and ngmlr both
  do. A 100 bp Illumina library over the same breakpoints ranks each junction on
  its own and produces no multi-junction route, because no read reaches from one
  junction to the next.
- **An event above about 10 kb, or interchromosomal.** Across those two
  callsets, 129 of the 130 junctions above 10 kb or between chromosomes are
  recovered; between 1 and 10 kb it is 60% and 65%; below 1 kb, 11% and 10%. The
  cliff is a representation, not a limit on the event: 50 of the 58 misses are
  events the aligner wrote as a deletion inside one read's CIGAR rather than as
  a split alignment, which nothing reading SA tags can reach, and the pileup's
  own deletion marks are where those show. Where the cliff falls is as much the
  aligner's doing as the browser's, so another aligner puts it somewhere else.
- **Two reads that agree.** A route reaches the list once at least two of them
  cross the same junctions in the same order and orientation. Listing one-read
  routes as well buys three points of recall and twelve times as many routes at
  loci with no event, which is what the floor is there for — it is not a
  judgement that a single split read is mismapped.
- **The reads actually loaded.** A window over the track's byte budget renders
  as `force load` with nothing behind it; the dialog says so rather than
  reporting that no route is supported. Narrow the window.
- **Every locus you want ranked on screen.** A read anchored in the window
  brings its whole SA chain, so the far side of a junction needs no panel of its
  own. Reads sitting only at that far locus contribute nothing until it is
  shown: over one of the HG008-T demo slices the picker offers a single route,
  and over both it offers seven.

The same entry on a synteny track reads contigs rather than reads — a de novo
assembly aligned to the reference is the same object at a larger scale — and
there one contig is enough to list a route, while every locus has to be on
screen, since an alignment block names nothing the view has not fetched.

### Judging what it lists

A read count ranks the routes; it does not vouch for them. Reads mismapped into
a repeat produce a confident-looking route, so the output is a proposal to check
against the reads rather than a call.

- **The matched normal is the strongest check.** At the same windows, the normal
  recovers none of the somatic junctions in either callset. It does propose
  routes elsewhere — at 40% of COLO829's control windows and 4% of HG008-T's —
  so a route on its own says a locus has split reads, not that it has an event.
- **Look at the top two rows.** Where a published junction is recovered, it
  ranks first in 48 of 51 (COLO829) and 96 of 106 (HG008-T), and first or second
  in every single case. A route further down the list is unlikely to be the one
  you came for.
- **Read the segment sizes.** A route whose segments are each about one read
  long is an aligner splitting a short read across the genome rather than an
  allele; the segment strip drawn to scale beside each row, and the sizes under
  it, are what separate the two.
- **A row marked "part of a longer route in this list"** crosses a run of
  another row's junctions and stops. It is consistent with the longer route
  rather than a rival to it.
- **Dozens of routes means a repetitive window**, not a complicated allele. The
  picker says how many it left off the list for that reason.

[](/docs/tutorials/cancer_sv) works through both shapes it produces, a
two-segment fold-back and a four-segment allele across three chromosomes.

### Where split-read reconstruction comes from

Reading a split alignment as an ordered list of reference intervals is the
signature long-read SV callers extract before they cluster anything
([Sedlazeck et al. 2018](https://doi.org/10.1038/s41592-018-0001-7)), and
ordering and orienting those intervals into a derivative chromosome is what
long-read rearrangement pipelines do with them
([Cretu Stancu et al. 2017](https://doi.org/10.1038/s41467-017-01343-4),
[Mitsuhashi et al. 2020](https://doi.org/10.1186/s13073-020-00762-1)). Callers
that work from junctions instead reach the same object by chaining breakends
under copy-number constraints, which is LINX
([Shale et al. 2022](https://doi.org/10.1016/j.xgen.2022.100112)).

The browser does the visualization half of that lineage. Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080)) draws
one read's split alignment against every locus it touches; this groups those
chains and counts them. It does not genotype, filter or emit a call, and where
two routes disagree it lists both with their counts rather than choosing.

### Validation datasets

Each row below is a regression fixture holding every read in that window that
takes part in a multi-segment chain, verbatim from the published file, so what
the fixture asserts is what the picker shows.

| Records                       | Chemistry       | What the fixture pins                                                                                                   |
| ----------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| COLO829 tumor, chr3           | ONT             | The der(3) allele as one four-segment route at 28 reads, and beside it at 2 reads the route that skips its chr12 insert |
| COLO829BL normal, same window | ONT             | No route, which is what makes the tumor's somatic                                                                       |
| COLO829 tumor, chr9           | ONT             | A fold-back, kept apart from a second allele whose junction sits 28 bp away                                             |
| COLO829 tumor, hg19           | Illumina 100 bp | The three published junctions ranked top, and no path: no read reaches from one junction to the next                    |
| HG008-T                       | PacBio HiFi     | A chromoplexy breakend as the top route at 65 reads, its two ends on the breakends the benchmark publishes              |
| HG008-N, same window          | PacBio HiFi     | No split reads at all                                                                                                   |
| 1000 Genomes HG02030          | Illumina 150 bp | Confidently ranked routes at a germline locus with no event, separable from a real allele by segment span               |
| K562                          | PacBio Iso-Seq  | One row per splice acceptor from a single DNA breakpoint, which is why this is documented for genomic reads             |

The COLO829 junctions are those of the multi-platform truth set
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)); the
HG008-T ones are the C-GIAB draft benchmark's, whose T2T tumor assembly puts
both loci on one contig with the orientation flip the reads describe
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

### Recall by event size

Recall depends on event size, because the reconstruction reads split alignments
and an aligner represents a short deletion inside one read's CIGAR instead of
splitting it. Below, COLO829 against its ONT calls and HG008-T against the
C-GIAB benchmark, run over every junction rather than at chosen loci:

| Event size       | COLO829, ONT | HG008-T, PacBio HiFi |
| ---------------- | ------------ | -------------------- |
| < 1 kb           | 1 / 9        | 4 / 40               |
| 1 - 10 kb        | 6 / 10       | 17 / 26              |
| 10 - 100 kb      | 16 / 16      | 17 / 18              |
| > 100 kb         | 17 / 17      | 54 / 54              |
| interchromosomal | 11 / 11      | 14 / 14              |

Where the junction is recovered it is the first or second route listed in every
case in both datasets, and its two ends land a median of 1 to 2 bp from the
called breakend. No somatic junction is recovered at the same windows in each
matched normal.

So the tool is for events large enough that the aligner splits the read across
them, which is what the segment sizes beside each row let you check. Routes do
appear at loci with no event.

## Breakpoint split view

The breakpoint split view opens two synchronized panels side-by-side, each
centered on one breakpoint locus. Splines connect supporting reads across both
panels, and the variant call is drawn as a colored line with feet indicating
directionality.

<Figure caption="Breakpoint split view for an interchromosomal translocation, each panel centered on one breakpoint locus. Black splines connect supporting reads that span the junction, and the green line with feet is the variant call drawn across both panels to show directionality." src="/img/breakpoint_split_view.png" />

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

<Figure caption="Feature details panel for a TRA variant. The Breakends section lists each endpoint with its own 'Open in linear view' link, and below them a single 'Open breakpoints in split view' link that opens both loci at once." src="/img/link_to_split_view.png" />

The view also supports multi-hop events where a single read has multiple
supplementary alignments, connecting more than two breakpoints simultaneously.

Hovering a spline shades the reads it joins, so a junction names the alignments
that carry it. The shading follows the whole chain — every segment of the read,
in every panel it visits — and every other spline of the same read thickens
alongside it. Untick **Show... → Allow clicking alignment squiggles** to turn
the overlay back into a static picture.

### Following a chain of breakends

A BND record names one partner, so the record a launch starts from is two loci
however many the rearrangement has. Launching from a variant track's own
right-click menu offers **Follow further breakends at each end**, which reaches
the rest from the callset: at each end of the chain it looks for another
junction leaving from within a kilobase of the same place, and takes it when
there is exactly one, adding a panel per hop up to four.

It reads two junctions that leave one locus as one molecule, which the caller
does not assert, so it stops where that would be a guess: two open continuations
at a locus stop the walk, since the records cannot say which molecule carries
which, and so does a continuation leading back to a locus already on screen. To
work from the reads themselves, use
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
in their own section, so unphased support is visible.

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
chromosome-scale view of rearrangements. Complex events like chromosomal fusions
appear as off-diagonal blocks in the
[dotplot view](/docs/user_guides/dotplot_view), and clicking and dragging over a
region in the dotplot can launch a base-level
[linear synteny view](/docs/user_guides/linear_synteny_view) with the same
alignment.

This is particularly effective on cancer samples, whose derived genome often
differs structurally from the reference. The
[C-GIAB tutorial](/docs/tutorials/sv_visualization_cgiab) walks through this
workflow end-to-end with the HG008 phased tumor assembly.

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

## References

- Cretu Stancu et al. (2017).
  [Mapping and phasing of structural variation in patient genomes using nanopore sequencing](https://doi.org/10.1038/s41467-017-01343-4)
- Mitsuhashi et al. (2020).
  [A pipeline for complete characterization of complex germline rearrangements from long DNA reads](https://doi.org/10.1186/s13073-020-00762-1)
- Nattestad et al. (2018).
  [Complex rearrangements and oncogene amplifications revealed by long-read DNA and RNA sequencing of a breast cancer cell line](https://doi.org/10.1101/gr.231100.117)
- Nattestad et al. (2021).
  [Ribbon: intuitive visualization for complex genomic variation](https://doi.org/10.1093/bioinformatics/btaa1080)
- Sedlazeck et al. (2018).
  [Accurate detection of complex structural variations using single-molecule sequencing](https://doi.org/10.1038/s41592-018-0001-7)
- Shale et al. (2022).
  [Unscrambling cancer genomes via integrated analysis of structural variation and copy number](https://doi.org/10.1016/j.xgen.2022.100112)
- Valle-Inclán et al. (2022).
  [A multi-platform reference for somatic structural variation detection](https://doi.org/10.1016/j.xgen.2022.100139)
- Wagner et al. (2026).
  [A complete human pancreatic cancer genome](https://doi.org/10.64898/2026.05.01.722316)
