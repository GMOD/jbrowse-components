---
title: Structural variants (1000 Genomes)
sidebar_label: SVs (1000 Genomes)
description: Population SVs, a family trio, and a large chromosomal inversion
guide_category: Tutorials
tutorial_category: Structural variation
---

This tutorial explores structural variants (SVs) from the 1000 Genomes Project
using JBrowse's multi-sample visualization tools. We cover three connected
analyses:

- Browsing population-level SV calls and their genotype distribution
- Examining SV inheritance in a parent–child trio
- Characterizing a large chromosomal inversion on chr19

For SNP-level trio analysis (phased genotypes, IBD blocks, and crossing-over
visualization) see the companion
[Phased trio analysis](/docs/tutorials/analyze_trio) tutorial.

The [Jupyter multi-sample variants example](/docs/jbrowse_jupyter) shows the
same per-sample band and genotype-matrix displays from a VCF, and is available
as a Colab notebook.

## What you need

Nothing to install. The dataset is hosted, and every figure has a live link that
opens the same view in JBrowse.

## Dataset

The [1000 Genomes Project](https://www.internationalgenome.org/) sequenced
genomes from 2,504 individuals across 26 populations. The 2022 high-coverage
re-analysis produced a comprehensive SV callset
([Byrska-Bishop et al., 2022](https://doi.org/10.1016/j.cell.2022.08.004)) that
includes deletions, insertions, inversions, and translocations with per-sample
genotypes across all 3,202 individuals.

For this tutorial we use a pre-configured JBrowse instance that already has the
SV callset and trio alignment tracks loaded, so no data download is required. It
was built with the usual `jbrowse add-track` workflow: the ensemble SV callset
is bgzip-compressed and tabix-indexed on JBrowse's S3, and the trio tracks
stream the published high-coverage CRAMs directly from the 1000 Genomes FTP.

## Getting started

Open the 1000 Genomes demo instance and enable the variant track from the track
selector (top-left menu icon of any linear view):

[Open the 1000 Genomes demo](https://jbrowse.org/code/jb2/latest/?config=/genomes/GRCh38/1000genomes/config_1000genomes.json)

In the track selector, enable the 1KGP 2022 Illumina ensemble SV callset, under
**1000 Genomes → SV callsets**, listed by its file name,
**1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf**. A track of orange SV bars
will appear across the genome.

This walkthrough uses the hosted web demo, but the SV inspector and circular
views shown below work the same in [JBrowse Desktop](/docs/quickstart_desktop),
which is the better fit when you want to explore your own local VCF and BAM
files rather than the demo dataset.

## Browsing SVs with the SV inspector

The SV inspector combines a searchable/filterable table of all calls with a
whole-genome circular overview. Open it from the **Add** menu in the menu bar,
then paste the callset URL into the import form:

```
https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.Illumina_ensemble_callset.freeze_V1.vcf.gz
```

(the same URL is also listed in the track's About track menu). The circular view
renders inter-chromosomal translocations as orange chords. The table can be
sorted and filtered by any column.

<Figure caption="The SV inspector loaded with a large SV callset. The circular plot on the right renders inter-chromosomal events as orange chords connecting the two loci. The table on the left lists every call and can be sorted or filtered by SVTYPE, chromosome, quality, or any INFO field. Clicking a row navigates the linear view to that locus." src="/img/sv_inspector_importform_loaded.png" />

Useful filters to try:

- Type `DEL` in the SVTYPE column to isolate deletions
- Type `INV` to isolate inversions, which appear as arcs within a single
  chromosome arm rather than inter-chromosomal chords
- Click any row to jump directly to that locus in the linear view

For a full walkthrough of loading data into the SV inspector, see the
[SV inspector guide](/docs/user_guides/sv_inspector_view).

## Per-sample genotypes

With the SV track loaded in the linear view, click any variant bar to open its
feature details panel. Scroll to the **SAMPLES** section, which lists every
sample in the cohort with its genotype (GT), read depth, and other per-sample
fields.

To see genotype patterns across many SVs at once, switch the track to the
**Multi-sample variant display (regular)** display from the track menu. Each
sample becomes its own row, making it easy to spot calls that are private to a
single sample, shared within a family, or common across the cohort. See
[Multi-sample variant displays](/docs/user_guides/multivariant_track) for
details on the display modes.

## Inspecting a trio

The demo includes CRAM alignment tracks for many pedigreed trios, under **1000
Genomes → Alignments → Pedigreed** in the track selector, grouped by family id.
Pick one family (for example 1328: `NA12329_child`, `NA06984_father`,
`NA06989_mother`) and load all three to stack them beneath the variant track.

Once you have an SV of interest, check the three trio rows in the SAMPLES table
and the corresponding read tracks:

<Figure caption="Multi-sample SV view with trio alignment tracks loaded. The top track shows the 1KGP SV callset, and the three alignment tracks below are the mother, child, and father. The feature details panel on the right shows the BREAKENDS section (with a link to open the breakpoint split view) and the SAMPLES table listing each sample's GT, depth, and other per-sample fields." src="/img/multi-sv-trio.png" />

| Genotype pattern            | Interpretation                              |
| --------------------------- | ------------------------------------------- |
| Child 0/1, both parents 0/0 | Candidate de novo SV                        |
| Child 0/1, one parent 0/1   | Inherited from that parent                  |
| Child 1/1, both parents 0/1 | Homozygous, inherited copy from each parent |
| Child 0/0                   | Not present in this individual              |

The trio alignment tracks let you verify read-level support for each genotype.
Look for coverage changes, soft-clipped reads, or orientation anomalies in each
family member's track at the SV locus. For a primer on reading these signals,
see the [SV visualization guide](/docs/user_guides/sv_visualization).

For SNP-level trio phasing and IBD block analysis with the matrix display, see
the [Phased trio analysis](/docs/tutorials/analyze_trio) tutorial.

## The chr19 large inversion

The 1KGP SV callset includes a large inversion call on chromosome 19:
`HGSV_72999`, a ~730 kb inversion spanning roughly chr19:41,797,752–42,527,236.
It is an imprecise, manually-flagged call that overlaps neighboring complex
(CPX) events, which makes it a good case for reading the read-level evidence at
the breakpoints rather than trusting the call outright. Navigate to
`chr19:41,700,000–42,000,000` to start at its left breakpoint region.

At this scale the variant track shows the inversion call as a wide bar spanning
the region. Use the **Cluster by genotype** option in the track menu to group
samples into ref/ref (0/0), het (0/1), and hom-alt (1/1) rows, showing the
inversion's frequency across the cohort at a glance.

<Figure caption="chr19 region containing the large inversion shown in the 1KGP SV callset alongside pileup tracks from multiple samples. The track selector panel on the right shows the 1000 Genomes track categories, and enabling 1000 Genomes → Alignments adds coverage and pileup panels per sample." src="/img/multisv.png" />

Setting the display's cell coloring to **SV type** paints each alt-carrying cell
by its variant's structural-variant class, so the whole window becomes a map of
what kind of SV sits where, and the legend names each class present. The large
inversion stands out as a solid band in the inversion color.

<Figure caption="The same chr19 window with the multi-sample variant display colored by SV type. Each alt-carrying cell takes the color of its variant class, and the legend names the classes present: deletions, duplications, insertions, inversions, copy-number, and complex (CPX) events. The large inversion is the orange band." src="/img/multisv_svtype.png" />

### Read orientation evidence at the breakpoints

Zoom in to one of the inversion breakpoints (the call's endpoints, roughly
chr19:41,797,752 and chr19:42,527,236) and enable pair-orientation coloring on a
BAM track from the track menu. At the breakpoint you will see:

- Green (LL) pairs, both mates mapping to the forward strand, and dark blue (RR)
  pairs, both mates mapping to the reverse strand, cluster at the junction.
  These are the hallmark orientation signal of an inversion: reads that straddle
  the breakpoint change from the normal LR orientation to same-direction LL or
  RR.
- Soft-clipped reads at the exact breakpoint edge, where reads cannot align
  through the junction sequence

Enable paired arcs from the track menu's **Read connections** submenu to see
long-range connections spanning the inversion. Arcs with LL/RR coloring that
span the inverted interval confirm the rearrangement.

See the
[SV visualization guide, Inversion section](/docs/user_guides/sv_visualization#inversion)
for diagrams of these orientation patterns.

### Breakpoint split view

Click the inversion bar in the variant track to open feature details. In the
**BREAKENDS** section, click the split view link. This opens both inversion
breakpoints side-by-side in synchronized panels, with splines connecting
supporting reads across both panels and the variant call drawn as a colored line
with directional feet.

For more on navigating the breakpoint split view, see
[Breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view).

## Summary

| Step                    | Tool                                   | What to look for                                             |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------ |
| Population triage       | SV inspector table + circular view     | SV type counts, inter-chr translocations as chords           |
| Per-sample genotypes    | Feature details → SAMPLES              | GT 0/0 / 0/1 / 1/1 across all 3,202 samples                  |
| Genotype patterns       | Multi-sample display (regular)         | High-frequency vs private calls, row pattern per sample      |
| Trio inheritance        | Trio BAM tracks + SAMPLES table        | De novo vs inherited, which parent contributed the alt       |
| Inversion genotyping    | Cluster by genotype                    | Alt-genotype samples grouped into distinct rows              |
| Inversion read evidence | Pair orientation coloring, paired arcs | LL/RR pairs at breakpoints, long arcs spanning the inversion |
| Breakpoint detail       | Breakpoint split view                  | Splines + variant call across both junctions                 |

## See also

- [SV visualization guide](/docs/user_guides/sv_visualization)
- [SV inspector guide](/docs/user_guides/sv_inspector_view)
- [Multi-sample variant displays](/docs/user_guides/multivariant_track)
- [Phased trio analysis](/docs/tutorials/analyze_trio)
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab)
