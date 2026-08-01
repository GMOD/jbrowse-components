---
title: Structural variants (1000 Genomes)
sidebar_label: SVs (1000 Genomes)
description:
  Read one large chromosomal inversion across 3,202 samples, from the callset
  down to the reads at its breakpoints
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** take one large chr19 inversion out of the 1000 Genomes ensemble SV
callset, cluster its genotypes across 3,202 samples, and then check the call
against the read orientation at both breakpoints rather than trusting it.
Everything runs on a hosted demo, so no data download is needed.

## Prerequisites

- nothing to install: the demo instance already carries the callset and the
  alignments

## The dataset and the call

The [1000 Genomes Project](https://www.internationalgenome.org/) sequenced
genomes from 2,504 individuals across 26 populations. The 2022 high-coverage
re-analysis produced a comprehensive SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004)) that
includes deletions, insertions, inversions, and translocations with per-sample
genotypes across all 3,202 individuals.

`HGSV_72999` is a roughly 730 kb inversion spanning chr19:41,797,752-42,527,236.
It is an imprecise, manually-flagged call that overlaps neighboring complex
(CPX) events, which is what makes it worth following: a call like this is a
claim to be checked against the reads, not a result to read off.

The tracks are already loaded in the hosted demo, built with the usual
`jbrowse add-track` workflow. The callset is bgzip-compressed and tabix-indexed
on JBrowse's S3, and the alignment tracks stream the published high-coverage
CRAMs directly from the 1000 Genomes FTP.

[Open the 1000 Genomes demo](https://jbrowse.org/code/jb2/latest/?config=/genomes/GRCh38/1000genomes/config_1000genomes.json)

In the track selector, enable the 1KGP 2022 Illumina ensemble SV callset under
**1000 Genomes → SV callsets**, listed by its file name
**1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf**, then navigate to
`chr19:41,700,000-42,000,000` to start at the left breakpoint region.

This walkthrough uses the hosted web demo, but everything below works the same
in [JBrowse Desktop](/docs/quickstart_desktop), which is the better fit for your
own VCF and BAM files.

## Genotypes across the cohort

Switch the track to the **Multi-sample variant display (regular)** from the
track menu. Each sample becomes a row, drawn at the variant's real genomic span,
so the inversion is a wide bar rather than a tick. Clicking it opens the feature
details panel, whose **SAMPLES** section lists every sample with its genotype,
read depth, and other per-sample fields.

Rows arrive in the callset's own order, which encodes nothing, so run
**Clustering → Cluster rows by genotype...** in the track menu. That groups
ref/ref, het, and hom-alt samples into contiguous bands and turns the
inversion's cohort frequency into something readable at a glance.

<Figure caption="chr19 region containing the large inversion shown in the 1KGP SV callset alongside pileup tracks from multiple samples. The track selector panel on the right shows the 1000 Genomes track categories, and enabling 1000 Genomes → Alignments adds coverage and pileup panels per sample." src="/img/multisv.png" />

Setting the display's cell coloring to **SV type** paints each alt-carrying cell
by its variant's structural-variant class, so the whole window becomes a map of
what kind of SV sits where and the legend names each class present.

<Figure caption="The same chr19 window with the multi-sample variant display colored by SV type. Each alt-carrying cell takes the color of its variant class, and the legend names the classes present: deletions, duplications, insertions, inversions, copy-number, and complex (CPX) events. The large inversion is the orange band." src="/img/multisv_svtype.png" />

The inversion is the orange band. The CPX events it overlaps are a separate
color in the same window, which is the visual form of the caveat above: the
region holds more than one call and they are not independent.

## Read orientation evidence at the breakpoints

The genotypes are the caller's answer. The reads are what it read, and they are
in the demo too, so the call can be checked rather than accepted.

Zoom to one breakpoint (roughly chr19:41,797,752 and chr19:42,527,236) and
enable pair-orientation coloring on a BAM track from the track menu. At the
junction you will see:

- Green (LL) pairs, both mates mapping to the forward strand, and dark blue (RR)
  pairs, both mates mapping to the reverse strand, clustered at the junction.
  These are the hallmark orientation signal of an inversion: reads that straddle
  the breakpoint change from the normal LR orientation to same-direction LL or
  RR.
- Soft-clipped reads at the exact breakpoint edge, where reads cannot align
  through the junction sequence.

Enable paired arcs from the track menu's **Read connections** submenu to see
long-range connections spanning the inversion. Arcs with LL/RR coloring that
span the inverted interval are the confirmation the imprecise call needed.

See the
[SV visualization guide, Inversion section](/docs/user_guides/sv_visualization#inversion)
for diagrams of these orientation patterns.

## Breakpoint split view

Click the inversion bar in the variant track to open feature details. In the
**BREAKENDS** section, click the split view link. This opens both breakpoints
side-by-side in synchronized panels, with splines connecting supporting reads
across both panels and the variant call drawn as a colored line with directional
feet. It is the same evidence as above with both junctions on screen at once.

For more on navigating it, see
[Breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view).

## Where to go next

- The whole callset rather than one call: the
  [SV inspector](/docs/user_guides/sv_inspector_view) pairs a filterable table
  of every SV with a circular whole-genome overview, and takes this callset's
  URL straight from the track's **About track** menu.
- The same cohort's inheritance patterns: [](/docs/tutorials/analyze_trio)
  follows phased genotypes and IBD blocks through a trio, and
  [SV inheritance in a trio](/docs/user_guides/sv_visualization) reads the same
  question off trio alignments.
- The [Jupyter multi-sample variants example](/docs/jbrowse_jupyter) renders the
  same per-sample and matrix displays from a VCF in a notebook.

## See also

- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [Multi-sample variant displays](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/analyze_trio)
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab)
