---
title: Structural variant visualization
description: Interpreting SV signals across display types
guide_category: Views
---

This guide covers how to interpret structural variant (SV) signals across
JBrowse's views. A typical workflow starts in the
[SV inspector](/docs/user_guides/sv_inspector_view) — a combined variant table
and whole-genome circular overview — to triage candidates, then drills into the
alignments at each breakpoint to examine read-level evidence.

SV calls load as [variant tracks](/docs/user_guides/variant_track) (VCF), reads
as [alignments tracks](/docs/user_guides/alignments_track) (BAM/CRAM). The
[alignments track guide](/docs/user_guides/alignments_track) covers the general
features; this page focuses on what to look for when interpreting SVs.

:::info Background

For the read-level signals behind these displays — how split (supplementary)
alignments, the `SA` tag, pair orientation, `TLEN`, and clipping encode SV
evidence in the SAM format — see
[Structural variants and the SAM format](https://cmdcolin.github.io/posts/2022-02-06-sv-sam/).

:::

For end-to-end walkthroughs, see
[Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab) (HG008
tumor/normal PacBio HiFi + C-GIAB SV/CNV calls) and
[Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples)
(population-scale genotypes, trio inheritance, a large inversion).

## SV signals in the alignments track

The standard alignments track gives you several SV-relevant signals without any
extra steps:

- **Soft clipping** — reads that extend past a breakpoint have their overhanging
  bases soft-clipped; enabling Show soft clipping from the track menu makes
  these bases visible at breakpoint edges

<Figure caption="Soft-clipped reads at a breakpoint edge (right side, ~position 2,700). The dense cluster of colored nucleotide bases marks where many reads terminate at a common breakpoint; those colored bases are the overhanging sequence that could not be aligned to the reference." src="/img/alignments_soft_clipped.png" />

- **Insertion/clipping indicators** — a purple triangle marks positions where a
  depth-dependent fraction of reads (roughly 30% at high coverage) carry an
  insertion; blue/red triangles mark clipping; larger purple rectangles appear
  for insertions >10 bp

<Figure caption="Clipping and insertion indicators visible as colored vertical marks above the coverage track. The tall vertical colored lines (blue = soft clip, red = hard clip, purple = insertion) flag positions where many reads carry an SV signal, even without zooming into the pileup." src="/img/alignment_clipping_indicators.png" />

- **Color by pair orientation** — abnormally oriented pairs produce
  characteristic colors described in the table below
- **Color by insert size** — pairs with unexpectedly large or small inserts are
  highlighted

For descriptions of these features in general use, see the
[alignments track guide](/docs/user_guides/alignments_track).

### Pair orientation color scheme

JBrowse uses the same color scheme as IGV — see the
[IGV paired-end alignments guide](https://igv.org/doc/desktop/#UserGuide/tracks/alignments/paired_end_alignments/)
for background. Set the color scheme to Pair orientation from the track menu.
Orientation coloring assumes standard `fr` (Illumina) read pairs; SOLiD-style
pair orientations are not supported. The table below assumes `fr`:

<!-- COLOR_TABLE alignments-pair-orientation START -->

| Color                                                                                                                                                                       | Name                                       | Value     | Description                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------- | ---------------------------------------------------------------------------------- |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#d3d3d3;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#d3d3d3"></span> | LR (→ ←, normal proper pair)               | `#d3d3d3` | Concordant                                                                         |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#0099bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#0099bb"></span> | RL (← →, mates point away from each other) | `#0099bb` | Abnormal orientation                                                               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#4d9a4d;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#4d9a4d"></span> | LL (→ →, both mates forward strand)        | `#4d9a4d` | Abnormal orientation                                                               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#5555bb;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#5555bb"></span> | RR (← ←, both mates reverse strand)        | `#5555bb` | Abnormal orientation                                                               |
| <span style="display:inline-block;width:0.9em;height:0.9em;background-color:#6e4b3a;border:1px solid #8888;border-radius:2px;vertical-align:middle" title="#6e4b3a"></span> | Inter-chromosomal                          | `#6e4b3a` | Mate maps to a different chromosome; colored distinctly rather than by orientation |

<!-- COLOR_TABLE alignments-pair-orientation END -->

<Figure caption="An inverted duplication (CPX type INVdup, HGSV_2721) with two overlapping orientation signals, shown twice: a compact overview (top frame) and the same locus at the normal feature height (bottom frame), where individual read pairs and their orientation colors are easier to follow. Teal reads are RL-oriented (mates pointing away from each other, as if ← →), a signature of tandem duplication. Green LL reads (→→) and dark blue RR reads (←←) point the same direction, a signature of an inversion. The orientation-colored reads are a minority of the pileup — most pairs are concordant LR (light grey) — so they cluster at the breakpoints rather than filling the view." src="/img/inverted_duplication.png" />

### Insert size color scheme

**In the pileup**, set the color scheme to Insert size from the track menu.
Reads are colored red (insert larger than expected), pink (smaller than
expected), or light grey (normal). A separate Insert size (gradient) option
shades reads continuously by the magnitude of the deviation. Reads with a mate
on a different chromosome are handled separately (see the table below).

**With paired arcs or linked reads enabled** (via Read connections in the track
menu), the Insert size ± 3σ option uses threshold-based coloring:

| Pattern                                    | Color  | Notes                                  |
| ------------------------------------------ | ------ | -------------------------------------- |
| Insert > mean + 3σ (larger than expected)  | red    | suggests a deletion spanning the pair  |
| Insert < mean − 3σ (smaller than expected) | pink   | suggests an insertion between the pair |
| Mate on a different chromosome             | purple | suggests an inter-chromosomal event    |

**Insert size ± 3σ and orientation** combines both signals and is often the most
informative setting for a general SV scan.

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
- Paired reads flanking the gap colored **red** (larger insert than expected)
  suggest a deletion spanning the pair
- With paired arcs enabled, unusually long arcs point to a deletion

<Figure caption="A 27 bp heterozygous deletion (orange variant bar labeled '27bp DEL' in the top track) in HG002 ONT reads. The SNP coverage panel above the pileup shows the local depth; the pileup is grouped by HP tag into stacked sections, separating haplotype 1 (pink) and haplotype 2 (blue). Supporting reads carrying the deletion are concentrated in one haplotype group." src="/img/smalldel.png" />

### Insertion

- Soft-clipped reads at a single site suggest an insertion; with Show soft
  clipping enabled, the inserted bases become visible on each side
- When the insertion is large enough that pairs flank it, those pairs colored
  **pink** (smaller insert on reference) suggest an insertion between them
- For insertions larger than the sequenced fragment size, mates may become
  unmapped; long reads are needed to fully span the event
- A purple insertion indicator triangle suggests an insertion when enough reads
  carry one at that position (see
  [SV signals in the alignments track](#sv-signals-in-the-alignments-track) for
  the depth-dependent threshold)

<Figure caption="An insertion (nssv15767046 INS, labeled in the variant track at top) visible as a dense column of purple insertion rectangles at ~position 55,705,920 in nanopore (top track), PacBio (middle track), and Illumina (bottom track) reads. Long reads show tall purple bars spanning the inserted bases; Illumina reads show only soft-clip artifacts at the same site because the insert exceeds the fragment size." src="/img/insertion.png" />

### Inversion

- **LL (green)** and **RR (dark blue)** read pairs at a boundary suggest an
  inversion — normally LR-oriented reads become same-direction across the
  junction
- If you're zoomed into the inverted region itself, interior reads may look
  concordant
- Soft-clipped reads appear at both breakpoints, sometimes with short homology
  sequences visible in the clipped bases

The green LL / dark blue RR signature appears in the inverted-duplication figure
in the [pair orientation section](#pair-orientation-color-scheme) above.

### Tandem duplication

- **RL (teal)** read pairs suggest a tandem duplication: reads appear to point
  away from each other when the duplicated segment is joined back to its origin
- Elevated coverage over the duplicated region is another supporting signal
- With paired arcs enabled, arcs pointing backward (upstream) across a junction
  point to a tandem duplication

The teal RL signature also appears in the inverted-duplication figure in the
[pair orientation section](#pair-orientation-color-scheme) above.

### Translocation / inter-chromosomal fusion

- With paired arcs or linked reads enabled, reads with mates on a different
  chromosome are colored **purple**; in the pileup they appear **dark grey**
- A cluster of such reads at a locus marks one end of a translocation; open the
  [breakpoint split view](#breakpoint-split-view) from the feature details to
  see both ends at once

## Paired arcs

[Paired arcs](/docs/user_guides/alignments_track#paired-arcs) draw bezier curves
between the ends of paired or split reads. For SVs, unusually long arcs relative
to their neighbors point to a deletion spanning the pair, and inter-chromosomal
connections (drawn as vertical lines at the view edge) flag translocations. Set
the color scheme to insert size, orientation, or combined coloring from the
track menu.

<Figure caption="Paired arcs over an HG002 structural variant. Illumina paired-end mates that span the deleted region are drawn as long arcs standing out from the short concordant arcs, and the discordant pairs are colored red for a larger-than-expected insert size — confirming the deletion. The GIAB consensus SV call (top) lines up with the arc signature." src="/img/alignments/arc_display.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-fDL8SrEPoO&password=6rsxL)
— HG002 deletion with Nanopore and Illumina reads in arc mode

## Linked reads

[Linked reads](/docs/user_guides/alignments_track#linked-reads) stratify reads
by the log-scaled distance between mates, making it easy to count how many reads
span a breakpoint and read their orientation at a glance. Chains with
supplementary alignments are connected by an orange line.

<Figure caption="Linked reads on an SV dataset: reads are drawn as horizontal lines stratified on the Y axis by the log distance between mates. The bar on the bottom row marks an abnormally large insert, flagging the structural-variant event." src="/img/alignments/read_cloud.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-ofjI26CNas&password=ohqlR)
— inversion example in linked reads mode

The Edit filters option in the track menu lets you show or hide **proper pairs**
and **singletons**. The color scheme provides insert size, orientation, or
combined coloring.

## Inspecting individual reads

Right-clicking any read opens a context menu with two single-read inspection
options:

- **Linear read vs ref** — opens a synteny-style split view showing how that
  read aligns to the reference, with the read sequence on one panel and the
  reference on the other
- **Dotplot of read vs ref** — opens a dotplot of the read against the
  reference, which can reveal complex rearrangements as diagonal segments

Both are most useful on long reads where a single read spans a breakpoint.

<Figure caption="'Linear read vs ref' for a SKBR3 PacBio read spanning a ~500 bp insertion. The top panel is a standard pileup; the bottom panel is a synteny-style split view showing the read (top lane) aligned to the reference (bottom lane). The gap in the diagonal alignment blocks in the lower panel marks the inserted sequence not present in the reference. Click-and-drag over any region in the lower panel to extract its sequence." src="/img/read_vs_ref_insertion.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-rzJ27iixQH&password=rSgZe)
— SKBR3 PacBio read vs reference insertion

## Breakpoint split view

The breakpoint split view opens two synchronized panels side-by-side, each
centered on one breakpoint locus. Splines connect supporting reads across both
panels, and the variant call is drawn as a colored line with feet indicating
directionality.

<Figure caption="Breakpoint split view for an interchromosomal translocation. The two panels are each centered on one breakpoint locus. Black splines connect supporting reads that span the junction — each spline represents a single read seen in both panels. The green line with arrowheads ('feet') is the variant call drawn across both panels to indicate directionality." src="/img/breakpoint_split_view.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data/config_demo.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22BreakpointSplitView%22%2C%22showIntraviewLinks%22%3Afalse%2C%22views%22%3A%5B%7B%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%221%3A229%2C347%2C000-229%2C362%2C000%22%2C%22tracks%22%3A%5B%7B%22trackId%22%3A%22ngmlr_splitters_cram%22%2C%22displaySnapshot%22%3A%7B%22height%22%3A140%7D%7D%2C%22breast_cancer_sniffles_hg19%22%5D%7D%2C%7B%22assembly%22%3A%22hg19%22%2C%22loc%22%3A%225%3A137%2C877%2C000-137%2C892%2C000%22%2C%22tracks%22%3A%5B%7B%22trackId%22%3A%22ngmlr_splitters_cram%22%2C%22displaySnapshot%22%3A%7B%22height%22%3A140%7D%7D%2C%22breast_cancer_sniffles_hg19%22%5D%7D%5D%7D%5D%7D&sessionName=Screenshot)
— SKBR3 interchromosomal translocation in breakpoint split view (the same
session this figure is captured from)

The header bar accepts location searches directly in either panel.

### Launching the breakpoint split view

- **From the SV inspector** — click a feature in the circular overview or the
  triangle dropdown on any table row. See the
  [SV inspector guide](/docs/user_guides/sv_inspector_view).
- **From variant feature details** — click a BND or TRA variant in a variant
  track; the feature details panel has a button to open the split view,
  automatically loading any open alignment tracks.
- **From alignment feature details** — click any read with a supplementary
  alignment; the feature details panel includes an option to open the split view
  centered on that read and its supplementary partner.

<Figure caption="Feature details panel for a TRA variant. The BREAKENDS section at the bottom contains 'Launch split views with breakend source and target' — clicking that link (e.g. '14:84871468 // 17:74803924 (split view)') opens both breakpoint loci simultaneously in the breakpoint split view, with any open alignment tracks pre-loaded." src="/img/link_to_split_view.png" />

The view also supports **multi-hop events** where a single read has multiple
supplementary alignments, connecting more than two breakpoints simultaneously.

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fbreakpoint%2Fconfig.json&session=share-xeUuLRakik&password=vh0ca)
— multi-hop split read connection in breakpoint split view

## Phasing heterozygous SVs

For heterozygous SVs, confirming that supporting reads come from a single
haplotype is strong evidence for the call. If your BAM/CRAM has been haplotagged
(e.g., with WhatsHap or HiPhase), reads carry an `HP` tag identifying the
haplotype.

Sort and color by the `HP` tag from the track menu. Reads from each haplotype
cluster together, making it easy to see whether an SV is present on one or both
haplotypes.

<Figure caption="Reads colored and sorted by haplotype. Coloring by the HP tag gives one color per haplotype, and sorting by the HP tag stacks each haplotype's reads into contiguous rows, making it easy to see which haplotype carries the variant." src="/img/alignments/haplotype.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE)
— heterozygous small deletion in GIAB colored and sorted by HP tag

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

- Use a **bigWig coverage track** (or a
  [multi-quantitative track](/docs/user_guides/multiquantitative_track) for
  tumor vs normal comparison) instead of a full alignments track when surveying
  the region — it loads at any scale and makes copy-number changes immediately
  visible
- Load the **SV call set as a variant track** for a compact overview of all
  calls; clicking a feature navigates directly to it
- Open the **breakpoint split view** to inspect the breakpoint loci themselves —
  each panel shows only a local window around one end of the SV, so the
  inter-breakpoint distance doesn't matter
- Use the **SV inspector** for whole-genome triage before drilling into
  individual calls

<Figure caption="COLO829 melanoma tumor (red) and matched normal (blue) whole-genome coverage as a multi-quantitative bigWig track. Copy-number changes are visible at chromosome scale without loading any reads." src="/img/cnv.png" />

[Live demo](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64)
— COLO829 tumor vs normal whole-genome coverage

## Whole-genome assembly comparison

When a de novo assembly of the sample is available — for example, a phased tumor
assembly from PacBio HiFi or ONT data — aligning it back to the reference with a
tool like [minimap2](https://github.com/lh3/minimap2) and loading the resulting
PAF as a synteny track gives a chromosome-scale view of rearrangements that
read-level displays cannot. Complex events like chromosomal fusions appear as
off-diagonal blocks in the [dotplot view](/docs/user_guides/dotplot_view), and
clicking and dragging over a region in the dotplot can launch a base-level
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

- **Read-level displays require zooming in**: the pileup, paired arcs, and
  linked reads modes only render when the view is zoomed in enough to load
  individual reads; very large SVs can't be spanned in a single pileup view
- **Paired-end evidence is fragment-size limited**: for insertions larger than
  the sequenced fragment, paired-end evidence disappears; long reads are
  required to fully resolve the inserted sequence
- **Repetitive regions**: SVs in segmental duplications or repeats produce
  noisy, ambiguous signals; soft-clipped reads and orientation anomalies are
  common artefacts in these regions
- **Short-read orientation coloring** assumes `fr` (Illumina) read pairs;
  SOLiD-style orientations are not supported.
