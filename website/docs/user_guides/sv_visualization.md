---
title: SV visualization
description: Interpreting SV signals across display types
guide_category: Analysis
---

**TL;DR:** Triage structural variant (SV) candidates in the
[SV inspector](/docs/user_guides/sv_inspector_view), a combined table and
whole-genome circular overview over a
[variant track](/docs/user_guides/variant_track)'s calls, then drill into the
[alignments](/docs/user_guides/alignments_track) (BAM/CRAM) at each breakpoint
for the read-level evidence. This page is about what those read patterns mean,
and the [alignments track guide](/docs/user_guides/alignments_track) covers what
each control does.

End-to-end walkthroughs: [](/docs/tutorials/sv_visualization_cgiab),
[](/docs/tutorials/cancer_sv), [](/docs/tutorials/sv_multisamples). For how
split (supplementary) alignments, the `SA` tag, pair orientation, `TLEN` and
clipping encode SV evidence in the SAM format itself, see
[Structural variants and the SAM format](https://cmdcolin.github.io/posts/2022-02-06-sv-sam/).

## SV signals in the alignments track

Most of the evidence is in a standard alignments track already.
[Soft clipping](/docs/user_guides/alignments_track#soft-clipping) marks a
breakpoint edge, where a cluster of reads terminates and their overhanging bases
are clipped, and the
[insertion and clipping indicators](/docs/user_guides/alignments_track#insertion-and-clipping-indicators)
flag those clusters above the coverage row before you zoom into the pileup.
Coloring by pair orientation or by insert size then lifts the abnormal pairs out
of the concordant ones. What each SV type makes of those signals is
[below](#sv-type-signatures).

<Figure caption="Soft-clipped reads at a breakpoint edge (right side, ~position 2,700). The dense cluster of colored bases marks where many reads terminate at a common breakpoint." src="/img/alignments_soft_clipped.png" />

### Pair orientation color scheme

Set the color scheme to Pair orientation from the track menu. JBrowse uses the
same colors as IGV (see the
[IGV paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)),
and assumes standard `fr` (Illumina) read pairs. SOLiD-style orientations are
not supported.

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

An inversion turns a stretch of sequence around, and every read inside it turns
around too. A pair with one end inside and one end outside therefore has one end
reversed and one not, so both point the same way: forward-forward across the
left junction, reverse-reverse across the right one. Each of those pairs also
has an end carried to the far side of the segment, so a green LL bundle and a
navy RR bundle span the same stretch.

<Figure caption="Only a pair straddling a junction has an end that moved without its mate; one wholly inside the inverted segment, or wholly outside it, is unremarkable. The bottom row flips the segment back, and the tie lines follow each read to where it lands: the two inside the segment trade places and turn around." src="/img/inversion_pair_orientation.png" />

In an inverted duplication call, green LL, navy RR and magenta split reads are
all the inversion, the last being one read split into alignments that point in
opposite directions. They are a minority of an otherwise concordant grey pileup,
so they cluster at the breakpoints. The duplication carries no orientation
signature at all: where the second copy went is what the call's
`INFO.CPX_INTERVALS` names, and no read in the pileup states it.

<Figure caption="An inverted duplication (CPX type INVdup, HGSV_2721) in HG02768 paired-end reads, with the 1KGP ensemble call above and the variant's INFO fields open alongside." src="/img/inverted_duplication.png" />

### Inversions in long reads

Short paired-end reads _infer_ an inversion, because neither mate spans a
breakpoint. A long read spans the whole event and splits into forward and
reverse-strand alignments. With View as pairs / link supplementary alignments
on, those segments chain onto one row: the inverted middle paints the
reverse-strand color between the forward-strand segments either side, and a
magenta arc joins the two breakpoints.

**Group by... → Split read (SA tag)** puts the reads carrying a supplementary
alignment in their own section, where each breaks into three pieces with the
middle one reversed. The section below spans the locus in one piece. The two
sections together are the genotype: a locus where some reads invert and the rest
run through unbroken is one inverted copy and one uninverted, read off the
pileup rather than from the caller's `GT`.

<Figure caption="Reads grouped by Group by... → Split read (SA tag) over HGSV_10047 in HG00151 nanopore reads, with the 1KGP ensemble VCF call above. The split reads in the upper section break into three pieces with the middle one reversed; the reads below cross the same span in one piece." src="/img/inversion_long_read.png" />

### Insert size color scheme

Set the color scheme to Insert size from the track menu. Reads are colored red
(insert larger than expected), pink (smaller than expected), or light grey
(normal), and a separate Insert size (gradient) option shades continuously by
the magnitude of the deviation. With read arcs or the read cloud enabled, the
Insert size option uses threshold-based coloring:

<!-- COLOR_TABLE alignments-insert-size START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#af4d19;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#af4d19"></span> | Mate on a different chromosome | `#af4d19` | Suggests an inter-chromosomal event |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff0000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff0000"></span> | Insert larger than expected | `#ff0000` | Suggests a deletion spanning the pair |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#f582c0;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#f582c0"></span> | Insert smaller than expected | `#f582c0` | Suggests an insertion between the pair |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#000000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#000000"></span> | Mate unmapped | `#000000` | The other end of the pair aligned nowhere, so insert size says nothing |

<!-- COLOR_TABLE alignments-insert-size END -->

The expected range is a robust band around the typical insert size.[^mad]

Insert size and orientation combines both signals and is often the most
informative setting for a general SV scan. A short insert always paints pink,
even where the orientation is abnormal, then an abnormal orientation wins (teal
RL for a tandem duplication, green LL or dark blue RR for an inversion), and a
large insert with normal orientation paints red for the classic deletion.

### SV channels

Every scheme above paints one pileup, so an event's evidence arrives mixed into
the rows around it. **Track menu → Read connections → SV channels (pairs by
orientation)** takes the same reads apart: each orientation class becomes its
own band with its own coverage curve and its own arcs, the concordant pairs drop
out of the arcs, and the pileup goes away. The bands are the rows of the
orientation table above, and the [signatures below](#sv-type-signatures) are the
key to reading them.

<Figure caption="The same variant, in the same place, through each band. Which band fills is what names the rearrangement, and a band that stays empty under a call is a call with no read-pair evidence behind it." src="/img/sv_channels_bands.png" />

<Figure caption="The INVdup call above, arranged as one band per pair orientation in HG02768. The two same-strand bands hold arc bundles standing on the same breakpoints, the normal band carries the ordinary coverage, and the outward-pointing band stays near empty." src="/img/sv_channels.png" />

Clicking the row again restores an ordinary pileup, with the color scheme
untouched in both directions. [](/docs/tutorials/sv_multisamples) reads a
complex 1000 Genomes call band by band.

## SV-type signatures

Each SV type leaves a characteristic combination of the signals above. One row
alone has artifacts that produce it, so combine several before calling an SV.

| SV type            | Read pairs                                 | Coverage                                                 | Clipping and arcs                                                                                               |
| ------------------ | ------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Deletion           | red, insert larger than expected           | drops between the breakpoints, halves for a heterozygote | clipped reads at both edges, unusually long arcs                                                                |
| Insertion          | pink, insert smaller than expected         | unchanged                                                | clipped reads at one site, a purple insertion indicator, mates unmapped once the insertion outruns the fragment |
| Inversion          | green LL and dark blue RR at the junctions | unchanged                                                | clipped reads at both breakpoints, magenta split-read arcs                                                      |
| Tandem duplication | teal RL                                    | elevated over the duplicated segment                     | arcs pointing back upstream across the junction                                                                 |
| Translocation      | rust, mate on another chromosome           | unchanged                                                | a cluster of rust reads at one end, arcs drawn as verticals at the view edge                                    |

Zoomed inside an inverted segment the interior reads look concordant, so the
junctions are where to look. Turning on Show soft clipping makes an insertion's
bases readable on each side of the site, and the clipped bases at an inversion
breakpoint often carry the short homology the junction formed on. For a
translocation, open the [breakpoint split view](#breakpoint-split-view) from the
feature details to see both ends at once.

<Figure caption="A 27 bp heterozygous deletion in HG002 ONT reads, with the SNP coverage panel above the pileup. The pileup is grouped by HP tag into stacked sections, and the reads carrying the deletion are concentrated in one haplotype group." src="/img/smalldel.png" />

## Read arcs

[Read arcs](/docs/user_guides/alignments_track#read-arcs) draw bezier curves
between the ends of paired or split reads. Unusually long arcs relative to their
neighbors point to a deletion spanning the pair, and inter-chromosomal
connections (drawn as vertical lines at the view edge) flag translocations. With
View as pairs on, each mate pair collapses onto a single row joined by its own
curve, so the abnormal same-orientation pairs of an inverted duplication read as
a coherent bundle.

<Figure caption="Read arcs over a deletion in the 1000 Genomes Kinh-Vietnamese trio, with the 1KGP ensemble SV call on top. The red arcs are pairs with a larger-than-expected insert size, lining up with the called breakpoints across all three samples." src="/img/multi-sv-trio.png" />

A read can look concordant (light-grey LR fill) yet still carry a colored
connector: the read itself crosses the breakpoint, splitting into a primary and
a strand-flipped supplementary alignment, and the arc joining them takes the
split-read inversion color rather than the RR-pair blue. That is evidence from
one read rather than a pair. Hover any connector for its classification.

Arcs also count. Near-identical curves stack into one line, so a curve per
molecule cannot say how many molecules agree, while the arc band draws each
junction once and thickens it by the reads behind it.
[](/docs/tutorials/k562_fusions) counts a fusion's support that way.

## Read cloud

[Read cloud](/docs/user_guides/alignments_track#read-cloud) stratifies reads by
the log-scaled distance between mates, so how many reads span a breakpoint and
which way they point are both countable at a glance. Chains with supplementary
alignments are connected by an orange line, and Edit filters in the track menu
shows or hides proper pairs and singletons.

<Figure caption="Read cloud on a synthetic SV dataset, colored by insert size. Reads are stratified by log distance between mates, lifting the insertion pairs (pink) clear of the background." src="/img/alignments/read_cloud.png" />

## Inspecting individual reads

Right-click any read for **Linear read vs ref** and **Dotplot of read vs ref**,
which lay one read out against every locus it touches. Both are most useful on a
long read spanning a breakpoint, where the order the read visits those loci in
is the structure of the rearrangement. See
[one read against the reference](/docs/user_guides/alignments_track#one-read-against-the-reference).

<Figure caption="'Linear read vs ref' for a SKBR3 PacBio read spanning several insertions, the ordinary pileup above and the read drawn against the reference below. Each gap in the diagonal is sequence the read carries and the reference does not." src="/img/read_vs_ref_insertion.png" />

## Reconstructing a derivative allele

A split read is an ordered, oriented list of reference intervals, which is what
a derivative allele is. The alignments track menu's **Launch → Reconstruct
derivative allele...** groups the reads in the window by the route their split
alignments describe and lists each route with the number of reads that
independently take it. **Draw as** picks which view it opens in: a linear
synteny view puts the allele along the bottom and the loci it visits along the
top, a breakpoint split view stacks those loci in the order the reads cross
them. Either goes into the launching view's place or into a new view below it.

<Figure caption="Top: the reconstruction dialog over the COLO829 tumor pileup it was computed from, each route's segments drawn to scale under its read count. Bottom: the linear synteny view the top route opens, hg38 above and the reconstructed allele below, one ribbon per segment." src="/img/cancer_sv/derivative_autogenerated.png" />

[](/docs/tutorials/cancer_sv) works through both shapes it produces, a
two-segment fold-back and a four-segment allele across three chromosomes.
[](/docs/tutorials/sv_visualization_cgiab) runs it over a tumor/normal HiFi pair
and checks the route it ranks first against a published benchmark.

### What the reconstruction needs

- **Long reads, from an aligner that emits SA tags** - minimap2 and ngmlr both
  do. A short-read library ranks each junction on its own and produces no
  multi-junction route, because no read reaches from one junction to the next.
  The picker measures the reads on screen, so it prints the median aligned
  length it found rather than sending you to a wider window.
- **An event above about 10 kb, or interchromosomal.** Below that an aligner
  usually writes the event inside one read's CIGAR rather than as a split
  alignment, which nothing reading SA tags can reach, and the pileup's own
  deletion marks are where those show. Where the cliff falls is as much the
  aligner's doing as the browser's.
- **Two reads that agree.** A route reaches the list once at least two of them
  cross the same junctions in the same order and orientation. The floor is what
  keeps a repetitive window from filling the list, not a judgement that a single
  split read is mismapped.
- **The reads actually loaded.** A window over the track's byte budget renders
  as `force load` with nothing behind it, and the dialog says so rather than
  reporting that no route is supported. Narrow the window.
- **Every locus you want ranked on screen.** A read anchored in the window
  brings its whole SA chain, so the far side of a junction needs no panel of its
  own, but reads sitting only at that far locus contribute nothing until it is
  shown.

The same entry on a synteny track reads contigs rather than reads, since a de
novo assembly aligned to the reference is the same object at a larger scale.
There one contig is enough to list a route, and every locus has to be on screen,
because an alignment block names nothing the view has not fetched.

### Judging what it lists

A read count ranks the routes, it does not vouch for them. Reads mismapped into
a repeat produce a confident-looking route, so the output is a proposal to check
against the reads rather than a call.

- **The matched normal is the strongest check.** A route on its own says a locus
  has split reads, not that it has an event, and normals do propose routes at
  windows with nothing somatic in them.
- **Look at the top two rows.** Where a published junction is recovered it is
  the first or second row in both validation callsets. A route further down the
  list is unlikely to be the one you came for.
- **Read the segment sizes.** A route whose segments are each about one read
  long is an aligner splitting a short read across the genome rather than an
  allele, and the segment strip drawn to scale beside each row is what separates
  the two.
- **A row marked "part of a longer route in this list"** crosses a run of
  another row's junctions and stops, so it is consistent with the longer route
  rather than a rival to it.
- **Dozens of routes means a repetitive window**, not a complicated allele. The
  picker says how many it left off the list.

### Recall by event size

Recall follows event size, because the reconstruction reads split alignments and
an aligner represents a short deletion inside one read's CIGAR instead. Below,
COLO829 against its ONT calls
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)) and
HG008-T against the C-GIAB draft benchmark
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)), scored at
every junction rather than at chosen loci:

| Event size       | COLO829, ONT | HG008-T, PacBio HiFi |
| ---------------- | ------------ | -------------------- |
| < 1 kb           | 1 / 9        | 4 / 40               |
| 1 - 10 kb        | 6 / 10       | 17 / 26              |
| 10 - 100 kb      | 16 / 16      | 17 / 18              |
| > 100 kb         | 17 / 17      | 54 / 54              |
| interchromosomal | 11 / 11      | 14 / 14              |

Where a junction is recovered, its two ends land within a base or two of the
called breakend, and neither matched normal recovers a somatic junction at the
same windows.

Reading a split alignment as an ordered list of reference intervals is what
long-read SV callers extract before they cluster anything
([Sedlazeck et al. 2018](https://doi.org/10.1038/s41592-018-0001-7)), and
ordering those intervals into a derivative chromosome is what long-read
rearrangement pipelines do with them
([Cretu Stancu et al. 2017](https://doi.org/10.1038/s41467-017-01343-4),
[Mitsuhashi et al. 2020](https://doi.org/10.1186/s13073-020-00762-1)). This is
the visualization half of that lineage, in the manner of Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080)): it
groups those chains and counts them, and where two routes disagree it lists both
with their counts rather than choosing.

## Breakpoint split view

The breakpoint split view opens synchronized panels side-by-side, each centered
on one breakpoint locus. Splines connect supporting reads across the panels, and
the variant call is drawn as a colored line with feet indicating directionality.
The header bar accepts location searches in either panel.

<Figure caption="Breakpoint split view for an interchromosomal translocation, each panel centered on one breakpoint locus. Black splines connect supporting reads that span the junction, and the green line with feet is the variant call drawn across both panels to show directionality." src="/img/breakpoint_split_view.png" />

Hovering a spline shades the reads it joins, so a junction names the alignments
that carry it. The shading follows the whole chain, every segment of the read in
every panel it visits, and every other spline of the same read thickens
alongside it. Untick **Show... → Allow clicking alignment squiggles** to turn
the overlay back into a static picture.

### Launching the breakpoint split view

- From the SV inspector - click a feature in the circular overview or the
  triangle dropdown on any table row. See the
  [SV inspector guide](/docs/user_guides/sv_inspector_view).
- From variant feature details - click a BND or TRA variant in a variant track;
  the feature details panel has a button to open the split view, automatically
  loading any open alignment tracks.
- From alignment feature details - click any read with a supplementary
  alignment, for a split view centered on that read and its supplementary
  partner.
- From the circular genome view - click a chord's feature details and use the
  "Open breakpoints in split view" link in its Breakends section.

<Figure caption="Feature details panel for a TRA variant. The Breakends section lists each endpoint with its own 'Open in linear view' link, and below them a single 'Open breakpoints in split view' link that opens both loci at once." src="/img/link_to_split_view.png" />

### Multi-hop events

A read with several supplementary alignments visits more than two loci, and the
view grows a panel per locus rather than stopping at a pair.
[](/docs/tutorials/cancer_sv) follows one such chain across three chromosomes.

<Figure caption="A COLO829 chain through chr3, chr10 and chr12 and back to chr3, one panel per locus with the tumor pileup in each. The splines carry the same molecules from panel to panel, in the order the reads cross the junctions." src="/img/cancer_sv/multihop_split_view.png" />

### Following a chain of breakends

A BND record names one partner, so a launch from one record is two loci however
many the rearrangement has. **Follow further breakends at each end** reaches the
rest from the callset: at each end of the chain it looks for another junction
leaving from within a kilobase of the same place, and takes it when there is
exactly one, adding a panel per hop up to four. It is offered by the two
launches that can read the callset, a variant track's right-click menu and a
click on a chord drawn from that same file, and only for the stacked shape.

<Figure caption="Launching from a COLO829 breakend record: the variant's right-click menu, the dialog with Follow further breakends at each end ticked, and the three panels the walk produces because the chain runs chr3 to chr10 to chr12." src="/img/cancer_sv/split_view_from_breakend.png" />

It reads two junctions leaving one locus as one molecule, which the caller does
not assert, so it stops where that would be a guess. Two open continuations at a
locus stop the walk, since the records cannot say which molecule carries which,
and so does a continuation leading back to a locus already on screen. To work
from the reads themselves instead, use
[Reconstruct derivative allele](#reconstructing-a-derivative-allele), which
ranks whole routes by how many molecules independently take each.

## Phasing heterozygous SVs

For a heterozygous SV, confirming that the supporting reads come from a single
haplotype is strong evidence for the call. Where the BAM/CRAM has been
haplotagged (WhatsHap, HiPhase), reads carry an `HP` tag, and sorting, coloring
or [grouping](/docs/user_guides/alignments_track#grouping-reads) by it from the
track menu clusters each haplotype. Grouping goes furthest, giving each
haplotype its own pileup section, with untagged reads collected in their own so
unphased support stays visible. The
[phased trio tutorial](/docs/tutorials/analyze_trio) covers phased haplotypes
end-to-end.

## Working with large SVs

A window large enough to need more data than a single request allows will fail
to load reads. For large or inter-chromosomal SVs:

- Survey the region with a BigWig coverage track, or a
  [multi-quantitative track](/docs/user_guides/multiquantitative_track) for
  tumor vs normal. It loads at any scale and makes copy-number changes
  immediately visible
- Load the call set as a variant track for a compact overview, where clicking a
  feature navigates to it
- Open the breakpoint split view for the breakpoint loci themselves. Each panel
  is a local window around one end, so the distance between them does not matter
- Use the SV inspector for whole-genome triage before drilling in

<Figure caption="COLO829 melanoma tumor (red) and matched normal (blue) whole-genome coverage as a multi-quantitative BigWig track. Copy-number changes are visible at chromosome scale without loading any reads." src="/img/cnv.png" />

## Whole-genome assembly comparison

Where a de novo assembly of the sample is available, aligning it back to the
reference with [minimap2](https://github.com/lh3/minimap2) and loading the PAF
as a [synteny track](/docs/tutorials/synteny_visualization) gives a
chromosome-scale view of the rearrangements. Complex events appear as
off-diagonal blocks in the [dotplot view](/docs/user_guides/dotplot_view), and
dragging over one launches a base-level
[linear synteny view](/docs/user_guides/linear_synteny_view) on the same
alignment. The [C-GIAB tutorial](/docs/tutorials/sv_visualization_cgiab) walks
this through with the HG008 phased tumor assembly.

## Summary

| Display / setting             | How to enable                   | Best for                                           |
| ----------------------------- | ------------------------------- | -------------------------------------------------- |
| Pileup (default)              | Default lower panel             | Base-level detail, individual reads                |
| Color by pair orientation     | Color scheme in track menu      | Abnormal orientation patterns (RL/LL/RR)           |
| Color by insert size          | Color scheme in track menu      | Insert size anomalies (pileup)                     |
| Read arcs                     | Read connections in track menu  | Overview of long-range connections                 |
| Read cloud                    | Read connections in track menu  | Counting discordant pairs, orientation per read    |
| Linear read vs ref            | Right-click on any read         | Complex alignment of a single long read            |
| Reconstruct derivative allele | Launch in the track menu        | The route several long reads agree on              |
| Breakpoint split view         | Feature details or SV inspector | Side-by-side inspection of both breakpoint loci    |
| Sort/color by HP tag          | Sort/color by tag in track menu | Confirming heterozygous SVs on one haplotype       |
| Dotplot view                  | Launch from the Add menu        | Chromosome-scale rearrangements (de novo assembly) |
| Linear synteny view           | Add menu or dotplot selection   | Base-level alignment between two genomes           |

## Limitations

- Read-level displays need the reads: the pileup, read arcs and read cloud only
  render once the view is zoomed in far enough to load them, and a very large SV
  cannot be spanned in one pileup. Use the routes in
  [working with large SVs](#working-with-large-svs)
- Repetitive regions: in segmental duplications and repeats, soft clips and
  orientation anomalies are common artifacts, so a signature there is weak
  evidence on its own

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
- Nattestad et al. (2021).
  [Ribbon: intuitive visualization for complex genomic variation](https://doi.org/10.1093/bioinformatics/btaa1080)
- Sedlazeck et al. (2018).
  [Accurate detection of complex structural variations using single-molecule sequencing](https://doi.org/10.1038/s41592-018-0001-7)
- Valle-Inclán et al. (2022).
  [A multi-platform reference for somatic structural variation detection](https://doi.org/10.1016/j.xgen.2022.100139)
- Wagner et al. (2026).
  [A complete human pancreatic cancer genome](https://doi.org/10.64898/2026.05.01.722316)

[^mad]:
    The band is `median ± 3·1.4826·MAD` rather than `mean ± 3σ`, because the
    long right tail of large inserts inflates the standard deviation and pushes
    a `mean − 3σ` lower bound below zero, where no short insert is ever flagged.
