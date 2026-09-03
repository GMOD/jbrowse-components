---
title: SV visualization
description: Reading structural variant evidence off the reads
guide_category: Analysis
---

**TL;DR:** Triage structural variant (SV) candidates in the
[SV inspector](/docs/user_guides/sv_inspector_view), then open the
[alignments](/docs/user_guides/alignments_track) at each breakpoint for the
read-level evidence. This page is what those read patterns mean: which color
scheme lifts which pattern out of the pileup, what each SV type looks like in
short and long reads, and which view to open once a breakpoint is found. The
[alignments track guide](/docs/user_guides/alignments_track) covers what each
control does.

End-to-end walkthroughs: [](/docs/tutorials/sv_visualization_cgiab),
[](/docs/tutorials/cancer_sv), [](/docs/tutorials/sv_multisamples). How the SAM
format itself encodes SV evidence, in split alignments, the `SA` tag, pair
orientation, `TLEN` and clipping, is in
[Structural variants and the SAM format](https://cmdcolin.github.io/posts/2022-02-06-sv-sam/).

## Where the evidence is

A structural variant leaves three kinds of mark in an alignments track:

- **Coverage.** A deletion drops it between the breakpoints and a duplication
  raises it. An inversion or a translocation leaves it alone.
- **Clipped reads.** A read crossing a breakpoint ends there, and its overhang
  is soft-clipped. The
  [insertion and clipping indicators](/docs/user_guides/alignments_track#insertion-and-clipping-indicators)
  flag a cluster of them above the coverage row before you zoom to the pileup,
  and [Show soft clipping](/docs/user_guides/alignments_track#soft-clipping)
  draws the clipped bases.
- **Reads whose two halves land apart.** In a paired-end library that is a pair
  with an unexpected insert size or orientation. In a long-read library one read
  spans the breakpoint and splits into a primary and a supplementary alignment,
  joined by the `SA` tag.

<Figure caption="Soft-clipped reads at a breakpoint edge. The cluster of colored bases on the right marks where many reads end at a common position and their overhang is clipped." src="/img/alignments_soft_clipped.png" />

The rest of this page takes the third kind in turn, paired-end reads then long
reads, then the views that show both sides of a breakpoint at once.

## Paired-end reads

### Pair orientation

**Color by → Pair orientation** colors each read by the strands its two mates
aligned to. The colors follow
[IGV's](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)
and assume a standard `fr` (Illumina) library. SOLiD-style orientations are not
supported.

<!-- COLOR_TABLE alignments-pair-orientation START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#d3d3d3;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#d3d3d3"></span> | LR (→ ←) | `#d3d3d3` | Normal proper pair |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#0099bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#0099bb"></span> | RL (← →) | `#0099bb` | Mates point away from each other |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#4d9a4d;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#4d9a4d"></span> | LL (→ →) | `#4d9a4d` | Both mates on the forward strand |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#5555bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#5555bb"></span> | RR (← ←) | `#5555bb` | Both mates on the reverse strand |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#af4d19;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#af4d19"></span> | Inter-chromosomal | `#af4d19` | Mate on another chromosome |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#000000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#000000"></span> | Mate unmapped | `#000000` | Mate aligned nowhere |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#9b30b0;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#9b30b0"></span> | Split read (inverted) | `#9b30b0` | Supplementary segment on the opposite strand to its primary |

<!-- COLOR_TABLE alignments-pair-orientation END -->

Colored this way, an inversion is a green LL bundle and a navy RR bundle
spanning the same stretch, with magenta split reads at the breakpoints, in a
pileup that is otherwise grey.

<Figure caption="An inverted duplication (CPX type INVdup, HGSV_2721) in HG02768 paired-end reads, with the 1KGP ensemble call above and the variant's INFO fields open alongside." src="/img/inverted_duplication.png" />

The two bundles come from pairs that straddle a junction. An inversion turns a
stretch of sequence around, and every read inside it with it, so a pair with one
end inside the segment and one end outside has one end reversed and one not:
both point the same way, forward-forward across the left junction and
reverse-reverse across the right. The end inside the segment also maps to the
mirrored position, which is why each bundle reaches across the segment. A pair
wholly inside the segment, or wholly outside it, maps as an ordinary LR pair.

<figure>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 340" style="max-width:100%;height:auto;display:block" width="900" font-family="system-ui, sans-serif" font-size="13" fill="#333" role="img" aria-label="How an inversion turns normal read pairs into LL and RR pairs on the reference">
<line x1="300" y1="42" x2="300" y2="212" stroke="#bbb" stroke-dasharray="3 3"/>
<text x="300" y="34" text-anchor="middle" fill="#888" font-size="12">junction</text>
<line x1="600" y1="42" x2="600" y2="212" stroke="#bbb" stroke-dasharray="3 3"/>
<text x="600" y="34" text-anchor="middle" fill="#888" font-size="12">junction</text>
<rect x="100" y="90" width="720" height="10" fill="#e4e4e4"/>
<rect x="300" y="88" width="300" height="14" fill="#dfe5f0"/>
<polyline points="344,91 336,95 344,99" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="404,91 396,95 404,99" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="464,91 456,95 464,99" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="524,91 516,95 524,99" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="584,91 576,95 584,99" fill="none" stroke="#7a8aa6" stroke-width="1.5"/>
<rect x="100" y="200" width="720" height="10" fill="#e4e4e4"/>
<rect x="300" y="198" width="300" height="14" fill="#dfe5f0"/>
<polyline points="336,201 344,205 336,209" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="396,201 404,205 396,209" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="456,201 464,205 456,209" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="516,201 524,205 516,209" fill="none" stroke="#7a8aa6" stroke-width="1.5"/><polyline points="576,201 584,205 576,209" fill="none" stroke="#7a8aa6" stroke-width="1.5"/>
<text x="20" y="99" font-weight="600">Sample</text>
<text x="20" y="209" font-weight="600">Reference</text>
<text x="450.0" y="118" text-anchor="middle" fill="#7a8aa6" font-size="12">inverted segment</text>
<polygon points="220,56 253,56 260,64.0 253,72 220,72" fill="#c8c8c8"/>
<polygon points="220,224 253,224 260,232.0 253,240 220,240" fill="#4d9a4d"/>
<polygon points="370,56 337,56 330,64.0 337,72 370,72" fill="#c8c8c8"/>
<polygon points="530,224 563,224 570,232.0 563,240 530,240" fill="#4d9a4d"/>
<path d="M240,56 Q295.0,23.0 350,56" fill="none" stroke="#aaa" stroke-width="1.5"/>
<path d="M240,240 Q395.0,333.0 550,240" fill="none" stroke="#4d9a4d" stroke-width="2"/>
<polygon points="420,56 453,56 460,64.0 453,72 420,72" fill="#c8c8c8"/>
<polygon points="480,224 447,224 440,232.0 447,240 480,240" fill="#c8c8c8"/>
<polygon points="520,56 487,56 480,64.0 487,72 520,72" fill="#c8c8c8"/>
<polygon points="380,224 413,224 420,232.0 413,240 380,240" fill="#c8c8c8"/>
<path d="M440,56 Q470.0,38.0 500,56" fill="none" stroke="#aaa" stroke-width="1.5"/>
<path d="M460,240 Q430.0,258.0 400,240" fill="none" stroke="#c8c8c8" stroke-width="2"/>
<polygon points="530,56 563,56 570,64.0 563,72 530,72" fill="#c8c8c8"/>
<polygon points="370,224 337,224 330,232.0 337,240 370,240" fill="#5555bb"/>
<polygon points="680,56 647,56 640,64.0 647,72 680,72" fill="#c8c8c8"/>
<polygon points="680,224 647,224 640,232.0 647,240 680,240" fill="#5555bb"/>
<path d="M550,56 Q605.0,23.0 660,56" fill="none" stroke="#aaa" stroke-width="1.5"/>
<path d="M350,240 Q505.0,333.0 660,240" fill="none" stroke="#5555bb" stroke-width="2"/>
<path d="M240,102 C240,145.0 240,145.0 240,196" fill="none" stroke="#4d9a4d" stroke-opacity="0.45" stroke-dasharray="4 3"/>
<path d="M350,102 C350,145.0 550,145.0 550,196" fill="none" stroke="#4d9a4d" stroke-opacity="0.45" stroke-dasharray="4 3"/>
<path d="M440,102 C440,145.0 460,145.0 460,196" fill="none" stroke="#c8c8c8" stroke-opacity="0.45" stroke-dasharray="4 3"/>
<path d="M500,102 C500,145.0 400,145.0 400,196" fill="none" stroke="#c8c8c8" stroke-opacity="0.45" stroke-dasharray="4 3"/>
<path d="M550,102 C550,145.0 350,145.0 350,196" fill="none" stroke="#5555bb" stroke-opacity="0.45" stroke-dasharray="4 3"/>
<path d="M660,102 C660,145.0 660,145.0 660,196" fill="none" stroke="#5555bb" stroke-opacity="0.45" stroke-dasharray="4 3"/>
<text x="395" y="300" text-anchor="middle" fill="#4d9a4d" font-weight="600">LL pair</text>
<text x="505" y="300" text-anchor="middle" fill="#5555bb" font-weight="600">RR pair</text>
<text x="430" y="268" text-anchor="middle" fill="#888" font-size="12">LR pair</text>
</svg>
<figcaption>A pair sequenced across a junction of an inverted segment. The end that fell inside the segment maps to the mirrored position on the opposite strand, so the pair lands as LL on the left junction and RR on the right, and the two reach across the same segment. A pair wholly inside the segment maps as an ordinary LR pair.</figcaption>
</figure>

The duplication half of an inverted duplication has no orientation signature.
Where the second copy went is what the call's `INFO.CPX_INTERVALS` names, and no
pair in the pileup states it.

### Insert size

**Color by → Insert size** colors a read by how far apart its mates aligned: red
for larger than expected, pink for smaller, light grey for normal. **Insert size
(gradient)** shades continuously by the size of the deviation instead. Expected
is a robust band around the typical insert.[^mad]

<!-- COLOR_TABLE alignments-insert-size START -->

<!-- prettier-ignore -->
| Color | Name | Value | Description |
| --- | --- | --- | --- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#af4d19;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#af4d19"></span> | Inter-chromosomal | `#af4d19` | Mate on another chromosome |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#ff0000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#ff0000"></span> | Insert larger than expected | `#ff0000` | Deletion between the mates |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#f582c0;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#f582c0"></span> | Insert smaller than expected | `#f582c0` | Insertion between the mates |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#000000;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#000000"></span> | Mate unmapped | `#000000` | Mate aligned nowhere |

<!-- COLOR_TABLE alignments-insert-size END -->

**Insert size and orientation** combines both. A short insert paints pink
whatever its orientation, an abnormal orientation wins over a normal insert, and
a large insert with normal orientation paints red, the classic deletion. It is
usually the most informative single setting for a first scan.

### Read arcs

**Read connections → Show read arcs** draws a bezier between the ends of each
pair, in the color of the scheme in force. Concordant pairs make short local
arcs, so a deletion reads as a bundle of long red arcs standing on the same two
breakpoints, and a mate on another chromosome draws as a vertical line at the
breakpoint. Reads describing the same connection draw as one arc thickened by
how many there are, so the arcs count the support as well as locate it.
[](/docs/tutorials/k562_fusions) counts a fusion's support that way.

<Figure caption="Read arcs over a deletion in the 1000 Genomes Kinh-Vietnamese trio, with the 1KGP ensemble SV call on top. The red arcs are pairs with a larger-than-expected insert size, lining up with the called breakpoints across all three samples." src="/img/multi-sv-trio.png" />

Hover any arc for its classification. A read can have a grey LR fill and still
carry a colored arc: the read itself crosses the breakpoint, splits into a
primary and a strand-flipped supplementary alignment, and the arc joining those
takes the magenta split-read color. That is evidence from one molecule rather
than from a pair.

### SV channels

Every scheme above paints one pileup, so an event's evidence arrives mixed into
the rows around it. **Read connections → SV channels (pairs by orientation)**
takes the same reads apart: each orientation class becomes its own band with its
own coverage curve and its own arcs, the concordant pairs drop out, and the
pileup goes away. Which band fills names the rearrangement, and a band that
stays empty under a call is a call with no read-pair evidence behind it.

<Figure caption="The INVdup call above, arranged as one band per pair orientation in HG02768. The two same-strand bands hold arc bundles standing on the same breakpoints, the normal band carries the ordinary coverage, and the outward-pointing band stays near empty." src="/img/sv_channels.png" />

<figure>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 404" style="max-width:100%;height:auto;display:block" width="900" font-family="system-ui, sans-serif" font-size="13" fill="#333" role="img" aria-label="Which pair-orientation band each SV type fills">
<text x="280.0" y="32" text-anchor="middle" font-weight="600">Deletion</text>
<text x="530.0" y="32" text-anchor="middle" font-weight="600">Tandem duplication</text>
<text x="780.0" y="32" text-anchor="middle" font-weight="600">Inversion</text>
<rect x="144" y="46" width="6" height="78" fill="#d3d3d3"/>
<text x="134" y="83.0" text-anchor="end" font-weight="600">LR</text>
<text x="134" y="101.0" text-anchor="end" fill="#666">→ ←</text>
<rect x="170" y="46" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="184" y="62" width="192" height="5" fill="#e4e4e4"/>
<rect x="252" y="60" width="56" height="9" fill="#666"/>
<path d="M235,70 Q277.0,116.2 319,70" fill="none" stroke="#d3d3d3" stroke-width="1.8"/>
<path d="M238,70 Q280.0,116.2 322,70" fill="none" stroke="#d3d3d3" stroke-width="1.8"/>
<path d="M241,70 Q283.0,116.2 325,70" fill="none" stroke="#d3d3d3" stroke-width="1.8"/>
<rect x="420" y="46" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="434" y="62" width="192" height="5" fill="#e4e4e4"/>
<rect x="502" y="60" width="56" height="9" fill="#666"/>
<rect x="670" y="46" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="684" y="62" width="192" height="5" fill="#e4e4e4"/>
<rect x="752" y="60" width="56" height="9" fill="#666"/>
<rect x="144" y="136" width="6" height="78" fill="#0099bb"/>
<text x="134" y="173.0" text-anchor="end" font-weight="600">RL</text>
<text x="134" y="191.0" text-anchor="end" fill="#666">← →</text>
<rect x="170" y="136" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="184" y="152" width="192" height="5" fill="#e4e4e4"/>
<rect x="252" y="150" width="56" height="9" fill="#666"/>
<rect x="420" y="136" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="434" y="152" width="192" height="5" fill="#e4e4e4"/>
<rect x="502" y="150" width="56" height="9" fill="#666"/>
<path d="M505,160 Q527.0,184.2 549,160" fill="none" stroke="#0099bb" stroke-width="1.8"/>
<path d="M508,160 Q530.0,184.2 552,160" fill="none" stroke="#0099bb" stroke-width="1.8"/>
<path d="M511,160 Q533.0,184.2 555,160" fill="none" stroke="#0099bb" stroke-width="1.8"/>
<rect x="670" y="136" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="684" y="152" width="192" height="5" fill="#e4e4e4"/>
<rect x="752" y="150" width="56" height="9" fill="#666"/>
<rect x="144" y="226" width="6" height="78" fill="#4d9a4d"/>
<text x="134" y="263.0" text-anchor="end" font-weight="600">LL</text>
<text x="134" y="281.0" text-anchor="end" fill="#666">→ →</text>
<rect x="170" y="226" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="184" y="242" width="192" height="5" fill="#e4e4e4"/>
<rect x="252" y="240" width="56" height="9" fill="#666"/>
<rect x="420" y="226" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="434" y="242" width="192" height="5" fill="#e4e4e4"/>
<rect x="502" y="240" width="56" height="9" fill="#666"/>
<rect x="670" y="226" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="684" y="242" width="192" height="5" fill="#e4e4e4"/>
<rect x="752" y="240" width="56" height="9" fill="#666"/>
<path d="M733,250 Q764.0,284.1 795,250" fill="none" stroke="#4d9a4d" stroke-width="1.8"/>
<path d="M736,250 Q767.0,284.1 798,250" fill="none" stroke="#4d9a4d" stroke-width="1.8"/>
<path d="M739,250 Q770.0,284.1 801,250" fill="none" stroke="#4d9a4d" stroke-width="1.8"/>
<rect x="144" y="316" width="6" height="78" fill="#5555bb"/>
<text x="134" y="353.0" text-anchor="end" font-weight="600">RR</text>
<text x="134" y="371.0" text-anchor="end" fill="#666">← ←</text>
<rect x="170" y="316" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="184" y="332" width="192" height="5" fill="#e4e4e4"/>
<rect x="252" y="330" width="56" height="9" fill="#666"/>
<rect x="420" y="316" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="434" y="332" width="192" height="5" fill="#e4e4e4"/>
<rect x="502" y="330" width="56" height="9" fill="#666"/>
<rect x="670" y="316" width="220" height="78" fill="#fff" stroke="#e2e2e2"/>
<rect x="684" y="332" width="192" height="5" fill="#e4e4e4"/>
<rect x="752" y="330" width="56" height="9" fill="#666"/>
<path d="M759,340 Q790.0,374.1 821,340" fill="none" stroke="#5555bb" stroke-width="1.8"/>
<path d="M762,340 Q793.0,374.1 824,340" fill="none" stroke="#5555bb" stroke-width="1.8"/>
<path d="M765,340 Q796.0,374.1 827,340" fill="none" stroke="#5555bb" stroke-width="1.8"/>
</svg>
<figcaption>Which band each SV type fills. A deletion is ordinary-facing pairs that are too far apart, a tandem duplication lights the outward-pointing band, and an inversion lights the two same-strand bands, each holding one junction.</figcaption>
</figure>

Clicking the row again restores the pileup, with the color scheme untouched.
[](/docs/tutorials/sv_multisamples) reads a complex 1000 Genomes call band by
band.

### Read cloud

[Read cloud](/docs/user_guides/alignments_track#read-cloud) lays pairs out on
the Y axis by the log distance between mates, so the insertion pairs lift clear
of the background and how many reads span a breakpoint is countable. Chains with
supplementary alignments are joined by an orange line, and **Edit filters**
shows or hides proper pairs and singletons.

<Figure caption="Read cloud on a synthetic SV dataset, colored by insert size. Reads are stratified by log distance between mates, lifting the insertion pairs (pink) clear of the background." src="/img/alignments/read_cloud.png" />

## Long reads

### Split reads

A long read spans the whole event, so it carries what a short-read pair could
only infer. At an inversion it splits into three alignments, the middle one on
the opposite strand. With **View as pairs / link supplementary alignments** on,
those segments chain onto one row: the inverted middle paints in the
reverse-strand color between two forward-strand segments, and a magenta arc
joins the two breakpoints.

**Group by → Split read (SA tag)** puts the reads carrying a supplementary
alignment in their own section. The two sections together are the genotype: a
locus where some reads invert and the rest run through unbroken is one inverted
copy and one uninverted, read off the pileup rather than from the caller's `GT`.

<Figure caption="Reads grouped by Group by... → Split read (SA tag) over HGSV_10047 in HG00151 nanopore reads, with the 1KGP ensemble VCF call above. The split reads in the upper section break into three pieces with the middle one reversed; the reads below cross the same span in one piece." src="/img/inversion_long_read.png" />

### One read against the reference

Right-click any read for **Linear read vs ref** or **Dotplot of read vs ref**,
which lay one read out against every locus it touches. On a read spanning a
breakpoint, the order it visits those loci in is the structure of the
rearrangement. See
[one read against the reference](/docs/user_guides/alignments_track#one-read-against-the-reference).

<Figure caption="'Linear read vs ref' for a SKBR3 PacBio read spanning several insertions, the ordinary pileup above and the read drawn against the reference below. Each gap in the diagonal is sequence the read carries and the reference does not." src="/img/read_vs_ref_insertion.png" />

### Reconstructing a derivative allele

Where several long reads cross the same junctions in the same order, **Launch →
Reconstruct derivative allele...** groups them by route and draws the allele the
chosen route describes. What it needs, how to judge its list and how far its
recall reaches are in [](/docs/user_guides/derivative_allele).

## Signatures by SV type

| SV type            | Read pairs                                 | Coverage                                                 | Clipping and arcs                                                                                               |
| ------------------ | ------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Deletion           | red, insert larger than expected           | drops between the breakpoints, halves for a heterozygote | clipped reads at both edges, unusually long arcs                                                                |
| Insertion          | pink, insert smaller than expected         | unchanged                                                | clipped reads at one site, a purple insertion indicator, mates unmapped once the insertion outruns the fragment |
| Inversion          | green LL and dark blue RR at the junctions | unchanged                                                | clipped reads at both breakpoints, magenta split-read arcs                                                      |
| Tandem duplication | teal RL                                    | elevated over the duplicated segment                     | arcs pointing back upstream across the junction                                                                 |
| Translocation      | rust, mate on another chromosome           | unchanged                                                | a cluster of rust reads at one end, arcs drawn as verticals at the view edge                                    |

Any one column has artifacts that produce it, and in segmental duplications and
repeats all of them are common, so combine several before calling. Zoomed inside
an inverted segment the interior reads look concordant, so the junctions are
where to look. The clipped bases at an inversion breakpoint often carry the
short homology the junction formed on. For a translocation, open the
[breakpoint split view](#breakpoint-split-view) to see both ends at once.

## Breakpoint split view

The breakpoint split view opens synchronized panels side by side, each centered
on one breakpoint locus. Splines connect the reads that span the junction across
the panels, and the variant call is drawn as a colored line with feet indicating
directionality. The header bar accepts location searches in either panel.

<Figure caption="Breakpoint split view for an interchromosomal translocation, each panel centered on one breakpoint locus. Black splines connect supporting reads that span the junction, and the green line with feet is the variant call drawn across both panels to show directionality." src="/img/breakpoint_split_view.png" />

Hovering a spline shades the reads it joins, every segment of the read in every
panel it visits, and every other spline of the same read thickens alongside it.
Untick **Show... → Allow clicking alignment squiggles** to turn the overlay back
into a static picture.

### Launching it

- **From the SV inspector**: click a feature in the circular overview, or the
  triangle dropdown on a table row. See the
  [SV inspector guide](/docs/user_guides/sv_inspector_view).
- **From variant feature details**: click a BND or TRA variant in a variant
  track. The feature details panel has a button to open the split view, which
  loads any open alignments tracks.
- **From alignment feature details**: click a read with a supplementary
  alignment, for a split view centered on that read and its supplementary
  partner.
- **From the circular genome view**: click a chord and use the "Open breakpoints
  in split view" link in its Breakends section.

<Figure caption="Feature details panel for a TRA variant. The Breakends section lists each endpoint with its own 'Open in linear view' link, and below them a single 'Open breakpoints in split view' link that opens both loci at once." src="/img/link_to_split_view.png" />

### Multi-hop events

A read with several supplementary alignments visits more than two loci, and the
view grows a panel per locus. [](/docs/tutorials/cancer_sv) follows one such
chain across three chromosomes.

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

The walk treats two junctions leaving one locus as one molecule, which the
caller does not assert, so it stops where that would be a guess: two open
continuations at a locus, or a continuation leading back to a locus already on
screen. To work from the reads themselves instead, use
[Reconstruct derivative allele](/docs/user_guides/derivative_allele), which
ranks whole routes by how many molecules independently take each.

## Phasing heterozygous SVs

For a heterozygous SV, the supporting reads all coming from one haplotype is
strong evidence for the call. Where the BAM/CRAM has been haplotagged (WhatsHap,
HiPhase), reads carry an `HP` tag, and sorting, coloring or
[grouping](/docs/user_guides/alignments_track#grouping-reads) by it from the
track menu clusters each haplotype. Grouping goes furthest, giving each
haplotype its own pileup section with untagged reads collected in their own, so
unphased support stays visible. The
[phased trio tutorial](/docs/tutorials/analyze_trio) covers phased haplotypes
end to end.

<Figure caption="A heterozygous deletion in HG002 ONT reads, with the SNP coverage panel above the pileup. The pileup is grouped by HP tag into stacked sections, and the reads carrying the deletion are concentrated in one haplotype group." src="/img/smalldel.png" />

## Working with large SVs

The pileup, read arcs and read cloud only render once the view is zoomed in far
enough to load the reads, and a very large SV cannot be spanned in one pileup.
For large or inter-chromosomal SVs:

- Survey the region with a BigWig coverage track, or a
  [multi-quantitative track](/docs/user_guides/multiquantitative_track) for
  tumor vs normal. It loads at any scale and makes copy-number changes visible
  at chromosome scale.
- Load the call set as a variant track for a compact overview, where clicking a
  feature navigates to it.
- Open the breakpoint split view for the breakpoint loci themselves. Each panel
  is a local window around one end, so the distance between them does not
  matter.
- Use the SV inspector for whole-genome triage before drilling in.

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
| Color by pair orientation     | Color by in track menu          | Abnormal orientation patterns (RL/LL/RR)           |
| Color by insert size          | Color by in track menu          | Insert size anomalies (pileup)                     |
| Read arcs                     | Read connections in track menu  | Overview of long-range connections                 |
| SV channels                   | Read connections in track menu  | One band per orientation class, with arcs          |
| Read cloud                    | Read connections in track menu  | Counting discordant pairs, orientation per read    |
| Linear read vs ref            | Right-click on any read         | Complex alignment of a single long read            |
| Reconstruct derivative allele | Launch in the track menu        | The route several long reads agree on              |
| Breakpoint split view         | Feature details or SV inspector | Side-by-side inspection of both breakpoint loci    |
| Group by HP tag               | Group by in track menu          | Confirming heterozygous SVs on one haplotype       |
| Dotplot view                  | Launch from the Add menu        | Chromosome-scale rearrangements (de novo assembly) |
| Linear synteny view           | Add menu or dotplot selection   | Base-level alignment between two genomes           |

## See also

- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/derivative_allele)
- [SV inspector](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/circular_view)
- [](/docs/user_guides/variant_track)
- [Alignments track configuration](/docs/config_guides/alignments_track)
- [Gallery: structural variant examples](/gallery/#sv)

[^mad]:
    The band is `median ± 3·1.4826·MAD` rather than `mean ± 3σ`, because the
    long right tail of large inserts inflates the standard deviation and pushes
    a `mean − 3σ` lower bound below zero, where no short insert is ever flagged.
